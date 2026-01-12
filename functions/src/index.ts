import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import nodemailer from "nodemailer";

import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ===== Email (Gmail SMTP) =====
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const GMAIL_USER = "agroconnect@gmail.com";
const GMAIL_REPLY_TO = "fecepedac@gmail.com";
const DEFAULT_FROM_NAME = "AgroConnect";

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

  return { ok: true, role, companyId };
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
        replyTo: GMAIL_REPLY_TO,
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
