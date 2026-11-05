import { test, expect } from "./fixtures";
import { nativeBoundary } from "./helpers/native-boundary";

for (const viewport of [
  { width: 720, height: 440 },
  { width: 380, height: 264 },
  { width: 320, height: 480 },
]) {
  test(`Work permanece acessível em ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await toWork(page);
    const back = page.getByRole("button", {
      name: "Voltar às categorias",
      exact: true,
    });
    if (await back.isVisible()) await back.click();
    for (const button of await page.locator(".category").all()) {
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.locator("[data-batch]").click();
    await expect(page.locator("#run-work")).toBeVisible();
    await page
      .getByRole("button", { name: "Adicionar ao Work", exact: true })
      .click();
    await expect(page.getByLabel("Bola", { exact: true })).toHaveValue("work");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

async function toWork(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: "Bola anterior: Work", exact: true })
    .click();
}

test("três modos têm navegação circular independente e persistência", async ({
  page,
}) => {
  await page.goto("/");
  await toWork(page);
  await expect(page.locator(".core span")).toHaveText("Work");
  await expect(
    page.getByRole("button", { name: "Abrir tudo", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".core span")).toHaveText("Work");
  await page
    .getByRole("button", { name: "Próxima bola: Principal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Próxima bola: Descanso", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Jogos", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Próxima bola: Work", exact: true })
    .click();
  await expect(page.locator(".core span")).toHaveText("Work");
});

for (const mode of ["main", "rest", "work"]) {
  test(`cadastro em ${mode} mantém o atalho na bola escolhida`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Adicionar à bola", exact: true })
      .click();
    await page.getByLabel("Bola", { exact: true }).selectOption(mode);
    await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue(
      `orbit-${mode}`,
    );
    await page.getByLabel("Nome", { exact: true }).fill(`Site ${mode}`);
    await page
      .getByLabel("URL", { exact: true })
      .fill("https://example.com/work");
    await page
      .getByRole("button", { name: "Adicionar atalho", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Fechar configurações", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `Site ${mode}`, exact: true }),
    ).toBeVisible();
    const data = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("orbit.local.v1")!),
    );
    expect(data.shortcuts[0].category).toBe(`orbit-${mode}`);
    expect(data.settings.mode).toBe(mode);
    const image = page
      .getByRole("button", { name: `Site ${mode}`, exact: true })
      .locator("img");
    await expect(image).toHaveAttribute(
      "src",
      "https://example.com/favicon.ico",
    );
    // External favicon loading is optional in the web preview; native icons use data URIs.
  });
}

test("toda categoria oferece o cadastro no próprio menu", async ({ page }) => {
  await page.goto("/");
  for (const [name, category] of [
    ["Navegador", "browser"],
    ["Ações", "actions"],
    ["Aplicativos", "apps"],
    ["Projetos", "projects"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.locator("#add-category-shortcut").click();
    await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue(
      category,
    );
    await page.getByLabel("Tipo", { exact: true }).selectOption("executable");
    await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue(
      category,
    );
    await page
      .getByRole("button", { name: "Fechar configurações", exact: true })
      .click();
  }
});

test("Work vazio orienta o cadastro sem disparar aplicativos", async ({
  page,
}) => {
  await page.goto("/");
  await toWork(page);
  await page.locator("[data-batch]").click();
  await expect(page.locator("#run-work")).toBeDisabled();
  await page
    .getByRole("button", { name: "Adicionar ao Work", exact: true })
    .click();
  await expect(page.getByLabel("Bola", { exact: true })).toHaveValue("work");
  await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue(
    "orbit-work",
  );
});

test("abrir tudo envia uma operação, lista resultado e mantém os outros modos separados", async ({
  page,
}) => {
  await nativeBoundary(page);
  await page.goto("/");
  await page.evaluate(() => {
    const p = (window as any).orbitProbe;
    p.delay = 150;
    p.state.shortcuts = [
      {
        id: "site",
        title: "Site de trabalho",
        category: "work-browser",
        icon: "globe",
        action: { type: "url", value: "https://example.com/work" },
      },
      {
        id: "open",
        title: "Site já aberto",
        category: "orbit-work",
        icon: "globe",
        action: { type: "url", value: "https://example.com/open" },
      },
      {
        id: "personal",
        title: "Pessoal",
        category: "browser",
        icon: "globe",
        action: { type: "url", value: "https://example.com/personal" },
      },
    ];
  });
  // Reopening through the settings flow refreshes the persisted state; no state module is replaced.
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Outro Work");
  await page.getByLabel("Bola", { exact: true }).selectOption("work");
  await page
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/another");
  await page
    .getByRole("button", { name: "Adicionar atalho", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Atalho adicionado");
  await page
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Página anterior de opções", exact: true })
    .click();
  await page.locator("[data-batch]").evaluate((button: HTMLButtonElement) => {
    button.click();
    document.querySelector<HTMLButtonElement>("[data-batch]")!.click();
  });
  await expect(
    page.getByRole("region", { name: "Resultado do Work" }),
  ).toContainText("já abertos");
  await expect(
    page.getByRole("region", { name: "Resultado do Work" }),
  ).toContainText("Site já aberto");
  await expect(
    page.getByRole("region", { name: "Resultado do Work" }),
  ).not.toContainText("Pessoal");
  expect(
    await page.evaluate(
      () =>
        (window as any).orbitProbe.calls.filter(
          (call: any) => call.cmd === "launch_work",
        ).length,
    ),
  ).toBe(1);
});

test("ícone quebrado mantém o símbolo de fallback", async ({ page }) => {
  await page.route("**/favicon.ico", (route) => route.abort());
  await page.goto("/");
  const tile = page
    .getByRole("button", { name: "GitHub", exact: true })
    .locator(".automatic-icon");
  await expect(tile.locator("svg")).toBeVisible();
  await expect(tile).not.toHaveClass(/is-loaded/);
});

test("ícone recebido do Windows substitui o fallback somente após carregar", async ({
  page,
}) => {
  const data =
    "data:image/svg+xml;base64," +
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>',
    ).toString("base64");
  await nativeBoundary(page, data);
  await page.goto("/");
  const tile = page
    .getByRole("button", { name: "GitHub", exact: true })
    .locator(".automatic-icon");
  await expect(tile).toHaveClass(/is-loaded/);
  await expect(tile.locator("img")).toBeVisible();
  await expect(tile.locator("svg")).toBeHidden();
});

test("um atalho individual do Work usa abertura discreta sem disparar o lote", async ({
  page,
}) => {
  await nativeBoundary(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Adicionar à bola", exact: true })
    .click();
  await page.getByLabel("Bola", { exact: true }).selectOption("work");
  await page.getByLabel("Nome", { exact: true }).fill("Meu trabalho");
  await page
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/work");
  await page
    .getByRole("button", { name: "Adicionar atalho", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  await page.getByRole("button", { name: "Meu trabalho", exact: true }).click();
  const calls = await page.evaluate(() => (window as any).orbitProbe.calls);
  expect(
    calls.filter((call: any) => call.cmd === "launch_work_item"),
  ).toHaveLength(1);
  expect(
    calls.some(
      (call: any) =>
        call.cmd === "launch_work" || call.cmd === "execute_action",
    ),
  ).toBe(false);
});
