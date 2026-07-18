import {expect, test} from "@playwright/test";

test("empresa autorizada entra al portal compartido y ve ambos sectores", async ({page}) => {
  await page.goto("/portal-empresas");
  await expect(page.getByTestId("company-e2e-access")).toBeVisible();
  await page.getByRole("button", {name: "Ingresar al entorno E2E"}).click();

  await expect(page.getByText("Empresa Piloto San Clemente").first()).toBeVisible();
  await expect(page.getByRole("button", {name: "Ofertas", exact: true})).toBeVisible();
  await expect(page.getByText("Cosecha Cerezas")).not.toBeVisible();
  await expect(page.getByText("Mapa Simulado")).not.toBeVisible();
  await page.getByRole("button", {name: "Ofertas", exact: true}).click();
  await expect(page.getByText("Cosecha piloto San Clemente")).toBeVisible();
  await expect(page.getByText("Guardia piloto Talca")).toBeVisible();
  await page.getByRole("button", {name: "Crear oferta"}).click();
  await expect(page.getByText("Crear oferta de trabajo")).toBeVisible();
  await expect(page.getByText(/Guardar borrador mantiene la oferta privada/)).toBeVisible();
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
