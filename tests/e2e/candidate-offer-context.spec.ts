import {expect, test} from "@playwright/test";

test("ver candidatos conserva la oferta seleccionada", async ({page}) => {
  await page.goto("/portal-empresas");
  await page.getByRole("button", {name: "Ingresar al entorno E2E"}).click();
  await page
    .getByRole("navigation")
    .getByRole("button", {name: "Ofertas", exact: true})
    .click();

  const securityOffer = page.locator("article").filter({hasText: "Guardia piloto Talca"});
  await securityOffer.getByRole("button", {name: "Ver candidatos"}).click();

  await expect(
    page.getByLabel(/Oferta para la invitaci/).locator("option:checked"),
  ).toContainText("Guardia piloto Talca");
});
