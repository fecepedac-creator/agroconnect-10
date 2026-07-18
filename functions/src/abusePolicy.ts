export type AppCheckMode = "report" | "enforce";

export type AbuseErrorCode =
  | "invalid-argument"
  | "failed-precondition"
  | "resource-exhausted";

export class AbusePolicyError extends Error {
  readonly code: AbuseErrorCode;
  readonly reason: string;

  constructor(code: AbuseErrorCode, reason: string, message: string) {
    super(message);
    this.name = "AbusePolicyError";
    this.code = code;
    this.reason = reason;
  }
}

export interface PayloadLimits {
  maxBytes: number;
  maxDepth: number;
  maxObjectKeys: number;
  maxArrayItems: number;
  maxStringChars: number;
  maxNodes: number;
}

export interface PayloadMetrics {
  bytes: number;
  nodes: number;
  depth: number;
}

export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
  ttlSeconds: number;
}

export interface RateWindow {
  startsAtMs: number;
  expiresAtMs: number;
}

export const DEFAULT_PAYLOAD_LIMITS: PayloadLimits = {
  maxBytes: 32 * 1024,
  maxDepth: 8,
  maxObjectKeys: 100,
  maxArrayItems: 100,
  maxStringChars: 4_000,
  maxNodes: 1_000,
};

export const DEFAULT_RATE_LIMIT: RateLimitPolicy = {
  limit: 10,
  windowSeconds: 60,
  ttlSeconds: 24 * 60 * 60,
};

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AbusePolicyError(
      "failed-precondition",
      "invalid-abuse-configuration",
      `${name} debe ser un entero positivo.`
    );
  }
  return value;
}

export function parseAppCheckMode(value: unknown): AppCheckMode {
  const normalized = String(value || "report").trim().toLowerCase();
  if (normalized === "report" || normalized === "enforce") return normalized;
  throw new AbusePolicyError(
    "failed-precondition",
    "invalid-app-check-mode",
    "APP_CHECK_MODE debe ser report o enforce."
  );
}

export function normalizePayloadLimits(
  overrides: Partial<PayloadLimits> = {}
): PayloadLimits {
  const limits = {...DEFAULT_PAYLOAD_LIMITS, ...overrides};
  return {
    maxBytes: positiveInteger(limits.maxBytes, "maxBytes"),
    maxDepth: positiveInteger(limits.maxDepth, "maxDepth"),
    maxObjectKeys: positiveInteger(limits.maxObjectKeys, "maxObjectKeys"),
    maxArrayItems: positiveInteger(limits.maxArrayItems, "maxArrayItems"),
    maxStringChars: positiveInteger(limits.maxStringChars, "maxStringChars"),
    maxNodes: positiveInteger(limits.maxNodes, "maxNodes"),
  };
}

export function normalizeRateLimitPolicy(
  overrides: Partial<RateLimitPolicy> = {}
): RateLimitPolicy {
  const policy = {...DEFAULT_RATE_LIMIT, ...overrides};
  const normalized = {
    limit: positiveInteger(policy.limit, "limit"),
    windowSeconds: positiveInteger(policy.windowSeconds, "windowSeconds"),
    ttlSeconds: positiveInteger(policy.ttlSeconds, "ttlSeconds"),
  };
  if (normalized.ttlSeconds < normalized.windowSeconds) {
    throw new AbusePolicyError(
      "failed-precondition",
      "invalid-abuse-configuration",
      "ttlSeconds no puede ser menor que windowSeconds."
    );
  }
  return normalized;
}

export function validateIdempotencyKey(
  value: unknown,
  required = true
): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (!required) return undefined;
    throw new AbusePolicyError(
      "invalid-argument",
      "idempotency-key-required",
      "Falta una clave de idempotencia para procesar esta operación."
    );
  }

  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(value)
  ) {
    throw new AbusePolicyError(
      "invalid-argument",
      "invalid-idempotency-key",
      "La clave de idempotencia debe tener entre 16 y 128 caracteres seguros."
    );
  }
  return value;
}

export function validateActionName(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9._-]{2,63}$/.test(value)) {
    throw new AbusePolicyError(
      "failed-precondition",
      "invalid-action-name",
      "La acción de protección tiene un formato inválido."
    );
  }
  return value;
}

export function getRateWindow(
  nowMs: number,
  policyInput: Partial<RateLimitPolicy> = {}
): RateWindow {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new AbusePolicyError(
      "failed-precondition",
      "invalid-clock",
      "No se pudo calcular la ventana de protección."
    );
  }
  const policy = normalizeRateLimitPolicy(policyInput);
  const windowMs = policy.windowSeconds * 1_000;
  const startsAtMs = Math.floor(nowMs / windowMs) * windowMs;
  return {
    startsAtMs,
    expiresAtMs: startsAtMs + policy.ttlSeconds * 1_000,
  };
}

export function getRateLimitDecision(
  currentCount: number,
  policyInput: Partial<RateLimitPolicy> = {}
): {allowed: boolean; nextCount: number; remaining: number} {
  const policy = normalizeRateLimitPolicy(policyInput);
  const count = Number.isSafeInteger(currentCount) && currentCount > 0
    ? currentCount
    : 0;
  const allowed = count < policy.limit;
  const nextCount = allowed ? count + 1 : count;
  return {
    allowed,
    nextCount,
    remaining: Math.max(0, policy.limit - nextCount),
  };
}

export function assertPayloadWithinLimits(
  payload: unknown,
  overrides: Partial<PayloadLimits> = {}
): PayloadMetrics {
  const limits = normalizePayloadLimits(overrides);
  const seen = new WeakSet<object>();
  let nodes = 0;
  let deepest = 0;

  const visit = (value: unknown, depth: number): void => {
    nodes += 1;
    deepest = Math.max(deepest, depth);
    if (nodes > limits.maxNodes) {
      throw new AbusePolicyError(
        "invalid-argument",
        "payload-too-complex",
        "La solicitud contiene demasiados elementos."
      );
    }
    if (depth > limits.maxDepth) {
      throw new AbusePolicyError(
        "invalid-argument",
        "payload-too-deep",
        "La solicitud supera la profundidad permitida."
      );
    }
    if (typeof value === "string" && value.length > limits.maxStringChars) {
      throw new AbusePolicyError(
        "invalid-argument",
        "payload-string-too-long",
        "La solicitud contiene un texto demasiado extenso."
      );
    }
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) {
      throw new AbusePolicyError(
        "invalid-argument",
        "payload-not-serializable",
        "La solicitud no tiene un formato serializable."
      );
    }
    seen.add(value);

    if (Array.isArray(value)) {
      if (value.length > limits.maxArrayItems) {
        throw new AbusePolicyError(
          "invalid-argument",
          "payload-array-too-large",
          "La solicitud contiene una lista demasiado extensa."
        );
      }
      value.forEach((item) => visit(item, depth + 1));
      return;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > limits.maxObjectKeys) {
      throw new AbusePolicyError(
        "invalid-argument",
        "payload-object-too-large",
        "La solicitud contiene demasiados campos."
      );
    }
    entries.forEach(([, item]) => visit(item, depth + 1));
  };

  visit(payload, 0);
  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new AbusePolicyError(
      "invalid-argument",
      "payload-not-serializable",
      "La solicitud no tiene un formato serializable."
    );
  }
  if (serialized === undefined) serialized = "null";
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > limits.maxBytes) {
    throw new AbusePolicyError(
      "invalid-argument",
      "payload-too-large",
      "La solicitud supera el tamaño permitido."
    );
  }
  return {bytes, nodes, depth: deepest};
}
