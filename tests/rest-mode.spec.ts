import { expect, test } from "@playwright/test";

test("setas alternam descanso e principal e lembram o modo", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Próxima bola: Descanso", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Jogos", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Streaming", exact: true }).click();
  for (const name of [
    "Prime Video",
    "Disney+",
    "Netflix",
    "HBO Max",
    "Apple TV",
    "Globoplay",
  ]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Jogos", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bola anterior: Principal", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Navegador", exact: true }),
  ).toBeVisible();
});

test("temas persistem sem apagar atalhos antigos", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "orbit.local.v1",
      JSON.stringify({
        settings: { trigger: "middle", hotkey: "F8" },
        usage: {},
        shortcuts: [
          {
            id: "old",
            title: "Meu site",
            category: "browser",
            icon: "globe",
            action: { type: "url", value: "https://example.com/" },
          },
        ],
      }),
    ),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByRole("button", { name: "Tema Papel", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await expect(
    page.getByRole("button", { name: "Meu site", exact: true }),
  ).toBeVisible();
});

test("adiciona opção na bola, pagina, abre e remove", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Adicionar à bola", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Biblioteca");
  await page
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/livros");
  await page
    .getByRole("button", { name: "Adicionar atalho", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Biblioteca", exact: true }),
  ).toBeVisible();
  await context.route("https://example.com/**", (r) =>
    r.fulfill({ body: "Biblioteca" }),
  );
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://example.com/livros");
  await popup.close();
  await page.getByRole("button", { name: "Abrir Orbit", exact: true }).click();
  await page
    .getByRole("button", { name: "Próxima página de opções", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Biblioteca", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remover Biblioteca", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Navegador", exact: true }),
  ).toBeVisible();
});

test("Jogos oferece exe e Livros oferece pasta diretamente na bola", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Próxima bola: Descanso", exact: true })
    .click();
  await page.getByRole("button", { name: "Jogos", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar jogo", exact: true })
    .click();
  await expect(page.getByLabel("Tipo", { exact: true })).toHaveValue(
    "executable",
  );
  await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue(
    "games",
  );
  await page
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  await page.getByRole("button", { name: "Livros", exact: true }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Livros");
  await expect(page.getByLabel("Tipo", { exact: true })).toHaveValue("folder");
  await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue(
    "orbit-rest",
  );
});

for (const size of [
  { width: 720, height: 440 },
  { width: 620, height: 380 },
  { width: 540, height: 340 },
  { width: 380, height: 264 },
  { width: 320, height: 480 },
]) {
  test(`Descanso e setas cabem em ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Próxima bola: Descanso", exact: true })
      .click();
    const back = page.getByRole("button", {
      name: "Voltar às categorias",
      exact: true,
    });
    if (await back.isVisible()) await back.click();
    for (const selector of [
      ".category",
      ".mode-arrow",
      ".compact-controls button",
    ]) {
      for (const item of await page.locator(selector).all()) {
        const r = (await item.boundingBox())!;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(size.width);
        expect(r.y + r.height).toBeLessThanOrEqual(size.height);
        expect(r.width).toBeGreaterThanOrEqual(44);
        expect(r.height).toBeGreaterThanOrEqual(44);
      }
    }
    await page.getByRole("button", { name: "Streaming", exact: true }).click();
    for (const name of [
      "Prime Video",
      "Disney+",
      "Netflix",
      "HBO Max",
      "Apple TV",
      "Globoplay",
    ]) {
      const button = page.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport({ ratio: 1 });
    }
  });
}

test("trocas rápidas persistem a última escolha e não perdem rascunho ao trocar tema", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    for (let n = 0; n < 7; n++)
      document
        .querySelector<HTMLButtonElement>('[data-mode-switch="next"]')!
        .click();
  });
  await expect(
    page.getByRole("button", { name: "Jogos", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Rascunho");
  for (const theme of ["Papel", "Ametista", "Grafite"])
    await page
      .getByRole("button", { name: `Tema ${theme}`, exact: true })
      .click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Rascunho",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  await expect(
    page.getByRole("button", { name: "Jogos", exact: true }),
  ).toBeVisible();
});

test("animação de balanço dura 200ms e respeita movimento reduzido", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Próxima bola: Descanso", exact: true })
    .click();
  expect(
    await page
      .locator(".wheel")
      .evaluate((e) => getComputedStyle(e).animationDuration),
  ).toBe("0.2s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".wheel")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
});

test("capturas dos quatro temas e contraste de texto", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 720, height: 440 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Próxima bola: Descanso", exact: true })
    .click();
  for (const [title, id] of [
    ["Oceano", "ocean"],
    ["Ametista", "amethyst"],
    ["Grafite", "graphite"],
    ["Papel", "paper"],
  ]) {
    await page
      .getByRole("button", { name: "Configurações", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Tema ${title}`, exact: true })
      .click();
    if (id === "paper")
      await page.screenshot({
        path: testInfo.outputPath("settings.png"),
        animations: "disabled",
      });
    await page
      .getByRole("button", { name: "Fechar configurações", exact: true })
      .click();
    const ratios = await page.evaluate(() => {
      const luminance = (v: string) => {
        const rgb = v
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((x) => {
            x /= 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const ratio = (a: string, b: string) => {
        const x = luminance(a),
          y = luminance(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      };
      return [...document.querySelectorAll(".bubble strong")].map((el) => {
        let bg = el.closest(".bubble")!;
        while (
          getComputedStyle(bg).backgroundColor === "rgba(0, 0, 0, 0)" &&
          bg.parentElement
        )
          bg = bg.parentElement;
        return ratio(
          getComputedStyle(el).color,
          getComputedStyle(bg).backgroundColor,
        );
      });
    });
    for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5);
    for (const name of [
      "Prime Video",
      "Disney+",
      "Netflix",
      "HBO Max",
      "Apple TV",
      "Globoplay",
    ])
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: testInfo.outputPath(`${id}.png`),
      animations: "disabled",
    });
  }
});
