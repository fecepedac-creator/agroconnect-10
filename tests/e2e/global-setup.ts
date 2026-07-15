import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";

const PROJECT_ID = "demo-mundoconnect";
const COMPANY_ID = "company_e2e";
const COMPANY_EMAIL = "empresa@mundoconnect.test";
const COMPANY_PASSWORD = "MundoConnect123!";

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

  await db.collection("companies").doc(COMPANY_ID).set({
    name: "Empresa Piloto San Clemente",
    rut: "76.000.000-0",
    status: "active",
    subscriptionPlan: "Basic",
    contactEmail: COMPANY_EMAIL,
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
    await db.collection("publicJobs").doc(job.id).set(data);
    await db.collection("companies").doc(COMPANY_ID).collection("jobs").doc(job.id).set(data);
  }

  await deleteApp(app);
}
