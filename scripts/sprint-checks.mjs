import admin from "firebase-admin";

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

requireEnv("GOOGLE_APPLICATION_CREDENTIALS");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function count(ref, label) {
  try {
    const snapshot = await ref.count().get();
    return { label, count: snapshot.data().count };
  } catch (error) {
    return { label, error: error?.message ?? String(error) };
  }
}

async function run() {
  const results = [];

  results.push(await count(db.collection("companies"), "companies_total"));
  results.push(await count(db.collection("companies").where("isPublic", "==", true), "companies_isPublic_true"));
  results.push(await count(db.collection("companies").where("public", "==", true), "companies_public_true"));
  results.push(await count(db.collection("users"), "users_total"));
  results.push(await count(db.collection("users").where("role", "==", "company_admin"), "users_role_company_admin"));
  results.push(await count(db.collection("users").where("role", "==", "company_hr"), "users_role_company_hr"));
  results.push(await count(db.collection("users").where("role", "==", "worker"), "users_role_worker"));
  results.push(await count(db.collection("users").where("role", "==", null), "users_role_missing"));
  results.push(await count(db.collection("stats_companies"), "stats_companies_total"));
  results.push(await count(db.collection("comms_outbox"), "comms_outbox_total"));
  results.push(await count(db.collectionGroup("jobs"), "jobs_total"));
  results.push(await count(db.collectionGroup("applications"), "applications_total"));
  results.push(await count(db.collectionGroup("broadcasts"), "broadcasts_total"));
  results.push(await count(db.collectionGroup("billing_payments"), "billing_payments_total"));
  results.push(await count(db.collectionGroup("billing_invoices"), "billing_invoices_total"));

  console.table(results);
}

run().catch((error) => {
  console.error("Sprint checks failed:", error);
  process.exit(1);
});
