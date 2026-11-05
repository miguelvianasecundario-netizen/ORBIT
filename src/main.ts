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
  browserStatus,
  prepareBrowser,
  launchWork,
} from "./bridge";
import { icon } from "./icons";
import { radial, wheelOptions } from "./radial";
import { categories, adjacentMode } from "./data";
import { workView, workItems } from "./work-view";
import { itemIcon, hydrateIcons } from "./item-icons";
import {
  DEFAULT_APPEARANCE,
  applyAppearance,
  transparencyControls,
  type TransparencyKey,
} from "./appearance";
import type {
  CategoryId,
  ViewId,
  WorkReport,
  BrowserStatus,
  MenuItem,
  OrbitState,
  Settings,
  Theme,
  Mode,
  AppearanceSettings,
} from "./types";
const app = document.querySelector<HTMLDivElement>("#app")!;
let state: OrbitState = {
  usage: {},
  settings: {
    trigger: "alt-middle",
    hotkey: DEFAULT_HOTKEY,
    theme: "ocean",
    mode: "main",
    ...DEFAULT_APPEARANCE,
  },
  shortcuts: [],
};
const compactLayout = () => innerWidth < 620 || innerHeight < 380;
let appearanceDraft: Partial<AppearanceSettings> = {};
let appearanceTimer: ReturnType<typeof setTimeout> | undefined;
let wheelPage = 0;
let settingsQueue: Promise<void> = Promise.resolve();
let preferenceRevision = 0;
let confirmedSettings = { ...state.settings };
let pendingSettings: { patch: Partial<Settings> }[] = [];
const defaultCategory = (): CategoryId =>
  state.settings.mode === "main"
    ? "browser"
    : state.settings.mode === "rest"
      ? "streaming"
      : "work-browser";
function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  applyAppearance({ ...state.settings, ...appearanceDraft });
}
function syncAppearanceControls() {
  const appearance = { ...state.settings, ...appearanceDraft };
  for (const { key } of transparencyControls) {
    const input = app.querySelector<HTMLInputElement>(
      `[data-transparency="${key}"]`,
    );
    if (input) input.value = String(appearance[key]);
    if (input)
      input.setAttribute("aria-valuetext", `${appearance[key]}% transparente`);
    const output = app.querySelector<HTMLElement>(`#${key}-value`);
    if (output) output.textContent = `${appearance[key]}%`;
  }
  const checkbox = app.querySelector<HTMLInputElement>("#icons-only");
  if (checkbox) checkbox.checked = appearance.iconsOnly;
  const toggle = app.querySelector<HTMLButtonElement>("#toggle-icons-only");
  if (toggle) {
    toggle.title = appearance.iconsOnly ? "Mostrar nomes" : "Modo só ícones";
    toggle.setAttribute("aria-label", toggle.title);
    toggle.setAttribute("aria-pressed", String(appearance.iconsOnly));
    toggle.innerHTML = icon(appearance.iconsOnly ? "expand" : "minimize");
  }
}
function commitAppearanceDraft() {
  clearTimeout(appearanceTimer);
  const patch = appearanceDraft;
  appearanceDraft = {};
  if (Object.keys(patch).length)
    void updateSettings(patch).catch((error) => notify(String(error), true));
}
function syncPreferenceControls() {
  applyTheme();
  syncAppearanceControls();
  for (const el of app.querySelectorAll<HTMLElement>("[data-theme-choice]"))
    el.setAttribute(
      "aria-pressed",
      String(el.dataset.themeChoice === state.settings.theme),
    );
  const trigger = app.querySelector<HTMLSelectElement>("#trigger");
  if (trigger) trigger.value = state.settings.trigger;
}
function updateSettings(patch: Partial<Settings>): Promise<void> {
  preferenceRevision++;
  const change = { patch: { ...patch } };
  pendingSettings.push(change);
  state.settings = { ...state.settings, ...patch };
  syncPreferenceControls();
  const work = settingsQueue.then(async () => {
    // Build on the last successful save. A rejected hotkey must not be copied
    // into a later, unrelated theme or activation change.
    const next = { ...confirmedSettings, ...change.patch };
    try {
      await saveSettings(next);
      confirmedSettings = next;
    } finally {
      pendingSettings = pendingSettings.filter((entry) => entry !== change);
      state.settings = pendingSettings.reduce(
        (settings, entry) => ({ ...settings, ...entry.patch }),
        { ...confirmedSettings },
      );
      syncPreferenceControls();
    }
  });
  settingsQueue = work.catch(() => {});
  return work;
}
let selected: ViewId | null = compactLayout() ? null : "browser",
  opened = true,
  panel = false,
  branchSide = "right",
  query = "",
  busy = false;
