export type Mode = "main" | "rest" | "work";
export type Theme = "ocean" | "amethyst" | "graphite" | "paper";
export type CategoryId =
  | "browser"
  | "apps"
  | "projects"
  | "actions"
  | "games"
  | "streaming"
  | "orbit-main"
  | "orbit-rest"
  | "work-apps"
  | "work-browser"
  | "work-projects"
  | "orbit-work";
export type ViewId = CategoryId | "work-all";
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

export interface WorkResult {
  id: string;
  title: string;
  status: "opened" | "alreadyOpen" | "error";
  detail?: string;
}
export interface WorkReport {
  results: WorkResult[];
}
export interface BrowserStatus {
  connected: boolean;
  prepared: boolean;
}
