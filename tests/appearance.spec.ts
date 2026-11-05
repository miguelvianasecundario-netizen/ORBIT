import { test, expect, type Page } from "./fixtures";
import { nativeBoundary } from "./helpers/native-boundary";

async function range(page: Page, id: string, value: number) {
  await page.locator(`#${id}`).evaluate((input: HTMLInputElement, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
async function settings(page: Page) {
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
}
const alpha = (color: string) =>
  color.startsWith("rgba")
    ? Number(color.slice(color.lastIndexOf(",") + 1, -1))
    : 1;

test("transparências independentes persistem sem apagar preferências nem o formulário", async ({
  page,
}) => {
  await page.goto("/");
  await settings(page);
  await page.getByLabel("Nome", { exact: true }).fill("Meu rascunho");
  await page
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/rascunho");
  for (const [key, value] of Object.entries({
    menuTransparency: 60,
    selectionTransparency: 75,
    panelTransparency: 35,
    appTransparency: 20,
  }))
    await range(page, key, value);
  await expect
    .poll(async () =>
      alpha(
        await page
          .locator(".bubble")
          .first()
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ),
    )
    .toBeCloseTo(0.8);
  const fills = await page.evaluate(() => ({
    menu: getComputedStyle(document.querySelector(".segment:not(.selected)")!)
      .fill,
    selected: getComputedStyle(document.querySelector(".segment.selected")!)
      .fill,
    panel: getComputedStyle(document.querySelector(".branch")!).backgroundColor,
    app: getComputedStyle(document.querySelector(".bubble")!).backgroundColor,
    icon: getComputedStyle(document.querySelector(".bubble .automatic-icon")!)
      .opacity,
    text: getComputedStyle(document.querySelector(".bubble-copy")!).opacity,
    baseCoversSector: (
      document.querySelector(".wheel-base") as SVGGeometryElement
    ).isPointInFill(new DOMPoint(360, 140)),
  }));
  expect(alpha(fills.menu)).toBeCloseTo(0.4);
  expect(alpha(fills.selected)).toBeCloseTo(0.25);
  expect(alpha(fills.panel)).toBeCloseTo(0.65);
  expect(alpha(fills.app)).toBeCloseTo(0.8);
  expect(fills.icon).toBe("1");
  expect(fills.text).toBe("1");
  expect(fills.baseCoversSector).toBe(false);
  await page.getByRole("button", { name: "Tema Papel", exact: true }).click();
  await page.getByLabel("Modo minimizado — só ícones", { exact: true }).check();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Meu rascunho",
  );
  await expect(page.getByLabel("URL", { exact: true })).toHaveValue(
    "https://example.com/rascunho",
  );
  await page
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  await page.reload();
  await settings(page);
  for (const [key, value] of Object.entries({
    menuTransparency: 60,
    selectionTransparency: 75,
    panelTransparency: 35,
    appTransparency: 20,
  }))
    await expect(page.locator(`#${key}`)).toHaveValue(String(value));
  await expect(page.locator("#icons-only")).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page
    .getByRole("button", {
      name: "Restaurar transparência e tamanho",
      exact: true,
    })
    .click();
  await expect(page.locator("#panelTransparency")).toHaveValue("4");
  await expect(page.locator("#menuTransparency")).toHaveValue("0");
  await expect(page.locator("#icons-only")).not.toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
});

test("100% remove fundos sem apagar controles e dados antigos recebem valores padrão", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "orbit.local.v1",
      JSON.stringify({
        settings: {
          mode: "main",
          theme: "ocean",
          trigger: "keyboard",
          hotkey: "F8",
        },
        usage: {},
        shortcuts: [],
      }),
    ),
  );
  await page.goto("/");
  await settings(page);
  await expect(page.locator("#panelTransparency")).toHaveValue("4");
  await expect(page.locator("#hotkey")).toHaveValue("F8");
  for (const key of [
    "menuTransparency",
    "selectionTransparency",
    "panelTransparency",
    "appTransparency",
  ])
    await range(page, key, 100);
  await page
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  const colors = await page.evaluate(() => [
    getComputedStyle(document.querySelector(".wheel-base")!).fill,
    getComputedStyle(document.querySelector(".segment.selected")!).fill,
    getComputedStyle(document.querySelector(".branch")!).backgroundColor,
    getComputedStyle(document.querySelector(".bubble")!).backgroundColor,
  ]);
  expect(colors.map(alpha)).toEqual([0, 0, 0, 0]);
  await expect(
    page
      .getByRole("button", { name: "ChatGPT", exact: true })
      .locator("strong"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Configurações", exact: true }),
  ).toBeVisible();
});

