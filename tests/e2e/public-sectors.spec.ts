import {expect, test} from "@playwright/test";

test("MundoConnect permite entrar directamente a los dos sectores operativos", async ({page}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", {level: 1})).toContainText("trabajo correcto");

  await page.goto("/agro");
  await expect(page.getByText("AgroConnect", {exact: true}).first()).toBeVisible();
  await expect(page.getByRole("button", {name: /trabajo|ofertas/i}).first()).toBeVisible();

  await page.goto("/seguridad");
  await expect(page.getByText("SeguridadConnect", {exact: true}).first()).toBeVisible();
  await expect(page.getByRole("button", {name: /trabajo|ofertas/i}).first()).toBeVisible();
});

test("terminos y privacidad son accesibles sin iniciar sesion", async ({page}) => {
  await page.goto("/legal/terminos");
  await expect(page.getByRole("heading", {name: "Términos de uso"})).toBeVisible();
  await expect(page.getByText(/plataforma de intermediación tecnológica/i)).toBeVisible();

  await page.goto("/legal/privacidad");
  await expect(page.getByRole("heading", {name: "Privacidad y datos personales"})).toBeVisible();
  await expect(page.getByText(/No mostramos públicamente RUT/i)).toBeVisible();
});

const expansionRoutes = [
  "/construccion",
  "/salud",
  "/transporte",
  "/forestal",
  "/retail",
  "/logistica",
  "/aseo",
  "/servicios",
  "/turismo",
  "/industria",
];

for (const route of expansionRoutes) {
  test(`${route} informa que el area aun no esta operativa`, async ({page}) => {
    await page.goto(route);
    await expect(page.getByText(/Área en preparación/i)).toBeVisible();
    await expect(page.getByRole("button", {name: /Participar como empresa/i})).toBeVisible();
  });
}
