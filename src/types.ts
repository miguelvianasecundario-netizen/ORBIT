export type Mode = "main" | "rest";
export type Theme = "ocean" | "amethyst" | "graphite" | "paper";
export type CategoryId =
  | "browser"
  | "apps"
  | "projects"
  | "actions"
  | "games"
  | "streaming"
  | "orbit-main"
  | "orbit-rest";
export interface Action {
  type: "url" | "folder" | "executable";
  value: string;
}
export interface MenuItem {
  id: string;
  title: string;
  icon: string;
  category: CategoryId;
  description?: string;
  action?: Action;
  children?: MenuItem[];
}
export interface Settings {
  hotkey: string;
  trigger: "middle" | "alt-middle" | "keyboard";
  theme: Theme;
  mode: Mode;
}
export interface Usage {
  count: number;
  lastUsed: number;
}
export interface OrbitState {
  usage: Record<string, Usage>;
  settings: Settings;
  shortcuts: MenuItem[];
}
