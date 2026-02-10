import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Briefcase,
  Building2,
  CreditCard,
  Leaf,
  Mail,
  ScrollText,
  TrendingUp,
  Users,
} from "lucide-react";
import { db } from "../firebase";
import { AppView, type Company, type CompanyStatus, type JobOffer } from "../types";
import { normalizeCompanyStatus } from "../utils/companyStatus";

/**
 * CompanyDashboard (Empresa)
 *
 * ✅ Firestore como fuente única de verdad
 * ✅ Métricas desde agregados: stats_companies/{companyId} + stats_companies/{companyId}/monthly/{YYYY-MM}
 * ✅ Sin queries pesadas (solo doc reads + queries acotadas con limit)
 * ✅ Área financiera y comunicaciones SOLO lectura para empresa
 */

type SubscriptionPlan = "Basic" | "Pro" | "Enterprise";
type CompanyStatsDoc = {
  companyId: string;
  jobsTotal?: number;
  jobsActive?: number;
  jobsFuture?: number;
  jobsClosed?: number;
  applicationsTotal?: number;
  hiresTotal?: number;
  lastJobAt?: any;
  lastApplicationAt?: any;
  updatedAt?: any;
};

type MonthlyStatsDoc = {
  ym: string; // YYYY-MM
  jobsCreated?: number;
  applicationsCreated?: number;
  hiresCreated?: number;
  updatedAt?: any;
};

type BillingRecordDoc = {
  type: "invoice" | "payment";
  amount: number;
  currency: "CLP" | "USD";
  issuedAt?: string; // YYYY-MM-DD
  dueAt?: string; // YYYY-MM-DD
  paidAt?: string; // YYYY-MM-DD
  status: "paid" | "unpaid" | "overdue";
  reference?: string;
  note?: string;
  createdAt?: any;
  createdBy?: { uid?: string; email?: string | null };
};

type CommsOutboxDoc = {
  companyId: string;
  to: string;
  templateKey: "overdue" | "suspension" | "low_activity" | "holiday" | "custom";
  fromEmail?: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  status: "queued" | "sent" | "error";
  createdAt?: any;
  createdBy?: { uid?: string; email?: string | null };
  errorMessage?: string;
};

function clampInt(n: any, fallback = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function ymNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function ymShift(ym: string, deltaMonths: number): string {
  const [y0, m0] = ym.split("-").map((x) => parseInt(x, 10));
  const base = y0 * 12 + (m0 - 1);
  const idx = base + deltaMonths;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function ymLabel(ym: string) {
  const [y, m] = ym.split("-");
  const mm = parseInt(m, 10);
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${names[Math.max(0, Math.min(11, mm - 1))]} ${y}`;
}

function formatMoney(amount: number, currency: "CLP" | "USD") {
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    }).format(amount || 0);
  } catch {
    return `${currency} ${amount || 0}`;
  }
}

function statusLabel(s?: CompanyStatus) {
  switch (s) {
    case "overdue":
      return "🔴 Morosidad";
    case "suspended":
      return "Suspendida";
    case "pending":
      return "Pendiente";
    case "inactive":
      return "Inactiva";
    case "active":
    default:
      return "🟢 Pagos al día";
  }
}

function statusPillClasses(s?: CompanyStatus) {
  switch (s) {
    case "overdue":
      return "border-red-300 bg-red-100 text-red-800 font-semibold";
    case "suspended":
      return "border-gray-300 bg-gray-100 text-gray-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "inactive":
      return "border-gray-300 bg-gray-100 text-gray-700";
    case "active":
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
}

function TrendBadge({
  label,
  delta,
  tooltip,
}: {
  label: string;
  delta: number | null;
  tooltip: string;
}) {
  const up = (delta ?? 0) > 0;
  const down = (delta ?? 0) < 0;
  const flat = (delta ?? 0) === 0;

  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : TrendingUp;

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
        up
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : down
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-gray-200 bg-gray-50 text-gray-700"
      }`}
    >
      <Icon size={14} />
      {label}:{" "}
      {delta == null ? "—" : flat ? "0" : `${delta > 0 ? "+" : ""}${delta}`}
    </span>
  );
}

