import {expect, test} from "@playwright/test";
import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

const PROJECT_ID = "demo-mundoconnect";

async function superadminToken() {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key",
    {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        email: "superadmin@mundoconnect.test",
        password: "Superadmin123!",
        returnSecureToken: true,
      }),
    }
  );
  const payload = await response.json() as {idToken?: string; error?: unknown};
  if (!response.ok || !payload.idToken) throw new Error(`No se obtuvo token SuperAdmin: ${JSON.stringify(payload.error)}`);
  return payload.idToken;
}

async function callFunction(name: string, token: string, data: Record<string, unknown>) {
  const response = await fetch(`http://127.0.0.1:5001/${PROJECT_ID}/us-central1/${name}`, {
    method: "POST",
    headers: {"content-type": "application/json", authorization: `Bearer ${token}`},
    body: JSON.stringify({data}),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(JSON.stringify(payload.error || payload));
  return payload.result;
}

test("SuperAdmin resuelve denuncia y elimina datos con trazabilidad", async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
  const app = initializeApp({projectId: PROJECT_ID}, `trust-${Date.now()}`);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const token = await superadminToken();

  await callFunction("reviewSafetyReport", token, {
    reportId: "report_e2e",
    decision: "suspend_job",
    resolutionNote: "Oferta suspendida por validacion E2E.",
  });
  const [report, job] = await Promise.all([
    db.collection("safety_reports").doc("report_e2e").get(),
    db.collection("companies").doc("company_e2e").collection("jobs").doc("trust_job").get(),
  ]);
  expect(report.data()?.status).toBe("resolved");
  expect(job.data()?.jobStatus).toBe("closed");
  expect(job.data()?.publishPublic).toBe(false);

  const deletionUser = await auth.getUserByEmail("delete.worker@mundoconnect.test");
  await callFunction("reviewDataDeletionRequest", token, {
    uid: deletionUser.uid,
    decision: "complete",
    resolutionNote: "Identidad verificada y eliminacion E2E autorizada.",
  });
  await expect(auth.getUser(deletionUser.uid)).rejects.toMatchObject({code: "auth/user-not-found"});
  expect((await db.collection("workers").doc(deletionUser.uid).get()).exists).toBe(false);
  expect((await db.collection("data_deletion_requests").doc(deletionUser.uid).get()).exists).toBe(false);
  const anonymizedMatch = await db.collection("matches").doc("trust_deletion_match").get();
  expect(anonymizedMatch.data()?.workerId).toMatch(/^deleted_/);
  expect(anonymizedMatch.data()?.workerEmail).toBeUndefined();
  expect((await db.collection("privacy_audit").limit(1).get()).size).toBe(1);

  await deleteApp(app);
});
