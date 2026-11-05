import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve } from "node:path";

// Browser compositions with CSS blur disabled. These do not emulate Win32.
const output = resolve(
  process.env.ORBIT_VISUAL_OUTPUT || "test-results/visual",
);
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "1421",
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "inherit"] },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Vite startup timed out")),
      15000,
    );
    server.stdout.on("data", (data) => {
      if (String(data).includes("Local:")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.once("error", reject);
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Vite exited: ${code}`));
    });
  });
  browser = await chromium.launch({ executablePath, headless: true });
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1560, height: 1260 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:1421");
  const rows = Array.from(
    { length: 17 },
    (_, i) =>
      `<div class="row"><span>${["orbit-windows-x64-v0.1.7.zip", "Documentos — meus projetos", "Biblioteca e referências", "Downloads e aplicativos"][i % 4]}</span><span>04/11/2026 09:10</span><span>${i % 2 ? "Pasta de arquivos" : "Arquivo ZIP"}</span><span>2.105 KB</span></div>`,
  ).join("");
  const themes = [
    ["ocean", "Oceano"],
    ["amethyst", "Ametista"],
    ["graphite", "Grafite"],
    ["paper", "Papel"],
  ];
  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box} body{margin:0;background:#edf2ef;font:14px Arial,sans-serif;color:#213d32;padding:24px}h1{font-size:24px;margin:0 0 8px}.note{color:#50685d;margin:0 0 22px}.scenes{display:grid;grid-template-columns:1fr 1fr;gap:20px}.scene{border-radius:18px;overflow:hidden;box-shadow:0 5px 18px #1d392022}.label{font-size:14px;font-weight:700;padding:14px 16px;background:#fff}.desktop{height:492px;position:relative;overflow:hidden;background:#191919;color:#eee}.paper{background:#fff;color:#242424}.amethyst{background:linear-gradient(125deg,#2353a5,#7231a4 40%,#f7b47f);color:#fff}.toolbar{padding:15px 16px;font-size:14px;border-bottom:1px solid #8886;background:#8881}.columns{font-size:12px;padding:12px 14px;border-bottom:1px solid #8883;color:#999}.row{display:flex;gap:25px;white-space:nowrap;line-height:27px;font-size:13px;padding:0 12px}.row span:first-child{width:245px;flex-shrink:0}.row:nth-child(4n){background:#8882}.amethyst .row{font-size:15px;font-weight:700;line-height:29px}iframe{position:absolute;width:720px;height:440px;border:0;left:12px;top:38px;z-index:1;background:transparent;color-scheme:light}.desktop:not(.paper) iframe{color-scheme:dark}.foot{font-size:13px;margin:20px 0 0;color:#53685d}
  </style></head><body><h1>ORBIT 0.1.7 · Quatro temas, leitura protegida</h1><p class="note">Principal · Descanso · Work · Atalhos em qualquer menu</p><div class="scenes">${themes.map(([id, title]) => `<section class="scene"><div class="label">${title}</div><div class="desktop ${id}"><div class="toolbar">← &nbsp; Downloads &nbsp; › &nbsp; Arquivos</div><div class="columns">Nome &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; Modificado em &nbsp; &nbsp; Tipo</div>${rows}<iframe src="http://127.0.0.1:1421"></iframe></div></section>`).join("")}</div><p class="foot">Composições no Chromium, tamanho real 720 × 440, com desfoque desativado. Não são capturas nativas do Windows.</p></body></html>`);
  const frames = page.frames().filter((frame) => frame !== page.mainFrame());
  assert.equal(frames.length, 4);
  const metrics = [];
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    await frame.locator(".category").first().waitFor();
    await frame
      .getByRole("button", { name: "Configurações", exact: true })
      .click();
    await frame
      .getByRole("button", { name: `Tema ${themes[index][1]}`, exact: true })
      .click();
    await frame
      .getByRole("button", { name: "Fechar configurações", exact: true })
      .click();
    const contrast = await frame.evaluate(() => {
      const parse = (value) => {
        if (value.startsWith("#")) {
          const h = value.slice(1);
          return [0, 2, 4]
            .map((n) => parseInt(h.slice(n, n + 2), 16))
            .concat(h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1);
        }
        const values = value.match(/[\d.]+/g).map(Number);
        return values.length === 4 ? values : [...values, 1];
      };
      const mix = (fg, bg) =>
        fg
          .slice(0, 3)
          .map((n, i) => n * fg[3] + bg[i] * (1 - fg[3]))
          .concat(1);
      const lum = (color) =>
        color
          .slice(0, 3)
          .map((n) => n / 255)
          .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
          .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a, b) =>
        (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
      const result = [];
      const root = getComputedStyle(document.documentElement);
      for (const token of [
        "--surface",
        "--selected",
        "--hover",
        "--item",
        "--input",
      ]) {
        for (const bg of [
          [0, 0, 0, 1],
          [255, 255, 255, 1],
        ]) {
          const surface = mix(parse(root.getPropertyValue(token).trim()), bg);
          for (const ink of ["--ink", "--muted"])
            result.push({
              kind: "text",
              token,
              ink,
              ratio: ratio(parse(root.getPropertyValue(ink).trim()), surface),
            });
        }
      }
      for (const el of document.querySelectorAll(".app-icon")) {
        const tile = mix(
          parse(getComputedStyle(el).backgroundColor),
          parse(getComputedStyle(el.closest(".bubble")).backgroundColor),
        );
        result.push({
          kind: "icon",
          name: el.className,
          ratio: ratio(parse(getComputedStyle(el).color), tile),
        });
      }
      return result;
    });
    for (const value of contrast)
      assert(
        value.ratio >= (value.kind === "text" ? 4.5 : 3),
        `${themes[index][0]} contrast: ${JSON.stringify(value)}`,
      );
    metrics.push({
      theme: themes[index][0],
      minTextContrast: Math.min(
        ...contrast.filter((x) => x.kind === "text").map((x) => x.ratio),
      ),
      minIconContrast: Math.min(
        ...contrast.filter((x) => x.kind === "icon").map((x) => x.ratio),
      ),
    });
    if (index === 0 || index === 3) {
      await frame
        .getByRole("button", { name: "Bola anterior: Work", exact: true })
        .click();
      if (index === 0) {
        for (const [title, value] of [
          ["GitHub", "https://github.com"],
          ["Figma", "https://figma.com"],
          ["Google Drive", "https://drive.google.com"],
        ]) {
          await frame.locator("#add-category-shortcut").click();
          await frame.getByLabel("Nome", { exact: true }).fill(title);
          await frame.getByLabel("URL", { exact: true }).fill(value);
          await frame.locator("#shortcut-form button[type=submit]").click();
          await frame
            .getByRole("button", { name: "Fechar configurações", exact: true })
            .click();
        }
      } else {
        await frame.locator("[data-batch]").click();
      }
    } else if (index === 2) {
      await frame
        .getByRole("button", { name: "Próxima bola: Descanso", exact: true })
        .click();
    }
    await frame.evaluate(() => {
      document.documentElement.classList.add("desktop");
      document.body.classList.add("native");
      const style = document.createElement("style");
      style.textContent =
        "*,*::before,*::after{backdrop-filter:none!important;animation:none!important;transition:none!important}";
      document.head.append(style);
    });
    assert.equal(await frame.getByRole("alert").count(), 0);
  }
  for (const frame of frames) await frame.locator(".toast").waitFor({state: "detached"});
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${output}/orbit-v0.1.7-preview.png` });
  await writeFile(
    `${output}/contrast.json`,
    JSON.stringify(
      {
        method:
          "Computed colors, alpha composited over black/white; WCAG sRGB; CSS blur disabled",
        metrics,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ metrics, output }, null, 2));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
