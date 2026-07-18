import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";

const PROJECT_ID = "demo-mundoconnect";
const COMPANY_ID = "company_e2e";
const COMPANY_EMAIL = "empresa@mundoconnect.test";
const COMPANY_PASSWORD = "MundoConnect123!";
const WORKER_EMAIL = "match.worker@mundoconnect.test";
const WORKER_PASSWORD = "Trabajador123!";
const SUPERADMIN_EMAIL = "superadmin@mundoconnect.test";
const SUPERADMIN_PASSWORD = "Superadmin123!";

export default async function globalSetup() {
  await Promise.all(getApps().map((app) => deleteApp(app)));
  const app = initializeApp({projectId: PROJECT_ID});
  const auth = getAuth(app);
  const db = getFirestore(app);

  const testUsers = await auth.listUsers();
  const disposableUids = testUsers.users
    .filter((user) => user.email?.endsWith("@mundoconnect.test"))
    .map((user) => user.uid);
  if (disposableUids.length > 0) await auth.deleteUsers(disposableUids);

  const existing = await auth.getUserByEmail(COMPANY_EMAIL).catch(() => null);
  if (existing) await auth.deleteUser(existing.uid);

  const companyUser = await auth.createUser({
    email: COMPANY_EMAIL,
    password: COMPANY_PASSWORD,
    emailVerified: true,
    displayName: "Empresa E2E",
  });
  await auth.setCustomUserClaims(companyUser.uid, {
    role: "company_admin",
    companyId: COMPANY_ID,
  });

  const workerUser = await auth.createUser({
    email: WORKER_EMAIL,
    password: WORKER_PASSWORD,
    emailVerified: true,
    displayName: "Trabajador Match E2E",
  });
  await auth.setCustomUserClaims(workerUser.uid, {role: "worker"});
  const workerProfile = {
    uid: workerUser.uid,
    role: "worker",
    email: WORKER_EMAIL,
    name: "Trabajador Match E2E",
    fullName: "Trabajador Match E2E",
    phone: "+56911112222",
    commune: "San Clemente",
    region: "Maule",
    primaryTrade: "Cosecha",
    skills: ["Cosecha"],
    sectors: ["agriculture"],
    sector: "agriculture",
    available: true,
    isAvailable: true,
    discoverable: true,
    consent: {
      version: "e2e-v1",
      matching: true,
      operationalMessages: true,
      marketing: false,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await db.collection("workers").doc(workerUser.uid).set(workerProfile);
  await db.collection("users").doc(workerUser.uid).set(workerProfile);
  await db.collection("discoverableWorkers").doc(workerUser.uid).set({
    workerId: workerUser.uid,
    displayName: "Trabajador M.",
    region: "Maule",
    commune: "San Clemente",
    primaryTrade: "Cosecha",
    skills: ["Cosecha"],
    sectors: ["agriculture"],
    sector: "agriculture",
    isAvailable: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const superadminUser = await auth.createUser({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
    emailVerified: true,
  });
  await auth.setCustomUserClaims(superadminUser.uid, {role: "superadmin", admin: true, superadmin: true});

  const deletionUser = await auth.createUser({
    email: "delete.worker@mundoconnect.test",
    password: WORKER_PASSWORD,
    emailVerified: true,
  });
  await auth.setCustomUserClaims(deletionUser.uid, {role: "worker"});
  await db.collection("workers").doc(deletionUser.uid).set({
    uid: deletionUser.uid,
    role: "worker",
    name: "Persona por eliminar",
    email: "delete.worker@mundoconnect.test",
    phone: "+56999990000",
    available: false,
  });
  await db.collection("workers").doc(deletionUser.uid).collection("applications").doc("old_application").set({
    workerId: deletionUser.uid,
    companyId: COMPANY_ID,
    jobId: "trust_job",
  });
  await db.collection("users").doc(deletionUser.uid).set({uid: deletionUser.uid, role: "worker"});
  await db.collection("discoverableWorkers").doc(deletionUser.uid).set({workerId: deletionUser.uid});
  await db.collection("data_deletion_requests").doc(deletionUser.uid).set({
    uid: deletionUser.uid,
    email: "delete.worker@mundoconnect.test",
    status: "pending",
    requestedAt: FieldValue.serverTimestamp(),
  });
  await db.collection("matches").doc("trust_deletion_match").set({
    companyId: COMPANY_ID,
    jobId: "trust_job",
    workerId: deletionUser.uid,
    workerName: "Persona por eliminar",
    workerEmail: "delete.worker@mundoconnect.test",
    workerPhone: "+56999990000",
    state: "closed",
  });

  await db.collection("companies").doc(COMPANY_ID).set({
    name: "Empresa Piloto San Clemente",
    rut: "76.000.000-0",
    status: "active",
    subscriptionPlan: "Basic",
    contactEmail: COMPANY_EMAIL,
    hrEmail: COMPANY_EMAIL,
    officialPhone: "+56922223333",
    adminEmail: COMPANY_EMAIL,
    region: "Maule",
    commune: "San Clemente",
    sectors: ["agriculture", "security"],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.collection("companies").doc(COMPANY_ID).collection("company_members").doc(companyUser.uid).set({
    uid: companyUser.uid,
    companyId: COMPANY_ID,
    email: COMPANY_EMAIL,
    role: "company_admin",
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const jobs = [
    {
      id: "agriculture_e2e",
      title: "Cosecha piloto San Clemente",
      sector: "agriculture",
      category: "Cosecha",
      location: "San Clemente",
      transportMode: "employer_transport",
    },
    {
      id: "security_e2e",
      title: "Guardia piloto Talca",
      sector: "security",
      category: "Seguridad",
      location: "Talca",
      shiftType: "day",
    },
  ];

  for (const job of jobs) {
    const data = {
      ...job,
      jobId: job.id,
      companyId: COMPANY_ID,
      companyName: "Empresa Piloto San Clemente",
      description: "Oferta aislada para pruebas E2E.",
      workersNeeded: 5,
      workersFilled: 0,
      isActive: true,
      jobStatus: "active",
      publishPublic: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection("publicJobs").doc(`${COMPANY_ID}_${job.id}`).set(data);
    await db.collection("companies").doc(COMPANY_ID).collection("jobs").doc(job.id).set(data);
  }

  await db.collection("companies").doc(COMPANY_ID).collection("jobs").doc("trust_job").set({
    companyId: COMPANY_ID,
    title: "Oferta de control de confianza",
    location: "Talca",
    workersNeeded: 1,
    isActive: true,
    jobStatus: "active",
    publishPublic: true,
  });
  await db.collection("safety_reports").doc("report_e2e").set({
    reporterUid: workerUser.uid,
    reporterEmail: WORKER_EMAIL,
    category: "false_offer",
    details: "Oferta aislada para validar la resolucion administrativa.",
    companyId: COMPANY_ID,
    jobId: "trust_job",
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
  });

  await deleteApp(app);
}
