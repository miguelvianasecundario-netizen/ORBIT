import { test, expect } from "@playwright/test";
test("Brave substitui Google e informa requisito desktop na prévia", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Google", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Nova guia do Brave", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Windows");
  expect(
    await page.evaluate(() => localStorage.getItem("orbit.local.v1")),
  ).toBeNull();
});
test("Aplicativos oferece seletor exe e permite categorias compatíveis", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Aplicativos", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar aplicativo", exact: true })
    .click();
  await expect(page.getByLabel("Tipo", { exact: true })).toHaveValue(
    "executable",
  );
  await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue(
    "apps",
  );
  await expect(page.getByLabel("Categoria", { exact: true })).toBeEnabled();
  await page
    .getByRole("button", { name: "Selecionar executável (.exe)", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Windows");
  await page.getByLabel("Tipo", { exact: true }).selectOption("url");
  await expect(page.getByLabel("Categoria", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("URL", { exact: true })).toBeVisible();
});
