import { test, expect } from "./fixtures";
import { nativeBoundary } from "./helpers/native-boundary";

test("envios consecutivos cadastram o atalho uma vez", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Meu site");
  await page.getByLabel("URL", { exact: true }).fill("https://example.com");
  await page.locator("#shortcut-form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByRole("status")).toContainText("Atalho adicionado");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("orbit.local.v1")!).shortcuts.length,
    ),
  ).toBe(1);
});

test("mudar categoria ou bola mantém o executável selecionado; cancelar também", async ({
  page,
}) => {
  await nativeBoundary(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Aplicativos", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar aplicativo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Selecionar executável (.exe)", exact: true })
    .click();
  await expect(page.locator("#folder-path")).toHaveValue(
    "C:\\Jogos\\Meu jogo.exe",
  );
  await page
    .getByLabel("Categoria", { exact: true })
    .selectOption("orbit-main");
  await expect(page.locator("#folder-path")).toHaveValue(
    "C:\\Jogos\\Meu jogo.exe",
  );
  await page.getByLabel("Bola", { exact: true }).selectOption("rest");
  await page.getByLabel("Categoria", { exact: true }).selectOption("games");
  await expect(page.locator("#folder-path")).toHaveValue(
    "C:\\Jogos\\Meu jogo.exe",
  );
  await page.evaluate(() => {
    (window as any).orbitProbe.selection = null;
  });
  await page.locator("#pick-folder").click();
  await expect(page.locator("#folder-path")).toHaveValue(
    "C:\\Jogos\\Meu jogo.exe",
  );
  await page
    .getByRole("button", { name: "Adicionar atalho", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Atalho adicionado");
  const probe = await page.evaluate(() => (window as any).orbitProbe);
  expect(probe.state.shortcuts).toHaveLength(1);
  expect(probe.state.shortcuts[0]).toMatchObject({
    category: "games",
    action: { type: "executable", value: "C:\\Jogos\\Meu jogo.exe" },
  });
  expect(
    probe.calls
      .filter((c: any) => c.cmd === "set_dialog_active")
      .map((c: any) => c.args.active),
  ).toEqual([true, false, true, false]);
});

test("falha ao salvar atalho global não contamina o tema salvo depois", async ({
  page,
}) => {
  await nativeBoundary(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Rascunho preservado");
  await page
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/draft");
  await page.getByLabel("Atalho de teclado", { exact: true }).click();
  await page.keyboard.press("F8");
  await page.evaluate(() => {
    const w = window as any;
    w.orbitProbe.rejectHotkey = true;
    w.orbitProbe.delay = 75;
    (document.querySelector("#save-hotkey") as HTMLButtonElement).click();
    (
      document.querySelector('[data-theme-choice="paper"]') as HTMLButtonElement
    ).click();
  });
  await expect
    .poll(async () =>
      page.evaluate(() => (window as any).orbitProbe.state.settings),
    )
    .toMatchObject({ hotkey: "Ctrl+Alt+Space", theme: "paper" });
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Rascunho preservado",
  );
  await expect(page.getByLabel("URL", { exact: true })).toHaveValue(
    "https://example.com/draft",
  );
  await expect(
    page.getByLabel("Atalho de teclado", { exact: true }),
  ).toHaveValue("Ctrl + Alt + Espaço");
});

test("foco acompanha lista compacta e retorna ao fechar configurações", async ({
  page,
}) => {
  await page.setViewportSize({ width: 380, height: 264 });
  await page.goto("/");
  await page.getByRole("button", { name: "Navegador", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "YouTube", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Configurações", exact: true }),
  ).toBeFocused();
});

for (const size of [
  { width: 720, height: 440 },
  { width: 380, height: 264 },
]) {
  test(`nome longo na bola cabe no setor em ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    const title =
      "Biblioteca de documentos e referências importantes para os meus projetos pessoais";
    await page.evaluate((title) => {
      localStorage.setItem(
        "orbit.local.v1",
        JSON.stringify({
          settings: {
            trigger: "alt-middle",
            hotkey: "F8",
            mode: "rest",
            theme: "ocean",
          },
          usage: {},
          shortcuts: [
            {
              id: "custom-long",
              title,
              category: "orbit-rest",
              icon: "folder",
              action: { type: "url", value: "https://example.com" },
            },
          ],
        }),
      );
    }, title);
    await page.reload();
    const button = page.getByRole("button", { name: title, exact: true });
    await expect(button).toBeVisible();
    const fit = await button.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const s = el.querySelector("span:last-child")!.getBoundingClientRect();
      const i = el
        .querySelector(".automatic-icon, svg")!
        .getBoundingClientRect();
      return (
        s.left >= b.left &&
        s.right <= b.right &&
        s.top >= b.top &&
        s.bottom <= b.bottom &&
        i.top >= b.top
      );
    });
    expect(fit).toBe(true);
    await expect(button).toHaveAttribute("title", title);
  });
}

test("alterar preferências mantém o formulário que está sendo preenchido", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Ainda estou escrevendo");
  await page
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/draft");
  await page.getByLabel("Atalho de teclado", { exact: true }).click();
  await page.keyboard.press("F8");
  await page
    .getByRole("button", { name: "Salvar atalho de teclado", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Atalho de teclado atualizado",
  );
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Ainda estou escrevendo",
  );
  await expect(page.getByLabel("URL", { exact: true })).toHaveValue(
    "https://example.com/draft",
  );
});

test("adicionar streaming fica acessível no cabeçalho sem rolar a lista", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 440 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Próxima bola: Descanso", exact: true })
    .click();
  const add = page.getByRole("button", {
    name: "Adicionar streaming",
    exact: true,
  });
  await expect(add).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("button", { name: "Globoplay", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await add.click();
  await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue(
    "streaming",
  );
  await expect(page.getByLabel("Tipo", { exact: true })).toHaveValue("url");
});

test("nomes Unicode usam o mesmo limite de 80 caracteres do backend", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Adicionar à bola", exact: true })
    .click();
  const title = "📚".repeat(80);
  await page.getByLabel("Nome", { exact: true }).fill(title);
  await page
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/books");
  await page
    .getByRole("button", { name: "Adicionar atalho", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Atalho adicionado");
  await page.getByLabel("Nome", { exact: true }).fill("x".repeat(81));
  await page
    .getByLabel("URL", { exact: true })
    .fill("https://example.com/too-long");
  await page
    .getByRole("button", { name: "Adicionar atalho", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("80 caracteres");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("orbit.local.v1")!).shortcuts.length,
    ),
  ).toBe(1);
});
