import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import nodemailer from "nodemailer";
import {createHash} from "node:crypto";
import {isVerifiedGoogleIdentity} from "./authPolicy";
import {
  canProposeCompletion,
  canProposeHire,
  canRespondToCompletion,
  canRespondToHire,
  canRespondToMatchState,
  canReviewMatch,
  isSelfDeclaredCredentialType,
  isTerminalMatchState,
  MATCH_STATES,
  nextMatchState,
  parseCompletionDecision,
  parseCredentialDecision,
  parseHireDecision,
  parseMatchDecision,
} from "./matchPolicy";
import {
  canBootstrapLegacyMembership,
  canManageCompanyMembership,
  hasActiveCompanyAuthority,
  isActiveCompany,
  isActiveCompanyMembership,
} from "./accessPolicy";

import * as admin from "firebase-admin";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentReference,
  type Transaction,
} from "firebase-admin/firestore";
import {evaluateEligibility, type EligibilityReason} from "./jobPolicy";

export {upsertWorkerIdentity} from "./workerIdentity";

admin.initializeApp();

const db = getFirestore();

// ===== Email (Gmail SMTP) =====
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GMAIL_USER = "agroconnect@gmail.com";
const GMAIL_REPLY_TO = "fecepedac@gmail.com";
const DEFAULT_FROM_NAME = "AgroConnect";
const SUPERADMIN_EMAILS_PARAM = defineString("SUPERADMIN_EMAILS", {
  default: "",
});

function isSuperAdminToken(token: any): boolean {
  const role = String(token?.role || "").toLowerCase();
  return (
    token?.admin === true ||
    token?.superadmin === true ||
    role === "admin" ||
    role === "superadmin"
  );
}

async function hasCurrentSuperadminClaims(uid: string): Promise<boolean> {
  const currentUser = await admin.auth().getUser(uid);
  return isSuperAdminToken(currentUser.customClaims || {});
}

async function assertAuthenticated(request: any) {
  const user = request.auth;
  if (!user?.uid || !user?.token?.email) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  return user;
}

function normalizeEmail(input: unknown): string {
  return String(input || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSuperadminEmails(): string[] {
  const raw = String(SUPERADMIN_EMAILS_PARAM.value() || "").trim();
  if (!raw) return [];

  const parsed = raw
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter((email) => isValidEmail(email));

  return parsed;
}


async function callGeminiText(apiKey: string, prompt: string, temperature = 0.3): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new HttpsError("internal", `Gemini error: ${text.slice(0, 500)}`);
  }

  const data = (await response.json()) as any;
  const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!contentText) {
    throw new HttpsError("internal", "Respuesta vacía desde Gemini.");
  }
  return contentText.trim();
}

async function getReplyToEmail(): Promise<string> {
  try {
    const snap = await db.collection("admin").doc("config").get();
    const config = snap.exists ? (snap.data() as any) : null;
    const replyTo = String(config?.notificationEmail || "").trim();
    return replyTo || GMAIL_REPLY_TO;
  } catch (e) {
    console.error("getReplyToEmail error:", e);
    return GMAIL_REPLY_TO;
  }
}

/**
 * =========================
 *  AUTH / ACCESS
 * =========================
 * Callable: syncUserAccess
 *
 * Objetivo:
 * - Cerrar el ciclo de acceso SIN tocar firestore.rules por cada empresa nueva.
 * - El SUPERADMIN crea la empresa con adminEmail.
 * - Cuando ese adminEmail inicia sesión con Google:
 *   se crea/actualiza users/{uid} con:
 *   - role: "company_admin"
 *   - companyId
 *
 * Nota:
 * - El superadmin hoy se controla en firestore.rules vía email allowlist.
 */
export const syncUserAccess = onCall(async (request) => {
  const user = request.auth;
  if (!user?.uid || !user?.token?.email) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const email = String(user.token.email).toLowerCase();
  const trustedCompanyIdentity = isVerifiedGoogleIdentity(user.token);

  const userRef = db.collection("users").doc(user.uid);
  const existing = await userRef.get();
  const preferredCompanyId = String(existing.data()?.activeCompanyId || "");

  let role: "company_admin" | "company_hr" | "worker" | "none" = "worker";
  let companyId: string | null = null;

  if (trustedCompanyIdentity) {
    const memberships = await db
      .collectionGroup("company_members")
      .where("uid", "==", user.uid)
      .limit(20)
      .get();
    const activeMemberships = memberships.docs.filter(
      (doc) => isActiveCompanyMembership(doc.data())
    );
    const companySnapshots = await Promise.all(activeMemberships.map(
      (membership) => db.collection("companies")
        .doc(String(membership.ref.parent.parent?.id || "__invalid__"))
        .get()
    ));
    const authorizedMemberships = activeMemberships.filter(
      (_membership, index) => isActiveCompany(companySnapshots[index].data())
    );
    const selectedMembership =
      authorizedMemberships.find(
        (doc) => doc.ref.parent.parent?.id === preferredCompanyId
      ) || authorizedMemberships[0];

    if (selectedMembership) {
      companyId = selectedMembership.ref.parent.parent?.id || null;
      role = selectedMembership.data()?.role === "company_hr"
        ? "company_hr"
        : "company_admin";
    } else {
      // Compatibility bootstrap: convert the legacy adminEmail assignment into
      // an explicit membership the first time the verified admin signs in.
      const companySnap = await db
        .collection("companies")
        .where("adminEmail", "==", email)
        .limit(1)
        .get();
      if (!companySnap.empty && isActiveCompany(companySnap.docs[0].data())) {
        companyId = companySnap.docs[0].id;
        const legacyMemberRef = companySnap.docs[0].ref
          .collection("company_members")
          .doc(user.uid);
        const legacyMember = await legacyMemberRef.get();
        // Never reactivate a membership that an administrator explicitly
        // suspended or removed.
        if (canBootstrapLegacyMembership(legacyMember.exists ? legacyMember.data() : null)) {
          role = "company_admin";
          await legacyMemberRef.set({
            uid: user.uid,
            companyId,
            email,
            role,
            status: "active",
            createdByUid: "legacy_admin_email_bootstrap",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            activatedAt: FieldValue.serverTimestamp(),
            schemaVersion: 1,
          }, {merge: true});
        } else {
          companyId = null;
        }
      }
    }
  }

  const payload: any = {
    role,
    companyId,
    activeCompanyId: companyId,
    email,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }

  await userRef.set(payload, { merge: true });

  // Keep Auth claims aligned with Firestore role/companyId.
  // Do not degrade superadmin/admin privileges in this flow.
  let claimsUpdated = false;
  const auth = admin.auth();
  const current = await auth.getUser(user.uid);
  const existingClaims = current.customClaims || {};
  const existingRole = String(existingClaims.role || "").toLowerCase();
  const userHasElevatedClaims =
    existingClaims.admin === true ||
    existingClaims.superadmin === true ||
    existingRole === "admin" ||
    existingRole === "superadmin";

  if (!userHasElevatedClaims) {
    const nextClaims: Record<string, any> = {
      ...existingClaims,
      role,
      companyId,
    };

    await auth.setCustomUserClaims(user.uid, nextClaims);
    claimsUpdated = true;
  }

  return { ok: true, role, companyId, claimsUpdated };
});

