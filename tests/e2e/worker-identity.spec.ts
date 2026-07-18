import {expect, test} from "@playwright/test";
import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

const PROJECT_ID = "demo-mundoconnect";
const PASSWORD = "Identity123!";
const EMAILS = ["identity.a@mundoconnect.test", "identity.b@mundoconnect.test"];

async function idToken(email: string): Promise<string> {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key",
    {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({email, password: PASSWORD, returnSecureToken: true}),
    }
  );
  const payload = await response.json() as {idToken?: string};
  if (!response.ok || !payload.idToken) throw new Error("No se obtuvo token E2E.");
  return payload.idToken;
}

async function callIdentity(token: string, data: Record<string, unknown>) {
  const response = await fetch(
    `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/upsertWorkerIdentity`,
    {
      method: "POST",
      headers: {"content-type": "application/json", authorization: `Bearer ${token}`},
      body: JSON.stringify({data}),
    }
  );
  const payload = await response.json();
  return {ok: response.ok && !payload.error, payload};
}

test("RUT se reserva y cambia atomicamente sin colisiones", async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
  const app = initializeApp({projectId: PROJECT_ID}, `identity-${Date.now()}`);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const users = [];
  for (const email of EMAILS) {
    const previous = await auth.getUserByEmail(email).catch(() => null);
    if (previous) await auth.deleteUser(previous.uid);
    users.push(await auth.createUser({email, password: PASSWORD, emailVerified: true}));
  }

  try {
    const [tokenA, tokenB] = await Promise.all(EMAILS.map(idToken));
    const register = await callIdentity(tokenA, {
      mode: "register",
      email: EMAILS[0],
      rut: "12.345.678-5",
      profile: {
        fullName: "Persona Identidad A",
        commune: "Talca",
        primaryTrade: "Operario",
        sectors: ["agriculture"],
        mobility: "public_transport",
        consent: {
          version: "e2e-v1",
          matching: true,
          operationalMessages: true,
          marketing: false,
        },
      },
    });
    expect(register.ok).toBe(true);
    expect((await db.collection("workers").doc(users[0].uid).get()).data()?.rut)
      .toBe("123456785");
    expect((await db.collection("worker_usernames").doc("123456785").get()).data()?.uid)
      .toBe(users[0].uid);

    const collision = await callIdentity(tokenB, {
      mode: "update_rut",
      email: EMAILS[1],
      rut: "12.345.678-5",
    });
    expect(collision.ok).toBe(false);
    expect(collision.payload.error.status).toBe("ALREADY_EXISTS");

    const update = await callIdentity(tokenA, {
      mode: "update_rut",
      email: EMAILS[0],
      rut: "11.111.111-1",
    });
    expect(update.ok).toBe(true);
    expect((await db.collection("worker_usernames").doc("123456785").get()).exists)
      .toBe(false);
    expect((await db.collection("worker_usernames").doc("111111111").get()).data()?.uid)
      .toBe(users[0].uid);
  } finally {
    await Promise.all(users.map(async (user) => {
      await Promise.all([
        db.collection("users").doc(user.uid).delete(),
        db.collection("workers").doc(user.uid).delete(),
      ]);
      await auth.deleteUser(user.uid);
    }));
    await Promise.all([
      db.collection("worker_usernames").doc("123456785").delete(),
      db.collection("worker_usernames").doc("111111111").delete(),
    ]);
    await deleteApp(app);
  }
});
