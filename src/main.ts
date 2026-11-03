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
import { categories } from "./data";
import { icon } from "./icons";
import { radial } from "./radial";
import type { CategoryId, MenuItem, OrbitState, Settings } from "./types";
const app = document.querySelector<HTMLDivElement>("#app")!;
let state: OrbitState = {
  usage: {},
  settings: { trigger: "alt-middle" },
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
  const category = categories.find((c) => c.id === selected);
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
  const favorites = sorted(
    available.filter((i) => state.usage[i.id]?.count),
  ).slice(0, 3);
  app.innerHTML = `<div class="wallpaper" aria-hidden="true"><div class="wave wave-one"></div><div class="wave wave-two"></div><div class="grain"></div></div>
 <div class="shell ${opened ? "" : "closed"}"><header><a class="brand" href="#" aria-label="Orbit início">${icon("orbit")}<span>orbit<span class="brand-dot">.</span></span><span class="brand-caption">SEU UNIVERSO, A UM CLIQUE</span></a><div class="header-actions"><span class="mode"><i></i>${native ? "Windows · conectado" : "Modo navegador"}</span><button class="icon-button" id="settings" aria-label="Configurações" title="Configurações">${icon("settings")}</button>${opened ? `<button class="icon-button" id="close" aria-label="Fechar launcher" title="Fechar (Esc)">${icon("close")}</button>` : ""}</div></header>
 ${
   opened
     ? `<main class="workspace" aria-label="Launcher Orbit"><nav class="rail" aria-label="Navegação rápida">${categories.map((c) => `<button class="rail-button ${selected === c.id ? "active" : ""}" data-category="${c.id}" aria-label="Ir para ${c.title}" title="${c.title}">${icon(c.icon)}</button>`).join("")}<span class="rail-separator"></span><button class="rail-button" id="add" aria-label="Novo atalho" title="Novo atalho">${icon("plus")}</button><span class="rail-light"></span></nav>
 <div class="intro"><div class="eyebrow"><span></span> MENOS DISTÂNCIA. MAIS POSSIBILIDADES.</div><h1>Tudo na sua <em>órbita.</em></h1><p>Escolha uma direção. Siga suas ideias.</p></div>
 <div class="launcher ${branchSide === "left" ? "branch-left" : ""}" data-launcher>${radial(selected)}<section class="branch ${!selected && !query ? "collapsed" : ""}" aria-label="Opções da categoria"><div class="branch-heading"><span class="eyebrow">${query ? "RESULTADOS" : trail.length ? "EXPLORAR" : "EXPLORE SUA ÓRBITA"}</span><h2>${esc(query ? "Buscar atalhos" : (trail.at(-1)?.title ?? category?.title ?? "Escolha uma categoria"))}</h2><p>${esc(query ? `${listing.length} atalhos encontrados` : (category?.subtitle ?? ""))}</p></div><svg class="connectors" viewBox="0 0 100 360" preserveAspectRatio="none" aria-hidden="true">${[45, 135, 225, 315].map((y) => `<path d="M0 180 C60 180 35 ${y} 100 ${y}"/>`).join("")}<circle cx="4" cy="180" r="4"/></svg><div class="branch-list">${listing.map(actionButton).join("")}${selected === "projects" && !query ? `<button class="bubble add-project" id="add-project" aria-label="Adicionar projeto"><span class="app-icon">${icon("plus")}</span><span class="bubble-copy"><strong>Adicionar projeto</strong><small>Suas pastas favoritas, aqui</small></span>${icon("arrow", "bubble-arrow")}</button>` : ""}${!listing.length && query ? '<p class="empty">Nenhum atalho encontrado.</p>' : ""}</div><button class="text-button" id="customize">${icon("plus")} Personalizar atalhos</button></section></div>
 <footer><div class="activation-hint">${icon("cursor")}<span>${state.settings.trigger === "middle" ? "Clique central" : state.settings.trigger === "alt-middle" ? "Alt + clique central" : "Ctrl + Alt + Espaço"}<small>${native ? "para chamar o Orbit" : "na versão desktop"}</small></span></div><div class="footer-center">${favorites.length ? `<span>NA SUA ÓRBITA</span>${favorites.map((i) => `<button class="favorite" data-item="${esc(i.id)}" title="${state.usage[i.id]?.count} utilizações">${icon(i.icon)}${esc(i.title)}</button>`).join("")}` : '<span>FEITO PARA O SEU FLUXO</span><span class="local-indicator">' + icon("shield") + "Privado. Local. Seu.</span>"}</div><span class="escape-hint"><kbd>esc</kbd> para fechar</span></footer></main>`
     : `<div class="resting"><div class="resting-logo">${icon("orbit")}</div><span class="eyebrow">SEU PRÓXIMO PASSO COMEÇA AQUI</span><h1>Seu universo.<br/><em>A um clique.</em></h1><button class="primary" id="reopen">Abrir Orbit ${icon("arrow")}</button><p><kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Espaço</kbd></p></div>`
 }
 ${panel ? settingsView(state, selected) : ""}</div>`;
  bind();
}

function bind() {
  app
    .querySelector<HTMLAnchorElement>(".brand")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      show();
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
        await saveSettings({ trigger });
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
  if (e.ctrlKey && e.altKey && e.code === "Space") {
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
