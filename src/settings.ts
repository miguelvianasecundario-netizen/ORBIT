import { hotkeyLabel } from "./hotkey";
import { native } from "./bridge";
import { icon } from "./icons";
import { categories, themes, modeNames, modes } from "./data";
import { esc } from "./utils";
import { itemIcon } from "./item-icons";
import { transparencyControls } from "./appearance";
import type { OrbitState, CategoryId } from "./types";
export function settingsView(state: OrbitState, selected: CategoryId | null) {
  const mode = state.settings.mode;
  return `<div class="panel-backdrop"><aside class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="panel-header"><h2 id="settings-title">Configurações</h2><button class="icon-button" id="close-settings" aria-label="Fechar configurações">${icon("close")}</button></div>
  <p class="panel-note">${native ? "Seu ORBIT, do seu jeito. Alterações salvas neste computador." : "Prévia no navegador. Pastas, jogos e aplicativos precisam da versão Windows."}</p>
  <section class="settings-section"><h3>${icon("palette")} Aparência</h3><div class="theme-picker" role="group" aria-label="Temas">${themes.map((t) => `<button class="theme-choice" data-theme-choice="${t.id}" aria-label="Tema ${t.title}" aria-pressed="${state.settings.theme === t.id}"><span class="theme-swatch" aria-hidden="true" style="--swatch-base:${t.colors[0]};--swatch-accent:${t.colors[1]};--swatch-ink:${t.colors[2]}"><i></i><b></b></span><span>${t.title}</span></button>`).join("")}</div></section>
  <section class="settings-section appearance-controls"><h3>${icon("palette")} Transparência e tamanho</h3><p class="help">Ajuste cada fundo. 0% é sólido; 100% deixa só ícones, textos e contornos. As mudanças aparecem na hora.</p>
  ${transparencyControls.map(({ key, label }) => `<div class="transparency-control"><label for="${key}">${label}</label><span id="${key}-value" aria-hidden="true">${state.settings[key]}%</span><input id="${key}" data-transparency="${key}" type="range" min="0" max="100" step="1" value="${state.settings[key]}" aria-label="Transparência: ${label.toLocaleLowerCase()}" /></div>`).join("")}
  <label class="appearance-toggle" for="icons-only"><input id="icons-only" type="checkbox" ${state.settings.iconsOnly ? "checked" : ""}/><span>Modo minimizado — só ícones</span></label><p class="help">Passe o mouse para ver os nomes. Use o botão abaixo do círculo para alternar rapidamente.</p><button class="secondary" id="reset-appearance">Restaurar transparência e tamanho</button></section>
  <section class="settings-section"><h3>${icon("plus")} Adicionar atalho</h3><p class="help">Escolha uma categoria ou “Direto na bola”. Uma opção como Livros pode abrir sua pasta com um clique.</p>
  <form id="shortcut-form"><label for="shortcut-title">Nome</label><input id="shortcut-title" name="title" placeholder="Ex.: Livros ou meu jogo" maxlength="160" aria-describedby="shortcut-title-help" required/>
  <p class="help" id="shortcut-title-help">Até 80 caracteres. Nomes longos aparecem resumidos na bola; passe o mouse para ler por inteiro.</p>
  <label for="shortcut-mode">Bola</label><select id="shortcut-mode" name="mode">${modes.map((m) => `<option value="${m}" ${mode === m ? "selected" : ""}>${modeNames[m]}</option>`).join("")}</select>
  <div class="form-row"><div><label for="shortcut-category">Categoria</label><select id="shortcut-category" name="category">${categoryOptions(mode, selected)}</select></div><div><label for="shortcut-kind">Tipo</label><select id="shortcut-kind" name="kind"><option value="url">Link</option><option value="folder">Pasta</option><option value="executable">Executável (.exe)</option></select></div></div>
  <div id="url-field"><label for="shortcut-url">URL</label><input id="shortcut-url" name="url" type="url" placeholder="https://" required/></div><button class="secondary" type="button" id="pick-folder" hidden>Selecionar pasta</button><input type="hidden" id="folder-path"/>
  <button class="primary" type="submit">${icon("plus")} Adicionar atalho</button></form>
  <div class="saved-shortcuts">${state.shortcuts.length ? state.shortcuts.map((i) => `<div class="saved-item"><span>${itemIcon(i)}<span>${esc(i.title)}<small>${i.category.startsWith("orbit-") ? "Na bola " + modeNames[i.category.replace("orbit-", "") as keyof typeof modeNames] : (categories.find((c) => c.id === i.category)?.title ?? "")}</small></span></span><button class="icon-button" data-remove="${esc(i.id)}" aria-label="Remover ${esc(i.title)}">${icon("trash")}</button></div>`).join("") : '<p class="help">Seus atalhos personalizados aparecerão aqui.</p>'}</div></section>
  <section class="settings-section"><h3>${icon("globe")} Brave no Work</h3><p class="help">A extensão local reconhece a mesma URL já aberta no perfil conectado e abre novas abas em segundo plano.</p><p class="help" id="browser-connection" aria-live="polite">Verificando conexão…</p><button class="secondary" id="prepare-browser">Preparar extensão do Brave</button><p class="help" id="browser-setup-result" hidden></p></section>
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
