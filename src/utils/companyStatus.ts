import type { CompanyStatus } from "../types";

const COMPANY_STATUS_MAP: Record<string, CompanyStatus> = {
  active: "active",
  inactive: "inactive",
  pending: "pending",
  suspended: "suspended",
  overdue: "overdue",
};

export function normalizeCompanyStatus(input: unknown, fallback: CompanyStatus = "inactive"): CompanyStatus {
  const normalized = String(input || "").trim().toLowerCase();
  if (!normalized) return fallback;

  const mapped = COMPANY_STATUS_MAP[normalized];
  if (mapped) return mapped;

  console.warn("[CompanyStatus] unknown status, fallback applied:", input);
  return fallback;
}
