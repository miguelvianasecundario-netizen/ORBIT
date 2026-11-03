import { categories } from "./data";
import { icon } from "./icons";
import type { CategoryId } from "./types";
function point(r: number, angle: number) {
  const a = (angle * Math.PI) / 180;
  return [250 + r * Math.cos(a), 250 + r * Math.sin(a)];
}
function wedge(start: number, end: number) {
  const a = point(235, start),
    b = point(235, end),
    c = point(142, end),
    d = point(142, start);
  return `M${a} A235 235 0 0 1 ${b} L${c} A142 142 0 0 0 ${d} Z`;
}
export function radial(selected: CategoryId | null) {
  const angles = [
    [-178, -92],
    [-88, -2],
    [92, 178],
    [2, 88],
  ];
  return `<div class="wheel"><div class="wheel-halo"></div><svg class="wheel-glass" viewBox="0 0 500 500" aria-hidden="true"><defs><linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffffff" stop-opacity=".62"/><stop offset=".5" stop-color="#d7f7ed" stop-opacity=".12"/><stop offset="1" stop-color="#ffffff" stop-opacity=".35"/></linearGradient><linearGradient id="selected" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#8fe6d3" stop-opacity=".34"/><stop offset="1" stop-color="#d9faff" stop-opacity=".60"/></linearGradient></defs>${categories.map((c, i) => `<path class="segment ${selected === c.id ? "selected" : ""}" d="${wedge(...(angles[i] as [number, number]))}"/>`).join("")}<circle class="outer-line" cx="250" cy="250" r="244"/></svg>${categories.map((c) => `<button class="category ${c.id} ${selected === c.id ? "active" : ""}" data-category="${c.id}" aria-label="${c.title}" aria-pressed="${selected === c.id}">${icon(c.icon)}<span>${c.title}</span><small>${c.id === "browser" ? "Explore" : c.id === "apps" ? "Crie" : c.id === "projects" ? "Continue" : "Simplifique"}</small></button>`).join("")}<button class="core" id="back" aria-label="${selected ? "Voltar às categorias" : "Centro do Orbit"}" title="${selected ? "Recolher categoria" : "Escolha uma categoria"}">${icon(selected ? "back" : "cursor")}</button><span class="orbit-point"></span></div>`;
}
