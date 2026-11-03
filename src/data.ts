import type { CategoryId, MenuItem } from "./types";
export const categories: {
  id: CategoryId;
  title: string;
  icon: string;
  subtitle: string;
}[] = [
  {
    id: "apps",
    title: "Aplicativos",
    icon: "grid",
    subtitle: "Suas ferramentas, por perto",
  },
  {
    id: "browser",
    title: "Navegador",
    icon: "globe",
    subtitle: "Um atalho para o seu mundo",
  },
  {
    id: "projects",
    title: "Projetos",
    icon: "folder",
    subtitle: "Retome de onde parou",
  },
  {
    id: "actions",
    title: "Ações",
    icon: "bolt",
    subtitle: "Menos passos. Mais fluidez.",
  },
];
export const items: MenuItem[] = [
  {
    id: "browser-youtube",
    title: "YouTube",
    icon: "youtube",
    category: "browser",
    description: "Vídeos e inspirações",
    action: { type: "url", value: "https://www.youtube.com/" },
  },
  {
    id: "browser-chatgpt",
    title: "ChatGPT",
    icon: "chatgpt",
    category: "browser",
    description: "Espaço para suas ideias",
    action: { type: "url", value: "https://chatgpt.com/" },
  },
  {
    id: "browser-github",
    title: "GitHub",
    icon: "github",
    category: "browser",
    description: "Seu próximo commit",
    action: { type: "url", value: "https://github.com/" },
  },
  {
    id: "browser-google",
    title: "Google",
    icon: "google",
    category: "browser",
    description: "Encontre novas possibilidades",
    action: { type: "url", value: "https://www.google.com/" },
  },
  {
    id: "apps-explorer",
    title: "Explorador de Arquivos",
    icon: "folder",
    category: "apps",
    description: "Arquivos e pastas",
  },
  {
    id: "apps-notepad",
    title: "Bloco de Notas",
    icon: "note",
    category: "apps",
    description: "Capture uma ideia",
  },
  {
    id: "apps-vscode",
    title: "VS Code",
    icon: "code",
    category: "apps",
    description: "Abra seu editor",
  },
  {
    id: "actions-downloads",
    title: "Downloads",
    icon: "download",
    category: "actions",
    description: "Seus arquivos recentes",
  },
  {
    id: "actions-settings",
    title: "Configurações do Windows",
    icon: "settings",
    category: "actions",
    description: "Personalize seu computador",
  },
  {
    id: "actions-taskmanager",
    title: "Gerenciador de Tarefas",
    icon: "activity",
    category: "actions",
    description: "Veja o que está em execução",
  },
];
