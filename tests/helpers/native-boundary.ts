import type { Page } from "@playwright/test";

/** Only the IPC boundary is simulated. This does not validate Win32 or dialogs. */
export async function nativeBoundary(
  page: Page,
  iconValue: string | null = null,
) {
  await page.addInitScript((iconValue) => {
    const w = window as any;
    w.isTauri = true;
    w.orbitProbe = {
      state: {
        settings: {
          trigger: "alt-middle",
          hotkey: "Ctrl+Alt+Space",
          mode: "main",
          theme: "ocean",
        },
        usage: {},
        shortcuts: [],
      },
      calls: [],
      selection: "C:\\Jogos\\Meu jogo.exe",
      rejectHotkey: false,
      delay: 0,
    };
    w.__TAURI_INTERNALS__ = {
      transformCallback: () => 1,
      invoke: async (cmd: string, args: any = {}) => {
        const p = w.orbitProbe;
        p.calls.push({ cmd, args: structuredClone(args) });
        if (cmd === "get_item_icon") return iconValue;
        if (cmd === "browser_status")
          return { connected: true, prepared: true };
        if (cmd === "prepare_browser") return "C:\\Orbit\\browser-extension";
        if (cmd === "launch_work" || cmd === "launch_work_item") {
          if (p.delay)
            await new Promise((resolve) => setTimeout(resolve, p.delay));
          return {
            results: p.state.shortcuts
              .filter(
                (item: any) =>
                  [
                    "work-apps",
                    "work-browser",
                    "work-projects",
                    "orbit-work",
                  ].includes(item.category) &&
                  (!args.id || item.id === args.id),
              )
              .map((item: any) => ({
                id: item.id,
                title: item.title,
                status: item.title.includes("aberto")
                  ? "alreadyOpen"
                  : "opened",
              })),
          };
        }
        if (cmd === "get_state") return structuredClone(p.state);
        if (cmd === "save_settings") {
          if (p.delay)
            await new Promise((resolve) => setTimeout(resolve, p.delay));
          if (p.rejectHotkey && args.settings.hotkey === "F8")
            throw new Error("Atalho em uso.");
          p.state.settings = structuredClone(args.settings);
          return;
        }
        if (cmd === "add_shortcut") {
          if (p.delay)
            await new Promise((resolve) => setTimeout(resolve, p.delay));
          const item = {
            ...args,
            id: `custom-${p.state.shortcuts.length}`,
            icon: "folder",
          };
          p.state.shortcuts.push(item);
          return structuredClone(item);
        }
        if (cmd === "plugin:dialog|open") return p.selection;
        if (cmd === "plugin:event|listen") return 1;
        if (
          ["frontend_ready", "set_dialog_active", "hide_launcher"].includes(cmd)
        )
          return;
        throw new Error(`Unexpected IPC command: ${cmd}`);
      },
    };
  }, iconValue);
}
