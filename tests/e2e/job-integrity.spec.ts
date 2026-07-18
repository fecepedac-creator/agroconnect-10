import {expect, test} from "@playwright/test";
import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";

const PROJECT_ID = "demo-mundoconnect";
const COMPANY_ID = "company_e2e";
const COMPANY_EMAIL = "empresa@mundoconnect.test";
const COMPANY_PASSWORD = "MundoConnect123!";
const WORKER_EMAIL = "match.worker@mundoconnect.test";
const WORKER_PASSWORD = "Trabajador123!";

async function idToken(email: string, password: string): Promise<string> {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key",
    {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({email, password, returnSecureToken: true}),
    }
  );
  const payload = await response.json() as {idToken?: string; error?: unknown};
  if (!response.ok || !payload.idToken) {
    throw new Error(`No se obtuvo token: ${JSON.stringify(payload.error)}`);
  }
  return payload.idToken;
}

async function callFunction(
  name: string,
  token: string,
  data: Record<string, unknown>
): Promise<{ok: boolean; status: number; payload: any}> {
  const response = await fetch(
    `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/${name}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({data}),
    }
  );
  const payload = await response.json();
  return {ok: response.ok && !payload.error, status: response.status, payload};
}

test.describe.serial("integridad transaccional de ofertas", () => {
  test.beforeAll(async () => {
    const app = getApps().find((candidate) => candidate.name === "job-integrity") ||
      initializeApp({projectId: PROJECT_ID}, "job-integrity");
    const auth = getAuth(app);
    const db = getFirestore(app);
    const worker = await auth.getUserByEmail(WORKER_EMAIL);
    await db.collection("workers").doc(worker.uid).set({
      consent: {matching: true},
      discoverable: true,
      available: true,
      isAvailable: true,
    }, {merge: true});
  });

  test.afterAll(async () => {
    const app = getApps().find((candidate) => candidate.name === "job-integrity");
    if (!app) return;
    const db = getFirestore(app);
    const batch = db.batch();
    [
      "eligibility_required_credential",
      "single_capacity_job",
      "manual_close_job",
      "ui_close_job",
    ].forEach((jobId) => {
      batch.delete(db.collection("companies").doc(COMPANY_ID)
        .collection("jobs").doc(jobId));
      batch.delete(db.collection("publicJobs").doc(`${COMPANY_ID}_${jobId}`));
    });
    [
      "capacity_match_a",
      "capacity_match_b",
      "close_match_0",
      "close_match_1",
      "close_match_2",
      "close_match_3",
    ].forEach((matchId) => batch.delete(db.collection("matches").doc(matchId)));
    [
      "capacity_worker_0",
      "capacity_worker_1",
      "close_worker_0",
      "close_worker_1",
      "close_worker_2",
      "close_worker_3",
    ].forEach((workerId) => batch.delete(db.collection("workers").doc(workerId)));
    batch.delete(db.collection("companies").doc("public_projection_e2e"));
    batch.delete(db.collection("publicCompanies").doc("public_projection_e2e"));
    await batch.commit();
    await deleteApp(app);
  });

  test("rechaza postulacion cuando falta una credencial activa", async () => {
    const app = getApps().find((candidate) => candidate.name === "job-integrity")!;
    const auth = getAuth(app);
    const db = getFirestore(app);
    const worker = await auth.getUserByEmail(WORKER_EMAIL);
    const jobId = "eligibility_required_credential";
    const job = {
      companyId: COMPANY_ID,
      jobId,
      companyName: "Empresa Piloto San Clemente",
      title: "Oferta con credencial obligatoria",
      sector: "agriculture",
      workersNeeded: 2,
      workersFilled: 0,
      requiredCredentialTypes: ["integrity_required"],
      isActive: true,
      jobStatus: "active",
      publishPublic: true,
    };
    await db.collection("companies").doc(COMPANY_ID)
      .collection("jobs").doc(jobId).set(job);
    await db.collection("publicJobs").doc(`${COMPANY_ID}_${jobId}`).set(job);

    const token = await idToken(WORKER_EMAIL, WORKER_PASSWORD);
    const result = await callFunction("applyToJob", token, {companyId: COMPANY_ID, jobId});

    expect(result.ok).toBe(false);
    expect(result.payload.error.status).toBe("FAILED_PRECONDITION");
    expect(result.payload.error.details.reasons).toContain("credential_required");
    expect((await db.collection("matches").doc(`${COMPANY_ID}_${jobId}_${worker.uid}`).get()).exists).toBe(false);

    const companyToken = await idToken(COMPANY_EMAIL, COMPANY_PASSWORD);
    const invitation = await callFunction("inviteWorkerToJob", companyToken, {
      companyId: COMPANY_ID,
      jobId,
      workerId: worker.uid,
    });
    expect(invitation.ok).toBe(false);
    expect(invitation.payload.error.details.reasons).toContain("credential_required");
    expect((await db.collection("matches").doc(`${COMPANY_ID}_${jobId}_${worker.uid}`).get()).exists).toBe(false);
  });

  test("impide sobrecontratacion concurrente y cierra al completar cupos", async () => {
    const app = getApps().find((candidate) => candidate.name === "job-integrity")!;
    const db = getFirestore(app);
    const jobId = "single_capacity_job";
    const jobRef = db.collection("companies").doc(COMPANY_ID)
      .collection("jobs").doc(jobId);
    const publicRef = db.collection("publicJobs").doc(`${COMPANY_ID}_${jobId}`);
    const baseJob = {
      companyId: COMPANY_ID,
      jobId,
      title: "Oferta de un solo cupo",
      sector: "agriculture",
      workersNeeded: 1,
      workersFilled: 0,
      isActive: true,
      jobStatus: "active",
      publishPublic: true,
    };
    await Promise.all([jobRef.set(baseJob), publicRef.set(baseJob)]);

    const matchIds = ["capacity_match_a", "capacity_match_b"];
    for (const [index, matchId] of matchIds.entries()) {
      const workerId = `capacity_worker_${index}`;
      await db.collection("workers").doc(workerId).set({
        sectors: ["agriculture"],
        available: true,
        discoverable: true,
        consent: {matching: true},
      });
      await db.collection("matches").doc(matchId).set({
        companyId: COMPANY_ID,
        jobId,
        workerId,
        state: "matched",
        workerDecision: "interested",
        companyDecision: "interested",
      });
    }

    const token = await idToken(COMPANY_EMAIL, COMPANY_PASSWORD);
    const results = await Promise.all(matchIds.map((matchId) =>
      callFunction("markMatchHired", token, {matchId})
    ));

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)?.payload.error.status)
      .toBe("FAILED_PRECONDITION");

    const [job, publicJob, ...matches] = await Promise.all([
      jobRef.get(),
      publicRef.get(),
      ...matchIds.map((matchId) => db.collection("matches").doc(matchId).get()),
    ]);
    expect(job.data()?.workersFilled).toBe(1);
    expect(job.data()?.jobStatus).toBe("closed");
    expect(job.data()?.publishPublic).toBe(false);
    expect(publicJob.exists).toBe(false);
    expect(matches.filter((match) => match.data()?.state === "hired")).toHaveLength(1);

    const hiredIndex = matches.findIndex((match) => match.data()?.state === "hired");
    const retry = await callFunction("markMatchHired", token, {
      matchId: matchIds[hiredIndex],
    });
    expect(retry.ok).toBe(true);
    expect(retry.payload.result.alreadyHired).toBe(true);
    expect((await jobRef.get()).data()?.workersFilled).toBe(1);
  });

  test("cierra oferta sin borrarla, retira publicacion y clausura procesos", async () => {
    const app = getApps().find((candidate) => candidate.name === "job-integrity")!;
    const db = getFirestore(app);
    const jobId = "manual_close_job";
    const jobRef = db.collection("companies").doc(COMPANY_ID)
      .collection("jobs").doc(jobId);
    const publicRef = db.collection("publicJobs").doc(`${COMPANY_ID}_${jobId}`);
    const job = {
      companyId: COMPANY_ID,
      jobId,
      title: "Oferta para cierre manual",
      sector: "agriculture",
      workersNeeded: 3,
      workersFilled: 0,
      isActive: true,
      jobStatus: "active",
      publishPublic: true,
    };
    await Promise.all([jobRef.set(job), publicRef.set(job)]);

    const states = ["worker_interested", "company_interested", "matched", "hired"];
    for (const [index, state] of states.entries()) {
      const workerId = `close_worker_${index}`;
      await db.collection("workers").doc(workerId).set({sectors: ["agriculture"]});
      await db.collection("matches").doc(`close_match_${index}`).set({
        companyId: COMPANY_ID,
        jobId,
        workerId,
        state,
      });
    }

    const token = await idToken(COMPANY_EMAIL, COMPANY_PASSWORD);
    const result = await callFunction("closeJob", token, {
      companyId: COMPANY_ID,
      jobId,
      reason: "e2e_manual_close",
    });
    expect(result.ok).toBe(true);
    expect(result.payload.result.closedMatches).toBe(3);

    const [closedJob, publicJob, audit, ...matches] = await Promise.all([
      jobRef.get(),
      publicRef.get(),
      db.collection("admin_audit").where("companyId", "==", COMPANY_ID).get(),
      ...states.map((_, index) => db.collection("matches").doc(`close_match_${index}`).get()),
    ]);
    expect(closedJob.exists).toBe(true);
    expect(closedJob.data()?.jobStatus).toBe("closed");
    expect(closedJob.data()?.isActive).toBe(false);
    expect(publicJob.exists).toBe(false);
    expect(matches.slice(0, 3).every((match) => match.data()?.state === "closed")).toBe(true);
    expect(matches[3].data()?.state).toBe("hired");
    expect(audit.docs.some((entry) =>
      entry.data().action === "close_job" && entry.data().jobId === jobId
    )).toBe(true);

    const retry = await callFunction("closeJob", token, {companyId: COMPANY_ID, jobId});
    expect(retry.ok).toBe(true);
    expect(retry.payload.result.alreadyClosed).toBe(true);
  });

  test("empresa cierra una oferta desde la interfaz sin borrarla", async ({page}) => {
    const app = getApps().find((candidate) => candidate.name === "job-integrity")!;
    const db = getFirestore(app);
    const jobId = "ui_close_job";
    const jobRef = db.collection("companies").doc(COMPANY_ID)
      .collection("jobs").doc(jobId);
    await jobRef.set({
      companyId: COMPANY_ID,
      jobId,
      title: "Oferta para cerrar desde interfaz",
      description: "Prueba E2E del cierre lógico.",
      sector: "agriculture",
      location: "Talca",
      workersNeeded: 2,
      workersFilled: 0,
      isActive: true,
      jobStatus: "active",
      publishPublic: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await page.goto("/portal-empresas");
    await page.getByRole("button", {name: "Ingresar al entorno E2E"}).click();
    await expect(page.getByRole("heading", {name: "Resumen"})).toBeVisible();
    await page.getByRole("navigation")
      .getByRole("button", {name: "Ofertas", exact: true}).click();
    const card = page.locator("article").filter({hasText: "Oferta para cerrar desde interfaz"});
    await expect(card).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await card.getByRole("button", {name: "Cerrar oferta Oferta para cerrar desde interfaz"}).click();
    await expect(page.getByRole("status")).toContainText("fue cerrada");
    await expect.poll(async () => (await jobRef.get()).data()?.jobStatus).toBe("closed");
    expect((await jobRef.get()).exists).toBe(true);
  });

  test("proyecta solo datos publicos de empresas activas y despublica al cambiar estado", async () => {
    const app = getApps().find((candidate) => candidate.name === "job-integrity")!;
    const db = getFirestore(app);
    const companyId = "public_projection_e2e";
    const companyRef = db.collection("companies").doc(companyId);
    const publicRef = db.collection("publicCompanies").doc(companyId);

    await companyRef.set({
      name: "Empresa Pública E2E",
      logoUrl: "https://example.test/logo.png",
      region: "Maule",
      rubro: "Servicios",
      sector: "security",
      sectors: ["security", "cleaning"],
      status: "active",
      isPublic: true,
      verified: true,
      verificationStatus: "verified",
      adminEmail: "privado@example.test",
      officialPhone: "+56900000000",
      billing: {plan: "private"},
    });

    await expect.poll(
      async () => (await publicRef.get()).exists,
      {timeout: 20_000}
    ).toBe(true);
    const projection = (await publicRef.get()).data() || {};
    expect(projection).toMatchObject({
      name: "Empresa Pública E2E",
      region: "Maule",
      rubro: "Servicios",
      sector: "security",
      sectors: ["security", "cleaning"],
      status: "active",
      verified: true,
      verificationStatus: "verified",
    });
    expect(projection.adminEmail).toBeUndefined();
    expect(projection.officialPhone).toBeUndefined();
    expect(projection.billing).toBeUndefined();

    await companyRef.update({status: "suspended"});
    await expect.poll(
      async () => (await publicRef.get()).exists,
      {timeout: 20_000}
    ).toBe(false);
  });
});
