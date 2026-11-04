import { hotkeyLabel } from "./hotkey";
import { native } from "./bridge";
import { icon } from "./icons";
import { categories, themes, modeNames } from "./data";
import { esc } from "./utils";
import type { OrbitState, CategoryId } from "./types";
export function settingsView(state: OrbitState, selected: CategoryId | null) {
  const mode = state.settings.mode;
  return `<div class="panel-backdrop"><aside class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="panel-header"><h2 id="settings-title">Configurações</h2><button class="icon-button" id="close-settings" aria-label="Fechar configurações">${icon("close")}</button></div>
  <p class="panel-note">${native ? "Seu ORBIT, do seu jeito. Alterações salvas neste computador." : "Prévia no navegador. Pastas, jogos e aplicativos precisam da versão Windows."}</p>
  <section class="settings-section"><h3>${icon("palette")} Aparência</h3><div class="theme-picker" role="group" aria-label="Temas">${themes.map((t) => `<button class="theme-choice" data-theme-choice="${t.id}" aria-label="Tema ${t.title}" aria-pressed="${state.settings.theme === t.id}"><span class="theme-swatch" aria-hidden="true" style="--swatch-base:${t.colors[0]};--swatch-accent:${t.colors[1]};--swatch-ink:${t.colors[2]}"><i></i><b></b></span><span>${t.title}</span></button>`).join("")}</div></section>
  <section class="settings-section"><h3>${icon("plus")} Adicionar atalho</h3><p class="help">Escolha uma categoria ou “Direto na bola”. Uma opção como Livros pode abrir sua pasta com um clique.</p>
  <form id="shortcut-form"><label for="shortcut-title">Nome</label><input id="shortcut-title" name="title" placeholder="Ex.: Livros ou meu jogo" maxlength="60" required/>
  <label for="shortcut-mode">Bola</label><select id="shortcut-mode" name="mode"><option value="main" ${mode === "main" ? "selected" : ""}>Principal</option><option value="rest" ${mode === "rest" ? "selected" : ""}>Descanso</option></select>
  <div class="form-row"><div><label for="shortcut-category">Categoria</label><select id="shortcut-category" name="category">${categoryOptions(mode, selected)}</select></div><div><label for="shortcut-kind">Tipo</label><select id="shortcut-kind" name="kind"><option value="url">Link</option><option value="folder">Pasta</option><option value="executable">Executável (.exe)</option></select></div></div>
  <div id="url-field"><label for="shortcut-url">URL</label><input id="shortcut-url" name="url" type="url" placeholder="https://" required/></div><button class="secondary" type="button" id="pick-folder" hidden>Selecionar pasta</button><input type="hidden" id="folder-path"/>
  <button class="primary" type="submit">${icon("plus")} Adicionar atalho</button></form>
  <div class="saved-shortcuts">${state.shortcuts.length ? state.shortcuts.map((i) => `<div class="saved-item"><span>${icon(i.icon)}<span>${esc(i.title)}<small>${i.category.startsWith("orbit-") ? "Na bola " + modeNames[i.category === "orbit-main" ? "main" : "rest"] : (categories.find((c) => c.id === i.category)?.title ?? "")}</small></span></span><button class="icon-button" data-remove="${esc(i.id)}" aria-label="Remover ${esc(i.title)}">${icon("trash")}</button></div>`).join("") : '<p class="help">Seus atalhos personalizados aparecerão aqui.</p>'}</div></section>
  <section class="settings-section"><h3>${icon("cursor")} Ativação</h3><label for="trigger">Abrir o launcher com</label><select id="trigger"><option value="alt-middle" ${state.settings.trigger === "alt-middle" ? "selected" : ""}>Alt + clique central (recomendado)</option><option value="middle" ${state.settings.trigger === "middle" ? "selected" : ""}>Clique central</option><option value="keyboard" ${state.settings.trigger === "keyboard" ? "selected" : ""}>Somente teclado</option></select><label for="hotkey">Atalho de teclado</label><div class="hotkey-row"><input id="hotkey" readonly value="${esc(hotkeyLabel(state.settings.hotkey))}" aria-describedby="hotkey-help"/><button class="secondary" id="save-hotkey" disabled aria-label="Salvar atalho de teclado">Salvar</button></div><p class="help" id="hotkey-help">Clique no campo e pressione a combinação. Ex.: F8 ou Ctrl + Alt + O. Esc cancela.</p></section>
  <section class="settings-section"><h3>${icon("activity")} Aprendizado local</h3><p class="help">${Object.values(state.usage).reduce((n, u) => n + u.count, 0)} usos registrados. Os mais usados sobem dentro de cada categoria.</p><button class="secondary" id="clear-history">${icon("trash")} Limpar histórico</button></section>${native ? '<button class="secondary quit-orbit" id="quit-orbit">Encerrar ORBIT</button>' : ""}</aside></div>`;
}
export function categoryOptions(mode: string, selected: CategoryId | null) {
  return `<option value="orbit-${mode}" ${selected === `orbit-${mode}` ? "selected" : ""}>Direto na bola</option>${categories
    .filter((c) => c.mode === mode)
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${c.title}</option>`,
    )
    .join("")}`;
}
