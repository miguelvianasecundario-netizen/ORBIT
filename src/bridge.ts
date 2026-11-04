import { DEFAULT_HOTKEY } from "./hotkey";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { items, themes, categories } from "./data";
import type {
  Action,
  CategoryId,
  MenuItem,
  OrbitState,
  Settings,
} from "./types";
export const native = isTauri();
const key = "orbit.local.v1";
function empty(): OrbitState {
  return {
    usage: {},
    settings: {
      trigger: "alt-middle",
      hotkey: DEFAULT_HOTKEY,
      theme: "ocean",
      mode: "main",
    },
    shortcuts: [],
  };
}
export function validateUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname
  )
    throw new Error("Use uma URL https, sem credenciais.");
  return url.href;
}
function read(): OrbitState {
  const raw = localStorage.getItem(key);
  if (!raw) return empty();
  try {
    const value = JSON.parse(raw) as OrbitState;
    if (
      !value.settings ||
      !["middle", "alt-middle", "keyboard"].includes(value.settings.trigger) ||
      !Array.isArray(value.shortcuts) ||
      !value.usage
    )
      throw Error();
    value.settings.hotkey ??= DEFAULT_HOTKEY;
    if (!themes.some((t) => t.id === value.settings.theme))
      value.settings.theme = "ocean";
    if (!["main", "rest"].includes(value.settings.mode))
      value.settings.mode = "main";
    return value;
  } catch {
    throw new Error(
      "Os dados locais estão inválidos. Limpe os dados deste site para recomeçar.",
    );
  }
}
function write(state: OrbitState) {
  localStorage.setItem(key, JSON.stringify(state));
}
export const loadState = (): Promise<OrbitState> =>
  native ? invoke("get_state") : Promise.resolve().then(read);
export async function execute(item: MenuItem) {
  if (native) return invoke<void>("execute_action", { id: item.id });
  if (item.action?.type !== "url")
    throw new Error(
      "Esta ação precisa do Orbit desktop no Windows. No navegador, os links e a personalização estão disponíveis.",
    );
  const url = validateUrl(item.action.value);
  const popup = window.open(url, "_blank");
  if (!popup)
    throw new Error(
      "O navegador bloqueou a abertura. Permita pop-ups para abrir este atalho.",
    );
  popup.opener = null;
  const state = read();
  state.usage[item.id] = {
    count: (state.usage[item.id]?.count ?? 0) + 1,
    lastUsed: Date.now(),
  };
  write(state);
}
export async function hide() {
  if (native) await invoke("hide_launcher");
}
export async function saveSettings(settings: Settings) {
  if (native) return invoke<void>("save_settings", { settings });
  const state = read();
  state.settings = settings;
  write(state);
}
export async function addShortcut(
  title: string,
  category: CategoryId,
  action: Action,
): Promise<MenuItem> {
  title = title.trim();
  if (
    !title ||
    Array.from(title).length > 80 ||
    /[\u0000-\u001f\u007f-\u009f]/u.test(title)
  )
    throw new Error(
      "O nome deve ter entre 1 e 80 caracteres, sem caracteres de controle.",
    );
  if (action.type === "url") action.value = validateUrl(action.value);
  if (native) return invoke("add_shortcut", { title, category, action });
  if (action.type === "folder" || action.type === "executable")
    throw new Error(
      "Adicionar pastas ou executáveis requer o aplicativo desktop no Windows.",
    );
  const state = read();
  if (state.shortcuts.length >= 100)
    throw new Error("Limite de 100 atalhos atingido.");
  if (
    !categories.some((c) => c.id === category) &&
    !["orbit-main", "orbit-rest"].includes(category)
  )
    throw new Error("Categoria inválida.");
  const item: MenuItem = {
    id: crypto.randomUUID(),
    title,
    category,
    action,
    icon: action.type === "url" ? "globe" : "folder",
  };
  state.shortcuts.push(item);
  write(state);
  return item;
}
export async function removeShortcut(id: string) {
  if (native) return invoke<void>("remove_shortcut", { id });
  const state = read();
  state.shortcuts = state.shortcuts.filter((i) => i.id !== id);
  delete state.usage[id];
  write(state);
}
export async function clearHistory() {
  if (native) return invoke<void>("clear_history");
  const state = read();
  state.usage = {};
  write(state);
}
export async function chooseFolder(): Promise<string | null> {
  if (!native)
    throw new Error(
      "Selecionar pastas requer o aplicativo desktop no Windows.",
    );
  await invoke("set_dialog_active", { active: true });
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Escolha a pasta que o ORBIT deve abrir",
    });
    return typeof selected === "string" ? selected : null;
  } finally {
    await invoke("set_dialog_active", { active: false });
  }
}
export async function chooseExecutable(): Promise<string | null> {
  if (!native)
    throw new Error(
      "Selecionar executáveis .exe requer o aplicativo desktop no Windows.",
    );
  await invoke("set_dialog_active", { active: true });
  try {
    const selected = await open({
      directory: false,
      multiple: false,
      title: "Escolha um aplicativo Windows",
      filters: [{ name: "Aplicativo Windows", extensions: ["exe"] }],
    });
    return typeof selected === "string" ? selected : null;
  } finally {
    await invoke("set_dialog_active", { active: false });
  }
}
export function allItems(state: OrbitState) {
  return [...items, ...state.shortcuts];
}