export const setCompanyMember = onCall(async (request) => {
  const caller = await assertAuthenticated(request);
  if (!isVerifiedGoogleIdentity(caller.token)) {
    throw new HttpsError(
      "permission-denied",
      "La gestión de miembros requiere una cuenta Google verificada."
    );
  }

  const companyId = String(request.data?.companyId || "").trim();
  const targetEmail = normalizeEmail(request.data?.email);
  const role = request.data?.role === "company_hr"
    ? "company_hr"
    : "company_admin";
  const requestedStatus = String(request.data?.status || "active");
  if (
    !companyId ||
    !isValidEmail(targetEmail) ||
    !["active", "suspended", "removed"].includes(requestedStatus)
  ) {
    throw new HttpsError("invalid-argument", "Datos de membresía inválidos.");
  }

  const callerMembership = await db
    .collection("companies")
    .doc(companyId)
    .collection("company_members")
    .doc(caller.uid)
    .get();
  const callerIsSuperadmin = await hasCurrentSuperadminClaims(caller.uid);
  const company = await db.collection("companies").doc(companyId).get();
  const canManage = callerIsSuperadmin ||
    (
      callerMembership.exists &&
      canManageCompanyMembership(callerMembership.data()) &&
      isActiveCompany(company.data())
    );
  if (!canManage) {
    throw new HttpsError("permission-denied", "No puedes gestionar esta empresa.");
  }

  let targetUser;
  try {
    targetUser = await admin.auth().getUserByEmail(targetEmail);
  } catch (_error) {
    throw new HttpsError(
      "failed-precondition",
      "El usuario debe ingresar con Google antes de ser agregado."
    );
  }
  if (
    requestedStatus === "active" &&
    (!targetUser.emailVerified ||
      !targetUser.providerData.some((provider) => provider.providerId === "google.com"))
  ) {
    throw new HttpsError(
      "failed-precondition",
      "El miembro debe tener una cuenta Google verificada."
    );
  }

  const memberRef = db
    .collection("companies")
    .doc(companyId)
    .collection("company_members")
    .doc(targetUser.uid);
  const previous = await memberRef.get();
  await memberRef.set({
    uid: targetUser.uid,
    companyId,
    email: targetEmail,
    role,
    status: requestedStatus,
    createdByUid: previous.data()?.createdByUid || caller.uid,
    createdAt: previous.data()?.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    activatedAt: requestedStatus === "active"
      ? FieldValue.serverTimestamp()
      : previous.data()?.activatedAt || null,
    suspendedAt: requestedStatus === "suspended"
      ? FieldValue.serverTimestamp()
      : null,
    removedAt: requestedStatus === "removed"
      ? FieldValue.serverTimestamp()
      : null,
    schemaVersion: 1,
  }, {merge: true});

  if (requestedStatus !== "active") {
    const targetUserRef = db.collection("users").doc(targetUser.uid);
    const targetUserData = (await targetUserRef.get()).data() || {};
    if (targetUserData.companyId === companyId || targetUserData.activeCompanyId === companyId) {
      await targetUserRef.set({
        role: "worker",
        companyId: null,
        activeCompanyId: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    }
    const currentClaims = targetUser.customClaims || {};
    const currentRole = String(currentClaims.role || "");
    if (!["admin", "superadmin"].includes(currentRole)) {
      const nextClaims = {...currentClaims};
      delete nextClaims.companyId;
      nextClaims.role = "worker";
      await admin.auth().setCustomUserClaims(targetUser.uid, nextClaims);
    }
    await admin.auth().revokeRefreshTokens(targetUser.uid);
  }
  await db.collection("admin_audit").add({
    action: "set_company_member",
    companyId,
    targetUid: targetUser.uid,
    targetEmail,
    role,
    status: requestedStatus,
    performedByUid: caller.uid,
    performedAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    uid: targetUser.uid,
    companyId,
    role,
    status: requestedStatus,
  };
});

export const recordBillingEntry = onCall(async (request) => {
  const caller = await assertAuthenticated(request);
  if (
    !isVerifiedGoogleIdentity(caller.token) ||
    !await hasCurrentSuperadminClaims(caller.uid)
  ) {
    throw new HttpsError(
      "permission-denied",
      "La facturación requiere un SuperAdmin con Google verificado."
    );
  }

  const companyId = String(request.data?.companyId || "").trim();
  const type = request.data?.type === "payment" ? "payment" : "invoice";
  const amount = Number(request.data?.amount);
  const issuedAt = String(request.data?.issuedAt || "").trim();
  const dueAt = String(request.data?.dueAt || "").trim();
  const paidAt = String(request.data?.paidAt || "").trim();
  const reference = String(request.data?.reference || "").trim().slice(0, 160);
  const note = String(request.data?.note || "").trim().slice(0, 1000);
  const idempotencyKey = String(request.data?.idempotencyKey || "").trim();
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (
    !companyId ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > 2_000_000_000 ||
    !datePattern.test(issuedAt) ||
    (dueAt && !datePattern.test(dueAt)) ||
    (paidAt && !datePattern.test(paidAt)) ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)
  ) {
    throw new HttpsError("invalid-argument", "Datos de facturación inválidos.");
  }

  const companyRef = db.collection("companies").doc(companyId);
  const company = await companyRef.get();
  if (!company.exists) {
    throw new HttpsError("not-found", "La empresa no existe.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const status = type === "payment"
    ? "paid"
    : dueAt && dueAt < today
      ? "overdue"
      : "unpaid";
  const targetCollection = type === "payment"
    ? "billing_payments"
    : "billing_invoices";
  const targetRef = companyRef.collection(targetCollection).doc();
  const eventRef = db.collection("billing_events").doc(idempotencyKey);
  const auditRef = db.collection("admin_audit").doc();

  const result = await db.runTransaction(async (transaction) => {
    const existingEvent = await transaction.get(eventRef);
    if (existingEvent.exists) {
      return {
        duplicate: true,
        recordId: String(existingEvent.data()?.recordId || ""),
      };
    }

    transaction.create(targetRef, {
      companyId,
      type,
      amount,
      currency: "CLP",
      issuedAt,
      dueAt: dueAt || null,
      paidAt: type === "payment" ? (paidAt || issuedAt) : null,
      status,
      reference: reference || null,
      note: note || null,
      source: "manual_admin",
      idempotencyKey,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: {
        uid: caller.uid,
        email: normalizeEmail(caller.token.email),
      },
      schemaVersion: 1,
    });
    transaction.create(eventRef, {
      companyId,
      type,
      recordId: targetRef.id,
      source: "manual_admin",
      processedAt: FieldValue.serverTimestamp(),
      processedByUid: caller.uid,
      schemaVersion: 1,
    });
    transaction.create(auditRef, {
      action: "record_billing_entry",
      companyId,
      recordId: targetRef.id,
      billingType: type,
      amount,
      status,
      performedByUid: caller.uid,
      performedAt: FieldValue.serverTimestamp(),
    });

    if (type === "invoice" && status === "overdue") {
      transaction.set(companyRef, {
        status: "overdue",
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      transaction.set(companyRef.collection("billing").doc("account"), {
        companyId,
        status: "past_due",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "admin",
        schemaVersion: 1,
      }, {merge: true});
    }

    return {duplicate: false, recordId: targetRef.id};
  });

  return {ok: true, ...result, status};
});

async function hasCompanyAccess(uid: string, companyId: string): Promise<boolean> {
  if (!companyId) return false;
  const companyRef = db.collection("companies").doc(companyId);
  const [company, membership] = await Promise.all([
    companyRef.get(),
    companyRef.collection("company_members").doc(uid).get(),
  ]);
  return company.exists && membership.exists &&
    hasActiveCompanyAuthority(membership.data(), company.data());
}

async function assertSuperadmin(request: any) {
  const user = await assertAuthenticated(request);
  if (!await hasCurrentSuperadminClaims(user.uid)) {
    throw new HttpsError("permission-denied", "Acceso exclusivo de SuperAdmin.");
  }
  return user;
}

async function deleteDocumentRefs(
  refs: DocumentReference[]
): Promise<void> {
  for (let index = 0; index < refs.length; index += 400) {
    const batch = db.batch();
    refs.slice(index, index + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function hasAnyCompanyAccess(uid: string): Promise<boolean> {
  const memberships = await db.collectionGroup("company_members")
    .where("uid", "==", uid)
    .limit(20)
    .get();
  const activeMemberships = memberships.docs.filter((membership) =>
    isActiveCompanyMembership(membership.data())
  );
  const companies = await Promise.all(activeMemberships.map(
    (membership) => db.collection("companies")
      .doc(String(membership.ref.parent.parent?.id || "__invalid__"))
      .get()
  ));
  return companies.some((company) => isActiveCompany(company.data()));
}

function matchIdFor(companyId: string, jobId: string, workerId: string): string {
  return [companyId, jobId, workerId].join("_");
}

const ELIGIBILITY_REASON_LABELS: Record<EligibilityReason, string> = {
  company_inactive: "la empresa no está activa",
  job_inactive: "la oferta no está activa",
  job_full: "la oferta no tiene cupos disponibles",
  worker_unavailable: "el trabajador figura como no disponible",
  matching_consent_required: "falta el consentimiento para participar en matches",
  sector_mismatch: "el sector del perfil no coincide con la oferta",
  os10_required: "se requiere OS10 vigente",
  credential_required: "faltan credenciales activas requeridas",
};

function jobRequiresCredentials(job: Record<string, unknown>): boolean {
  return Array.isArray(job.requiredCredentialTypes) &&
    job.requiredCredentialTypes.some((value) => String(value || "").trim());
}

async function getActiveWorkerCredentials(
  transaction: Transaction,
  workerId: string,
  job: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  if (!jobRequiresCredentials(job)) return [];

  const credentials = await transaction.get(
    db.collection("worker_credentials")
      .where("workerId", "==", workerId)
      .where("status", "==", "active")
      .limit(100)
  );
  return credentials.docs.map((credential) => credential.data());
}

function assertEligibleForJob(input: {
  company: unknown;
  job: unknown;
  worker: unknown;
  credentials: unknown[];
}): void {
  const result = evaluateEligibility(input);
  if (result.eligible) return;

  const explanation = result.reasons
    .map((reason) => ELIGIBILITY_REASON_LABELS[reason])
    .join("; ");
  throw new HttpsError(
    "failed-precondition",
    `No se puede continuar: ${explanation}.`,
    {reasons: result.reasons, policyVersion: result.policyVersion}
  );
}

export const applyToJob = onCall(async (request) => {
  const worker = await assertAuthenticated(request);
  const companyId = String(request.data?.companyId || "").trim();
  const jobId = String(request.data?.jobId || "").trim();
  if (!companyId || !jobId) {
    throw new HttpsError("invalid-argument", "Oferta inválida.");
  }

  const companyRef = db.collection("companies").doc(companyId);
  const jobRef = companyRef.collection("jobs").doc(jobId);
  const workerRef = db.collection("workers").doc(worker.uid);
  const matchId = matchIdFor(companyId, jobId, worker.uid);
  const matchRef = db.collection("matches").doc(matchId);
  const workerApplicationRef = workerRef.collection("applications").doc(
    companyId + "_" + jobId
  );
  const companyApplicationRef = jobRef.collection("applications").doc(
    worker.uid
  );

  await db.runTransaction(async (transaction) => {
    const [company, job, workerProfile, existingMatch] = await Promise.all([
      transaction.get(companyRef),
      transaction.get(jobRef),
      transaction.get(workerRef),
      transaction.get(matchRef),
    ]);
    if (!company.exists || company.data()?.status !== "active") {
      throw new HttpsError("failed-precondition", "La empresa no está habilitada.");
    }
    if (
      !job.exists ||
      (job.data()?.isActive !== true && job.data()?.jobStatus !== "active") ||
      job.data()?.publishPublic !== true
    ) {
      throw new HttpsError("failed-precondition", "La oferta ya no está disponible.");
    }
    if (!workerProfile.exists) {
      throw new HttpsError("failed-precondition", "Completa tu perfil antes de postular.");
    }
    if (
      existingMatch.exists &&
      !["withdrawn", "declined", "expired", "closed"].includes(
        String(existingMatch.data()?.state || "")
      )
    ) {
      return;
    }

    const jobData = job.data() || {};
    const credentials = await getActiveWorkerCredentials(
      transaction,
      worker.uid,
      jobData
    );
    assertEligibleForJob({
      company: company.data(),
      job: jobData,
      worker: workerProfile.data(),
      credentials,
    });

    const application = {
      jobId,
      companyId,
      jobTitle: String(jobData.title || ""),
      companyName: String(company.data()?.name || ""),
      workerId: worker.uid,
      appliedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      status: "postulado",
    };
    transaction.set(matchRef, {
      companyId,
      jobId,
      workerId: worker.uid,
      jobTitle: String(jobData.title || ""),
      companyName: String(company.data()?.name || ""),
      source: "worker_application",
      state: "worker_interested",
      workerDecision: "interested",
      companyDecision: "pending",
      createdAt: existingMatch.data()?.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ),
      lastActionBy: "worker",
      lastActionByUid: worker.uid,
      schemaVersion: 1,
    }, {merge: true});
    transaction.set(workerApplicationRef, application, {merge: true});
    transaction.set(companyApplicationRef, application, {merge: true});
  });

  return {ok: true, matchId, state: "worker_interested"};
});

export const inviteWorkerToJob = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const companyId = String(request.data?.companyId || "").trim();
  const jobId = String(request.data?.jobId || "").trim();
  const workerId = String(request.data?.workerId || "").trim();
  if (!companyId || !jobId || !workerId) {
    throw new HttpsError("invalid-argument", "Invitación inválida.");
  }
  if (!(await hasCompanyAccess(actor.uid, companyId))) {
    throw new HttpsError("permission-denied", "No representas a esta empresa.");
  }

  const companyRef = db.collection("companies").doc(companyId);
  const jobRef = companyRef.collection("jobs").doc(jobId);
  const workerRef = db.collection("workers").doc(workerId);
  const matchId = matchIdFor(companyId, jobId, workerId);
  const matchRef = db.collection("matches").doc(matchId);
  await db.runTransaction(async (transaction) => {
    const [company, job, worker, existing] = await Promise.all([
      transaction.get(companyRef),
      transaction.get(jobRef),
      transaction.get(workerRef),
      transaction.get(matchRef),
    ]);
    if (!company.exists || company.data()?.status !== "active") {
      throw new HttpsError("failed-precondition", "La empresa no está habilitada.");
    }
    if (
      !job.exists ||
      (job.data()?.isActive !== true && job.data()?.jobStatus !== "active")
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Selecciona una oferta activa antes de invitar."
      );
    }
    if (!worker.exists) {
      throw new HttpsError("not-found", "El trabajador ya no está disponible.");
    }
    if (
      existing.exists &&
      existing.data()?.companyDecision === "interested" &&
      !isTerminalMatchState(existing.data()?.state)
    ) {
      return;
    }

    const jobData = job.data() || {};
    const credentials = await getActiveWorkerCredentials(
      transaction,
      workerId,
      jobData
    );
    assertEligibleForJob({
      company: company.data(),
      job: jobData,
      worker: worker.data(),
      credentials,
    });

    const workerDecision = existing.data()?.workerDecision || "pending";
    const state = workerDecision === "interested"
      ? "matched"
      : "company_interested";
    transaction.set(matchRef, {
      companyId,
      jobId,
      workerId,
      jobTitle: String(jobData.title || ""),
      companyName: String(company.data()?.name || ""),
      source: existing.data()?.source || "company_invitation",
      state,
      workerDecision,
      companyDecision: "interested",
      createdAt: existing.data()?.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      matchedAt: state === "matched"
        ? FieldValue.serverTimestamp()
        : existing.data()?.matchedAt || null,
      expiresAt: Timestamp.fromMillis(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ),
      lastActionBy: "company",
      lastActionByUid: actor.uid,
      schemaVersion: 1,
    }, {merge: true});
    if (state === "matched") {
      const profile = worker.data() || {};
      transaction.set(
        companyRef.collection("contact_grants").doc(matchId),
        {
          matchId,
          companyId,
          jobId,
          workerId,
          status: "active",
          contact: {
            phone: profile.phone || null,
            email: profile.email || null,
            preferredChannel: profile.phone ? "whatsapp" : "email",
          },
          reason: "mutual_match",
          grantedAt: FieldValue.serverTimestamp(),
          expiresAt: Timestamp.fromMillis(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ),
          schemaVersion: 1,
        },
        {merge: true}
      );
    }
  });
  return {ok: true, matchId};
});

export const respondToMatch = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const matchId = String(request.data?.matchId || "").trim();
  const decision = parseMatchDecision(request.data?.decision);
  if (!matchId || !decision) {
    throw new HttpsError("invalid-argument", "Match inválido.");
  }

  const matchRef = db.collection("matches").doc(matchId);
  const initialMatch = await matchRef.get();
  if (!initialMatch.exists) {
    throw new HttpsError("not-found", "El match no existe.");
  }
  const initial = initialMatch.data() || {};
  const isWorkerActor = initial.workerId === actor.uid;
  const isCompanyActor = !isWorkerActor &&
    await hasCompanyAccess(actor.uid, initial.companyId);
  if (!isWorkerActor && !isCompanyActor) {
    throw new HttpsError("permission-denied", "No puedes responder este match.");
  }

  let nextState = "";
  await db.runTransaction(async (transaction) => {
    const currentSnap = await transaction.get(matchRef);
    const current = currentSnap.data() || {};
    if (isTerminalMatchState(current.state)) {
      throw new HttpsError("failed-precondition", "El match ya está cerrado.");
    }
    if (!canRespondToMatchState(current.state)) {
      throw new HttpsError("failed-precondition", "El match ya no admite nuevas decisiones.");
    }

    const workerDecision = isWorkerActor ? decision : current.workerDecision;
    const companyDecision = isCompanyActor ? decision : current.companyDecision;
    nextState = decision === "declined"
      ? "declined"
      : nextMatchState(workerDecision, companyDecision);
    const update: Record<string, any> = {
      workerDecision,
      companyDecision,
      state: nextState,
      updatedAt: FieldValue.serverTimestamp(),
      lastActionBy: isWorkerActor ? "worker" : "company",
      lastActionByUid: actor.uid,
    };
    if (nextState === "matched") {
      update.matchedAt = FieldValue.serverTimestamp();
      const workerProfile = await transaction.get(
        db.collection("workers").doc(current.workerId)
      );
      const profile = workerProfile.data() || {};
      transaction.set(
        db.collection("companies").doc(current.companyId)
          .collection("contact_grants").doc(matchId),
        {
          matchId,
          companyId: current.companyId,
          jobId: current.jobId,
          workerId: current.workerId,
          status: "active",
          contact: {
            phone: profile.phone || null,
            email: profile.email || null,
            preferredChannel: profile.phone ? "whatsapp" : "email",
          },
          reason: "mutual_match",
          grantedAt: FieldValue.serverTimestamp(),
          expiresAt: Timestamp.fromMillis(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ),
          schemaVersion: 1,
        },
        {merge: true}
      );
    }
    transaction.update(matchRef, update);
  });

  return {ok: true, matchId, state: nextState};
});

async function proposeMatchHireHandler(request: any) {
  const actor = await assertAuthenticated(request);
  const matchId = String(request.data?.matchId || "").trim();
  if (!matchId) throw new HttpsError("invalid-argument", "Match inválido.");

  const matchRef = db.collection("matches").doc(matchId);
  const initial = await matchRef.get();
  if (!initial.exists) throw new HttpsError("not-found", "El match no existe.");
  const companyId = String(initial.data()?.companyId || "");
  if (!(await hasCompanyAccess(actor.uid, companyId))) {
    throw new HttpsError("permission-denied", "No representas a esta empresa.");
  }

  const companyRef = db.collection("companies").doc(companyId);
  const membershipRef = companyRef.collection("company_members").doc(actor.uid);
  const auditRef = db.collection("admin_audit").doc();
  const result = await db.runTransaction(async (transaction) => {
    const [match, company, membership] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(companyRef),
      transaction.get(membershipRef),
    ]);
    if (!match.exists) throw new HttpsError("not-found", "El match no existe.");
    const data = match.data() || {};
    if (!hasActiveCompanyAuthority(membership.data(), company.data())) {
      throw new HttpsError("permission-denied", "Tu acceso a la empresa ya no está activo.");
    }
    if (data.state === MATCH_STATES.HIRE_PROPOSED) return {alreadyProposed: true};
    if ([MATCH_STATES.HIRED, MATCH_STATES.COMPLETION_PROPOSED,
      MATCH_STATES.COMPLETION_DISPUTED, MATCH_STATES.COMPLETED].includes(data.state)) {
      return {alreadyProposed: true, alreadyHired: true};
    }
    if (!canProposeHire(data.state)) {
      throw new HttpsError(
        "failed-precondition",
        "Solo puedes proponer contratación cuando ambas partes están interesadas."
      );
    }
    transaction.update(matchRef, {
      state: MATCH_STATES.HIRE_PROPOSED,
      hireProposedAt: FieldValue.serverTimestamp(),
      hireProposedByUid: actor.uid,
      updatedAt: FieldValue.serverTimestamp(),
      lastActionBy: "company",
      lastActionByUid: actor.uid,
    });
    transaction.create(auditRef, {
      action: "hire_proposed",
      matchId,
      companyId,
      jobId: data.jobId,
      workerId: data.workerId,
      performedByUid: actor.uid,
      performedAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    });
    return {alreadyProposed: false};
  });
  return {ok: true, matchId, state: MATCH_STATES.HIRE_PROPOSED, ...result};
}

export const proposeMatchHire = onCall(proposeMatchHireHandler);

// Compatibilidad: el endpoint legado ahora solo propone y nunca consume cupos.
export const markMatchHired = onCall(proposeMatchHireHandler);

export const respondToHireProposal = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const matchId = String(request.data?.matchId || "").trim();
  const decision = parseHireDecision(request.data?.decision);
  if (!matchId || !decision) {
    throw new HttpsError("invalid-argument", "Respuesta de contratación inválida.");
  }

  const matchRef = db.collection("matches").doc(matchId);
  const initial = await matchRef.get();
  if (!initial.exists) throw new HttpsError("not-found", "El match no existe.");
  const initialData = initial.data() || {};
  if (initialData.workerId !== actor.uid) {
    throw new HttpsError("permission-denied", "Solo el trabajador puede responder esta propuesta.");
  }
  const companyId = String(initialData.companyId || "");
  const jobId = String(initialData.jobId || "");
  const workerId = String(initialData.workerId || "");
  if (!companyId || !jobId || !workerId) {
    throw new HttpsError("failed-precondition", "El match tiene datos incompletos.");
  }

  const companyRef = db.collection("companies").doc(companyId);
  const jobRef = companyRef.collection("jobs").doc(jobId);
  const workerRef = db.collection("workers").doc(workerId);
  const publicJobRef = db.collection("publicJobs").doc(`${companyId}_${jobId}`);
  const auditRef = db.collection("admin_audit").doc();
  const result = await db.runTransaction(async (transaction) => {
    const [match, company, job, worker] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(companyRef),
      transaction.get(jobRef),
      transaction.get(workerRef),
    ]);
    if (!match.exists) throw new HttpsError("not-found", "El match no existe.");
    const data = match.data() || {};
    if (data.workerId !== actor.uid) {
      throw new HttpsError("permission-denied", "Solo el trabajador puede responder esta propuesta.");
    }
    if (decision === "accept" && data.state === MATCH_STATES.HIRED) {
      return {alreadyHandled: true, state: MATCH_STATES.HIRED,
        jobClosed: job.data()?.jobStatus === "closed"};
    }
    if (decision === "reject" && data.state === MATCH_STATES.HIRE_REJECTED) {
      return {alreadyHandled: true, state: MATCH_STATES.HIRE_REJECTED};
    }
    if (!canRespondToHire(data.state)) {
      throw new HttpsError("failed-precondition", "La propuesta de contratación ya fue respondida.");
    }

    if (decision === "reject") {
      transaction.update(matchRef, {
        state: MATCH_STATES.HIRE_REJECTED,
        hireDecision: "rejected",
        hireRespondedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastActionBy: "worker",
        lastActionByUid: actor.uid,
      });
      transaction.create(auditRef, {
        action: "hire_rejected", matchId, companyId, jobId, workerId,
        performedByUid: actor.uid,
        performedAt: FieldValue.serverTimestamp(), schemaVersion: 1,
      });
      return {alreadyHandled: false, state: MATCH_STATES.HIRE_REJECTED};
    }

    if (!company.exists || !job.exists || !worker.exists) {
      throw new HttpsError("failed-precondition", "La empresa, oferta o perfil ya no está disponible.");
    }
    const jobData = job.data() || {};
    const credentials = await getActiveWorkerCredentials(transaction, workerId, jobData);
    assertEligibleForJob({company: company.data(), job: jobData, worker: worker.data(), credentials});
    const workersNeeded = Number(jobData.workersNeeded);
    const workersFilled = Number(jobData.workersFilled || 0);
    if (!Number.isInteger(workersNeeded) || workersNeeded <= 0 ||
        !Number.isInteger(workersFilled) || workersFilled < 0 ||
        workersFilled >= workersNeeded) {
      throw new HttpsError("failed-precondition", "La oferta no tiene cupos disponibles.",
        {reasons: ["job_full"], policyVersion: 1});
    }

    const nextWorkersFilled = workersFilled + 1;
    const jobClosed = nextWorkersFilled >= workersNeeded;
    transaction.update(matchRef, {
      state: MATCH_STATES.HIRED,
      hireDecision: "accepted",
      hiredAt: FieldValue.serverTimestamp(),
      hireRespondedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastActionBy: "worker",
      lastActionByUid: actor.uid,
    });
    transaction.update(jobRef, {
      workersFilled: nextWorkersFilled,
      ...(jobClosed ? {jobStatus: "closed", isActive: false, publishPublic: false,
        closedReason: "capacity_filled", closedAt: FieldValue.serverTimestamp()} : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (jobClosed) transaction.delete(publicJobRef);
    else transaction.set(publicJobRef, {workersFilled: nextWorkersFilled,
      updatedAt: FieldValue.serverTimestamp()}, {merge: true});

    const applicationUpdate = {
      status: "hired",
      hiredAt: FieldValue.serverTimestamp(),
      decisionAt: FieldValue.serverTimestamp(),
      decisionBy: actor.uid,
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.set(workerRef.collection("applications").doc(`${companyId}_${jobId}`),
      applicationUpdate, {merge: true});
    transaction.set(jobRef.collection("applications").doc(workerId), applicationUpdate, {merge: true});
    transaction.create(auditRef, {
      action: "hire_accepted", matchId, companyId, jobId, workerId,
      performedByUid: actor.uid,
      performedAt: FieldValue.serverTimestamp(), schemaVersion: 1,
    });
    return {alreadyHandled: false, state: MATCH_STATES.HIRED, jobClosed};
  });
  return {ok: true, matchId, ...result};
});

export const proposeMatchCompletion = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const matchId = String(request.data?.matchId || "").trim();
  if (!matchId) throw new HttpsError("invalid-argument", "Match inválido.");
  const matchRef = db.collection("matches").doc(matchId);
  const initial = await matchRef.get();
  if (!initial.exists) throw new HttpsError("not-found", "El match no existe.");
  const companyId = String(initial.data()?.companyId || "");
  if (!(await hasCompanyAccess(actor.uid, companyId))) {
    throw new HttpsError("permission-denied", "No representas a esta empresa.");
  }
  const companyRef = db.collection("companies").doc(companyId);
  const membershipRef = companyRef.collection("company_members").doc(actor.uid);
  const auditRef = db.collection("admin_audit").doc();
  const result = await db.runTransaction(async (transaction) => {
    const [match, company, membership] = await Promise.all([
      transaction.get(matchRef), transaction.get(companyRef), transaction.get(membershipRef),
    ]);
    if (!match.exists) throw new HttpsError("not-found", "El match no existe.");
    const data = match.data() || {};
    if (!hasActiveCompanyAuthority(membership.data(), company.data())) {
      throw new HttpsError("permission-denied", "Tu acceso a la empresa ya no está activo.");
    }
    if (data.state === MATCH_STATES.COMPLETION_PROPOSED) return {alreadyProposed: true};
    if (data.state === MATCH_STATES.COMPLETED) return {alreadyProposed: true, alreadyCompleted: true};
    if (!canProposeCompletion(data.state)) {
      throw new HttpsError("failed-precondition", "Solo un trabajo contratado puede finalizarse.");
    }
    transaction.update(matchRef, {
      state: MATCH_STATES.COMPLETION_PROPOSED,
      completionProposedAt: FieldValue.serverTimestamp(),
      completionProposedByUid: actor.uid,
      updatedAt: FieldValue.serverTimestamp(),
      lastActionBy: "company",
      lastActionByUid: actor.uid,
    });
    transaction.create(auditRef, {
      action: "completion_proposed", matchId, companyId,
      jobId: data.jobId, workerId: data.workerId, performedByUid: actor.uid,
      performedAt: FieldValue.serverTimestamp(), schemaVersion: 1,
    });
    return {alreadyProposed: false};
  });
  return {ok: true, matchId, state: MATCH_STATES.COMPLETION_PROPOSED, ...result};
});

