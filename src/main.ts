import {
  DEFAULT_HOTKEY,
  hotkeyLabel,
  hotkeyFromEvent,
  matchesHotkey,
} from "./hotkey";
import { settingsView, categoryOptions } from "./settings";
import { esc } from "./utils";
import "./style.css";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  native,
  loadState,
  execute,
  hide,
  saveSettings,
  addShortcut,
  removeShortcut,
  clearHistory,
  chooseFolder,
  chooseExecutable,
  allItems,
} from "./bridge";
import { icon } from "./icons";
import { radial, wheelOptions } from "./radial";
import { categories } from "./data";
import type {
  CategoryId,
  MenuItem,
  OrbitState,
  Settings,
  Theme,
  Mode,
} from "./types";
const app = document.querySelector<HTMLDivElement>("#app")!;
let state: OrbitState = {
  usage: {},
  settings: {
    trigger: "alt-middle",
    hotkey: DEFAULT_HOTKEY,
    theme: "ocean",
    mode: "main",
  },
  shortcuts: [],
};
const compactLayout = () => innerWidth < 620 || innerHeight < 380;
let wheelPage = 0;
let settingsQueue: Promise<void> = Promise.resolve();
let preferenceRevision = 0;
const defaultCategory = (): CategoryId =>
  state.settings.mode === "main" ? "browser" : "streaming";
function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
}
async function updateSettings(patch: Partial<Settings>) {
  const revision = ++preferenceRevision;
  const next = { ...state.settings, ...patch };
  state.settings = next;
  applyTheme();
  const work = settingsQueue.then(() => saveSettings(next));
  settingsQueue = work.catch(() => {});
  try {
    await work;
  } catch (error) {
    if (revision === preferenceRevision) {
      await refresh();
      render();
    }
    throw error;
  }
}
let selected: CategoryId | null = compactLayout() ? null : "browser",
  opened = true,
  panel = false,
  branchSide = "right",
  query = "",
  busy = false;
let trail: MenuItem[] = [];

const sorted = (list: MenuItem[]) =>
  [...list].sort(
    (a, b) => (state.usage[b.id]?.count ?? 0) - (state.usage[a.id]?.count ?? 0),
  );
