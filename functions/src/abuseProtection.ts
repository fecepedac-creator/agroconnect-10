import {createHash} from "node:crypto";
import {
  Firestore,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {
  AbusePolicyError,
  AppCheckMode,
  PayloadLimits,
  PayloadMetrics,
  RateLimitPolicy,
  assertPayloadWithinLimits,
  getRateLimitDecision,
  getRateWindow,
  normalizeRateLimitPolicy,
  parseAppCheckMode,
  validateActionName,
  validateIdempotencyKey,
} from "./abusePolicy.js";

const RATE_LIMIT_COLLECTION = "abuseRateLimits";

export interface ProtectedCallableRequest {
  data: unknown;
  app?: {appId?: string};
}

export interface AbuseProtectionOptions {
  action: string;
  identity: string;
  hashSalt?: string;
  appCheckMode?: AppCheckMode | string;
  idempotencyKey?: unknown;
  requireIdempotencyKey?: boolean;
  payloadLimits?: Partial<PayloadLimits>;
  rateLimit?: Partial<RateLimitPolicy>;
  firestore?: Firestore;
  nowMs?: number;
}

export interface AbuseProtectionResult {
  appCheck: "valid" | "reported-missing";
  idempotencyKey?: string;
  payload: PayloadMetrics;
  rateLimit: {
    remaining: number;
    resetsAt: Date;
  };
}

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof AbusePolicyError) {
    return new HttpsError(error.code, error.message, {reason: error.reason});
  }
  console.error("abuse_protection_error", error);
  return new HttpsError(
    "internal",
    "No se pudo validar la protección de la solicitud.",
    {reason: "abuse-protection-failed"}
  );
}

function requireHashSalt(value: string | undefined): string {
  const salt = String(value || process.env.ABUSE_HASH_SALT || "").trim();
  if (salt.length < 32) {
    throw new AbusePolicyError(
      "failed-precondition",
      "abuse-hash-salt-missing",
      "La protección contra abuso no tiene una sal segura configurada."
    );
  }
  return salt;
}

export function getAppCheckStatus(
  request: ProtectedCallableRequest,
  modeInput: AppCheckMode | string = process.env.APP_CHECK_MODE || "report",
  action = "callable"
): "valid" | "reported-missing" {
  const mode = parseAppCheckMode(modeInput);
  if (request.app?.appId) return "valid";
  if (mode === "enforce") {
    throw new HttpsError(
      "failed-precondition",
      "No se pudo verificar la integridad de la aplicación.",
      {reason: "app-check-required", action}
    );
  }
  console.warn("app_check_missing", {action, mode: "report"});
  return "reported-missing";
}

export function buildRateLimitDocumentId(input: {
  identity: string;
  action: string;
  startsAtMs: number;
  hashSalt?: string;
}): string {
  const identity = String(input.identity || "").trim();
  if (!identity) {
    throw new AbusePolicyError(
      "failed-precondition",
      "abuse-identity-missing",
      "No se pudo identificar el origen de la solicitud."
    );
  }
  const action = validateActionName(input.action);
  const salt = requireHashSalt(input.hashSalt);
  return createHash("sha256")
    .update(`${salt}\u0000${identity}\u0000${action}\u0000${input.startsAtMs}`)
    .digest("hex");
}

export async function consumeRateLimit(input: {
  identity: string;
  action: string;
  hashSalt?: string;
  policy?: Partial<RateLimitPolicy>;
  firestore?: Firestore;
  nowMs?: number;
}): Promise<{remaining: number; resetsAt: Date}> {
  const action = validateActionName(input.action);
  const policy = normalizeRateLimitPolicy(input.policy);
  const nowMs = input.nowMs ?? Date.now();
  const window = getRateWindow(nowMs, policy);
  const documentId = buildRateLimitDocumentId({
    identity: input.identity,
    action,
    startsAtMs: window.startsAtMs,
    hashSalt: input.hashSalt,
  });
  const firestore = input.firestore || getFirestore();
  const reference = firestore.collection(RATE_LIMIT_COLLECTION).doc(documentId);

  const remaining = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const currentCount = Number(snapshot.data()?.count || 0);
    const decision = getRateLimitDecision(currentCount, policy);
    if (!decision.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "Has realizado demasiadas solicitudes. Intenta nuevamente más tarde.",
        {
          reason: "rate-limit-exceeded",
          retryAfterSeconds: Math.max(1, Math.ceil((
            window.startsAtMs + policy.windowSeconds * 1_000 - nowMs
          ) / 1_000)),
        }
      );
    }
    transaction.set(reference, {
      count: decision.nextCount,
      windowStartsAt: Timestamp.fromMillis(window.startsAtMs),
      expiresAt: Timestamp.fromMillis(window.expiresAtMs),
      updatedAt: Timestamp.fromMillis(nowMs),
    });
    return decision.remaining;
  });

  return {
    remaining,
    resetsAt: new Date(window.startsAtMs + policy.windowSeconds * 1_000),
  };
}

export async function protectCallable(
  request: ProtectedCallableRequest,
  options: AbuseProtectionOptions
): Promise<AbuseProtectionResult> {
  try {
    const action = validateActionName(options.action);
    const appCheck = getAppCheckStatus(request, options.appCheckMode, action);
    const payload = assertPayloadWithinLimits(request.data, options.payloadLimits);
    const idempotencyKey = validateIdempotencyKey(
      options.idempotencyKey,
      options.requireIdempotencyKey ?? false
    );
    const rateLimit = await consumeRateLimit({
      identity: options.identity,
      action,
      hashSalt: options.hashSalt,
      policy: options.rateLimit,
      firestore: options.firestore,
      nowMs: options.nowMs,
    });
    return {appCheck, idempotencyKey, payload, rateLimit};
  } catch (error) {
    throw toHttpsError(error);
  }
}
