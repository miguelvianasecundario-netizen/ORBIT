import { expect, test } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:1420" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("expande as quatro categorias e permite voltar", async ({ page }) => {
  await page.getByRole("button", { name: "Navegador", exact: true }).click();
  for (const name of ["YouTube", "ChatGPT", "GitHub", "Google"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Aplicativos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Explorador de Arquivos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "YouTube", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Projetos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Adicionar projeto", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ações", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Downloads", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Voltar às categorias", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Downloads", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ações", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Downloads", exact: true }),
  ).toBeVisible();
});

for (const [name, url] of [
  ["YouTube", "https://www.youtube.com/"],
  ["ChatGPT", "https://chatgpt.com/"],
  ["GitHub", "https://github.com/"],
  ["Google", "https://www.google.com/"],
]) {
  test(`abre ${name} na URL correta e fecha o menu`, async ({
    page,
    context,
  }) => {
    // Intercept only the destination: still exercise the actual window.open path.
    await context.route(`${url}**`, (route) => route.fulfill({ body: name }));
    await page.getByRole("button", { name: "Navegador", exact: true }).click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name, exact: true }).click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(url);
    await expect(
      page.getByRole("button", { name: "Abrir Orbit", exact: true }),
    ).toBeVisible();
    await popup.close();
  });
}

test("ESC fecha e Ctrl+Alt+Space reabre", async ({ page }) => {
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Abrir Orbit", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+Alt+Space");
  await expect(
    page.getByRole("button", { name: "Navegador", exact: true }),
  ).toBeVisible();
});

test("um clique fora do menu fecha o launcher", async ({ page }) => {
  await page.mouse.click(4, 150);
  await expect(
    page.getByRole("button", { name: "Abrir Orbit", exact: true }),
  ).toBeVisible();
});

test("cadastra, persiste e remove atalho sem interpretar HTML", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("<b>Meu site</b>");
  await page.getByLabel("URL", { exact: true }).fill("https://example.com/");
  await page
    .getByRole("button", { name: "Adicionar atalho", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remover <b>Meu site</b>", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "<b>Meu site</b>", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remover <b>Meu site</b>", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "<b>Meu site</b>", exact: true }),
  ).toHaveCount(0);
});

test("histórico só registra ação bem-sucedida e pode ser apagado", async ({
  page,
  context,
}) => {
  await context.route("https://github.com/**", (route) =>
    route.fulfill({ body: "GitHub" }),
  );
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "GitHub", exact: true }).click();
  const popup = await popupPromise;
  await popup.close();
  await page.getByRole("button", { name: "Abrir Orbit", exact: true }).click();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await expect(page.getByText(/1 usos registrados/)).toBeVisible();
  await page
    .getByRole("button", { name: "Limpar histórico", exact: true })
    .click();
  await expect(page.getByText(/0 usos registrados/)).toBeVisible();
});

test("ação nativa no navegador informa a limitação sem registrar uso", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Ações", exact: true }).click();
  await page.getByRole("button", { name: "Downloads", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Windows");
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await expect(page.getByText(/0 usos registrados/)).toBeVisible();
});

test("URL executável é rejeitada", async ({ page }) => {
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Perigoso");
  await page.getByLabel("URL", { exact: true }).fill("javascript:alert(1)");
  await page
    .getByRole("button", { name: "Adicionar atalho", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("https");
  await expect(
    page.getByRole("button", { name: "Remover Perigoso" }),
  ).toHaveCount(0);
});

test("layout compacto mantém categorias e opções acessíveis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Navegador", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ChatGPT", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("layout desktop cabe na área útil com DPI alto", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 });
  // Exercise CSS sizing only. This does not simulate native IPC or OS transparency.
  await page.evaluate(() => {
    document.body.classList.add("native");
    document.documentElement.classList.add("desktop");
  });
  await expect(
    page.getByRole("button", { name: "Ações", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Google", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
});

test("launcher pequeno, sem título, e configurações acessíveis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 560, height: 360 });
  await expect(page.locator("header,h1,.brand")).toHaveCount(0);
  const wheel = await page.locator(".wheel").boundingBox();
  expect(wheel!.width).toBeLessThanOrEqual(300);
  await expect(
    page.getByRole("button", { name: "Google", exact: true }),
  ).toBeInViewport();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await expect(
    page.getByLabel("Atalho de teclado", { exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
});

test("atalho escolhido é salvo, persiste e substitui o anterior", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByLabel("Atalho de teclado", { exact: true }).click();
  await page.keyboard.press("F8");
  await page
    .getByRole("button", { name: "Salvar atalho de teclado", exact: true })
    .click();
  await page.reload();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Alt+Space");
  await expect(
    page.getByRole("button", { name: "Abrir Orbit", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("F8");
  await expect(
    page.getByRole("button", { name: "Navegador", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await expect(
    page.getByLabel("Atalho de teclado", { exact: true }),
  ).toHaveValue("F8");
  await page.getByLabel("Abrir o launcher com").selectOption("keyboard");
  await page.reload();
  await page.keyboard.press("Escape");
  await page.keyboard.press("F8");
  await expect(
    page.getByRole("button", { name: "Navegador", exact: true }),
  ).toBeVisible();
});

test("captura uma combinação e rejeita letra isolada e F12", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByLabel("Atalho de teclado", { exact: true }).click();
  await page.keyboard.press("f");
  await expect(page.getByRole("alert")).toContainText("Ctrl ou Alt");
  await expect(
    page.getByRole("button", { name: "Salvar atalho de teclado", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("F12");
  await expect(page.getByRole("alert")).toContainText("exceto F12");
  await page.keyboard.press("Control+Shift+O");
  await expect(
    page.getByLabel("Atalho de teclado", { exact: true }),
  ).toHaveValue("Ctrl + Shift + O");
  await page
    .getByRole("button", { name: "Salvar atalho de teclado", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Shift+O");
  await expect(
    page.getByRole("button", { name: "Navegador", exact: true }),
  ).toBeVisible();
});