export const respondToCompletionProposal = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const matchId = String(request.data?.matchId || "").trim();
  const decision = parseCompletionDecision(request.data?.decision);
  if (!matchId || !decision) {
    throw new HttpsError("invalid-argument", "Respuesta de finalización inválida.");
  }
  const matchRef = db.collection("matches").doc(matchId);
  const auditRef = db.collection("admin_audit").doc();
  const result = await db.runTransaction(async (transaction) => {
    const match = await transaction.get(matchRef);
    if (!match.exists) throw new HttpsError("not-found", "El match no existe.");
    const data = match.data() || {};
    if (data.workerId !== actor.uid) {
      throw new HttpsError("permission-denied", "Solo el trabajador puede responder esta finalización.");
    }
    const targetState = decision === "confirm" ?
      MATCH_STATES.COMPLETED : MATCH_STATES.COMPLETION_DISPUTED;
    if (data.state === targetState) return {alreadyHandled: true, state: targetState};
    if (!canRespondToCompletion(data.state)) {
      throw new HttpsError("failed-precondition", "La propuesta de finalización ya fue respondida.");
    }
    transaction.update(matchRef, {
      state: targetState,
      completionDecision: decision,
      completionRespondedAt: FieldValue.serverTimestamp(),
      ...(decision === "confirm" ? {completedAt: FieldValue.serverTimestamp()} :
        {completionDisputedAt: FieldValue.serverTimestamp()}),
      updatedAt: FieldValue.serverTimestamp(),
      lastActionBy: "worker",
      lastActionByUid: actor.uid,
    });
    transaction.create(auditRef, {
      action: decision === "confirm" ? "completion_confirmed" : "completion_disputed",
      matchId, companyId: data.companyId, jobId: data.jobId, workerId: data.workerId,
      performedByUid: actor.uid, performedAt: FieldValue.serverTimestamp(), schemaVersion: 1,
    });
    return {alreadyHandled: false, state: targetState};
  });
  return {ok: true, matchId, ...result};
});
const OPERATIONAL_MATCH_STATES = new Set([
  "worker_interested",
  "company_interested",
  "matched",
  "hire_proposed",
]);

