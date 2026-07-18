export const WORKER_IDENTITY_MODES = ["register", "update_rut"] as const;

export type WorkerIdentityMode = typeof WORKER_IDENTITY_MODES[number];

export class WorkerIdentityPolicyError extends Error {
  constructor(
    public readonly code: "invalid-argument" | "already-exists" | "permission-denied",
    message: string
  ) {
    super(message);
    this.name = "WorkerIdentityPolicyError";
  }
}

export function normalizeChileanRut(value: unknown): string {
  const normalized = String(value || "").replace(/[^0-9kK]/g, "").toLowerCase();
  if (!/^\d{7,8}[0-9k]$/.test(normalized)) {
    throw new WorkerIdentityPolicyError("invalid-argument", "El RUT no tiene un formato válido.");
  }

  const body = normalized.slice(0, -1);
  const suppliedDigit = normalized.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const expectedDigit = remainder === 11 ? "0" : remainder === 10 ? "k" : String(remainder);
  if (suppliedDigit !== expectedDigit) {
    throw new WorkerIdentityPolicyError("invalid-argument", "El dígito verificador del RUT no es válido.");
  }
  return normalized;
}

export function assertRutClaimAvailable(
  existingIndex: Record<string, unknown> | null,
  uid: string
): void {
  if (existingIndex && existingIndex.uid !== uid) {
    throw new WorkerIdentityPolicyError(
      "already-exists",
      "Este RUT ya está asociado a otra cuenta."
    );
  }
}

export function assertTokenEmail(value: unknown): string {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new WorkerIdentityPolicyError(
      "permission-denied",
      "La cuenta autenticada no tiene un correo válido."
    );
  }
  return email;
}
