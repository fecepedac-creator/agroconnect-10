import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import nodemailer from "nodemailer";

import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ===== Email (Gmail SMTP) =====
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GMAIL_USER = "agroconnect@gmail.com";
const GMAIL_REPLY_TO = "fecepedac@gmail.com";
const DEFAULT_FROM_NAME = "AgroConnect";
const SUPERADMIN_EMAILS = ["fecepedac@gmail.com"];

function isSuperAdminToken(token: any): boolean {
  const role = String(token?.role || "").toLowerCase();
  return (
    token?.admin === true ||
    token?.superadmin === true ||
    role === "admin" ||
    role === "superadmin"
  );
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

async function getUserRole(uid: string, token?: any): Promise<string> {
  // First try from claims (no Firestore read)
  if (token?.role) {
    return String(token.role);
  }
  
  // Fallback to Firestore if no claim exists
  try {
    const snap = await db.collection("users").doc(uid).get();
    return String(snap.data()?.role || "none");
  } catch (e) {
    console.error("getUserRole error:", e);
    return "none";
  }
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
 * 
 * IMPORTANT: After calling this function, clients should refresh their ID token
 * by calling getIdToken(true) to get the updated custom claims.
 */
export const syncUserAccess = onCall(async (request) => {
  const user = request.auth;
  if (!user?.uid || !user?.token?.email) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const email = String(user.token.email).toLowerCase();

  // Buscar empresa donde adminEmail coincide
  const snap = await db
    .collection("companies")
    .where("adminEmail", "==", email)
    .limit(1)
    .get();

  let role: "company_admin" | "worker" | "none" = "worker";
  let companyId: string | null = null;

  if (!snap.empty) {
    role = "company_admin";
    companyId = snap.docs[0].id;
  } else {
    role = "worker";
    companyId = null;
  }

  const userRef = db.collection("users").doc(user.uid);

  const payload: any = {
    role,
    companyId,
    email,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const existing = await userRef.get();
  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }

  await userRef.set(payload, { merge: true });

  // Set custom claims on Auth token
  const auth = admin.auth();
  const currentUser = await auth.getUser(user.uid);
  const existingClaims = currentUser.customClaims || {};
  
  // Preserve existing claims (like admin/superadmin) while updating role/companyId
  await auth.setCustomUserClaims(user.uid, {
    ...existingClaims,
    role,
    companyId,
  });

  return { ok: true, role, companyId, claimsUpdated: true };
});

/**
 * =========================
 *  SUPERADMIN CLAIMS (Callable)
 * =========================
 * Setea claims admin/superadmin si el email está en allowlist server-side.
 */
export const syncSuperadminClaims = onCall(async (request) => {
  const user = await assertAuthenticated(request);
  const email = normalizeEmail(user.token.email);
  if (!SUPERADMIN_EMAILS.includes(email)) {
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
  const callerEmail = normalizeEmail(user.token.email);
  const callerIsSuperadmin = isSuperAdminToken(user.token);

  if (!callerIsSuperadmin && !SUPERADMIN_EMAILS.includes(callerEmail)) {
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

function normalizeCompanyStatus(raw: any): "Active" | "Pending" | "Suspended" | "Overdue" {
  const s = String(raw || "Active");
  if (s === "Pending" || s === "Suspended" || s === "Overdue" || s === "Active") return s;
  return "Active";
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

  if (status === "Active") globalFields.companiesActive = 1;
  if (status === "Overdue") globalFields.companiesOverdue = 1;
  if (status === "Suspended") globalFields.companiesSuspended = 1;

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
    Active: "companiesActive",
    Overdue: "companiesOverdue",
    Suspended: "companiesSuspended",
    Pending: "companiesPending",
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
    category: data?.category ?? null,
    paymentType: data?.paymentType ?? null,
    payMode: data?.payMode ?? null,
    payAmount: data?.payAmount ?? null,
    payDetail: data?.payDetail ?? null,
    skillsRequired: data?.skillsRequired ?? null,
    benefits: data?.benefits ?? null,
    transportInfo: data?.transportInfo ?? null,
    otherBenefits: data?.otherBenefits ?? null,
    jobStatus: data?.jobStatus ?? "active",
    isActive: data?.isActive ?? true,
    publishedAt: data?.publishedAt ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await publicRef.set(payload, { merge: true });
}

async function closePublicJob(companyId: string, jobId: string) {
  const publicRef = db.collection("publicJobs").doc(`${companyId}_${jobId}`);
  await publicRef.set(
    {
      jobStatus: "closed",
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

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

  if (!isSuperAdminToken(user.token)) {
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
    if (!isSuperAdminToken(user.token)) {
      throw new HttpsError("permission-denied", "No tienes permisos para ejecutar auditorías.");
    }

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "IA no configurada aún.");
    }

    const dataQualityNotes: string[] = [];
    const totalCompaniesActive =
      (await safeCount(db.collection("companies").where("status", "in", ["active", "Active"]))) ?? 0;

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
      db.collection("companies").where("status", "in", ["overdue", "Overdue"])
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
  \"healthScore\": 0-100,
  \"summary\": \"string breve\",
  \"risks\": [\"...\"],
  \"recommendations\": [\"...\"],
  \"dataQualityNotes\": [\"...\"]
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

    const role = await getUserRole(user.uid, user.token);
    if (!isSuperAdminToken(user.token) && !["company_admin", "company_hr"].includes(role)) {
      throw new HttpsError("permission-denied", "No tienes permisos para usar la IA.");
    }

    const context = String(request.data?.context || "").trim();
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

    const role = await getUserRole(user.uid, user.token);
    if (!isSuperAdminToken(user.token) && !["company_admin", "company_hr"].includes(role)) {
      throw new HttpsError("permission-denied", "No tienes permisos para usar la IA.");
    }

    const basicInfo = String(request.data?.basicInfo || "").trim();
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
    if (!isSuperAdminToken(user.token)) {
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
  const cutoff = admin.firestore.Timestamp.fromMillis(cutoffMs);
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
