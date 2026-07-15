import {expect, test} from "@playwright/test";

test("empresa autorizada entra al portal compartido y ve ambos sectores", async ({page}) => {
  await page.goto("/portal-empresas");
  await expect(page.getByTestId("company-e2e-access")).toBeVisible();
  await page.getByRole("button", {name: "Ingresar al entorno E2E"}).click();

  await expect(page.getByText("Empresa Piloto San Clemente").first()).toBeVisible();
  await expect(page.getByRole("button", {name: "Mis Ofertas"})).toBeVisible();
  await page.getByRole("button", {name: "Mis Ofertas"}).click();
  await expect(page.getByText("Cosecha piloto San Clemente")).toBeVisible();
  await expect(page.getByText("Guardia piloto Talca")).toBeVisible();
});

test("empresa no incorporada puede enviar una solicitud sin obtener acceso", async ({page}) => {
  await page.goto("/portal-empresas");
  await page.getByRole("button", {name: "Solicitar incorporación"}).click();
  await page.getByPlaceholder("Nombre de la empresa").fill("Empresa Nueva E2E");
  await page.getByPlaceholder("RUT de la empresa").fill("76.111.111-1");
  await page.getByPlaceholder("Correo de contacto").fill("nueva@mundoconnect.test");
  await page.getByRole("button", {name: "Enviar solicitud"}).click();
  await expect(page.getByText("Solicitud recibida")).toBeVisible();
  await expect(page.getByText(/no concede acceso automático/i)).not.toBeVisible();
});

