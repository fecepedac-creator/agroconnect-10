import {expect, test} from "@playwright/test";

test("una oferta inexistente muestra estado explicito y permite volver", async ({page}) => {
  await page.goto("/trabajos/oferta-inexistente?sector=agriculture");

  await expect(page.getByRole("heading", {name: "Oferta no disponible"})).toBeVisible();
  await expect(page.getByText(/no existe, fue cerrada o ya no esta publicada/i)).toBeVisible();

  await page.getByRole("button", {name: "Volver al listado"}).click();

  await expect(page).toHaveURL(/\/trabajos\?sector=agriculture$/);
  await expect(page.getByText("Cosecha piloto San Clemente")).toBeVisible();
});
