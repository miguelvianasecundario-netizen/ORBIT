import { categories, modeNames } from "./data";
import { icon } from "./icons";
import { esc } from "./utils";
import type { CategoryId, OrbitState } from "./types";

function point(r: number, angle: number) {
  const a = (angle * Math.PI) / 180;
  return [250 + r * Math.cos(a), 250 + r * Math.sin(a)];
}
function wedge(start: number, end: number) {
  const a = point(235, start),
    b = point(235, end),
    c = point(92, end),
    d = point(92, start);
  return `M${a} A235 235 0 0 1 ${b} L${c} A92 92 0 0 0 ${d} Z`;
}
export function wheelOptions(state: OrbitState) {
  const mode = state.settings.mode;
  const options = [
    ...categories
      .filter((c) => c.mode === mode)
      .map((c) => ({
        id: c.id,
        title: c.title,
        icon: c.icon,
        kind: "category",
      })),
    ...state.shortcuts
      .filter((c) => c.category === `orbit-${mode}`)
      .map((c) => ({
        id: c.id,
        title: c.title,
        icon: /livr|bibliot/i.test(c.title) ? "book" : c.icon,
        kind: "item",
      })),
  ];
  if (mode === "rest" && options.length === 2)
    options.push({
      id: "books",
      title: "Livros",
      icon: "book",
      kind: "suggestion",
    });
  if (options.length % 4)
    options.push({ id: "add", title: "Adicionar", icon: "plus", kind: "add" });
  return options;
}
export function radial(
  selected: CategoryId | null,
  state: OrbitState,
  page: number,
) {
  const options = wheelOptions(state).slice(page * 4, page * 4 + 4);
  const angles = [
    [-178, -92],
    [-88, -2],
    [92, 178],
    [2, 88],
  ];
  const next = state.settings.mode === "main" ? "Descanso" : "Principal";
  return `<div class="orbit-navigation">
    <button class="mode-arrow previous" data-mode-switch="previous" aria-label="Bola anterior: ${next}" title="Trocar para ${next}">${icon("chevronLeft")}</button>
    <div class="wheel"><div class="wheel-halo"></div><svg class="wheel-glass" viewBox="0 0 500 500" aria-hidden="true">${options.map((c, i) => `<path class="segment ${selected === c.id ? "selected" : ""} ${c.kind === "add" ? "add-segment" : ""}" d="${wedge(angles[i][0], angles[i][1])}"/>`).join("")}<circle class="outer-line" cx="250" cy="250" r="244"/></svg>
    ${options.map((c, i) => `<button title="${esc(c.title)}" class="category slot-${i} ${selected === c.id ? "active" : ""}" data-${c.kind}="${esc(c.id)}" aria-label="${esc(c.title)}" ${c.kind === "category" ? `aria-pressed="${selected === c.id}"` : ""}>${icon(c.icon)}<span>${esc(c.title)}</span></button>`).join("")}
    <button class="core" id="back" aria-label="${selected ? "Voltar às categorias" : "Centro do Orbit"}" title="${selected ? "Recolher categoria" : "Escolha uma categoria"}">${icon(selected ? "back" : state.settings.mode === "rest" ? "moon" : "orbit")}<span>${modeNames[state.settings.mode]}</span></button></div>
    <button class="mode-arrow next" data-mode-switch="next" aria-label="Próxima bola: ${next}" title="Trocar para ${next}">${icon("chevron")}</button>
  </div>`;
}
