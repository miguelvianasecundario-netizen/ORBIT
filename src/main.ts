import {
  DEFAULT_HOTKEY,
  hotkeyLabel,
  hotkeyFromEvent,
  matchesHotkey,
} from "./hotkey";
import { settingsView } from "./settings";
import { esc } from "./utils";
import "./style.css";
import { listen } from "@tauri-apps/api/event";
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
  allItems,
} from "./bridge";
import { icon } from "./icons";
import { radial } from "./radial";
import type { CategoryId, MenuItem, OrbitState, Settings } from "./types";
const app = document.querySelector<HTMLDivElement>("#app")!;
let state: OrbitState = {
  usage: {},
  settings: { trigger: "alt-middle", hotkey: DEFAULT_HOTKEY },
  shortcuts: [],
};
let selected: CategoryId | null = "browser",
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
  selected = "browser";
  trail = [];
  render();
}
function actionButton(item: MenuItem, i: number) {
  return `<button class="bubble" style="--i:${i}" data-item="${esc(item.id)}" aria-label="${esc(item.title)}"><span class="app-icon ${esc(item.icon)}">${icon(item.icon)}</span><span class="bubble-copy"><strong>${esc(item.title)}</strong><small>${esc(item.description ?? (item.action?.type === "folder" ? "Pasta favorita" : "Seu atalho"))}</small></span>${icon(item.children ? "chevron" : "arrow", "bubble-arrow")}</button>`;
}
function render() {
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
    <div class="compact-controls"><button class="icon-button" id="settings" aria-label="Configurações" title="Configurações">${icon("settings")}</button>${opened ? `<button class="icon-button" id="close" aria-label="Fechar launcher" title="Fechar (Esc)">${icon("close")}</button>` : ""}</div>
    ${
      opened
        ? `<main class="workspace" aria-label="Launcher Orbit"><div class="launcher ${branchSide === "left" ? "branch-left" : ""}" data-launcher>
      ${radial(selected)}
      <section class="branch ${!selected && !query ? "collapsed" : ""}" aria-label="Opções da categoria">
        <svg class="connectors" viewBox="0 0 100 360" preserveAspectRatio="none" aria-hidden="true">${[45, 135, 225, 315].map((y) => `<path d="M0 180 C60 180 35 ${y} 100 ${y}"/>`).join("")}<circle cx="4" cy="180" r="4"/></svg>
        <div class="branch-list">${listing.map(actionButton).join("")}${selected === "projects" && !query ? `<button class="bubble add-project" id="add-project" aria-label="Adicionar projeto"><span class="app-icon">${icon("plus")}</span><span class="bubble-copy"><strong>Adicionar projeto</strong></span></button>` : ""}</div>
        <button class="text-button" id="customize">${icon("plus")} Personalizar</button>
      </section>
    </div></main>`
        : `<div class="resting"><button class="primary" id="reopen">Abrir Orbit ${icon("arrow")}</button><p><kbd>${esc(hotkeyLabel(state.settings.hotkey))}</kbd></p></div>`
    }
    ${panel ? settingsView(state, selected) : ""}
  </div>`;
  bind();
}

function bind() {
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
      await saveSettings({ ...state.settings, hotkey });
      await refresh();
      render();
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
      render();
    };
  app.querySelector("#back")?.addEventListener("click", () => {
    if (trail.length) trail.pop();
    else selected = null;
    query = "";
    render();
  });
  for (const el of app.querySelectorAll<HTMLElement>("[data-item]"))
    el.onclick = () => void runItem(el.dataset.item!);
  for (const id of ["settings", "add", "customize", "add-project"])
    app.querySelector("#" + id)?.addEventListener("click", () => {
      panel = true;
      render();
      app.querySelector<HTMLButtonElement>("#close-settings")?.focus();
      if (id === "add-project") {
        const kind = app.querySelector<HTMLSelectElement>("#shortcut-kind")!;
        kind.value = "folder";
        kind.dispatchEvent(new Event("change"));
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
        await saveSettings({ ...state.settings, trigger });
        await refresh();
        notify("Ativação atualizada.");
      } catch (error) {
        (e.target as HTMLSelectElement).value = state.settings.trigger;
        notify(String(error), true);
      }
    });
  app
    .querySelector<HTMLSelectElement>("#shortcut-kind")
    ?.addEventListener("change", (e) => {
      const folder = (e.target as HTMLSelectElement).value === "folder";
      (app.querySelector("#url-field") as HTMLElement).hidden = folder;
      (app.querySelector("#pick-folder") as HTMLElement).hidden = !folder;
      app.querySelector<HTMLInputElement>("#shortcut-url")!.required = !folder;
    });
  app.querySelector("#pick-folder")?.addEventListener("click", async () => {
    try {
      const path = await chooseFolder();
      if (path) {
        app.querySelector<HTMLInputElement>("#folder-path")!.value = path;
        app.querySelector("#pick-folder")!.textContent = path;
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
      const kind = data.get("kind") as "url" | "folder";
      const value =
        kind === "url"
          ? String(data.get("url"))
          : app.querySelector<HTMLInputElement>("#folder-path")!.value;
      try {
        if (!value) throw new Error("Selecione uma pasta primeiro.");
        await addShortcut(
          String(data.get("title")),
          data.get("category") as CategoryId,
          { type: kind, value },
        );
        await refresh();
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
        '.settings-panel button:not([hidden]), .settings-panel input:not([type="hidden"]), .settings-panel select',
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
      "button,a,header,footer,.rail,.intro,.branch-heading",
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
} catch (e) {
  notify(String(e), true);
}
render();