export const closeJob = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const companyId = String(request.data?.companyId || "").trim();
  const jobId = String(request.data?.jobId || "").trim();
  const reason = String(request.data?.reason || "closed_by_company")
    .trim()
    .slice(0, 120) || "closed_by_company";
  if (!companyId || !jobId) {
    throw new HttpsError("invalid-argument", "Oferta inválida.");
  }
  if (!(await hasCompanyAccess(actor.uid, companyId))) {
    throw new HttpsError("permission-denied", "No representas a esta empresa.");
  }

  const companyRef = db.collection("companies").doc(companyId);
  const jobRef = companyRef.collection("jobs").doc(jobId);
  const publicJobRef = db.collection("publicJobs").doc(`${companyId}_${jobId}`);
  const membershipRef = companyRef.collection("company_members").doc(actor.uid);
  const auditRef = db.collection("admin_audit").doc();
  const closeResult = await db.runTransaction(async (transaction) => {
    const [company, membership, job] = await Promise.all([
      transaction.get(companyRef),
      transaction.get(membershipRef),
      transaction.get(jobRef),
    ]);
    if (!hasActiveCompanyAuthority(membership.data(), company.data())) {
      throw new HttpsError("permission-denied", "Tu acceso a la empresa ya no está activo.");
    }
    if (!job.exists) {
      throw new HttpsError("not-found", "La oferta no existe.");
    }
    const alreadyClosed = job.data()?.jobStatus === "closed" &&
      job.data()?.isActive === false;
    if (!alreadyClosed) {
      transaction.update(jobRef, {
        jobStatus: "closed",
        isActive: false,
        publishPublic: false,
        closedReason: reason,
        closedAt: FieldValue.serverTimestamp(),
        closedByUid: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(auditRef, {
        action: "close_job",
        companyId,
        jobId,
        reason,
        performedByUid: actor.uid,
        performedAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
      });
    }
    transaction.delete(publicJobRef);
    return {alreadyClosed};
  });

  const matches = await db.collection("matches")
    .where("companyId", "==", companyId)
    .get();
  const operationalMatches = matches.docs.filter((match) => {
    const data = match.data();
    return data.jobId === jobId && OPERATIONAL_MATCH_STATES.has(data.state);
  });
  for (let index = 0; index < operationalMatches.length; index += 100) {
    const batch = db.batch();
    operationalMatches.slice(index, index + 100).forEach((match) => {
      const data = match.data();
      const workerId = String(data.workerId || "").trim();
      batch.update(match.ref, {
        state: "closed",
        closedReason: "job_closed",
        closedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastActionBy: "company",
        lastActionByUid: actor.uid,
      });
      batch.set(
        companyRef.collection("contact_grants").doc(match.id),
        {
          status: "revoked",
          revokedReason: "job_closed",
          revokedAt: FieldValue.serverTimestamp(),
        },
        {merge: true}
      );
      if (workerId) {
        batch.set(
          db.collection("workers").doc(workerId)
            .collection("applications").doc(`${companyId}_${jobId}`),
          {
            status: "closed",
            closedReason: "job_closed",
            updatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
        batch.set(
          jobRef.collection("applications").doc(workerId),
          {
            status: "closed",
            closedReason: "job_closed",
            updatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
      }
    });
    await batch.commit();
  }

  return {
    ok: true,
    companyId,
    jobId,
    closedMatches: operationalMatches.length,
    ...closeResult,
  };
});

export const getMatchContact = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const matchId = String(request.data?.matchId || "").trim();
  const match = await db.collection("matches").doc(matchId).get();
  if (!match.exists) {
    throw new HttpsError("not-found", "El match no existe.");
  }
  const data = match.data() || {};
  const workerIsActor = data.workerId === actor.uid;
  const companyIsActor = await hasCompanyAccess(actor.uid, data.companyId);
  if (!workerIsActor && !companyIsActor) {
    throw new HttpsError("permission-denied", "No participas en este match.");
  }
  if (!["matched", "hire_proposed", "hired", "completion_proposed",
    "completion_disputed", "completed"].includes(data.state)) {
    throw new HttpsError(
      "failed-precondition",
      "El contacto se libera únicamente después del match."
    );
  }

  if (workerIsActor) {
    const company = await db.collection("companies").doc(data.companyId).get();
    const companyData = company.data() || {};
    const contact = {
      phone: companyData.hrPhone || companyData.officialPhone || null,
      email: companyData.hrEmail || companyData.contactEmail || null,
      preferredChannel: companyData.hrPhone || companyData.officialPhone
        ? "whatsapp"
        : "email",
    };
    await db.collection("admin_audit").add({
      action: "worker_view_company_contact",
      companyId: data.companyId,
      matchId,
      workerId: data.workerId,
      performedByUid: actor.uid,
      performedAt: FieldValue.serverTimestamp(),
    });
    return {ok: true, contact};
  }

  const grant = await db.collection("companies").doc(data.companyId)
    .collection("contact_grants").doc(matchId).get();
  const grantData = grant.data() || {};
  const expiresAt = grantData.expiresAt?.toMillis?.() || 0;
  if (
    !grant.exists ||
    grantData.status !== "active" ||
    expiresAt <= Date.now()
  ) {
    throw new HttpsError("failed-precondition", "El acceso al contacto expiró.");
  }
  await db.collection("admin_audit").add({
    action: "view_match_contact",
    companyId: data.companyId,
    matchId,
    workerId: data.workerId,
    performedByUid: actor.uid,
    performedAt: FieldValue.serverTimestamp(),
  });
  return {ok: true, contact: grantData.contact || {}};
});

export const submitMatchReview = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const matchId = String(request.data?.matchId || "").trim();
  const overall = Number(request.data?.overall);
  const comment = String(request.data?.comment || "").trim().slice(0, 500);
  if (!matchId || !Number.isInteger(overall) || overall < 1 || overall > 5) {
    throw new HttpsError("invalid-argument", "Evaluación inválida.");
  }

  const matchRef = db.collection("matches").doc(matchId);
  const match = await matchRef.get();
  if (!match.exists) {
    throw new HttpsError("not-found", "El match no existe.");
  }
  const data = match.data() || {};
  if (!canReviewMatch(data.state, data.administrativeClosure)) {
    throw new HttpsError(
      "failed-precondition",
      "La evaluación requiere un trabajo verificado."
    );
  }
  const workerIsActor = data.workerId === actor.uid;
  const companyIsActor = await hasCompanyAccess(actor.uid, data.companyId);
  if (!workerIsActor && !companyIsActor) {
    throw new HttpsError("permission-denied", "No participaste en este trabajo.");
  }

  const side = workerIsActor ? "worker_to_company" : "company_to_worker";
  const counterpartSide = workerIsActor
    ? "company_to_worker"
    : "worker_to_company";
  const reviewRef = db.collection("match_reviews").doc(matchId + "_" + side);
  const counterpartRef = db
    .collection("match_reviews")
    .doc(matchId + "_" + counterpartSide);
  await db.runTransaction(async (transaction) => {
    const [currentMatch, existing, counterpart] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(reviewRef),
      transaction.get(counterpartRef),
    ]);
    if (!currentMatch.exists ||
        !canReviewMatch(currentMatch.data()?.state,
          currentMatch.data()?.administrativeClosure)) {
      throw new HttpsError(
        "failed-precondition",
        "La evaluación requiere una finalización confirmada por ambas partes."
      );
    }
    if (existing.exists) {
      throw new HttpsError(
        "already-exists",
        "Ya evaluaste este trabajo."
      );
    }
    transaction.create(reviewRef, {
      matchId,
      companyId: data.companyId,
      workerId: data.workerId,
      side,
      authorUid: actor.uid,
      targetType: workerIsActor ? "company" : "worker",
      targetId: workerIsActor ? data.companyId : data.workerId,
      overall,
      comment: comment || null,
      visible: counterpart.exists,
      createdAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    });
    if (counterpart.exists) {
      transaction.update(counterpartRef, {
        visible: true,
        revealedAt: FieldValue.serverTimestamp(),
      });
    }
    const reputationRef = workerIsActor
      ? db.collection("company_reputation").doc(data.companyId)
      : db.collection("worker_reputation").doc(data.workerId);
    transaction.set(reputationRef, {
      ratingCount: FieldValue.increment(1),
      ratingSum: FieldValue.increment(overall),
      updatedAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    }, {merge: true});
  });
  return {ok: true, matchId, side};
});

export const issueWorkerCredential = onCall(async (request) => {
  const issuer = await assertAuthenticated(request);
  const workerId = String(request.data?.workerId || "").trim();
  const title = String(request.data?.title || "").trim().slice(0, 120);
  const credentialType = String(request.data?.credentialType || "platform_course");
  const companyId = String(request.data?.companyId || "").trim();
  const matchId = String(request.data?.matchId || "").trim();
  const allowedTypes = [
    "platform_course",
    "company_training",
    "external_verified",
  ];
  if (!workerId || !title || !allowedTypes.includes(credentialType)) {
    throw new HttpsError("invalid-argument", "Credencial inválida.");
  }
  const issuerIsSuperadmin = await hasCurrentSuperadminClaims(issuer.uid);
  let canIssue = issuerIsSuperadmin;
  if (!issuerIsSuperadmin && companyId && matchId && await hasCompanyAccess(issuer.uid, companyId)) {
    const match = await db.collection("matches").doc(matchId).get();
    const matchData = match.data() || {};
    canIssue = match.exists &&
      matchData.companyId === companyId &&
      matchData.workerId === workerId &&
      ["matched", "hired"].includes(String(matchData.state || ""));
  }
  if (!canIssue) {
    throw new HttpsError("permission-denied", "No puedes emitir credenciales.");
  }
  const worker = await db.collection("workers").doc(workerId).get();
  if (!worker.exists) {
    throw new HttpsError("not-found", "El trabajador no existe.");
  }
  const credentialRef = db.collection("worker_credentials").doc();
  await credentialRef.set({
    workerId,
    title,
    credentialType,
    issuerType: issuerIsSuperadmin ? "platform" : "company",
    issuerId: issuerIsSuperadmin ? "agroconnect" : companyId,
    issuedByUid: issuer.uid,
    status: "active",
    visibility: "public",
    evidenceReference: String(request.data?.evidenceReference || "")
      .trim()
      .slice(0, 300) || null,
    issuedAt: FieldValue.serverTimestamp(),
    expiresAt: request.data?.expiresAt || null,
    schemaVersion: 1,
  });
  return {ok: true, credentialId: credentialRef.id};
});