let trail: MenuItem[] = [];
let workBusy = false;
let workReport: WorkReport | null = null;
let brave: BrowserStatus | null = null;
let addingShortcut = false;
let pickingDestination = false;
let panelOpener = "#settings";
function rememberPanelOpener() {
  const el = document.activeElement;
  for (const attr of [
    "id",
    "data-category",
    "data-item",
    "data-suggestion",
    "data-add",
  ]) {
    const value = el?.getAttribute(attr);
    if (value) {
      panelOpener = `[${attr}="${CSS.escape(value)}"]`;
      return;
    }
  }
}
function focusVisible(...selectors: string[]) {
  for (const selector of selectors) {
    const el = app.querySelector<HTMLElement>(selector);
    if (el?.getClientRects().length) {
      el.focus({ preventScroll: true });
      return;
    }
  }
}
function closePanel() {
  commitAppearanceDraft();
  panel = false;
  render();
  focusVisible(panelOpener, "#branch-settings", "#settings", ".category");
}

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
  const revision = preferenceRevision;
  const snapshot = await loadState();
  if (revision === preferenceRevision) {
    state = snapshot;
    confirmedSettings = { ...snapshot.settings };
  } else {
    state = { ...snapshot, settings: state.settings };
  }
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
  return `<button class="bubble" style="--i:${i}" data-item="${esc(item.id)}" aria-label="${esc(item.title)}" title="${esc(item.title)}"><span class="app-icon ${esc(item.icon)}">${itemIcon(item)}</span><span class="bubble-copy"><strong>${esc(item.title)}</strong><small>${esc(item.description ?? (item.action?.type === "folder" ? "Pasta favorita" : "Seu atalho"))}</small></span>${icon(item.children ? "chevron" : "arrow", "bubble-arrow")}</button>`;
}
function render(animate = false) {
  applyTheme();
  const pageCount = Math.ceil(wheelOptions(state).length / 4);
  wheelPage = Math.max(0, Math.min(wheelPage, pageCount - 1));
  document.body.classList.toggle("native", native);
  document.documentElement.classList.toggle("desktop", native);
  const available = allItems(state);
  const addingLabels: Partial<Record<ViewId, string>> = {
    apps: "Adicionar aplicativo",
    games: "Adicionar jogo",
    projects: "Adicionar projeto",
    streaming: "Adicionar streaming",
    "work-apps": "Adicionar aplicativo",
    "work-projects": "Adicionar projeto",
  };
  const addLabel = selected
    ? (addingLabels[selected] ?? "Adicionar atalho nesta categoria")
    : "Adicionar atalho nesta categoria";
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
        ? `<main class="workspace" aria-label="Launcher Orbit"><div class="launcher ${selected === "work-all" ? "work-summary-open" : ""} ${selected ? "has-selection" : ""} ${branchSide === "left" ? "branch-left" : ""}" data-launcher>
      <div class="radial-column">${radial(selected, state, wheelPage)}<div class="compact-controls"><button class="icon-button" id="settings" aria-label="Configurações" title="Configurações">${icon("settings")}</button><button class="icon-button" id="add-to-wheel" aria-label="Adicionar à bola" title="Adicionar à bola">${icon("plus")}</button>${pageCount > 1 ? `<div class="page-controls"><button class="icon-button" id="previous-page" aria-label="Página anterior de opções">${icon("chevronLeft")}</button><span>${wheelPage + 1}/${pageCount}</span><button class="icon-button" id="next-page" aria-label="Próxima página de opções">${icon("chevron")}</button></div>` : ""}<button class="icon-button" id="toggle-icons-only" aria-label="Modo só ícones" title="Modo só ícones">${icon("minimize")}</button><button class="icon-button dismiss" id="close" aria-label="Fechar launcher" title="Fechar (Esc)">${icon("close")}</button></div></div>
      <section class="branch ${selected === "work-all" ? "work-summary" : ""} ${!selected && !query ? "collapsed" : ""}" aria-label="Opções da categoria">
        <header class="branch-heading"><button class="icon-button back-list" id="back-list" aria-label="Voltar às categorias">${icon("back")}</button><h1>${esc(selected === "work-all" ? "Work" : (trail.at(-1)?.title ?? categories.find((c) => c.id === selected)?.title ?? "Escolha uma categoria"))}</h1><span class="count" aria-label="${selected === "work-all" ? workItems(state).length : listing.length} opções">${selected === "work-all" ? workItems(state).length : listing.length}</span>${selected && selected !== "work-all" ? `<button class="icon-button branch-add" id="add-category-shortcut" aria-label="${addLabel}" title="${addLabel}">${icon("plus")}</button>` : ""}<button class="icon-button branch-settings" id="branch-settings" aria-label="Configurações">${icon("settings")}</button></header>
        <svg class="connectors" viewBox="0 0 100 360" preserveAspectRatio="none" aria-hidden="true">${[45, 135, 225, 315].map((y) => `<path d="M0 180 C60 180 35 ${y} 100 ${y}"/>`).join("")}<circle cx="4" cy="180" r="4"/></svg>
        <div class="branch-list ${listing.length && selected !== "work-all" ? "has-items" : ""}">${selected === "work-all" ? workView(state, workReport, workBusy, brave) : listing.map(actionButton).join("") + (listing.length === 0 ? `<p class="empty-list">Adicione seus atalhos pelo + no cabeçalho.</p>` : "")}</div>
      </section>
    </div></main>`
        : `<div class="resting"><button class="icon-button" id="settings" aria-label="Configurações" title="Configurações">${icon("settings")}</button><button class="primary" id="reopen">Abrir Orbit ${icon("arrow")}</button><p><kbd>${esc(hotkeyLabel(state.settings.hotkey))}</kbd></p></div>`
    }
    ${panel ? settingsView(state, selected === "work-all" ? null : selected) : ""}
  </div>`;
  bind();
  syncAppearanceControls();
  hydrateIcons(app, available);
  void refreshBrowserStatus();
  if (animate) {
    app.querySelector(".wheel")?.classList.add("menu-swing");
    app.querySelector(".branch")?.classList.add("menu-swing");
  }
}

function bind() {
  for (const input of app.querySelectorAll<HTMLInputElement>(
    "[data-transparency]",
  )) {
    input.oninput = () => {
      const key = input.dataset.transparency as TransparencyKey;
      appearanceDraft[key] = input.valueAsNumber;
      applyTheme();
      syncAppearanceControls();
      clearTimeout(appearanceTimer);
      appearanceTimer = setTimeout(commitAppearanceDraft, 250);
    };
    input.onchange = commitAppearanceDraft;
  }
  app
    .querySelector<HTMLInputElement>("#icons-only")
    ?.addEventListener("change", (event) => {
      commitAppearanceDraft();
      void updateSettings({
        iconsOnly: (event.currentTarget as HTMLInputElement).checked,
      }).catch((error) => notify(String(error), true));
    });
  app.querySelector("#toggle-icons-only")?.addEventListener("click", () => {
    void updateSettings({ iconsOnly: !state.settings.iconsOnly }).catch(
      (error) => notify(String(error), true),
    );
  });
  app.querySelector("#reset-appearance")?.addEventListener("click", () => {
    clearTimeout(appearanceTimer);
    appearanceDraft = {};
    void updateSettings({ ...DEFAULT_APPEARANCE }).catch((error) =>
      notify(String(error), true),
    );
  });
  for (const button of app.querySelectorAll<HTMLElement>("[data-mode-switch]"))
    button.onclick = () => {
      const mode: Mode = adjacentMode(
        state.settings.mode,
        button.dataset.modeSwitch === "previous" ? -1 : 1,
      );
      void updateSettings({ mode }).catch((e) => {
        selected = compactLayout() ? null : defaultCategory();
        wheelPage = 0;
        if (!panel) render();
        notify(String(e), true);
      });
      wheelPage = 0;
      selected = compactLayout() ? null : defaultCategory();
      workReport = null;
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
    if (!panel) rememberPanelOpener();
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
    .querySelector("#add-work-shortcut")
    ?.addEventListener("click", () => openForm("orbit-work"));
  app.querySelector("#add-category-shortcut")?.addEventListener("click", () => {
    if (!selected || selected === "work-all") return;
    const kind = ["apps", "games", "work-apps"].includes(selected)
      ? "executable"
      : ["projects", "work-projects"].includes(selected)
        ? "folder"
        : "url";
    openForm(selected, kind);
  });
  for (const button of app.querySelectorAll("[data-batch], #run-work"))
    button.addEventListener("click", () => void runWork());
  app.querySelector("#prepare-browser")?.addEventListener("click", async () => {
    const button = app.querySelector<HTMLButtonElement>("#prepare-browser")!;
    const result = app.querySelector<HTMLElement>("#browser-setup-result")!;
    button.disabled = true;
    try {
      const path = await prepareBrowser();
      result.hidden = false;
      result.textContent = `No Brave, abra brave://extensions, ative Modo de desenvolvedor e use Carregar sem compactação. Selecione a pasta: ${path}. A conexão aparecerá aqui quando estiver pronta.`;
      await refreshBrowserStatus();
    } catch (e) {
      notify(String(e), true);
    } finally {
      button.disabled = false;
    }
  });
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
    hotkeyInput!.disabled = true;
    try {
      await updateSettings({ hotkey });
      notify("Atalho de teclado atualizado.");
    } catch (error) {
      notify(String(error), true);
    } finally {
      hotkeyInput!.disabled = false;
      hotkeyInput!.value = hotkeyLabel(state.settings.hotkey);
      delete hotkeyInput!.dataset.hotkey;
      saveHotkey.disabled = true;
      hotkeyInput!.focus({ preventScroll: true });
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
      if (compactLayout())
        focusVisible(
          ".branch-list [data-item]",
          "#add-category-shortcut",
          "#back-list",
        );
      else focusVisible(`[data-category="${selected}"]`);
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
  for (const id of ["settings", "branch-settings"])
    app.querySelector("#" + id)?.addEventListener("click", () => {
      rememberPanelOpener();
      panel = true;
      render();
      app.querySelector<HTMLButtonElement>("#close-settings")?.focus();
    });
  app.querySelector("#close-settings")?.addEventListener("click", closePanel);
  app.querySelector(".panel-backdrop")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      closePanel();
    }
  });
  app
    .querySelector<HTMLSelectElement>("#trigger")
    ?.addEventListener("change", async (e) => {
      const trigger = (e.target as HTMLSelectElement)
        .value as Settings["trigger"];
      try {
        await updateSettings({ trigger });
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
      const pathInput = app.querySelector<HTMLInputElement>("#folder-path")!;
      // Category/mode changes reuse this handler but do not change the file type.
      if (pathInput.dataset.kind !== kind) pathInput.value = "";
      pathInput.dataset.kind = kind;
      picker.textContent =
        pathInput.value ||
        (kind === "executable"
          ? "Selecionar executável (.exe)"
          : "Selecionar pasta");
      app.querySelector<HTMLInputElement>("#shortcut-url")!.required = !local;
    });
  app.querySelector("#pick-folder")?.addEventListener("click", async () => {
    if (pickingDestination) return;
    const form = app.querySelector<HTMLFormElement>("#shortcut-form")!;
    const kindInput = form.querySelector<HTMLSelectElement>("#shortcut-kind")!;
    const picker = form.querySelector<HTMLButtonElement>("#pick-folder")!;
    const pathInput = form.querySelector<HTMLInputElement>("#folder-path")!;
    const title = form.querySelector<HTMLInputElement>("#shortcut-title")!;
    const kind = kindInput.value;
    pickingDestination = true;
    picker.disabled = true;
    try {
      const path = await (kind === "executable"
        ? chooseExecutable()
        : chooseFolder());
      // An async dialog must never write into a different/reopened form.
      if (path && form.isConnected && kindInput.value === kind) {
        pathInput.value = path;
        picker.textContent = path;
        if (kind === "executable" && !title.value)
          title.value = Array.from(
            (path.split(/[\\/]/).at(-1) ?? "Aplicativo").replace(/\.exe$/i, ""),
          )
            .slice(0, 80)
            .join("");
      }
    } catch (e) {
      notify(String(e), true);
    } finally {
      pickingDestination = false;
      picker.disabled = false;
      if (picker.isConnected) picker.focus({ preventScroll: true });
    }
  });
  app
    .querySelector<HTMLFormElement>("#shortcut-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (addingShortcut || pickingDestination) return;
      const form = e.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const submit = form.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )!;
      addingShortcut = true;
      submit.disabled = true;
      form.setAttribute("aria-busy", "true");
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
        focusVisible("#shortcut-title");
      } catch (error) {
        notify(String(error), true);
      } finally {
        addingShortcut = false;
        submit.disabled = false;
        form.removeAttribute("aria-busy");
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
async function refreshBrowserStatus() {
  if (!panel && state.settings.mode !== "work") return;
  try {
    brave = await browserStatus();
  } catch {
    brave = { connected: false, prepared: false };
  }
  const label = brave.connected
    ? "Brave conectado · as abas existentes serão preservadas."
    : brave.prepared
      ? "Extensão preparada. Carregue-a no Brave e use Reconectar, se necessário."
      : "Extensão ainda não conectada.";
  for (const node of app.querySelectorAll(
    "#browser-connection, #work-browser-connection",
  ))
    node.textContent = label;
}
setInterval(() => {
  if (opened && (panel || state.settings.mode === "work"))
    void refreshBrowserStatus();
}, 3000);
async function runWork() {
  if (workBusy) return;
  selected = "work-all";
  workReport = null;
  if (!workItems(state).length) {
    render();
    return;
  }
  workBusy = true;
  render();
  try {
    const report = await launchWork();
    workReport = report;
    await refresh();
  } catch (e) {
    notify(String(e), true);
  } finally {
    workBusy = false;
    if (opened && !panel && state.settings.mode === "work") {
      render();
      focusVisible("#run-work");
    }
  }
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
    if (panel) closePanel();
    else void close();
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