function notify(message: string, error = false) {
  const old = document.querySelector(".toast");
  old?.remove();
  const el = document.createElement("div");
  el.className = `toast ${error ? "error" : ""}`;
  el.setAttribute("role", error ? "alert" : "status");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 6500);
}
async function refresh() {
  await settingsQueue;
  state = await loadState();
}
async function close() {
  try {
    await hide();
    opened = false;
    panel = false;
    render();
  } catch (e) {
    notify(String(e), true);
  }
}
function show() {
  opened = true;
  panel = false;
  query = "";
  selected = compactLayout() ? null : defaultCategory();
  wheelPage = 0;
  trail = [];
  render();
}
function actionButton(item: MenuItem, i: number) {
  return `<button class="bubble" style="--i:${i}" data-item="${esc(item.id)}" aria-label="${esc(item.title)}"><span class="app-icon ${esc(item.icon)}">${icon(item.icon)}</span><span class="bubble-copy"><strong>${esc(item.title)}</strong><small>${esc(item.description ?? (item.action?.type === "folder" ? "Pasta favorita" : "Seu atalho"))}</small></span>${icon(item.children ? "chevron" : "arrow", "bubble-arrow")}</button>`;
}
function render(animate = false) {
  applyTheme();
  const pageCount = Math.ceil(wheelOptions(state).length / 4);
  wheelPage = Math.max(0, Math.min(wheelPage, pageCount - 1));
  document.body.classList.toggle("native", native);
  document.documentElement.classList.toggle("desktop", native);
  const available = allItems(state);
  const listing = query
    ? sorted(
        available.filter((i) =>
          i.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        ),
      )
    : sorted(
        trail.at(-1)?.children ??
          available.filter((i) => i.category === selected),
      );
  app.innerHTML = `<div class="wallpaper" aria-hidden="true"><div class="wave wave-one"></div><div class="wave wave-two"></div><div class="grain"></div></div>
  <div class="shell ${opened ? "" : "closed"}">
    ${
      opened
        ? `<main class="workspace" aria-label="Launcher Orbit"><div class="launcher ${selected ? "has-selection" : ""} ${branchSide === "left" ? "branch-left" : ""}" data-launcher>
      <div class="radial-column">${radial(selected, state, wheelPage)}<div class="compact-controls"><button class="icon-button" id="settings" aria-label="Configurações" title="Configurações">${icon("settings")}</button><button class="icon-button" id="add-to-wheel" aria-label="Adicionar à bola" title="Adicionar à bola">${icon("plus")}</button>${pageCount > 1 ? `<div class="page-controls"><button class="icon-button" id="previous-page" aria-label="Página anterior de opções">${icon("chevronLeft")}</button><span>${wheelPage + 1}/${pageCount}</span><button class="icon-button" id="next-page" aria-label="Próxima página de opções">${icon("chevron")}</button></div>` : ""}<button class="icon-button dismiss" id="close" aria-label="Fechar launcher" title="Fechar (Esc)">${icon("close")}</button></div></div>
      <section class="branch ${!selected && !query ? "collapsed" : ""}" aria-label="Opções da categoria">
        <header class="branch-heading"><button class="icon-button back-list" id="back-list" aria-label="Voltar às categorias">${icon("back")}</button><h1>${esc(trail.at(-1)?.title ?? categories.find((c) => c.id === selected)?.title ?? "Escolha uma categoria")}</h1><span class="count" aria-label="${listing.length} opções">${listing.length}</span><button class="icon-button branch-settings" id="branch-settings" aria-label="Configurações">${icon("settings")}</button></header>
        <svg class="connectors" viewBox="0 0 100 360" preserveAspectRatio="none" aria-hidden="true">${[45, 135, 225, 315].map((y) => `<path d="M0 180 C60 180 35 ${y} 100 ${y}"/>`).join("")}<circle cx="4" cy="180" r="4"/></svg>
        <div class="branch-list">${listing.map(actionButton).join("")}${listing.length === 0 ? `<p class="empty-list">${selected === "games" ? "Adicione o executável do seu jogo para abrir por aqui." : "Guarde aqui as pastas dos seus projetos."}</p>` : ""}${selected === "projects" && !query ? `<button class="bubble add-project" id="add-project" aria-label="Adicionar projeto"><span class="app-icon">${icon("plus")}</span><span class="bubble-copy"><strong>Adicionar projeto</strong></span></button>` : ""}${["apps", "games", "streaming"].includes(selected ?? "") && !query ? `<button class="bubble add-project" id="add-app" aria-label="${selected === "games" ? "Adicionar jogo" : selected === "streaming" ? "Adicionar streaming" : "Adicionar aplicativo"}"><span class="app-icon">${icon("plus")}</span><span class="bubble-copy"><strong>${selected === "games" ? "Adicionar jogo" : selected === "streaming" ? "Adicionar streaming" : "Adicionar aplicativo"}</strong></span></button>` : ""}</div>
      </section>
    </div></main>`
        : `<div class="resting"><button class="icon-button" id="settings" aria-label="Configurações" title="Configurações">${icon("settings")}</button><button class="primary" id="reopen">Abrir Orbit ${icon("arrow")}</button><p><kbd>${esc(hotkeyLabel(state.settings.hotkey))}</kbd></p></div>`
    }
    ${panel ? settingsView(state, selected) : ""}
  </div>`;
  bind();
  if (animate) {
    app.querySelector(".wheel")?.classList.add("menu-swing");
    app.querySelector(".branch")?.classList.add("menu-swing");
  }
}

