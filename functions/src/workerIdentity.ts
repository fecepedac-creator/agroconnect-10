import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {
  assertRutClaimAvailable,
  assertTokenEmail,
  normalizeChileanRut,
  WorkerIdentityPolicyError,
  type WorkerIdentityMode,
} from "./workerIdentityPolicy";

type Data = Record<string, unknown>;
type RegisterProfile = {
  fullName: string;
  phone?: string;
  commune: string;
  primaryTrade: string;
  sectors: Array<"agriculture" | "security">;
  mobility: "needs_transport" | "public_transport" | "own_transport";
  consent: {
    version: string;
    matching: true;
    operationalMessages: boolean;
    marketing: boolean;
  };
};

function asData(value: unknown): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkerIdentityPolicyError("invalid-argument", "La solicitud no es válida.");
  }
  return value as Data;
}

function boundedString(value: unknown, field: string, max: number, required = true): string | undefined {
  const result = String(value || "").trim();
  if ((!result && required) || result.length > max) {
    throw new WorkerIdentityPolicyError("invalid-argument", `${field} no es válido.`);
  }
  return result || undefined;
}

function parseRegisterProfile(value: unknown): RegisterProfile {
  const data = asData(value);
  const sectors = Array.isArray(data.sectors) ? data.sectors : [];
  const allowedSectors = new Set(["agriculture", "security"]);
  if (
    sectors.length < 1 ||
    sectors.length > 2 ||
    sectors.some((sector) => typeof sector !== "string" || !allowedSectors.has(sector))
  ) {
    throw new WorkerIdentityPolicyError("invalid-argument", "Los sectores no son válidos.");
  }

  const mobility = String(data.mobility || "");
  if (!new Set(["needs_transport", "public_transport", "own_transport"]).has(mobility)) {
    throw new WorkerIdentityPolicyError("invalid-argument", "La modalidad de traslado no es válida.");
  }

  const consent = asData(data.consent);
  if (
    consent.matching !== true ||
    typeof consent.operationalMessages !== "boolean" ||
    typeof consent.marketing !== "boolean"
  ) {
    throw new WorkerIdentityPolicyError("invalid-argument", "El consentimiento no es válido.");
  }

  return {
    fullName: boundedString(data.fullName, "El nombre", 120) as string,
    phone: boundedString(data.phone, "El teléfono", 30, false),
    commune: boundedString(data.commune, "La comuna", 120) as string,
    primaryTrade: boundedString(data.primaryTrade, "El oficio", 120) as string,
    sectors: sectors as RegisterProfile["sectors"],
    mobility: mobility as RegisterProfile["mobility"],
    consent: {
      version: boundedString(consent.version, "La versión de consentimiento", 40) as string,
      matching: true,
      operationalMessages: consent.operationalMessages as boolean,
      marketing: consent.marketing as boolean,
    },
  };
}

function parseInput(value: unknown): {
  mode: WorkerIdentityMode;
  rut?: string;
  suppliedEmail?: string;
  profile?: RegisterProfile;
} {
  const data = asData(value);
  const keys = Object.keys(data);
  if (keys.some((key) => !["mode", "rut", "email", "profile"].includes(key))) {
    throw new WorkerIdentityPolicyError("invalid-argument", "La solicitud contiene campos no permitidos.");
  }
  const mode = String(data.mode || "");
  if (mode !== "register" && mode !== "update_rut") {
    throw new WorkerIdentityPolicyError("invalid-argument", "La operación no es válida.");
  }
  if (mode === "register" && !data.profile) {
    throw new WorkerIdentityPolicyError("invalid-argument", "Falta el perfil del trabajador.");
  }
  return {
    mode,
    rut: data.rut == null || data.rut === "" ? undefined : normalizeChileanRut(data.rut),
    suppliedEmail: data.email == null ? undefined : String(data.email).trim().toLowerCase(),
    profile: mode === "register" ? parseRegisterProfile(data.profile) : undefined,
  };
}

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof WorkerIdentityPolicyError) {
    return new HttpsError(error.code, error.message);
  }
  console.error("upsertWorkerIdentity error", error);
  return new HttpsError("internal", "No se pudo guardar la identidad del trabajador.");
}

export const upsertWorkerIdentity = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const email = assertTokenEmail(request.auth?.token?.email);
    const input = parseInput(request.data);
    if (input.suppliedEmail && input.suppliedEmail !== email) {
      throw new WorkerIdentityPolicyError(
        "permission-denied",
        "El correo no coincide con la cuenta autenticada."
      );
    }
    if (input.mode === "update_rut" && !input.rut) {
      throw new WorkerIdentityPolicyError("invalid-argument", "Debes indicar un RUT válido.");
    }

    const db = getFirestore();
    const userRef = db.collection("users").doc(uid);
    const workerRef = db.collection("workers").doc(uid);
    const now = FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const workerSnap = await transaction.get(workerRef);
      const priorRutValue = workerSnap.data()?.rut || userSnap.data()?.rut;
      const priorRut = typeof priorRutValue === "string" ? priorRutValue : undefined;
      const nextIndexRef = input.rut
        ? db.collection("worker_usernames").doc(input.rut)
        : null;
      const oldIndexRef = priorRut && priorRut !== input.rut
        ? db.collection("worker_usernames").doc(priorRut)
        : null;
      const nextIndexSnap = nextIndexRef ? await transaction.get(nextIndexRef) : null;
      const oldIndexSnap = oldIndexRef ? await transaction.get(oldIndexRef) : null;

      if (nextIndexSnap?.exists) {
        assertRutClaimAvailable(nextIndexSnap.data() || null, uid);
      }
      if (input.mode === "update_rut" && !workerSnap.exists && !userSnap.exists) {
        throw new WorkerIdentityPolicyError(
          "permission-denied",
          "Primero debes completar el registro del trabajador."
        );
      }

      const provider = String(request.auth?.token?.firebase?.sign_in_provider || "password");
      const profile: Data = {
        uid,
        email,
        role: "worker",
        authProviders: Array.from(new Set([
          ...((workerSnap.data()?.authProviders as string[] | undefined) || []),
          provider,
        ])),
        updatedAt: now,
        lastSeen: now,
      };
      if (input.profile) {
        Object.assign(profile, {
          displayName: input.profile.fullName,
          fullName: input.profile.fullName,
          commune: input.profile.commune,
          primaryTrade: input.profile.primaryTrade,
          sectors: input.profile.sectors,
          mobility: input.profile.mobility,
          consent: {...input.profile.consent, acceptedAt: now},
          discoverable: true,
        });
        if (input.profile.phone) profile.phone = input.profile.phone;
      }
      if (input.rut) profile.rut = input.rut;
      if (!userSnap.exists || !workerSnap.exists) profile.createdAt = now;

      transaction.set(userRef, profile, {merge: true});
      transaction.set(workerRef, profile, {merge: true});
      if (nextIndexRef) {
        const indexData: Data = {uid, email, updatedAt: now};
        if (!nextIndexSnap?.exists) indexData.createdAt = now;
        transaction.set(nextIndexRef, indexData, {merge: true});
      }
      if (oldIndexRef && oldIndexSnap?.data()?.uid === uid) {
        transaction.delete(oldIndexRef);
      }
    });

    return {ok: true, uid, email, rut: input.rut || null};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw toHttpsError(error);
  }
});
