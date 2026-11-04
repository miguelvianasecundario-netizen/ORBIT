import type { CategoryId, MenuItem, Mode, Theme } from "./types";
export const modeNames: Record<Mode, string> = {
  main: "Principal",
  rest: "Descanso",
};
export const themes: { id: Theme; title: string; colors: string[] }[] = [
  { id: "ocean", title: "Oceano", colors: ["#152c36", "#9bf3d0", "#f3fbff"] },
  {
    id: "amethyst",
    title: "Ametista",
    colors: ["#29243b", "#d6b8ff", "#faf5ff"],
  },
  {
    id: "graphite",
    title: "Grafite",
    colors: ["#242629", "#f5d38a", "#ffffff"],
  },
  { id: "paper", title: "Papel", colors: ["#f8fafc", "#1766a3", "#172d40"] },
];
export const categories: {
  id: CategoryId;
  title: string;
  icon: string;
  subtitle: string;
  mode: Mode;
}[] = [
  {
    id: "apps",
    mode: "main",
    title: "Aplicativos",
    icon: "grid",
    subtitle: "Suas ferramentas, por perto",
  },
  {
    id: "browser",
    mode: "main",
    title: "Navegador",
    icon: "globe",
    subtitle: "Um atalho para o seu mundo",
  },
  {
    id: "projects",
    mode: "main",
    title: "Projetos",
    icon: "folder",
    subtitle: "Retome de onde parou",
  },
  {
    id: "actions",
    mode: "main",
    title: "Ações",
    icon: "bolt",
    subtitle: "Menos passos. Mais fluidez.",
  },
  {
    id: "games",
    mode: "rest",
    title: "Jogos",
    icon: "gamepad",
    subtitle: "Seus jogos, a um clique",
  },
  {
    id: "streaming",
    mode: "rest",
    title: "Streaming",
    icon: "play",
    subtitle: "Escolha o que assistir",
  },
];
export const items: MenuItem[] = [
  ...[
    ["prime", "Prime Video", "https://www.primevideo.com/"],
    ["disney", "Disney+", "https://www.disneyplus.com/pt-br"],
    ["netflix", "Netflix", "https://www.netflix.com/br/"],
    ["hbo", "HBO Max", "https://www.hbomax.com/br/pt"],
    ["apple", "Apple TV", "https://tv.apple.com/br"],
    ["globo", "Globoplay", "https://globoplay.globo.com/"],
  ].map(([id, title, value]): MenuItem => ({
    id: `streaming-${id}`,
    title,
    icon: "play",
    category: "streaming",
    action: { type: "url", value },
  })),
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
    id: "browser-brave",
    title: "Nova guia do Brave",
    icon: "globe",
    category: "browser",
    description: "Página inicial de uma nova guia",
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
