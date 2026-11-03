export type CategoryId = "browser" | "apps" | "projects" | "actions";
export interface Action {
  type: "url" | "folder";
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
  trigger: "middle" | "alt-middle" | "keyboard";
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