function bind() {
  for (const button of app.querySelectorAll<HTMLElement>("[data-mode-switch]"))
    button.onclick = () => {
      const mode: Mode = state.settings.mode === "main" ? "rest" : "main";
      void updateSettings({ mode }).catch((e) => notify(String(e), true));
      wheelPage = 0;
      selected = compactLayout() ? null : defaultCategory();
      query = "";
      trail = [];
      render(true);
      app
        .querySelector<HTMLElement>(
          `[data-mode-switch="${button.dataset.modeSwitch}"]`,
        )
        ?.focus({ preventScroll: true });
    };
  for (const [id, delta] of [
    ["previous-page", -1],
    ["next-page", 1],
  ] as const)
    app.querySelector("#" + id)?.addEventListener("click", () => {
      const count = Math.ceil(wheelOptions(state).length / 4);
      wheelPage = (wheelPage + delta + count) % count;
      selected = null;
      query = "";
      trail = [];
      render(true);
      app.querySelector<HTMLElement>("#" + id)?.focus({ preventScroll: true });
    });
  for (const button of app.querySelectorAll<HTMLElement>("[data-theme-choice]"))
    button.onclick = () => {
      void updateSettings({ theme: button.dataset.themeChoice as Theme }).catch(
        (e) => notify(String(e), true),
      );
      for (const el of app.querySelectorAll<HTMLElement>("[data-theme-choice]"))
        el.setAttribute("aria-pressed", String(el === button));
    };
  const openForm = (category: CategoryId, kind = "url", title = "") => {
    panel = true;
    render();
    app.querySelector<HTMLSelectElement>("#shortcut-category")!.value =
      category;
    const kindInput = app.querySelector<HTMLSelectElement>("#shortcut-kind")!;
    kindInput.value = kind;
    kindInput.dispatchEvent(new Event("change"));
    const titleInput = app.querySelector<HTMLInputElement>("#shortcut-title")!;
    titleInput.value = title;
    titleInput.focus();
    app.querySelector("#shortcut-form")?.scrollIntoView({ block: "start" });
  };
  app
    .querySelector("#add-to-wheel")
    ?.addEventListener("click", () => openForm(`orbit-${state.settings.mode}`));
  app
    .querySelector("[data-add]")
    ?.addEventListener("click", () => openForm(`orbit-${state.settings.mode}`));
  app
    .querySelector('[data-suggestion="books"]')
    ?.addEventListener("click", () =>
      openForm("orbit-rest", "folder", "Livros"),
    );
  app.querySelector("#quit-orbit")?.addEventListener("click", () => {
    if (native) void invoke("quit_orbit");
    else void close();
  });
  const hotkeyInput = app.querySelector<HTMLInputElement>("#hotkey");
  const saveHotkey = app.querySelector<HTMLButtonElement>("#save-hotkey");
  hotkeyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Tab") return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      hotkeyInput.value = hotkeyLabel(state.settings.hotkey);
      delete hotkeyInput.dataset.hotkey;
      saveHotkey!.disabled = true;
      return;
    }
    try {
      const value = hotkeyFromEvent(e);
      if (value) {
        hotkeyInput.value = hotkeyLabel(value);
        hotkeyInput.dataset.hotkey = value;
        saveHotkey!.disabled = value === state.settings.hotkey;
      }
    } catch (error) {
      notify(String(error), true);
    }
  });
  saveHotkey?.addEventListener("click", async () => {
    const hotkey = hotkeyInput?.dataset.hotkey;
    if (!hotkey) return;
    saveHotkey.disabled = true;
    try {
      await updateSettings({ hotkey });
      await refresh();
      render(true);
      notify("Atalho de teclado atualizado.");
    } catch (error) {
      saveHotkey.disabled = false;
      notify(String(error), true);
    }
  });

  app.querySelector("#close")?.addEventListener("click", () => void close());
  app.querySelector("#reopen")?.addEventListener("click", show);
  for (const el of app.querySelectorAll<HTMLElement>("[data-category]"))
    el.onclick = () => {
      selected = el.dataset.category as CategoryId;
      query = "";
      trail = [];
      render(true);
      app
        .querySelector<HTMLElement>(`[data-category="${selected}"]`)
        ?.focus({ preventScroll: true });
    };
  const back = () => {
    if (trail.length) trail.pop();
    else selected = null;
    query = "";
    render(true);
    app.querySelector<HTMLElement>("[data-category]")?.focus();
  };
  app.querySelector("#back")?.addEventListener("click", back);
  app.querySelector("#back-list")?.addEventListener("click", back);
  for (const el of app.querySelectorAll<HTMLElement>("[data-item]"))
    el.onclick = () => void runItem(el.dataset.item!);
  for (const id of [
    "settings",
    "branch-settings",
    "add",
    "customize",
    "add-project",
    "add-app",
  ])
    app.querySelector("#" + id)?.addEventListener("click", () => {
      panel = true;
      render();
      app.querySelector<HTMLButtonElement>("#close-settings")?.focus();
      if (id === "add-project" || id === "add-app") {
        openForm(
          selected!,
          id === "add-project"
            ? "folder"
            : selected === "streaming"
              ? "url"
              : "executable",
        );
      }
    });
  app.querySelector("#close-settings")?.addEventListener("click", () => {
    panel = false;
    render();
  });
  app.querySelector(".panel-backdrop")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      panel = false;
      render();
    }
  });
  app
    .querySelector<HTMLSelectElement>("#trigger")
    ?.addEventListener("change", async (e) => {
      const trigger = (e.target as HTMLSelectElement)
        .value as Settings["trigger"];
      try {
        await updateSettings({ trigger });
        await refresh();
        notify("Ativação atualizada.");
      } catch (error) {
        (e.target as HTMLSelectElement).value = state.settings.trigger;
        notify(String(error), true);
      }
    });
  app
    .querySelector<HTMLSelectElement>("#shortcut-mode")
    ?.addEventListener("change", (e) => {
      const mode = (e.target as HTMLSelectElement).value;
      app.querySelector<HTMLSelectElement>("#shortcut-category")!.innerHTML =
        categoryOptions(mode, `orbit-${mode}` as CategoryId);
      app.querySelector("#shortcut-kind")!.dispatchEvent(new Event("change"));
    });
  app
    .querySelector("#shortcut-category")
    ?.addEventListener("change", () =>
      app.querySelector("#shortcut-kind")!.dispatchEvent(new Event("change")),
    );
  app
    .querySelector<HTMLSelectElement>("#shortcut-kind")
    ?.addEventListener("change", (e) => {
      const kind = (e.target as HTMLSelectElement).value;
      const local = kind !== "url";
      (app.querySelector("#url-field") as HTMLElement).hidden = local;
      const picker = app.querySelector<HTMLButtonElement>("#pick-folder")!;
      picker.hidden = !local;
      picker.textContent =
        kind === "executable"
          ? "Selecionar executável (.exe)"
          : "Selecionar pasta";
      app.querySelector<HTMLInputElement>("#folder-path")!.value = "";
      app.querySelector<HTMLInputElement>("#shortcut-url")!.required = !local;
      const category =
        app.querySelector<HTMLSelectElement>("#shortcut-category")!;
      if (
        kind === "executable" &&
        !["apps", "games", "orbit-main", "orbit-rest"].includes(category.value)
      )
        category.value =
          app.querySelector<HTMLSelectElement>("#shortcut-mode")!.value ===
          "rest"
            ? "games"
            : "apps";
      category.disabled = false;
    });
  app.querySelector("#pick-folder")?.addEventListener("click", async () => {
    try {
      const executable =
        app.querySelector<HTMLSelectElement>("#shortcut-kind")!.value ===
        "executable";
      const path = await (executable ? chooseExecutable() : chooseFolder());
      if (path) {
        app.querySelector<HTMLInputElement>("#folder-path")!.value = path;
        app.querySelector("#pick-folder")!.textContent = path;
        const title = app.querySelector<HTMLInputElement>("#shortcut-title")!;
        if (executable && !title.value)
          title.value = (path.split(/[\\/]/).at(-1) ?? "Aplicativo")
            .replace(/\.exe$/i, "")
            .slice(0, 60);
      }
    } catch (e) {
      notify(String(e), true);
    }
  });
  app
    .querySelector<HTMLFormElement>("#shortcut-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const kind = data.get("kind") as "url" | "folder" | "executable";
      const value =
        kind === "url"
          ? String(data.get("url"))
          : app.querySelector<HTMLInputElement>("#folder-path")!.value;
      try {
        if (!value)
          throw new Error(
            kind === "executable"
              ? "Selecione um executável primeiro."
              : "Selecione uma pasta primeiro.",
          );
        await addShortcut(
          String(data.get("title")),
          data.get("category") as CategoryId,
          { type: kind, value },
        );
        await refresh();
        const destination = String(data.get("category"));
        if (destination.startsWith("orbit-")) {
          await updateSettings({ mode: data.get("mode") as Mode });
          const realOptions = wheelOptions(state).filter(
            (o) => o.kind !== "add",
          );
          wheelPage = Math.floor((realOptions.length - 1) / 4);
          selected = null;
        }
        render();
        notify("Atalho adicionado à sua órbita.");
      } catch (error) {
        notify(String(error), true);
      }
    });
  for (const el of app.querySelectorAll<HTMLElement>("[data-remove]"))
    el.onclick = async () => {
      try {
        await removeShortcut(el.dataset.remove!);
        await refresh();
        if (wheelPage >= Math.ceil(wheelOptions(state).length / 4))
          wheelPage = 0;
        render();
        notify("Atalho removido.");
      } catch (e) {
        notify(String(e), true);
      }
    };
  app.querySelector("#clear-history")?.addEventListener("click", async () => {
    try {
      await clearHistory();
      await refresh();
      render();
      notify("Histórico apagado.");
    } catch (e) {
      notify(String(e), true);
    }
  });
}
async function runItem(id: string) {
  if (busy) return;
  const item =
    allItems(state).find((i) => i.id === id) ??
    trail.at(-1)?.children?.find((i) => i.id === id);
  if (!item) return;
  if (item.children) {
    trail.push(item);
    render();
    return;
  }
  busy = true;
  try {
    await execute(item);
    await refresh();
    await close();
  } catch (e) {
    notify(String(e), true);
  } finally {
    busy = false;
  }
}
document.addEventListener("keydown", (e) => {
  if (
    !(e.target as HTMLElement).closest("input,select,textarea") &&
    matchesHotkey(e, state.settings.hotkey)
  ) {
    e.preventDefault();
    show();
    return;
  }
  if (e.key === "Escape") {
    if (panel) {
      panel = false;
      render();
    } else void close();
  }
  if (e.key === "Tab" && panel) {
    const nodes = Array.from(
      app.querySelectorAll<HTMLElement>(
        '.settings-panel button:not([hidden]):not(:disabled), .settings-panel input:not([type="hidden"]):not(:disabled), .settings-panel select:not(:disabled)',
      ),
    ).filter((el) => el.getClientRects().length);
    if (e.shiftKey && document.activeElement === nodes[0]) {
      e.preventDefault();
      nodes.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
      e.preventDefault();
      nodes[0]?.focus();
    }
  }
});
document.addEventListener("mousedown", (e) => {
  if (
    opened &&
    !panel &&
    e.button === 0 &&
    !(e.target as HTMLElement).closest(
      "button,a,header,footer,.rail,.intro,.branch-heading,.compact-controls",
    )
  ) {
    if (!(e.target as HTMLElement).closest(".wheel,.branch-list")) void close();
  }
});
if (!native)
  document.addEventListener("mousedown", (e) => {
    if (
      e.button === 1 &&
      (state.settings.trigger === "middle" ||
        (state.settings.trigger === "alt-middle" && e.altKey))
    ) {
      e.preventDefault();
      show();
    }
  });
if (native) {
  await listen<{ branchSide: string }>("orbit:activate", async (e) => {
    branchSide = e.payload.branchSide;
    try {
      await refresh();
    } catch (error) {
      notify(String(error), true);
    }
    show();
  });
}
try {
  await refresh();
  selected = compactLayout() ? null : defaultCategory();
} catch (e) {
  notify(String(e), true);
}
render();
if (native)
  await invoke("frontend_ready").catch((error) => notify(String(error), true));