function KpiCard({
  icon,
  title,
  value,
  subtitle,
  trend,
}: {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  trend?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-500">{title}</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{value}</div>
          {subtitle ? <div className="mt-1 text-xs text-gray-600">{subtitle}</div> : null}
        </div>
        <div className="shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-2 text-gray-700">
          {icon}
        </div>
      </div>
      {trend ? <div className="mt-3 flex flex-wrap gap-2">{trend}</div> : null}
    </div>
  );
}

export default function CompanyDashboard({
  company,
  jobs,
  onNavigate,
}: {
  company: Company;
  jobs: JobOffer[];
  onNavigate: (view: AppView) => void;
}) {
  const companyId = company?.id;

  const [companyDoc, setCompanyDoc] = useState<Company | null>(company || null);
  const [stats, setStats] = useState<CompanyStatsDoc | null>(null);
  const [monthly, setMonthly] = useState<MonthlyStatsDoc[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  const [billingPayments, setBillingPayments] = useState<(BillingRecordDoc & { id: string })[]>([]);
  const [billingInvoices, setBillingInvoices] = useState<(BillingRecordDoc & { id: string })[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(false);

  const [comms, setComms] = useState<(CommsOutboxDoc & { id: string })[]>([]);
  const [loadingComms, setLoadingComms] = useState(false);

  // --- live company doc (status/plan)
  useEffect(() => {
    if (!companyId) return;
    const ref = doc(db, "companies", companyId);
    const unsub = onSnapshot(
      ref,
      (snap) => setCompanyDoc((snap.data() as any) ? ({ id: snap.id, ...(snap.data() as any) } as any) : null),
      (err) => console.error("company doc error:", err)
    );
    return () => unsub();
  }, [companyId]);

  // --- company stats aggregate
  useEffect(() => {
    if (!companyId) return;
    const ref = doc(db, "stats_companies", companyId);
    const unsub = onSnapshot(
      ref,
      (snap) => setStats((snap.data() as any) || null),
      (err) => console.error("stats_companies error:", err)
    );
    return () => unsub();
  }, [companyId]);

  // --- monthly stats (last 12 months docs) as point reads (no heavy query)
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!companyId) return;
      setLoadingMonthly(true);
      try {
        const now = ymNow();
        const monthsToLoad = Array.from({ length: 12 }).map((_, i) => ymShift(now, -(11 - i))); // oldest -> newest
        const docs = await Promise.all(
          monthsToLoad.map(async (ym) => {
            const ref = doc(db, "stats_companies", companyId, "monthly", ym);
            const snap = await getDoc(ref);
            return snap.exists() ? ({ ...(snap.data() as any), ym } as MonthlyStatsDoc) : ({ ym } as MonthlyStatsDoc);
          })
        );
        if (!alive) return;
        setMonthly(docs);
      } catch (e) {
        console.error("monthly stats load error:", e);
      } finally {
        if (alive) setLoadingMonthly(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [companyId]);

  // --- billing (read-only, limited)
  useEffect(() => {
    if (!companyId) return;
    setLoadingBilling(true);
    const paymentsQuery = query(
      collection(db, "companies", companyId, "billing_payments"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const invoicesQuery = query(
      collection(db, "companies", companyId, "billing_invoices"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsubPayments = onSnapshot(
      paymentsQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any;
        setBillingPayments(list);
        setLoadingBilling(false);
      },
      (err) => {
        console.error("billing payments error:", err);
        setLoadingBilling(false);
      }
    );
    const unsubInvoices = onSnapshot(
      invoicesQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any;
        setBillingInvoices(list);
        setLoadingBilling(false);
      },
      (err) => {
        console.error("billing invoices error:", err);
        setLoadingBilling(false);
      }
    );
    return () => {
      unsubPayments();
      unsubInvoices();
    };
  }, [companyId]);

  // --- comms_outbox (read-only, limited)
  useEffect(() => {
    if (!companyId) return;
    setLoadingComms(true);
    const qComms = query(
      collection(db, "comms_outbox"),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(
      qComms,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any;
        setComms(list);
        setLoadingComms(false);
      },
      (err) => {
        console.error("comms_outbox error:", err);
        setLoadingComms(false);
      }
    );
    return () => unsub();
  }, [companyId]);

  // --- derived: account status & plan
  const plan = (companyDoc?.subscriptionPlan as SubscriptionPlan) || "Basic";
  const status = normalizeCompanyStatus(companyDoc?.status, "active");

  const nowYm = ymNow();
  const last1Ym = ymShift(nowYm, -1);

  const monthMap = useMemo(() => {
    const m = new Map<string, MonthlyStatsDoc>();
    for (const d of monthly) m.set(d.ym, d);
    return m;
  }, [monthly]);

  const billing = useMemo(() => {
    const combined = [...billingPayments, ...billingInvoices];
    return combined.sort((a: any, b: any) => {
      const aTime = a?.createdAt?.toMillis?.() || 0;
      const bTime = b?.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }, [billingPayments, billingInvoices]);

  const sumRange = (startDeltaMonthsInclusive: number, endDeltaMonthsInclusive: number, key: keyof MonthlyStatsDoc) => {
    let s = 0;
    for (let dm = startDeltaMonthsInclusive; dm <= endDeltaMonthsInclusive; dm++) {
      const ym = ymShift(nowYm, dm);
      const doc = monthMap.get(ym);
      s += clampInt((doc as any)?.[key], 0);
    }
    return s;
  };

  const kpiThisMonth = useMemo(() => {
    const d = monthMap.get(nowYm);
    return {
      jobsCreated: clampInt(d?.jobsCreated, 0),
      applicationsCreated: clampInt(d?.applicationsCreated, 0),
      hiresCreated: clampInt(d?.hiresCreated, 0),
    };
  }, [monthMap, nowYm]);

  const trends = useMemo(() => {
    const lastMonth = monthMap.get(last1Ym);
    const prevMonth = monthMap.get(ymShift(nowYm, -2));

    const delta1_apps =
      clampInt(lastMonth?.applicationsCreated, 0) - clampInt(prevMonth?.applicationsCreated, 0);
    const delta1_jobs = clampInt(lastMonth?.jobsCreated, 0) - clampInt(prevMonth?.jobsCreated, 0);
    const delta1_hires = clampInt(lastMonth?.hiresCreated, 0) - clampInt(prevMonth?.hiresCreated, 0);

    const last3_apps = sumRange(-2, 0, "applicationsCreated");
    const prev3_apps = sumRange(-5, -3, "applicationsCreated");
    const last3_jobs = sumRange(-2, 0, "jobsCreated");
    const prev3_jobs = sumRange(-5, -3, "jobsCreated");
    const last3_hires = sumRange(-2, 0, "hiresCreated");
    const prev3_hires = sumRange(-5, -3, "hiresCreated");

    const last12_apps = sumRange(-11, 0, "applicationsCreated");
    const prev12_apps = sumRange(-23, -12, "applicationsCreated");
    const last12_jobs = sumRange(-11, 0, "jobsCreated");
    const prev12_jobs = sumRange(-23, -12, "jobsCreated");
    const last12_hires = sumRange(-11, 0, "hiresCreated");
    const prev12_hires = sumRange(-23, -12, "hiresCreated");

    return {
      delta1: { apps: delta1_apps, jobs: delta1_jobs, hires: delta1_hires },
      delta3: { apps: last3_apps - prev3_apps, jobs: last3_jobs - prev3_jobs, hires: last3_hires - prev3_hires },
      delta12: { apps: last12_apps - prev12_apps, jobs: last12_jobs - prev12_jobs, hires: last12_hires - prev12_hires },
    };
  }, [monthMap, last1Ym, nowYm]);

  const effectiveStats = useMemo(() => {
    return {
      jobsTotal: clampInt(stats?.jobsTotal, jobs?.length || 0),
      jobsActive: clampInt(stats?.jobsActive, jobs?.filter((j: any) => (j.status || "active") === "active").length || 0),
      applicationsTotal: clampInt(stats?.applicationsTotal, 0),
      hiresTotal: clampInt(stats?.hiresTotal, 0),
    };
  }, [stats, jobs]);

  const financial = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const invoices = billing.filter((b) => b.type === "invoice");
    const paid = invoices.filter((i) => i.status === "paid").length;
    const overdue = invoices.filter((i) => i.status === "overdue" || (i.status === "unpaid" && i.dueAt && i.dueAt < today)).length;
    const unpaid = invoices.filter((i) => i.status === "unpaid").length;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const last90 = invoices.filter((i) => {
      const d = i.dueAt || i.issuedAt || "";
      return d >= cutoffStr;
    });

    const scoreBase = last90.length || 1;
    const scorePaid = last90.filter((i) => i.status === "paid").length;
    const scoreOverdue = last90.filter((i) => i.status === "overdue").length;

    const score = Math.max(0, Math.min(100, Math.round((scorePaid / scoreBase) * 100 - scoreOverdue * 10)));

    return { paid, overdue, unpaid, invoicesCount: invoices.length, score };
  }, [billing]);

  const alerts = useMemo(() => {
    const list: { type: "warn" | "info"; title: string; detail: string; action?: { label: string; to: AppView } }[] = [];

    const activeJobs = effectiveStats.jobsActive;
    const appsThisMonth = kpiThisMonth.applicationsCreated;

    if (activeJobs > 0 && appsThisMonth === 0) {
      list.push({
        type: "warn",
        title: "Jobs sin postulaciones este mes",
        detail: "Tienes jobs activos, pero no se registran postulaciones en el período actual.",
        action: { label: "Revisar postulaciones", to: AppView.WORKERS },
      });
    }

    const last3Jobs = sumRange(-2, 0, "jobsCreated");
    if (last3Jobs === 0) {
      list.push({
        type: "info",
        title: "Baja actividad de publicación",
        detail: "En los últimos 3 meses no hay nuevas publicaciones registradas en las métricas.",
        action: { label: "Crear nuevo job", to: AppView.JOBS },
      });
    }

    const last3Hires = sumRange(-2, 0, "hiresCreated");
    const last3Apps = sumRange(-2, 0, "applicationsCreated");
    if (last3Apps > 10 && last3Hires === 0) {
      list.push({
        type: "info",
        title: "Conversión baja (postulaciones → contrataciones)",
        detail: "Hay volumen de postulaciones, pero no se registran contrataciones recientes. Puede ser filtro/flujo.",
        action: { label: "Ver jobs activos", to: AppView.JOBS },
      });
    }

    if (status === "overdue" || status === "suspended") {
      list.push({
        type: "warn",
        title: status === "overdue" ? "Cuenta con morosidad" : "Cuenta suspendida",
        detail: "Tu cuenta tiene restricciones por estado de pago. Revisa facturas y estado.",
        // ✅ FIX: AppView.SETTINGS -> AppView.SETTINGS_COMPANY
        action: { label: "Ver área financiera", to: AppView.SETTINGS_COMPANY },
      });
    }

    return list.slice(0, 3);
  }, [effectiveStats.jobsActive, kpiThisMonth.applicationsCreated, status, sumRange]);

  const miniSeries = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => ymShift(nowYm, -(5 - i)));
    const points = months.map((ym) => ({
      ym,
      label: ymLabel(ym),
      apps: clampInt(monthMap.get(ym)?.applicationsCreated, 0),
      jobs: clampInt(monthMap.get(ym)?.jobsCreated, 0),
      hires: clampInt(monthMap.get(ym)?.hiresCreated, 0),
    }));
    return points;
  }, [monthMap, nowYm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                <Leaf size={16} />
                AgroConnect
              </span>
              <span className="text-gray-400">/</span>
              <span>EMPRESA</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="text-2xl font-extrabold text-gray-900">{companyDoc?.name || company?.name || "Mi empresa"}</div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusPillClasses(status)}`}>
                {statusLabel(status)}
              </span>
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
                Plan: <b className="ml-1">{plan}</b>
              </span>
            </div>

            <div className="mt-1 text-sm text-gray-600">
              Resumen del período actual: <b>{ymLabel(nowYm)}</b>{" "}
              {loadingMonthly ? <span className="text-gray-400">· cargando métricas…</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate(AppView.PUBLISH_OFFER)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Briefcase size={16} />
              Publicar nueva oferta de trabajo
            </button>
            <button
              onClick={() => onNavigate(AppView.WORKERS)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              <Users size={16} />
              Revisar postulaciones
            </button>
            <button
              // ✅ FIX: AppView.SETTINGS -> AppView.SETTINGS_COMPANY
              onClick={() => onNavigate(AppView.SETTINGS_COMPANY)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              <Building2 size={16} />
              Configuración
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          icon={<Briefcase size={18} />}
          title="Jobs activos"
          value={effectiveStats.jobsActive}
          subtitle={
            <span>
              Total publicados: <b>{effectiveStats.jobsTotal}</b>
            </span>
          }
          trend={
            <>
              <TrendBadge
                label="1m"
                delta={trends.delta1.jobs}
                tooltip="Cambio del mes anterior vs el mes previo a ese (jobs creados)."
              />
              <TrendBadge
                label="3m"
                delta={trends.delta3.jobs}
                tooltip="Cambio últimos 3 meses vs los 3 meses anteriores (jobs creados)."
              />
              <TrendBadge
                label="12m"
                delta={trends.delta12.jobs}
                tooltip="Cambio últimos 12 meses vs los 12 meses anteriores (jobs creados)."
              />
            </>
          }
        />

        <KpiCard
          icon={<BarChart3 size={18} />}
          title="Postulaciones (mes)"
          value={kpiThisMonth.applicationsCreated}
          subtitle={
            <span>
              Acumulado: <b>{effectiveStats.applicationsTotal}</b>
            </span>
          }
          trend={
            <>
              <TrendBadge
                label="1m"
                delta={trends.delta1.apps}
                tooltip="Cambio del mes anterior vs el mes previo a ese (postulaciones creadas)."
              />
              <TrendBadge
                label="3m"
                delta={trends.delta3.apps}
                tooltip="Cambio últimos 3 meses vs los 3 meses anteriores (postulaciones creadas)."
              />
              <TrendBadge
                label="12m"
                delta={trends.delta12.apps}
                tooltip="Cambio últimos 12 meses vs los 12 meses anteriores (postulaciones creadas)."
              />
            </>
          }
        />

        <KpiCard
          icon={<BadgeCheck size={18} />}
          title="Contrataciones (mes)"
          value={kpiThisMonth.hiresCreated}
          subtitle={
            <span>
              Acumulado: <b>{effectiveStats.hiresTotal}</b>
            </span>
          }
          trend={
            <>
              <TrendBadge
                label="1m"
                delta={trends.delta1.hires}
                tooltip="Cambio del mes anterior vs el mes previo a ese (contrataciones creadas)."
              />
              <TrendBadge
                label="3m"
                delta={trends.delta3.hires}
                tooltip="Cambio últimos 3 meses vs los 3 meses anteriores (contrataciones creadas)."
              />
              <TrendBadge
                label="12m"
                delta={trends.delta12.hires}
                tooltip="Cambio últimos 12 meses vs los 12 meses anteriores (contrataciones creadas)."
              />
            </>
          }
        />

        <KpiCard
          icon={<CreditCard size={18} />}
          title="Cumplimiento (90 días)"
          value={`${financial.score}%`}
          subtitle={
            <span>
              Facturas: <b>{financial.invoicesCount}</b> · Pagadas: <b>{financial.paid}</b> · Vencidas:{" "}
              <b className={financial.overdue > 0 ? "text-red-700" : ""}>{financial.overdue}</b>
            </span>
          }
        />
      </div>

      {/* Pulse (mini series) + Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Pulso reciente</div>
              <div className="text-xs text-gray-600">Últimos 6 meses (agregados monthly)</div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
              <ScrollText size={14} />
              {loadingMonthly ? "Cargando…" : "OK"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {miniSeries.map((p) => (
              <div key={p.ym} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-600">{p.label}</div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Jobs</span>
                    <b className="text-gray-900">{p.jobs}</b>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Postulaciones</span>
                    <b className="text-gray-900">{p.apps}</b>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Contrataciones</span>
                    <b className="text-gray-900">{p.hires}</b>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[11px] text-gray-500">
            Nota: esto proviene de <b>stats_companies/{companyId}/monthly</b>. Si algún mes aparece “0”, puede ser
            falta de eventos o métricas aún no generadas.
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Alertas operativas</div>
              <div className="text-xs text-gray-600">Sugerencias accionables</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
              <AlertTriangle size={14} />
              {alerts.length}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {alerts.length === 0 ? (
              <div className="text-sm text-gray-600">Sin alertas relevantes por ahora.</div>
            ) : (
              alerts.map((a, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl border p-3 ${
                    a.type === "warn" ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className={`text-sm font-extrabold ${a.type === "warn" ? "text-red-800" : "text-gray-900"}`}>
                    {a.title}
                  </div>
                  <div className={`mt-1 text-xs ${a.type === "warn" ? "text-red-700" : "text-gray-600"}`}>
                    {a.detail}
                  </div>
                  {a.action ? (
                    <button
                      onClick={() => onNavigate(a.action!.to)}
                      className={`mt-2 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                        a.type === "warn"
                          ? "bg-white border border-red-200 text-red-800 hover:bg-red-100"
                          : "bg-white border border-gray-200 text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      <TrendingUp size={14} />
                      {a.action.label}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Financial + Comms */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Área financiera</div>
              <div className="text-xs text-gray-600">Solo lectura (controlado por SuperAdmin / sistema)</div>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${statusPillClasses(status)}`}>
              {statusLabel(status)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-600">Pagadas</div>
              <div className="mt-1 text-xl font-extrabold text-gray-900">{financial.paid}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-600">Pendientes</div>
              <div className="mt-1 text-xl font-extrabold text-gray-900">{financial.unpaid}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-600">Vencidas</div>
              <div className={`mt-1 text-xl font-extrabold ${financial.overdue > 0 ? "text-red-700" : "text-gray-900"}`}>
                {financial.overdue}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="text-[11px] uppercase text-gray-500 bg-gray-50">
                <tr>
                  <th className="p-3">Factura</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Vence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingBilling ? (
                  <tr>
                    <td className="p-4 text-sm text-gray-600" colSpan={4}>
                      Cargando…
                    </td>
                  </tr>
                ) : (
                  billing
                    .filter((b) => b.type === "invoice")
                    .slice(0, 8)
                    .map((r) => (
                      <tr key={r.id} className="text-sm">
                        <td className="p-3 font-semibold text-gray-900">
                          {r.reference ? `#${r.reference}` : "—"}
                        </td>
                        <td className="p-3 text-gray-800">{formatMoney(r.amount, r.currency)}</td>
                        <td className="p-3">
                          {r.status === "paid" ? (
                            <span className="text-emerald-700 font-semibold">Pagada</span>
                          ) : r.status === "overdue" ? (
                            <span className="text-red-700 font-semibold">Vencida</span>
                          ) : (
                            <span className="text-gray-700">Pendiente</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-gray-600">{r.dueAt || "—"}</td>
                      </tr>
                    ))
                )}

                {!loadingBilling && billing.filter((b) => b.type === "invoice").length === 0 ? (
                  <tr>
                    <td className="p-4 text-sm text-gray-600" colSpan={4}>
                      Sin facturas registradas aún.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-[11px] text-gray-500">
            Score simple = % pagadas (últimos 90 días) con penalización por vencidas. No es contabilidad; es indicador operativo.
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">Comunicaciones</div>
              <div className="text-xs text-gray-600">Mensajes enviados desde AgroConnect (outbox)</div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
              <Mail size={14} />
              {loadingComms ? "Cargando…" : `${comms.length}`}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {loadingComms ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : comms.length === 0 ? (
              <div className="text-sm text-gray-600">Sin mensajes registrados.</div>
            ) : (
              comms.map((m) => (
                <div key={m.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-gray-900 truncate">{m.subject || "—"}</div>
                      <div className="mt-1 text-xs text-gray-600 truncate">
                        Para: {m.to || "—"} · Estado:{" "}
                        <span
                          className={`font-semibold ${
                            m.status === "sent"
                              ? "text-emerald-700"
                              : m.status === "error"
                                ? "text-red-700"
                                : "text-gray-700"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700">
                      <ScrollText size={14} />
                      {m.templateKey}
                    </span>
                  </div>
                  {m.text ? (
                    <div className="mt-2 text-xs text-gray-700 line-clamp-3 whitespace-pre-wrap">{m.text}</div>
                  ) : null}
                  {m.errorMessage ? (
                    <div className="mt-2 text-xs text-red-700 whitespace-pre-wrap">{m.errorMessage}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="mt-2 text-[11px] text-gray-500">
            Fuente: <b>comms_outbox</b> filtrado por companyId, ordenado por createdAt (últimos 10).
          </div>
        </div>
      </div>
    </div>
  );
}
