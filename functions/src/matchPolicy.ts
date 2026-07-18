export type MatchDecision = "interested" | "declined";
export type CredentialDecision = "verified" | "rejected";
export type HireDecision = "accept" | "reject";
export type CompletionDecision = "confirm" | "dispute";

export const MATCH_STATES = {
  MATCHED: "matched",
  HIRE_PROPOSED: "hire_proposed",
  HIRE_REJECTED: "hire_rejected",
  HIRED: "hired",
  COMPLETION_PROPOSED: "completion_proposed",
  COMPLETION_DISPUTED: "completion_disputed",
  COMPLETED: "completed",
  ADMIN_CLOSED: "closed",
} as const;

export function parseMatchDecision(value: unknown): MatchDecision | null {
  return value === "interested" || value === "declined" ? value : null;
}

export function parseCredentialDecision(value: unknown): CredentialDecision | null {
  return value === "verified" || value === "rejected" ? value : null;
}

export function parseHireDecision(value: unknown): HireDecision | null {
  return value === "accept" || value === "reject" ? value : null;
}

export function parseCompletionDecision(value: unknown): CompletionDecision | null {
  return value === "confirm" || value === "dispute" ? value : null;
}

export function isTerminalMatchState(value: unknown): boolean {
  return [
    "declined",
    "withdrawn",
    MATCH_STATES.HIRE_PROPOSED,
    MATCH_STATES.HIRE_REJECTED,
    MATCH_STATES.HIRED,
    MATCH_STATES.COMPLETION_PROPOSED,
    MATCH_STATES.COMPLETION_DISPUTED,
    MATCH_STATES.COMPLETED,
    MATCH_STATES.ADMIN_CLOSED,
    "expired",
  ].includes(String(value || ""));
}

export function canProposeHire(value: unknown): boolean {
  return value === MATCH_STATES.MATCHED;
}

export function canRespondToHire(value: unknown): boolean {
  return value === MATCH_STATES.HIRE_PROPOSED;
}

export function canProposeCompletion(value: unknown): boolean {
  return value === MATCH_STATES.HIRED || value === MATCH_STATES.COMPLETION_DISPUTED;
}

export function canRespondToCompletion(value: unknown): boolean {
  return value === MATCH_STATES.COMPLETION_PROPOSED;
}

export function canReviewMatch(value: unknown, administrativeClosure: unknown): boolean {
  return value === MATCH_STATES.COMPLETED ||
    (value === MATCH_STATES.ADMIN_CLOSED && administrativeClosure === true);
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
