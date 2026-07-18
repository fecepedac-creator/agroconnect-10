import {expect, test} from "@playwright/test";
import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";

const PROJECT_ID = "demo-mundoconnect";
const COMPANY_ID = "pagination_company";
const PREFIX = "pagination_job_";

test.describe.serial("paginacion publica de ofertas", () => {
  test.beforeAll(async () => {
    const app = getApps().find((candidate) => candidate.name === "job-pagination") ||
      initializeApp({projectId: PROJECT_ID}, "job-pagination");
    const db = getFirestore(app);
    const batch = db.batch();
    const baseTime = Date.now() + 60_000;

    for (let index = 0; index < 45; index += 1) {
      const id = `${PREFIX}${String(index).padStart(2, "0")}`;
      batch.set(db.collection("publicJobs").doc(`${COMPANY_ID}_${id}`), {
        jobId: id,
        companyId: COMPANY_ID,
        companyName: "Empresa Paginacion",
        title: `Oferta paginada ${index}`,
        description: "Oferta aislada para probar cursores.",
        workersNeeded: 2,
        workersFilled: 0,
        location: "Maule",
        sector: "agriculture",
        publishPublic: true,
        isActive: true,
        jobStatus: "active",
        updatedAt: Timestamp.fromMillis(baseTime + index),
      });
    }
    batch.set(db.collection("publicJobs").doc(`${COMPANY_ID}_security_hidden`), {
      jobId: "security_hidden",
      companyId: COMPANY_ID,
      companyName: "Empresa Paginacion",
      title: "Oferta seguridad fuera del sector",
      sector: "security",
      publishPublic: true,
      isActive: true,
      jobStatus: "active",
      updatedAt: Timestamp.fromMillis(baseTime + 100),
    });
    await batch.commit();
  });

  test.afterAll(async () => {
    const app = getApps().find((candidate) => candidate.name === "job-pagination");
    if (!app) return;
    const db = getFirestore(app);
    const batch = db.batch();
    for (let index = 0; index < 45; index += 1) {
      const id = `${PREFIX}${String(index).padStart(2, "0")}`;
      batch.delete(db.collection("publicJobs").doc(`${COMPANY_ID}_${id}`));
    }
    batch.delete(db.collection("publicJobs").doc(`${COMPANY_ID}_security_hidden`));
    await batch.commit();
    await deleteApp(app);
  });

  test("carga paginas de 20 sin mezclar sectores ni duplicar ofertas", async ({page}) => {
    await page.goto("/trabajos?sector=agriculture");
    await expect(page.getByText("Oferta paginada 44", {exact: true})).toBeVisible();
    await expect(page.getByText("Oferta paginada 24", {exact: true})).toHaveCount(0);
    await expect(page.getByText("Oferta seguridad fuera del sector", {exact: true})).toHaveCount(0);

    await page.getByRole("button", {name: "Ver mas ofertas"}).click();
    await expect(page.getByText("Oferta paginada 24", {exact: true})).toBeVisible();
    await expect(page.getByText("Oferta paginada 4", {exact: true})).toHaveCount(0);

    await page.getByRole("button", {name: "Ver mas ofertas"}).click();
    await expect(page.getByText("Oferta paginada 0", {exact: true})).toBeVisible();
    await expect(page.getByRole("button", {name: "Ver mas ofertas"})).toHaveCount(0);
  });

  test("abre directamente una oferta aunque no este en la primera pagina", async ({page}) => {
    await page.goto(`/trabajos/${PREFIX}00?sector=agriculture`);
    await expect(page.getByRole("heading", {name: "Oferta paginada 0"})).toBeVisible();
    await expect(page.getByText("Oferta no disponible", {exact: true})).toHaveCount(0);
  });
});
