import {expect, test, type Page} from "@playwright/test";

async function registerWorker(page: Page, sector: "agriculture" | "security") {
  const email = `trabajador.${sector}@mundoconnect.test`;
  const trade = sector === "agriculture" ? "Cosecha" : "Guardia";
  const commune = sector === "agriculture" ? "San Clemente" : "Talca";

  await page.goto(`/auth/register?sector=${sector}`);
  await expect(page.getByText(sector === "agriculture" ? "AgroConnect" : "SeguridadConnect", {exact: true}).first()).toBeVisible();
  await page.getByLabel("Nombre y apellido").fill(`Trabajador ${trade}`);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Crear contraseña").fill("Trabajador123!");
  await page.getByLabel("Repetir contraseña").fill("Trabajador123!");
  await page.getByRole("button", {name: "Continuar", exact: true}).click();

  await page.getByLabel("Comuna").fill(commune);
  await page.getByLabel("Trabajo principal").fill(trade);
  await page.getByRole("button", {name: "Continuar", exact: true}).click();

  await page.getByRole("button", {name: sector === "agriculture" ? "Necesito transporte" : "Uso locomoción pública"}).click();
  await page.getByLabel("Teléfono").fill(sector === "agriculture" ? "11111111" : "22222222");
  await page.getByLabel("Acepto términos y privacidad").check();
  await page.getByLabel("Autorizo matching laboral").check();
  await page.getByRole("button", {name: "Crear mi cuenta"}).click();

  await expect(page).toHaveURL(new RegExp(`/worker\\?sector=${sector}`));
  await expect(page.getByText(new RegExp(`Hola, Trabajador ${trade}`))).toBeVisible();
  await expect(page.getByText("Ofertas disponibles")).toBeVisible();

  await page.getByRole("button", {name: /piloto/}).click();
  await page.getByRole("button", {name: "Reportar esta oferta"}).click();
  await expect(page.getByLabel("Categoría de denuncia")).toBeVisible();
  await expect(page.getByRole("button", {name: "Enviar denuncia"})).toBeDisabled();
}

test("trabajador agricola completa el registro y entra a su portal", async ({page}) => {
  await registerWorker(page, "agriculture");
});

test("trabajador de seguridad completa el registro y entra a su portal", async ({page}) => {
  await registerWorker(page, "security");
});
