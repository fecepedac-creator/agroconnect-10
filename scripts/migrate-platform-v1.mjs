import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = new Set(process.argv.slice(2));
const projectArg = process.argv.find((value) => value.startsWith("--project="));
const projectId = projectArg?.split("=", 2)[1]?.trim();
const apply = args.has("--apply");

if (!projectId || projectId.startsWith("REPLACE_WITH_")) {
  console.error("Use --project=<firebase-project-id>. Dry-run is the default.");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();
const auth = getAuth();
const writes = [];
const summary = {
  companies: 0,
  workers: 0,
  membershipsPrepared: 0,
  discoveryProfilesPrepared: 0,
  adminAccountsMissing: 0,
};

const companies = await db.collection("companies").get();
summary.companies = companies.size;
for (const company of companies.docs) {
  const data = company.data();
  const email = String(data.adminEmail || "").trim().toLowerCase();
  if (!email) continue;
  try {
    const user = await auth.getUserByEmail(email);
    writes.push({
      ref: company.ref.collection("company_members").doc(user.uid),
      data: {
        uid: user.uid,
        companyId: company.id,
        email,
        role: "company_admin",
        status: "active",
        createdByUid: "migration_platform_v1",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        activatedAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
      },
    });
    summary.membershipsPrepared += 1;
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      summary.adminAccountsMissing += 1;
      continue;
    }
    throw error;
  }
}

const workers = await db.collection("workers").get();
summary.workers = workers.size;
for (const worker of workers.docs) {
  const data = worker.data();
  const fullName = String(data.displayName || data.fullName || "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const displayName = parts.length > 1
    ? parts[0] + " " + parts[1].slice(0, 1) + "."
    : parts[0] || "Trabajador";
  writes.push({
    ref: db.collection("discoverableWorkers").doc(worker.id),
    data: {
      workerId: worker.id,
      displayName,
      region: String(data.region || ""),
      commune: String(data.commune || data.comuna || ""),
      skills: Array.isArray(data.skills) ? data.skills.slice(0, 20) : [],
      experienceTags: Array.isArray(data.experienceTags)
        ? data.experienceTags.slice(0, 20)
        : [],
      availabilityStatus: data.isAvailable === false ? "unavailable" : "available",
      isAvailable: data.isAvailable !== false,
      updatedAt: FieldValue.serverTimestamp(),
      schemaVersion: 2,
    },
  });
  summary.discoveryProfilesPrepared += 1;
}

console.log(JSON.stringify({ projectId, apply, ...summary }, null, 2));
if (!apply) {
  console.log("Dry-run complete. No data was modified.");
  process.exit(0);
}

for (let offset = 0; offset < writes.length; offset += 400) {
  const batch = db.batch();
  for (const write of writes.slice(offset, offset + 400)) {
    batch.set(write.ref, write.data, { merge: true });
  }
  await batch.commit();
}

console.log("Migration applied successfully.");
