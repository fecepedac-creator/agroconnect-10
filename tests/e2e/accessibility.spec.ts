import AxeBuilder from "@axe-core/playwright";
import {expect, test} from "@playwright/test";

const publicRoutes = ["/", "/agro", "/seguridad", "/trabajos?sector=agriculture"];

for (const route of publicRoutes) {
  test(`${route} no tiene infracciones serias o criticas de accesibilidad`, async ({page}) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();

    const results = await new AxeBuilder({page}).analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
  });
}

test("el enlace para saltar navegacion lleva el foco al contenido", async ({page}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", {name: "Saltar al contenido principal"});
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});
