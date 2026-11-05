import type { OrbitState, WorkReport, BrowserStatus } from "./types";
import { icon } from "./icons";
import { esc } from "./utils";
export function workItems(state: OrbitState) {
  return state.shortcuts.filter((item) =>
    ["work-apps", "work-browser", "work-projects", "orbit-work"].includes(
      item.category,
    ),
  );
}
export function workView(
  state: OrbitState,
  report: WorkReport | null,
  busy: boolean,
  browser: BrowserStatus | null,
) {
  const count = workItems(state).length;
  return `<div class="work-overview">
    <p class="help">Abra seus ${count} atalhos juntos. Apps minimizados e sites em segundo plano.</p>
    <button class="primary" id="run-work" ${busy || !count ? "disabled" : ""}>${icon("layers")}${busy ? "Abrindo Work…" : "Abrir tudo"}</button>
    ${!count ? '<p class="empty-list">Adicione seus aplicativos, sites e pastas pelo +. Os atalhos dos outros modos ficam separados.</p><button class="secondary" id="add-work-shortcut">Adicionar ao Work</button>' : ""}
    <p class="help connection-state ${browser?.connected ? "connected" : ""}" id="work-browser-connection">${browser?.connected ? "Brave conectado · abas existentes serão preservadas." : "Conecte a extensão do Brave nas configurações para abrir sites sem duplicar abas."}</p>
    ${report ? `<section class="work-report" aria-label="Resultado do Work"><p role="status">${report.results.filter((r) => r.status === "opened").length} abertos · ${report.results.filter((r) => r.status === "alreadyOpen").length} já abertos · ${report.results.filter((r) => r.status === "error").length} falhas</p><ul>${report.results.map((r) => `<li class="result-${r.status}"><strong>${esc(r.title)}</strong><span>${r.status === "opened" ? "Aberto" : r.status === "alreadyOpen" ? "Já estava aberto" : "Não abriu"}</span>${r.detail ? `<small>${esc(r.detail)}</small>` : ""}</li>`).join("")}</ul></section>` : ""}
  </div>`;
}
