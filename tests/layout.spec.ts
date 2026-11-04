import { expect, test, type Locator, type Page } from "@playwright/test";

const categories = ["Aplicativos", "Navegador", "Projetos", "Ações"];

async function fullBoxInViewport(locator: Locator, page: Page) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-0.5);
  expect(box!.y).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 0.5);
}

async function assertLegibleLabel(locator: Locator) {
  const metrics = await locator.evaluate((el) => {
    const label = el.querySelector("span:not(.app-icon), strong")!;
    const style = getComputedStyle(label);
    const text = document.createRange();
    text.selectNodeContents(label);
    const box = el.getBoundingClientRect();
    return {
      fontSize: parseFloat(style.fontSize),
      button: { x: box.x, y: box.y, right: box.right, bottom: box.bottom },
      lines: [...text.getClientRects()].map((r) => ({
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
      })),
    };
  });
  expect(metrics.fontSize).toBeGreaterThanOrEqual(13);
  for (const line of metrics.lines) {
    expect(line.x).toBeGreaterThanOrEqual(metrics.button.x - 1);
    expect(line.y).toBeGreaterThanOrEqual(metrics.button.y - 1);
    expect(line.right).toBeLessThanOrEqual(metrics.button.right + 1);
    expect(line.bottom).toBeLessThanOrEqual(metrics.button.bottom + 1);
  }
}

async function assertNoDocumentOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > innerWidth,
      y: document.documentElement.scrollHeight > innerHeight,
    })),
  ).toEqual({ x: false, y: false });
}

for (const deviceScaleFactor of [1, 1.25, 1.5, 2]) {
  for (const viewport of [
    { width: 720, height: 440 },
    { width: 620, height: 380 },
    { width: 540, height: 340 },
    { width: 380, height: 264 },
    { width: 320, height: 480 },
  ]) {
    test.describe(`layout ${viewport.width}×${viewport.height}, escala ${deviceScaleFactor}`, () => {
      test.use({ viewport, deviceScaleFactor, reducedMotion: "reduce" });
      test("categorias e opções cabem por inteiro sem reduzir o texto", async ({
        page,
      }) => {
        await page.goto("/");
        const back = page.getByRole("button", {
          name: "Voltar às categorias",
          exact: true,
        });
        if (await back.isVisible()) await back.click();
        for (const name of categories) {
          const category = page.getByRole("button", { name, exact: true });
          await fullBoxInViewport(category, page);
          await assertLegibleLabel(category);
          const icon = await category.locator("svg").boundingBox();
          expect(icon!.width).toBeGreaterThanOrEqual(23);
          expect(icon!.height).toBeGreaterThanOrEqual(23);
        }
        await assertNoDocumentOverflow(page);
        await page
          .getByRole("button", { name: "Navegador", exact: true })
          .click();
        for (const name of [
          "YouTube",
          "ChatGPT",
          "GitHub",
          "Nova guia do Brave",
        ]) {
          const item = page.getByRole("button", { name, exact: true });
          await item.scrollIntoViewIfNeeded();
          await fullBoxInViewport(item, page);
          const size = await item.boundingBox();
          expect(size!.height).toBeGreaterThanOrEqual(44);
          expect(
            await item
              .locator("strong")
              .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
          ).toBeGreaterThanOrEqual(13);
        }
        await assertNoDocumentOverflow(page);
        if (viewport.width >= 620 && viewport.height >= 380) {
          const wheel = (await page.locator(".wheel").boundingBox())!;
          const branch = (await page.locator(".branch").boundingBox())!;
          expect(wheel.x + wheel.width).toBeLessThanOrEqual(branch.x + 1);
          await page
            .locator(".launcher")
            .evaluate((el) => el.classList.add("branch-left"));
          const leftWheel = (await page.locator(".wheel").boundingBox())!;
          const leftBranch = (await page.locator(".branch").boundingBox())!;
          expect(leftBranch.x + leftBranch.width).toBeLessThanOrEqual(
            leftWheel.x + 1,
          );
          await fullBoxInViewport(page.locator(".wheel"), page);
          await fullBoxInViewport(page.locator(".branch"), page);
        } else {
          await expect(page.locator(".wheel")).not.toBeVisible();
          await fullBoxInViewport(
            page.getByRole("button", {
              name: "Voltar às categorias",
              exact: true,
            }),
            page,
          );
          await page
            .getByRole("button", { name: "Voltar às categorias", exact: true })
            .click();
          await fullBoxInViewport(
            page.getByRole("button", { name: "Navegador", exact: true }),
            page,
          );
        }
        await page
          .getByRole("button", { name: "Configurações", exact: true })
          .click();
        await fullBoxInViewport(page.locator(".settings-panel"), page);
        for (const label of ["Atalho de teclado", "Nome", "URL"]) {
          const input = page.getByLabel(label, { exact: true });
          await input.scrollIntoViewIfNeeded();
          await fullBoxInViewport(input, page);
          expect(
            await input.evaluate((el) =>
              parseFloat(getComputedStyle(el).fontSize),
            ),
          ).toBeGreaterThanOrEqual(13);
        }
        await assertNoDocumentOverflow(page);
      });
    });
  }
}

test("atalhos longos permanecem legíveis e alcançáveis com rolagem", async ({
  page,
}) => {
  await page.setViewportSize({ width: 620, height: 380 });
  await page.goto("/");
  // Seed only the persisted user data, leaving rendering, sorting and navigation real.
  await page.evaluate(() => {
    localStorage.setItem(
      "orbit.local.v1",
      JSON.stringify({
        settings: { trigger: "alt-middle", hotkey: "Ctrl+Alt+Space" },
        usage: {},
        shortcuts: Array.from({ length: 20 }, (_, i) => ({
          id: `layout-${i}`,
          title: `Projeto ${i} — documentação técnica e ferramentas de trabalho`,
          category: "browser",
          icon: "globe",
          action: { type: "url", value: "https://example.com/" },
        })),
      }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Navegador", exact: true }).click();
  const last = page.getByRole("button", {
    name: "Projeto 19 — documentação técnica e ferramentas de trabalho",
    exact: true,
  });
  await last.scrollIntoViewIfNeeded();
  await fullBoxInViewport(last, page);
  const metrics = await last.locator("strong").evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const bubble = el.closest("button")!.getBoundingClientRect();
    return {
      font: parseFloat(getComputedStyle(el).fontSize),
      lines: [...r.getClientRects()].map((x) => ({
        left: x.left,
        right: x.right,
        top: x.top,
        bottom: x.bottom,
      })),
      bubble: {
        left: bubble.left,
        right: bubble.right,
        top: bubble.top,
        bottom: bubble.bottom,
      },
    };
  });
  expect(metrics.font).toBeGreaterThanOrEqual(13);
  for (const r of metrics.lines) {
    expect(r.left).toBeGreaterThanOrEqual(metrics.bubble.left);
    expect(r.right).toBeLessThanOrEqual(metrics.bubble.right);
    expect(r.top).toBeGreaterThanOrEqual(metrics.bubble.top);
    expect(r.bottom).toBeLessThanOrEqual(metrics.bubble.bottom);
  }
  expect(
    await page
      .locator(".branch-list")
      .evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await assertNoDocumentOverflow(page);
});
