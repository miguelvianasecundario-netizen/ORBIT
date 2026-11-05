import type { AppearanceSettings } from "./types";
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  menuTransparency: 0,
  selectionTransparency: 0,
  panelTransparency: 4,
  appTransparency: 0,
  iconsOnly: false,
};
export const transparencyControls = [
  { key: "menuTransparency", label: "Menu circular" },
  { key: "selectionTransparency", label: "Setor selecionado" },
  { key: "panelTransparency", label: "Painel lateral" },
  { key: "appTransparency", label: "Botões dos apps" },
] as const;
export type TransparencyKey = (typeof transparencyControls)[number]["key"];

/** Old installations and preview storage receive the same defaults as Rust. */
export function normalizeAppearance(
  value: Partial<AppearanceSettings>,
): AppearanceSettings {
  const appearance = { ...DEFAULT_APPEARANCE };
  for (const { key } of transparencyControls) {
    const candidate = value[key];
    if (
      typeof candidate === "number" &&
      Number.isInteger(candidate) &&
      candidate >= 0 &&
      candidate <= 100
    )
      appearance[key] = candidate;
  }
  if (typeof value.iconsOnly === "boolean")
    appearance.iconsOnly = value.iconsOnly;
  return appearance;
}

export function applyAppearance(settings: AppearanceSettings) {
  const root = document.documentElement;
  const colors = getComputedStyle(root);
  const fill = (token: string, transparency: number) => {
    const hex = colors.getPropertyValue(token).trim().slice(1, 7);
    const rgb = [0, 2, 4].map((index) =>
      parseInt(hex.slice(index, index + 2), 16),
    );
    return `rgba(${rgb.join(",")},${(100 - transparency) / 100})`;
  };
  for (const [target, source, transparency] of [
    ["--menu-fill", "--surface-solid", settings.menuTransparency],
    ["--selection-fill", "--selected", settings.selectionTransparency],
    ["--panel-fill", "--surface-solid", settings.panelTransparency],
    ["--app-fill", "--item", settings.appTransparency],
    ["--app-hover-fill", "--hover", settings.appTransparency],
  ] as const)
    root.style.setProperty(target, fill(source, transparency));
  root.classList.toggle("icons-only", settings.iconsOnly);
}