export const submitWorkerCredentialEvidence = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const worker = await db.collection("workers").doc(actor.uid).get();
  if (!worker.exists) {
    throw new HttpsError("failed-precondition", "Primero completa tu perfil laboral.");
  }

  const title = String(request.data?.title || "").trim().slice(0, 120);
  const credentialType = String(request.data?.credentialType || "other")
    .trim()
    .slice(0, 50);
  const evidenceReference = String(request.data?.evidenceReference || "")
    .trim()
    .slice(0, 300);
  if (!title || !isSelfDeclaredCredentialType(credentialType)) {
    throw new HttpsError("invalid-argument", "Indica el nombre de la certificación.");
  }

  let expiresAt: Timestamp | null = null;
  const expiresAtInput = String(request.data?.expiresAt || "").trim();
  if (expiresAtInput) {
    const parsed = new Date(`${expiresAtInput}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpsError("invalid-argument", "La fecha de vencimiento no es válida.");
    }
    expiresAt = Timestamp.fromDate(parsed);
  }

  const credentialRef = db.collection("worker_credentials").doc();
  await credentialRef.set({
    workerId: actor.uid,
    title,
    credentialType,
    issuerType: "self_declared",
    issuerId: actor.uid,
    issuedByUid: actor.uid,
    status: "pending",
    visibility: "private",
    evidenceReference: evidenceReference || null,
    submittedAt: FieldValue.serverTimestamp(),
    issuedAt: null,
    expiresAt,
    schemaVersion: 1,
  });
  return {ok: true, credentialId: credentialRef.id, status: "pending"};
});

export const listMatchWorkerCredentials = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const matchId = String(request.data?.matchId || "").trim();
  const match = await db.collection("matches").doc(matchId).get();
  if (!match.exists) {
    throw new HttpsError("not-found", "El match no existe.");
  }
  const matchData = match.data() || {};
  if (!(await hasCompanyAccess(actor.uid, matchData.companyId))) {
    throw new HttpsError("permission-denied", "No representas a esta empresa.");
  }
  if (!["matched", "hired", "closed"].includes(String(matchData.state || ""))) {
    throw new HttpsError("failed-precondition", "Las credenciales se revisan después del match.");
  }

  const credentials = await db.collection("worker_credentials")
    .where("workerId", "==", matchData.workerId)
    .limit(50)
    .get();
  return {
    ok: true,
    credentials: credentials.docs.map((credential) => {
      const data = credential.data();
      return {
        id: credential.id,
        title: data.title || "Credencial",
        credentialType: data.credentialType || "other",
        status: data.status || "pending",
        evidenceReference: data.evidenceReference || null,
        expiresAt: data.expiresAt?.toDate?.().toISOString?.() || null,
      };
    }),
  };
});

export const reviewWorkerCredential = onCall(async (request) => {
  const actor = await assertAuthenticated(request);
  const matchId = String(request.data?.matchId || "").trim();
  const credentialId = String(request.data?.credentialId || "").trim();
  const decision = parseCredentialDecision(request.data?.decision);
  if (!matchId || !credentialId || !decision) {
    throw new HttpsError("invalid-argument", "Decisión de credencial inválida.");
  }
  const matchRef = db.collection("matches").doc(matchId);
  const credentialRef = db.collection("worker_credentials").doc(credentialId);
  const [match, credential] = await Promise.all([
    matchRef.get(),
    credentialRef.get(),
  ]);
  if (!match.exists || !credential.exists) {
    throw new HttpsError("not-found", "No encontramos el match o la credencial.");
  }
  const matchData = match.data() || {};
  const credentialData = credential.data() || {};
  if (!(await hasCompanyAccess(actor.uid, matchData.companyId))) {
    throw new HttpsError("permission-denied", "No representas a esta empresa.");
  }
  if (!["matched", "hired", "closed"].includes(String(matchData.state || ""))) {
    throw new HttpsError("failed-precondition", "La revisión requiere un match confirmado.");
  }
  if (credentialData.workerId !== matchData.workerId) {
    throw new HttpsError("permission-denied", "La credencial no pertenece a este trabajador.");
  }

  await db.runTransaction(async (transaction) => {
    const [currentMatch, currentCredential] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(credentialRef),
    ]);
    const currentMatchData = currentMatch.data() || {};
    const currentCredentialData = currentCredential.data() || {};
    if (!currentMatch.exists || !["matched", "hired", "closed"].includes(String(currentMatchData.state || ""))) {
      throw new HttpsError("failed-precondition", "La revisión requiere un match confirmado.");
    }
    if (!currentCredential.exists || currentCredentialData.workerId !== currentMatchData.workerId) {
      throw new HttpsError("permission-denied", "La credencial no pertenece a este trabajador.");
    }
    if (currentCredentialData.status !== "pending") {
      throw new HttpsError("already-exists", "Esta credencial ya fue revisada y no puede modificarse.");
    }
    transaction.set(credentialRef, {
      status: decision === "verified" ? "active" : "rejected",
      visibility: decision === "verified" ? "public" : "private",
      issuerType: decision === "verified" ? "company_verified" : "self_declared",
      issuerId: decision === "verified" ? currentMatchData.companyId : currentCredentialData.issuerId,
      reviewedByUid: actor.uid,
      reviewedCompanyId: currentMatchData.companyId,
      reviewedAt: FieldValue.serverTimestamp(),
      issuedAt: decision === "verified" ? FieldValue.serverTimestamp() : null,
    }, {merge: true});
    transaction.create(db.collection("admin_audit").doc(), {
      action: "review_worker_credential",
      matchId,
      companyId: currentMatchData.companyId,
      workerId: currentMatchData.workerId,
      credentialId,
      decision,
      performedByUid: actor.uid,
      performedAt: FieldValue.serverTimestamp(),
    });
  });
  return {ok: true, credentialId, status: decision === "verified" ? "active" : "rejected"};
});

async function upsertDiscoverableWorker(uid: string, data: any) {
  const discoverableRef = db.collection("discoverableWorkers").doc(uid);
  if (data?.discoverable !== true) {
    await discoverableRef.delete();
    return;
  }
  const fullName = String(data?.displayName || data?.fullName || "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const safeName = nameParts.length > 1
    ? nameParts[0] + " " + nameParts[1].slice(0, 1) + "."
    : nameParts[0] || "Trabajador";
  await discoverableRef.set({
    workerId: uid,
    displayName: safeName,
    region: String(data?.region || ""),
    commune: String(data?.commune || data?.comuna || ""),
    primaryTrade: String(data?.primaryTrade || ""),
    sectors: Array.isArray(data?.sectors) ? data.sectors.slice(0, 10) : [],
    skills: Array.isArray(data?.skills) ? data.skills.slice(0, 20) : [],
    experienceTags: Array.isArray(data?.experienceTags)
      ? data.experienceTags.slice(0, 20)
      : [],
    mobility: ["needs_transport", "public_transport", "own_transport"]
      .includes(String(data?.mobility || ""))
      ? data.mobility
      : null,
    preferredShift: ["day", "night", "rotating", "any"]
      .includes(String(data?.preferredShift || ""))
      ? data.preferredShift
      : "any",
    os10Status: ["none", "in_process", "valid", "expired"]
      .includes(String(data?.os10Status || ""))
      ? data.os10Status
      : "none",
    availabilityStatus: data?.available === false || data?.isAvailable === false
      ? "unavailable"
      : "available",
    isAvailable: data?.available !== false && data?.isAvailable !== false,
    updatedAt: FieldValue.serverTimestamp(),
    schemaVersion: 2,
  }, {merge: false});
}

export const onWorkerDiscoverableCreated = onDocumentCreated(
  "workers/{workerId}",
  async (event) => {
    if (event.data) {
      await upsertDiscoverableWorker(event.params.workerId, event.data.data());
    }
  }
);

export const onWorkerDiscoverableUpdated = onDocumentUpdated(
  "workers/{workerId}",
  async (event) => {
    if (event.data?.after) {
      await upsertDiscoverableWorker(
        event.params.workerId,
        event.data.after.data()
      );
    }
  }
);

export const requestWorkerDataDeletion = onCall(async (request) => {
  const user = await assertAuthenticated(request);
  const workerRef = db.collection("workers").doc(user.uid);
  const userRef = db.collection("users").doc(user.uid);
  const discoverableRef = db.collection("discoverableWorkers").doc(user.uid);
  const deletionRef = db.collection("data_deletion_requests").doc(user.uid);
  const batch = db.batch();

  batch.set(deletionRef, {
    uid: user.uid,
    email: normalizeEmail(user.token.email),
    status: "pending",
    requestedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    source: "worker_self_service",
  }, {merge: true});
  batch.set(workerRef, {
    available: false,
    discoverable: false,
    deletionStatus: "pending",
    deletionRequestedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});
  batch.set(userRef, {
    deletionStatus: "pending",
    deletionRequestedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});
  batch.delete(discoverableRef);
  await batch.commit();

  return {ok: true, status: "pending"};
});

export const submitSafetyReport = onCall(async (request) => {
  const user = await assertAuthenticated(request);
  const category = String(request.data?.category || "");
  const details = String(request.data?.details || "").trim();
  const companyId = String(request.data?.companyId || "").trim();
  const jobId = String(request.data?.jobId || "").trim();
  const allowedCategories = ["false_offer", "worker_fee", "different_conditions", "discrimination", "privacy", "other"];

  if (!allowedCategories.includes(category) || !companyId || !jobId || details.length < 10 || details.length > 1000) {
    throw new HttpsError("invalid-argument", "Completa una categoría y una descripción válida.");
  }

  const report = await db.collection("safety_reports").add({
    reporterUid: user.uid,
    reporterEmail: normalizeEmail(user.token.email),
    category,
    details,
    companyId,
    jobId,
    status: "open",
    source: "worker_job_detail",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return {ok: true, reportId: report.id};
});

export const reviewSafetyReport = onCall(async (request) => {
  const adminUser = await assertSuperadmin(request);
  const reportId = String(request.data?.reportId || "").trim();
  const decision = String(request.data?.decision || "").trim();
  const resolutionNote = String(request.data?.resolutionNote || "").trim();
  const allowedDecisions = ["resolve", "dismiss", "suspend_job", "suspend_company"];

  if (!reportId || !allowedDecisions.includes(decision) || resolutionNote.length < 5 || resolutionNote.length > 1000) {
    throw new HttpsError("invalid-argument", "Indica una resolución válida.");
  }

  const reportRef = db.collection("safety_reports").doc(reportId);
  await db.runTransaction(async (transaction) => {
    const report = await transaction.get(reportRef);
    if (!report.exists) {
      throw new HttpsError("not-found", "La denuncia no existe.");
    }
    const reportData = report.data() || {};
    if (reportData.status !== "open") {
      throw new HttpsError("failed-precondition", "La denuncia ya fue procesada.");
    }

    if (decision === "suspend_job") {
      const jobRef = db.collection("companies").doc(String(reportData.companyId))
        .collection("jobs").doc(String(reportData.jobId));
      transaction.set(jobRef, {
        isActive: false,
        isDraft: false,
        jobStatus: "closed",
        publishPublic: false,
        suspendedAt: FieldValue.serverTimestamp(),
        suspendedBy: adminUser.uid,
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      transaction.set(db.collection("publicJobs").doc(`${reportData.companyId}_${reportData.jobId}`), {
        isActive: false,
        jobStatus: "closed",
        publishPublic: false,
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    }

    if (decision === "suspend_company") {
      transaction.set(db.collection("companies").doc(String(reportData.companyId)), {
        status: "suspended",
        suspendedAt: FieldValue.serverTimestamp(),
        suspendedBy: adminUser.uid,
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    }

    transaction.update(reportRef, {
      status: decision === "dismiss" ? "dismissed" : "resolved",
      decision,
      resolutionNote,
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: adminUser.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(db.collection("admin_audit").doc(), {
      action: "safety_report_reviewed",
      actorUid: adminUser.uid,
      targetId: reportId,
      decision,
      companyId: String(reportData.companyId || ""),
      jobId: String(reportData.jobId || ""),
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return {ok: true, status: decision === "dismiss" ? "dismissed" : "resolved"};
});

export const reviewDataDeletionRequest = onCall(async (request) => {
  const adminUser = await assertSuperadmin(request);
  const uid = String(request.data?.uid || "").trim();
  const decision = String(request.data?.decision || "").trim();
  const resolutionNote = String(request.data?.resolutionNote || "").trim();
  if (!uid || !["complete", "reject"].includes(decision) || resolutionNote.length < 5 || resolutionNote.length > 1000) {
    throw new HttpsError("invalid-argument", "Indica una resolución válida.");
  }

  const deletionRef = db.collection("data_deletion_requests").doc(uid);
  const deletionRequest = await deletionRef.get();
  if (!deletionRequest.exists || deletionRequest.data()?.status !== "pending") {
    throw new HttpsError("failed-precondition", "La solicitud no está pendiente.");
  }

  if (decision === "reject") {
    await deletionRef.update({
      status: "rejected",
      resolutionNote,
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: adminUser.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection("admin_audit").add({
      action: "data_deletion_rejected",
      actorUid: adminUser.uid,
      targetId: uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    return {ok: true, status: "rejected"};
  }

  const anonymousSubject = createHash("sha256").update(uid).digest("hex").slice(0, 20);
  const [usernames, credentials, applications, grants, authoredReviews, workerReviews, workerMatches] = await Promise.all([
    db.collection("worker_usernames").where("uid", "==", uid).get(),
    db.collection("worker_credentials").where("workerId", "==", uid).get(),
    db.collectionGroup("applications").where("workerId", "==", uid).get(),
    db.collectionGroup("contact_grants").where("workerId", "==", uid).get(),
    db.collection("match_reviews").where("authorUid", "==", uid).get(),
    db.collection("match_reviews").where("workerId", "==", uid).get(),
    db.collection("matches").where("workerId", "==", uid).get(),
  ]);

  const refs = new Map<string, DocumentReference>();
  [usernames, credentials, applications, grants, authoredReviews, workerReviews].forEach((snapshot) => {
    snapshot.docs.forEach((document) => refs.set(document.ref.path, document.ref));
  });
  await deleteDocumentRefs([...refs.values()]);

  for (let index = 0; index < workerMatches.docs.length; index += 400) {
    const batch = db.batch();
    workerMatches.docs.slice(index, index + 400).forEach((match) => {
      batch.update(match.ref, {
        workerId: `deleted_${anonymousSubject}`,
        workerName: "Persona eliminada",
        workerDeleted: true,
        workerEmail: FieldValue.delete(),
        workerPhone: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  await Promise.all([
    db.recursiveDelete(db.collection("workers").doc(uid)),
    db.collection("users").doc(uid).delete(),
    db.collection("discoverableWorkers").doc(uid).delete(),
    db.collection("publicWorkers").doc(uid).delete(),
  ]);

  try {
    await admin.auth().deleteUser(uid);
  } catch (error: any) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
  await db.collection("privacy_audit").add({
    action: "data_deletion_completed",
    anonymousSubject,
    actorUid: adminUser.uid,
    resolutionNote,
    completedAt: FieldValue.serverTimestamp(),
  });
  await deletionRef.delete();

  return {ok: true, status: "completed"};
});

/**
 * =========================
 *  SUPERADMIN CLAIMS (Callable)
 * =========================
 * Setea claims admin/superadmin si el email está en allowlist server-side.
 */
export const syncSuperadminClaims = onCall(async (request) => {
  const user = await assertAuthenticated(request);
  if (!isVerifiedGoogleIdentity(user.token)) {
    throw new HttpsError(
      "permission-denied",
      "El acceso de SuperAdmin requiere una cuenta Google verificada."
    );
  }
  const email = normalizeEmail(user.token.email);
  const superadminEmails = getSuperadminEmails();
  if (!superadminEmails.includes(email)) {
    throw new HttpsError("permission-denied", "No tienes permisos de SuperAdmin.");
  }

  const auth = admin.auth();
  const current = await auth.getUser(user.uid);
  const existingClaims = current.customClaims || {};
  const nextClaims = {
    ...existingClaims,
    admin: true,
    superadmin: true,
    role: "superadmin",
  };

  await auth.setCustomUserClaims(user.uid, nextClaims);
  await db.collection("users").doc(user.uid).set(
    {
      role: "superadmin",
      email,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
});

/**
 * =========================
 *  SUPERADMIN CLAIMS (Callable)
 * =========================
 * Permite agregar/quitar superadmin por email.
 */
export const setSuperadminByEmail = onCall(async (request) => {
  const user = await assertAuthenticated(request);
  if (!isVerifiedGoogleIdentity(user.token)) {
    throw new HttpsError(
      "permission-denied",
      "La gestión de SuperAdmin requiere una cuenta Google verificada."
    );
  }
  const callerEmail = normalizeEmail(user.token.email);
  const callerIsSuperadmin = await hasCurrentSuperadminClaims(user.uid);

  const superadminEmails = getSuperadminEmails();
  if (!callerIsSuperadmin && !superadminEmails.includes(callerEmail)) {
    throw new HttpsError("permission-denied", "No tienes permisos para gestionar superadmins.");
  }

  const targetEmail = normalizeEmail(request.data?.email);
  if (!targetEmail || !isValidEmail(targetEmail)) {
    throw new HttpsError("invalid-argument", "Email inválido.");
  }

  const makeSuperadmin = request.data?.makeSuperadmin !== false;

  let targetUser;
  try {
    targetUser = await admin.auth().getUserByEmail(targetEmail);
  } catch (error) {
    throw new HttpsError("not-found", "No se encontró un usuario con ese email.");
  }

  if (
    makeSuperadmin &&
    (!targetUser.emailVerified ||
      !targetUser.providerData.some((provider) => provider.providerId === "google.com"))
  ) {
    throw new HttpsError(
      "failed-precondition",
      "El usuario objetivo debe verificar su identidad mediante Google."
    );
  }

  const existingClaims = targetUser.customClaims || {};
  const nextClaims: Record<string, any> = { ...existingClaims };

  if (makeSuperadmin) {
    nextClaims.admin = true;
    nextClaims.superadmin = true;
    nextClaims.role = "superadmin";
  } else {
    delete nextClaims.admin;
    delete nextClaims.superadmin;
    if (nextClaims.role === "superadmin") {
      nextClaims.role = "worker";
    }
  }

  await admin.auth().setCustomUserClaims(targetUser.uid, nextClaims);
  if (!makeSuperadmin) {
    await admin.auth().revokeRefreshTokens(targetUser.uid);
  }

  await db
    .collection("users")
    .doc(targetUser.uid)
    .set(
      {
        email: targetEmail,
        role: makeSuperadmin ? "superadmin" : "worker",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  await db.collection("admin_audit").add({
    action: makeSuperadmin ? "grant_superadmin" : "revoke_superadmin",
    targetUid: targetUser.uid,
    targetEmail,
    performedByUid: user.uid,
    performedByEmail: callerEmail,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, uid: targetUser.uid, email: targetEmail, superadmin: makeSuperadmin };
});

/**
 * =========================
 *  STATS / AGGREGATIONS
 * =========================
 *
 * Colecciones agregadas (MVP):
 * - stats/global (doc): KPIs globales
 * - stats_monthly/{YYYY-MM}: actividad mensual
 * - stats_companies/{companyId}: uso por empresa
 *
 * - finops_infra/{YYYY-MM}: editable (infra estimado) desde UI
 * - finops_manualExpenses/{expenseId}: gastos manuales (UI)
 *
 * Objetivo:
 * - Lecturas rápidas para Dashboard SuperAdmin.
 * - No rompe funcionalidades actuales.
 */

function ymFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function normalizeJobStatus(raw: any): "future" | "active" | "closed" {
  const s = String(raw || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "closed") return "closed";
  return "future";
}

function normalizeCompanyStatus(raw: any): "active" | "pending" | "suspended" | "overdue" {
  const s = String(raw || "active").toLowerCase();
  if (s === "pending") return "pending";
  if (s === "suspended") return "suspended";
  if (s === "overdue") return "overdue";
  return "active";
}

function normalizeApplicationStatus(raw: any): "applied" | "hired" | "rejected" | "other" {
  const s = String(raw || "").toLowerCase();
  if (["hired", "contratado", "contratada", "confirmado"].includes(s)) return "hired";
  if (["rejected", "rechazado", "rechazada", "no_asistio"].includes(s)) return "rejected";
  if (["applied", "postulado", "postulada"].includes(s)) return "applied";
  return "other";
}

async function incGlobal(fields: Record<string, number>) {
  const ref = db.collection("stats").doc("global");
  const update: any = {};
  for (const [k, v] of Object.entries(fields)) {
    update[k] = FieldValue.increment(v);
  }
  update.updatedAt = FieldValue.serverTimestamp();
  await ref.set(update, { merge: true });
}

async function incMonthly(ym: string, fields: Record<string, number>) {
  const ref = db.collection("stats_monthly").doc(ym);
  const update: any = { ym };
  for (const [k, v] of Object.entries(fields)) {
    update[k] = FieldValue.increment(v);
  }
  update.updatedAt = FieldValue.serverTimestamp();
  await ref.set(update, { merge: true });
}

async function incCompany(companyId: string, fields: Record<string, number>, extra?: any) {
  const ref = db.collection("stats_companies").doc(companyId);
  const update: any = { companyId };
  for (const [k, v] of Object.entries(fields)) {
    update[k] = FieldValue.increment(v);
  }
  if (extra) Object.assign(update, extra);
  update.updatedAt = FieldValue.serverTimestamp();
  await ref.set(update, { merge: true });
}

/**
 * Companies created
 */
export const onCompanyCreated = onDocumentCreated("companies/{companyId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data() as any;
  const status = normalizeCompanyStatus(data?.status);

  const globalFields: Record<string, number> = {
    companiesTotal: 1,
  };

  if (status === "active") globalFields.companiesActive = 1;
  if (status === "overdue") globalFields.companiesOverdue = 1;
  if (status === "suspended") globalFields.companiesSuspended = 1;
  if (status === "pending") globalFields.companiesPending = 1;

  await incGlobal(globalFields);
});

/**
 * Company status updated (Active/Pending/Suspended/Overdue)
 */
export const onCompanyUpdated = onDocumentUpdated("companies/{companyId}", async (event) => {
  const before = event.data?.before?.data() as any;
  const after = event.data?.after?.data() as any;
  if (!before || !after) return;

  const b = normalizeCompanyStatus(before.status);
  const a = normalizeCompanyStatus(after.status);
  if (b === a) return;

  const fields: Record<string, number> = {};
  const map: Record<string, string> = {
    active: "companiesActive",
    overdue: "companiesOverdue",
    suspended: "companiesSuspended",
    pending: "companiesPending",
  };

  const bKey = map[b];
  const aKey = map[a];
  if (bKey) fields[bKey] = (fields[bKey] || 0) - 1;
  if (aKey) fields[aKey] = (fields[aKey] || 0) + 1;

  await incGlobal(fields);
});

/**
 * Jobs created
 */
export const onJobCreated = onDocumentCreated("companies/{companyId}/jobs/{jobId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const { companyId } = event.params;
  const data = snap.data() as any;

  const status = normalizeJobStatus(data?.jobStatus);
  const createdAt = data?.createdAt?.toDate?.() || event.data?.createTime?.toDate?.() || new Date();
  const ym = ymFromDate(createdAt);

  // Global
  const g: Record<string, number> = { jobsTotal: 1 };
  if (status === "active") g.jobsActive = 1;
  if (status === "future") g.jobsFuture = 1;
  if (status === "closed") g.jobsClosed = 1;

  await incGlobal(g);
  await incMonthly(ym, { jobsCreated: 1 });

  // Company
  const c: Record<string, number> = { jobsTotal: 1 };
  if (status === "active") c.jobsActive = 1;
  if (status === "future") c.jobsFuture = 1;
  if (status === "closed") c.jobsClosed = 1;

  await incCompany(companyId, c, { lastJobAt: FieldValue.serverTimestamp() });
});

/**
 * Public jobs sync
 * - Mirrors publishable active jobs into publicJobs/{companyId}_{jobId}
 * - When job is closed or unpublishes, marks public job as closed
 */
async function upsertPublicJob(companyId: string, jobId: string, data: any) {
  const publicRef = db.collection("publicJobs").doc(`${companyId}_${jobId}`);
  let companyName = String(data?.companyName || "").trim();

  if (!companyName) {
    try {
      const companySnap = await db.collection("companies").doc(companyId).get();
      if (companySnap.exists) {
        companyName = String(companySnap.data()?.name || "").trim();
      }
    } catch (e) {
      console.error("publicJobs: failed to fetch company name", e);
    }
  }

  const payload = {
    companyId,
    jobId,
    companyName: companyName || null,
    title: String(data?.title || ""),
    description: String(data?.description || ""),
    workersNeeded: data?.workersNeeded ?? null,
    workersFilled: data?.workersFilled ?? null,
    startDate: data?.startDate ?? null,
    location: data?.location ?? "",
    coordinates: data?.coordinates ?? null,
    sector: data?.sector === "security" ? "security" : "agriculture",
    category: data?.category ?? null,
    paymentType: data?.paymentType ?? null,
    payMode: data?.payMode ?? null,
    payAmount: data?.payAmount ?? null,
    payDetail: data?.payDetail ?? null,
    skillsRequired: data?.skillsRequired ?? null,
    benefits: data?.benefits ?? null,
    transportMode: data?.transportMode ?? null,
    transportInfo: data?.transportInfo ?? null,
    pickupPoints: data?.pickupPoints ?? null,
    departureTime: data?.departureTime ?? null,
    returnTime: data?.returnTime ?? null,
    transportCost: data?.transportCost ?? null,
    shiftType: data?.shiftType ?? null,
    shiftPattern: data?.shiftPattern ?? null,
    requiresOs10: data?.requiresOs10 ?? null,
    facilityType: data?.facilityType ?? null,
    otherBenefits: data?.otherBenefits ?? null,
    jobStatus: data?.jobStatus ?? "active",
    isActive: data?.isActive ?? true,
    publishPublic: true,
    publishedAt: data?.publishedAt ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await publicRef.set(payload, { merge: true });
}

async function closePublicJob(companyId: string, jobId: string) {
  const publicRef = db.collection("publicJobs").doc(`${companyId}_${jobId}`);
  await publicRef.delete();
}

function publicCompanyProjection(data: Record<string, unknown>) {
  const projection: Record<string, unknown> = {
    name: String(data.name || "").trim(),
    logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : null,
    region: typeof data.region === "string" ? data.region : null,
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (typeof data.rubro === "string") projection.rubro = data.rubro;
  if (typeof data.sector === "string") projection.sector = data.sector;
  if (Array.isArray(data.sectors)) {
    projection.sectors = data.sectors
      .map((sector) => String(sector).trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (typeof data.verified === "boolean") projection.verified = data.verified;
  if (typeof data.verificationStatus === "string") {
    projection.verificationStatus = data.verificationStatus;
  }
  return projection;
}

async function syncPublicCompany(
  companyId: string,
  data: Record<string, unknown>
): Promise<void> {
  const publicRef = db.collection("publicCompanies").doc(companyId);
  if (data.isPublic !== true || data.status !== "active") {
    await publicRef.delete();
    return;
  }
  await publicRef.set(publicCompanyProjection(data));
}

export const onCompanyPublicSyncCreated = onDocumentCreated(
  "companies/{companyId}",
  async (event) => {
    const company = event.data;
    if (!company) return;
    const data = company.data();
    if (!data) return;
    await syncPublicCompany(event.params.companyId, data);
  }
);

export const onCompanyPublicSyncUpdated = onDocumentUpdated(
  "companies/{companyId}",
  async (event) => {
    const company = event.data?.after;
    if (!company) return;
    const data = company.data();
    if (!data) return;
    await syncPublicCompany(event.params.companyId, data);
  }
);

export const onJobPublicSyncCreated = onDocumentCreated(
  "companies/{companyId}/jobs/{jobId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as any;
    const { companyId, jobId } = event.params;

    if (data?.publishPublic === true && String(data?.jobStatus || "") === "active") {
      await upsertPublicJob(companyId, jobId, data);
    }
  }
);

/**
 * Jobs status updated (future/active/closed)
 */
export const onJobUpdated = onDocumentUpdated("companies/{companyId}/jobs/{jobId}", async (event) => {
  const before = event.data?.before?.data() as any;
  const after = event.data?.after?.data() as any;
  if (!before || !after) return;

  const { companyId } = event.params;
  const b = normalizeJobStatus(before.jobStatus);
  const a = normalizeJobStatus(after.jobStatus);
  if (b === a) return;

  const fieldsGlobal: Record<string, number> = {};
  const fieldsCompany: Record<string, number> = {};

  const key = (s: "future" | "active" | "closed") =>
    s === "active" ? "jobsActive" : s === "closed" ? "jobsClosed" : "jobsFuture";

  fieldsGlobal[key(b)] = (fieldsGlobal[key(b)] || 0) - 1;
  fieldsGlobal[key(a)] = (fieldsGlobal[key(a)] || 0) + 1;

  fieldsCompany[key(b)] = (fieldsCompany[key(b)] || 0) - 1;
  fieldsCompany[key(a)] = (fieldsCompany[key(a)] || 0) + 1;

  await incGlobal(fieldsGlobal);
  await incCompany(companyId, fieldsCompany);
});

export const onJobPublicSyncUpdated = onDocumentUpdated(
  "companies/{companyId}/jobs/{jobId}",
  async (event) => {
    const before = event.data?.before?.data() as any;
    const after = event.data?.after?.data() as any;
    if (!after) return;

    const { companyId, jobId } = event.params;
    const publishPublic = after?.publishPublic === true;
    const status = String(after?.jobStatus || "");

    if (publishPublic && status === "active") {
      await upsertPublicJob(companyId, jobId, after);
      return;
    }

    if (before?.publishPublic === true || before?.jobStatus === "active") {
      await closePublicJob(companyId, jobId);
    }
  }
);

/**
 * Applications created (per job)
 * Path in rules already: companies/{companyId}/jobs/{jobId}/applications/{appId}
 */
export const onApplicationCreated = onDocumentCreated(
  "companies/{companyId}/jobs/{jobId}/applications/{appId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { companyId } = event.params;
    const data = snap.data() as any;

    const createdAt = data?.createdAt?.toDate?.() || event.data?.createTime?.toDate?.() || new Date();
    const ym = ymFromDate(createdAt);

    const status = normalizeApplicationStatus(data?.status || data?.attendanceStatus);

    await incGlobal({ applicationsTotal: 1 });
    await incMonthly(ym, { applicationsCreated: 1 });

    await incCompany(companyId, { applicationsTotal: 1 }, { lastApplicationAt: FieldValue.serverTimestamp() });

    // si ya viene "hired" al crear (poco común), suma
    if (status === "hired") {
      await incGlobal({ hiresTotal: 1 });
      await incMonthly(ym, { hiresCreated: 1 });
      await incCompany(companyId, { hiresTotal: 1 });
    }
  }
);

/**
 * Application updated (status changes to hired/rejected etc)
 * Only tracks hired transitions (for placement metrics)
 */
export const onApplicationUpdated = onDocumentUpdated(
  "companies/{companyId}/jobs/{jobId}/applications/{appId}",
  async (event) => {
    const before = event.data?.before?.data() as any;
    const after = event.data?.after?.data() as any;
    if (!before || !after) return;

    const { companyId } = event.params;

    const b = normalizeApplicationStatus(before.status || before.attendanceStatus);
    const a = normalizeApplicationStatus(after.status || after.attendanceStatus);
    if (b === a) return;

    // Only hired counter
    if (b !== "hired" && a === "hired") {
      const updatedAt = event.data?.after?.updateTime?.toDate?.() || new Date();
      const ym = ymFromDate(updatedAt);
      await incGlobal({ hiresTotal: 1 });
      await incMonthly(ym, { hiresCreated: 1 });
      await incCompany(companyId, { hiresTotal: 1 });
    }

    if (b === "hired" && a !== "hired") {
      // rare: rollback
      const updatedAt = event.data?.after?.updateTime?.toDate?.() || new Date();
      const ym = ymFromDate(updatedAt);
      await incGlobal({ hiresTotal: -1 });
      await incMonthly(ym, { hiresCreated: -1 });
      await incCompany(companyId, { hiresTotal: -1 });
    }
  }
);

export const onMatchCreated = onDocumentCreated("matches/{matchId}", async (event) => {
  const data = event.data?.data() as any;
  if (!data) return;
  const companyId = String(data.companyId || "");
  const createdAt = data?.createdAt?.toDate?.() || event.data?.createTime?.toDate?.() || new Date();
  const ym = ymFromDate(createdAt);
  await incGlobal({matchesTotal: 1});
  await incMonthly(ym, {matchesCreated: 1});
  if (companyId) await incCompany(companyId, {matchesTotal: 1});
});

export const onMatchUpdated = onDocumentUpdated("matches/{matchId}", async (event) => {
  const before = event.data?.before.data() as any;
  const after = event.data?.after.data() as any;
  if (!before || !after || before.state === after.state) return;
  const companyId = String(after.companyId || "");
  const ym = ymFromDate(new Date());
  if (before.state !== "matched" && after.state === "matched") {
    await incGlobal({matchesConfirmed: 1});
    await incMonthly(ym, {matchesConfirmed: 1});
    if (companyId) await incCompany(companyId, {matchesConfirmed: 1});
  }
});

/**
 * =========================
 *  LEADS EMAIL (Callable -> Outbox)
 * =========================
 */
function buildLeadEmailTemplate(
  templateKey: "contact" | "approved" | "rejected",
  lead: any,
  replyTo: string
) {
  const companyName = String(lead?.companyName || "tu empresa");
  const baseSignature = `\n\nSaludos,\nEquipo AgroConnect\nResponde a este correo o escribe a ${replyTo}`;

  if (templateKey === "approved") {
    return {
      subject: `AgroConnect: incorporación aprobada para ${companyName}`,
      text:
        `Hola ${companyName},\n\nTu solicitud fue aprobada. En breve te contactaremos con los próximos pasos para completar el onboarding y activar tu perfil.` +
        baseSignature,
      html: `<p>Hola ${companyName},</p><p>Tu solicitud fue aprobada. En breve te contactaremos con los próximos pasos para completar el onboarding y activar tu perfil.</p><p>Saludos,<br/>Equipo AgroConnect<br/>Responde a este correo o escribe a ${replyTo}</p>`,
    };
  }

  if (templateKey === "rejected") {
    return {
      subject: `AgroConnect: actualización sobre tu solicitud`,
      text:
        `Hola ${companyName},\n\nGracias por tu interés. Por ahora no podemos avanzar con la incorporación, pero podremos retomar en el futuro si cambian las condiciones.` +
        baseSignature,
      html: `<p>Hola ${companyName},</p><p>Gracias por tu interés. Por ahora no podemos avanzar con la incorporación, pero podremos retomar en el futuro si cambian las condiciones.</p><p>Saludos,<br/>Equipo AgroConnect<br/>Responde a este correo o escribe a ${replyTo}</p>`,
    };
  }

  return {
    subject: `AgroConnect: recibimos tu solicitud`,
    text:
      `Hola ${companyName},\n\nGracias por contactarnos. Revisaremos tu solicitud y te responderemos pronto con los próximos pasos.` +
      baseSignature,
    html: `<p>Hola ${companyName},</p><p>Gracias por contactarnos. Revisaremos tu solicitud y te responderemos pronto con los próximos pasos.</p><p>Saludos,<br/>Equipo AgroConnect<br/>Responde a este correo o escribe a ${replyTo}</p>`,
  };
}

export const sendLeadEmail = onCall({ region: "us-central1" }, async (request) => {
  const user = request.auth;
  if (!user?.uid || !user?.token) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  if (!await hasCurrentSuperadminClaims(user.uid)) {
    throw new HttpsError("permission-denied", "No tienes permisos para enviar correos.");
  }

  const leadId = String(request.data?.leadId || "").trim();
  const templateKey = String(request.data?.templateKey || "").trim() as
    | "contact"
    | "approved"
    | "rejected";

  if (!leadId || !["contact", "approved", "rejected"].includes(templateKey)) {
    throw new HttpsError("invalid-argument", "leadId y templateKey son obligatorios.");
  }

  const leadSnap = await db.collection("company_leads").doc(leadId).get();
  if (!leadSnap.exists) {
    throw new HttpsError("not-found", "Lead no encontrado.");
  }

  const lead = leadSnap.data() as any;
  if (!lead?.email) {
    throw new HttpsError("failed-precondition", "El lead no tiene email.");
  }

  const replyTo = await getReplyToEmail();
  const template = buildLeadEmailTemplate(templateKey, lead, replyTo);

  const outboxRef = db.collection("comms_outbox").doc();
  await outboxRef.set({
    to: lead.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    replyTo,
    status: "queued",
    createdAt: FieldValue.serverTimestamp(),
    meta: {
      leadId,
      templateKey,
      createdByUid: user.uid,
      createdByEmail: user.token.email || null,
    },
  });

  return { ok: true, outboxId: outboxRef.id };
});

/**
 * =========================
 *  AI OPERATIONAL AUDIT (Gemini)
 * =========================
 */
async function safeCount(queryRef: any): Promise<number | null> {
  try {
    const snap = await queryRef.count().get();
    return snap.data().count ?? 0;
  } catch (e) {
    console.error("safeCount error:", e);
    return null;
  }
}

export const runOperationalAudit = onCall(
  {
    region: "us-central1",
    secrets: [GEMINI_API_KEY],
  },
  async (request) => {
    const user = await assertAuthenticated(request);
    if (!await hasCurrentSuperadminClaims(user.uid)) {
      throw new HttpsError("permission-denied", "No tienes permisos para ejecutar auditorías.");
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "IA no configurada aún.");
    }

    const dataQualityNotes: string[] = [];
    const totalCompaniesActive =
      (await safeCount(db.collection("companies").where("status", "==", "active"))) ?? 0;

    let totalJobsActive = await safeCount(db.collectionGroup("jobs").where("isActive", "==", true));
    if (totalJobsActive === null || totalJobsActive === 0) {
      const alt = await safeCount(db.collectionGroup("jobs").where("jobStatus", "==", "active"));
      if (alt !== null) totalJobsActive = alt;
      if (alt === null) dataQualityNotes.push("No se pudo contar ofertas activas (jobs).");
    }

    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const totalApplicationsLast30d = await safeCount(
      db.collectionGroup("applications").where("createdAt", ">=", last30d)
    );
    if (totalApplicationsLast30d === null) {
      dataQualityNotes.push("No se pudo contar postulaciones en los últimos 30 días.");
    }

    const leadsPending = await safeCount(db.collection("company_leads").where("status", "==", "pending"));
    if (leadsPending === null) {
      dataQualityNotes.push("No se pudo contar leads pendientes.");
    }

    const overdueCompanies = await safeCount(
      db.collection("companies").where("status", "==", "overdue")
    );
    if (overdueCompanies === null) {
      dataQualityNotes.push("No hay señal clara de morosidad disponible.");
    }

    const metrics = {
      totalCompaniesActive,
      totalJobsActive: totalJobsActive ?? 0,
      totalApplicationsLast30d: totalApplicationsLast30d ?? 0,
      leadsPending: leadsPending ?? 0,
      overdueCompanies: overdueCompanies ?? "N/A",
    };

    const prompt = `Eres un auditor operativo para AgroConnect. Analiza las métricas y devuelve SOLO JSON estricto con esta forma:
{
  "healthScore": 0-100,
  "summary": "string breve",
  "risks": ["..."],
  "recommendations": ["..."],
  "dataQualityNotes": ["..."]
}

Métricas:
${JSON.stringify(metrics)}

Notas de calidad de datos existentes:
${JSON.stringify(dataQualityNotes)}

Incluye las notas de calidad de datos, y agrega otras si detectas inconsistencias.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new HttpsError("internal", `Gemini error: ${text.slice(0, 500)}`);
    }

    const data = (await response.json()) as any;
    const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!contentText) {
      throw new HttpsError("internal", "Respuesta vacía desde Gemini.");
    }

    let analysis: any;
    try {
      analysis = JSON.parse(contentText);
    } catch (e) {
      console.error("Gemini parse error:", e);
      throw new HttpsError("internal", "Respuesta de IA no es JSON válido.");
    }

    const auditRef = db.collection("audits").doc();
    await auditRef.set({
      createdAt: FieldValue.serverTimestamp(),
      inputs: metrics,
      output: analysis,
      meta: {
        requestedByUid: user.uid,
        requestedByEmail: user.token.email || null,
      },
    });

    return {
      ok: true,
      metrics,
      analysis,
      auditId: auditRef.id,
    };
  }
);

