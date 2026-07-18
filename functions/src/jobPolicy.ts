export type EligibilityReason =
  | "company_inactive"
  | "job_inactive"
  | "job_full"
  | "worker_unavailable"
  | "matching_consent_required"
  | "sector_mismatch"
  | "os10_required"
  | "credential_required";

export interface EligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
  policyVersion: 1;
}

type Data = Record<string, unknown>;

function asData(value: unknown): Data {
  return value && typeof value === "object" ? value as Data : {};
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function isJobActive(job: Data): boolean {
  return job.isActive === true || job.jobStatus === "active";
}

function hasCapacity(job: Data): boolean {
  const needed = Number(job.workersNeeded);
  const filled = Number(job.workersFilled || 0);
  return Number.isFinite(needed) && needed > 0 && filled < needed;
}

export function evaluateEligibility(input: {
  company: unknown;
  job: unknown;
  worker: unknown;
  credentials?: unknown[];
}): EligibilityResult {
  const company = asData(input.company);
  const job = asData(input.job);
  const worker = asData(input.worker);
  const consent = asData(worker.consent);
  const reasons: EligibilityReason[] = [];

  if (company.status !== "active") reasons.push("company_inactive");
  if (!isJobActive(job)) reasons.push("job_inactive");
  if (!hasCapacity(job)) reasons.push("job_full");
  if (worker.available === false || worker.isAvailable === false) {
    reasons.push("worker_unavailable");
  }
  if (worker.discoverable === false || consent.matching !== true) {
    reasons.push("matching_consent_required");
  }

  const sector = String(job.sector || "agriculture");
  const sectors = asStringList(worker.sectors);
  if (!sectors.includes(sector)) reasons.push("sector_mismatch");
  if (job.requiresOs10 === true && worker.os10Status !== "valid") {
    reasons.push("os10_required");
  }

  const requiredCredentials = asStringList(job.requiredCredentialTypes);
  if (requiredCredentials.length > 0) {
    const activeCredentialTypes = new Set(
      (input.credentials || [])
        .map(asData)
        .filter((credential) => credential.status === "active")
        .map((credential) => String(credential.credentialType || ""))
        .filter(Boolean)
    );
    if (requiredCredentials.some((required) => !activeCredentialTypes.has(required))) {
      reasons.push("credential_required");
    }
  }

  return {eligible: reasons.length === 0, reasons, policyVersion: 1};
}

