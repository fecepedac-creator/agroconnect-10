export type MatchDecision = "interested" | "declined";
export type CredentialDecision = "verified" | "rejected";

export function parseMatchDecision(value: unknown): MatchDecision | null {
  return value === "interested" || value === "declined" ? value : null;
}

export function parseCredentialDecision(value: unknown): CredentialDecision | null {
  return value === "verified" || value === "rejected" ? value : null;
}

export function isTerminalMatchState(value: unknown): boolean {
  return ["declined", "withdrawn", "hired", "closed", "expired"].includes(String(value || ""));
}

export function canRespondToMatchState(value: unknown): boolean {
  return ["proposed", "worker_interested", "company_interested"].includes(String(value || ""));
}

export function nextMatchState(
  workerDecision: unknown,
  companyDecision: unknown
): "matched" | "worker_interested" | "company_interested" {
  if (workerDecision === "interested" && companyDecision === "interested") return "matched";
  return workerDecision === "interested" ? "worker_interested" : "company_interested";
}

export const SELF_DECLARED_CREDENTIAL_TYPES = [
  "os10",
  "sence",
  "license",
  "training",
  "other",
] as const;

export function isSelfDeclaredCredentialType(value: unknown): boolean {
  return SELF_DECLARED_CREDENTIAL_TYPES.includes(value as typeof SELF_DECLARED_CREDENTIAL_TYPES[number]);
}