test("arrastar salva uma alteração e uma falha não contamina a próxima preferência", async ({
  page,
}) => {
  await nativeBoundary(page);
  await page.goto("/");
  await settings(page);
  await page.evaluate(() => {
    (window as any).orbitProbe.delay = 80;
    (window as any).orbitProbe.rejectHotkey = true;
  });
  await page.getByLabel("Atalho de teclado", { exact: true }).click();
  await page.keyboard.press("F8");
  await page
    .getByRole("button", { name: "Salvar atalho de teclado", exact: true })
    .click();
  await page
    .locator("#menuTransparency")
    .evaluate((input: HTMLInputElement) => {
      for (let i = 1; i <= 70; i++) {
        input.value = String(i);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).orbitProbe.state.settings.menuTransparency,
      ),
    )
    .toBe(70);
  const saves = await page.evaluate(() =>
    (window as any).orbitProbe.calls.filter(
      (c: any) => c.cmd === "save_settings",
    ),
  );
  expect(saves).toHaveLength(2);
  expect(saves[1].args.settings.hotkey).toBe("Ctrl+Alt+Space");
  expect(saves[1].args.settings.menuTransparency).toBe(70);
  await expect(page.locator("#menuTransparency")).toHaveValue("70");
});

for (const viewport of [
  { width: 720, height: 440 },
  { width: 620, height: 380 },
  { width: 380, height: 264 },
  { width: 320, height: 480 },
]) {
  test(`só ícones mantém atalhos e configurações acessíveis em ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Modo só ícones", exact: true })
      .click();
    if (viewport.width < 620 || viewport.height < 380)
      await page
        .getByRole("button", { name: "Navegador", exact: true })
        .click();
    for (const item of await page.locator(".bubble").all()) {
      await expect(item.locator(".bubble-copy")).toBeHidden();
      expect(await item.getAttribute("title")).toBe(
        await item.getAttribute("aria-label"),
      );
      const box = (await item.boundingBox())!;
      // Browser transforms can report 43.999984 for a 44px button.
      expect(box.width).toBeCloseTo(44, 2);
      expect(box.height).toBeCloseTo(44, 2);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await settings(page);
    await expect(page.locator("#icons-only")).toBeChecked();
    await page
      .getByLabel("Modo minimizado — só ícones", { exact: true })
      .uncheck();
    await page
      .getByRole("button", { name: "Fechar configurações", exact: true })
      .click();
    await expect(
      page
        .getByRole("button", { name: "ChatGPT", exact: true })
        .locator("strong"),
    ).toBeVisible();
  });
}

test("modo só ícones preserva navegação, paginação e abertura de um link", async ({
  page,
}) => {
  await page
    .context()
    .route("https://example.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Atalho aberto</title>",
      }),
    );
  await page.setViewportSize({ width: 380, height: 264 });
  await page.addInitScript(() =>
    localStorage.setItem(
      "orbit.local.v1",
      JSON.stringify({
        settings: {
          trigger: "keyboard",
          hotkey: "F8",
          theme: "ocean",
          mode: "main",
          iconsOnly: true,
        },
        usage: {},
        shortcuts: Array.from({ length: 5 }, (_, i) => ({
          id: `custom-${i}`,
          title: `Meu link ${i}`,
          icon: "globe",
          category: "orbit-main",
          action: { type: "url", value: `https://example.com/${i}` },
        })),
      }),
    ),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Próxima página de opções", exact: true })
    .click();
  const item = page.getByRole("button", { name: "Meu link 0", exact: true });
  await expect(item).toBeVisible();
  await expect(item.locator("span:last-child")).toBeHidden();
  await page
    .getByRole("button", { name: "Próxima bola: Descanso", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Próxima bola: Work", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir tudo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Adicionar ao Work", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Voltar às categorias", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Próxima bola: Principal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Próxima página de opções", exact: true })
    .click();
  const popup = page.waitForEvent("popup");
  await item.click();
  const opened = await popup;
  await expect(opened).toHaveURL("https://example.com/0");
  await opened.close();
});
