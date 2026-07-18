import {expect, test} from "@playwright/test";

test("empresa solo ve datos operativos reales y difusión manual", async ({page}) => {
  await page.goto("/portal-empresas");
  await page.getByRole("button", {name: "Ingresar al entorno E2E"}).click();

  await expect(page.getByRole("heading", {name: "Resumen"})).toBeVisible();
  await expect(page.getByText("Cosecha Cerezas")).not.toBeVisible();
  await expect(page.getByText("Mapa Simulado")).not.toBeVisible();
  await expect(page.getByText("85%")).not.toBeVisible();

  await page.getByRole("button", {name: "Difundir oferta"}).click();
  await expect(page.getByText(/no envía campañas automáticas/i)).toBeVisible();
  await expect(page.getByRole("button", {name: "Copiar mensaje"})).toBeVisible();
  await expect(page.getByText("Meta Ads")).not.toBeVisible();
  await expect(page.getByText("WhatsApp Masivo")).not.toBeVisible();
});

test("búsqueda de candidatos exige una oferta seleccionada", async ({page}) => {
  await page.goto("/portal-empresas");
  await page.getByRole("button", {name: "Ingresar al entorno E2E"}).click();
  await page.getByRole("navigation").getByRole("button", {name: "Buscar candidatos"}).click();

  await expect(page.getByText("Oferta para la invitación")).toBeVisible();
  await expect(page.getByRole("option", {name: /Cosecha piloto San Clemente/})).toBeAttached();
  await expect(page.getByRole("option", {name: /Guardia piloto Talca/})).toBeAttached();
  await expect(page.getByRole("option", {name: "Cosecha"})).toBeAttached();
});

test("empresa puede navegar en un teléfono sin controles ocultos", async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto("/portal-empresas");
  await page.getByRole("button", {name: "Ingresar al entorno E2E"}).click();

  const menuButton = page.getByRole("button", {name: "Abrir menú principal"});
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("button", {name: "Ofertas", exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Procesos de selección"}).click();
  await expect(page.getByRole("heading", {name: "Procesos de selección", exact: true})).toBeVisible();
});