/**
 * =========================
 *  IA PARA DIFUSIONES Y DESCRIPCIONES
 * =========================
 */
export const redactarDifusion = onCall(
  {
    region: "us-central1",
    secrets: [GEMINI_API_KEY],
  },
  async (request) => {
    const user = await assertAuthenticated(request);
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "IA no configurada aún.");
    }

    const isSuperadmin = await hasCurrentSuperadminClaims(user.uid);
    if (!isSuperadmin && !await hasAnyCompanyAccess(user.uid)) {
      throw new HttpsError("permission-denied", "No tienes permisos para usar la IA.");
    }

    const context = String(request.data?.context || "").trim().slice(0, 4000);
    const campaignType = String(request.data?.campaignType || "general").trim();
    if (!context) {
      throw new HttpsError("invalid-argument", "Contexto requerido.");
    }

    const prompt = `Eres redactor experto en reclutamiento agrícola. Redacta un mensaje breve para WhatsApp.
Tipo de campaña: ${campaignType}
Contexto: ${context}
Incluye CTA directo a postular y tono cercano. Máximo 600 caracteres.`;

    const text = await callGeminiText(apiKey, prompt, 0.4);

    return { ok: true, text };
  }
);

export const generateJobDescription = onCall(
  {
    region: "us-central1",
    secrets: [GEMINI_API_KEY],
  },
  async (request) => {
    const user = await assertAuthenticated(request);
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "IA no configurada aún.");
    }

    const isSuperadmin = await hasCurrentSuperadminClaims(user.uid);
    if (!isSuperadmin && !await hasAnyCompanyAccess(user.uid)) {
      throw new HttpsError("permission-denied", "No tienes permisos para usar la IA.");
    }

    const basicInfo = String(request.data?.basicInfo || "").trim().slice(0, 4000);
    if (!basicInfo) {
      throw new HttpsError("invalid-argument", "Información base requerida.");
    }

    const prompt = `Actúa como un experto en Reclutamiento Agrícola para el mercado chileno. Redacta una oferta laboral clara y profesional para: ${basicInfo}`;
    const text = await callGeminiText(apiKey, prompt, 0.3);

    return { ok: true, text };
  }
);

