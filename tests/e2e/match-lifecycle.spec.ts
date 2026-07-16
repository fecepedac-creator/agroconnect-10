import {expect, test} from "@playwright/test";

test("match completo libera contacto, contratacion y evaluaciones", async ({browser}) => {
  const workerContext = await browser.newContext();
  const workerPage = await workerContext.newPage();

  await workerPage.goto("/auth?sector=agriculture");
  await workerPage.getByLabel("Correo").fill("match.worker@mundoconnect.test");
  await workerPage.locator('input[type="password"]').fill("Trabajador123!");
  await workerPage.getByRole("button", {name: "Ingresar", exact: true}).click();
  await expect(workerPage.getByText("Cosecha piloto San Clemente").first()).toBeVisible();
  await workerPage.getByText("Cosecha piloto San Clemente").first().click();
  await workerPage.getByRole("button", {name: "Postular ahora"}).click();
  await expect(workerPage.getByRole("button", {name: "Ya postulaste"})).toBeVisible();

  const companyContext = await browser.newContext();
  const companyPage = await companyContext.newPage();
  await companyPage.goto("/portal-empresas");
  await companyPage.getByRole("button", {name: "Ingresar al entorno E2E"}).click();
  await companyPage.getByRole("button", {name: "Procesos de selección"}).click();
  await expect(companyPage.getByText("Cosecha piloto San Clemente")).toBeVisible();
  await companyPage.getByRole("button", {name: "Me interesa"}).click();
  await expect(companyPage.getByText("Ambos están interesados")).toBeVisible();
  await companyPage.getByRole("button", {name: "Ver contacto"}).click();
  await expect(companyPage.getByText("+56911112222")).toBeVisible();
  await companyPage.getByRole("button", {name: "Marcar como contratado"}).click();
  await expect(companyPage.getByText("Contratado", {exact: true})).toBeVisible();
  await companyPage.getByRole("button", {name: "5 estrellas"}).click();
  await companyPage.getByRole("button", {name: "Enviar evaluacion"}).click();
  await expect(companyPage.getByText("Evaluacion registrada.")).toBeVisible();

  await workerPage.goto("/worker/postulaciones?sector=agriculture");
  await expect(workerPage.getByText(/Ambos están interesados/)).toBeVisible();
  await workerPage.getByRole("button", {name: "Ver datos de contacto"}).click();
  await expect(workerPage.getByText("empresa@mundoconnect.test")).toBeVisible();
  await workerPage.getByRole("button").filter({hasText: /^5/}).click();
  await workerPage.getByRole("button", {name: /Enviar evaluaci/}).click();
  await expect(workerPage.getByText("Gracias por evaluar esta experiencia.")).toBeVisible();

  await companyContext.close();
  await workerContext.close();
});