export const aiReview = onCall(
  {
    region: "us-central1",
    secrets: [GEMINI_API_KEY],
  },
  async (request) => {
    const user = await assertAuthenticated(request);
    if (!await hasCurrentSuperadminClaims(user.uid)) {
      throw new HttpsError("permission-denied", "No tienes permisos para ejecutar AI Review.");
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "IA no configurada aún.");
    }

    const subject = String(request.data?.subject || "").trim();
    const context = String(request.data?.context || "").trim();
    if (!subject) {
      throw new HttpsError("invalid-argument", "Debes indicar el sujeto de revisión.");
    }

    const prompt = `Eres auditor operativo. Analiza el siguiente sujeto y devuelve JSON estricto:
{
  "summary": "string breve",
  "checklist": ["..."],
  "risks": ["..."],
  "nextSteps": ["..."]
}

Sujeto: ${subject}
Contexto adicional: ${context || "N/A"}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new HttpsError("internal", `Gemini error: ${text.slice(0, 500)}`);
    }

    const data = (await response.json()) as any;
    const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!contentText) {
      throw new HttpsError("internal", "Respuesta vacía desde Gemini.");
    }

    let output: any;
    try {
      output = JSON.parse(contentText);
    } catch (e) {
      console.error("aiReview parse error:", e);
      throw new HttpsError("internal", "Respuesta de IA no es JSON válido.");
    }

    const auditRef = db.collection("audits").doc();
    await auditRef.set({
      createdAt: FieldValue.serverTimestamp(),
      inputs: { subject, context },
      output,
      meta: {
        type: "ai_review",
        requestedByUid: user.uid,
        requestedByEmail: user.token.email || null,
      },
    });

    return {
      ok: true,
      output,
      auditId: auditRef.id,
    };
  }
);
/**
 * =========================
 *  COMMS OUTBOX -> EMAIL (Gmail SMTP)
 * =========================
 * Crea un documento en `comms_outbox` desde el dashboard (cliente).
 * Esta Function lo procesa y envía el email real usando Gmail SMTP.
 *
 * Importante:
 * - `comms_outbox` debe ser writeable SOLO para SuperAdmin (rules ya lo cubren).
 * - Esta Function marca estado `sending` / `sent` / `error` y guarda metadata.
 * - Eventarc es "at least once": usamos un lock transaccional para evitar doble envío.
 *
 * Estructura esperada (flexible):
 * {
 *   to: string | string[],
 *   subject: string,
 *   text?: string,
 *   html?: string,
 *   replyTo?: string,          // ignorado, reply-to fijo
 *   fromEmail?: string,        // ignorado, from fijo
 *   fromName?: string,         // opcional (si viene, se ignora para mantener from fijo)
 *   meta?: { companyId?: string, templateKey?: string, createdByUid?: string }
 * }
 */
export const sendEmailFromOutbox = onDocumentCreated(
  {
    document: "comms_outbox/{docId}",
    region: "us-central1",
    secrets: [GMAIL_APP_PASSWORD],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const ref = snap.ref;
    const data = snap.data() as any;

    // Lock/idempotencia
    const locked = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists) return false;

      const d = fresh.data() as any;
      const status = d?.status ?? "queued";
      if (status === "sending" || status === "sent") return false;

      const attempts = (d?.attempts ?? 0) + 1;
      tx.update(ref, {
        status: "sending",
        attempts,
        sendingAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!locked) return;

    const to = data?.to;
    const subject = String(data?.subject ?? "").trim();
    const text = data?.text ? String(data.text) : undefined;
    const html = data?.html ? String(data.html) : undefined;
    const replyTo = String(data?.replyTo || "").trim() || (await getReplyToEmail());

    if (!to || !subject || (!text && !html)) {
      await ref.update({
        status: "error",
        provider: "gmail",
        error: "Missing required fields: to, subject, and text/html",
        failedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD.value(),
        },
      });

      const msg = {
        to,
        from: {
          name: DEFAULT_FROM_NAME,
          address: GMAIL_USER,
        },
        replyTo,
        subject,
        text,
        html,
      };

      const info = await transporter.sendMail(msg);

      await ref.update({
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        provider: "gmail",
        providerMessageId: info?.messageId || null,
      });
    } catch (e: any) {
      const errMsg = String(e?.message ?? e);

      await ref.update({
        status: "error",
        provider: "gmail",
        error: errMsg.slice(0, 1500),
        failedAt: FieldValue.serverTimestamp(),
      });

      // Lanza para que quede en logs / reintentos controlados por GCF
      throw e;
    }
  }
);

/**
 * =========================
 *  COMMS OUTBOX WATCHDOG
 * =========================
 * Marca como error los mensajes en "sending" que quedaron colgados.
 */
export const commsOutboxWatchdog = onSchedule("every 10 minutes", async () => {
  const cutoffMs = Date.now() - 15 * 60 * 1000;
  const cutoff = Timestamp.fromMillis(cutoffMs);
  const snap = await db
    .collection("comms_outbox")
    .where("status", "==", "sending")
    .where("sendingAt", "<", cutoff)
    .limit(50)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      status: "error",
      error: "watchdog_timeout",
      failedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
});
