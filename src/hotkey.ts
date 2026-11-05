export const DEFAULT_HOTKEY = "Ctrl+Alt+Space";
export function hotkeyLabel(shortcut: string): string {
  return shortcut.replace("Space", "Espaço").replaceAll("+", " + ");
}
// Only capture while the user is explicitly editing the shortcut field.
export function hotkeyFromEvent(event: KeyboardEvent): string | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return null;
  if (event.metaKey)
    throw new Error("Use Ctrl, Alt ou Shift, sem a tecla Windows.");
  let key =
    event.key.length === 1 && /[a-z0-9]/i.test(event.key)
      ? event.key.toUpperCase()
      : event.code === "Space"
        ? "Space"
        : /^F([1-9]|1[0-9]|2[0-4])$/.test(event.key)
          ? event.key
          : "";
  if (!key || key === "F12")
    throw new Error("Use letras, números, Espaço ou F1–F24 (exceto F12).");
  if (!/^F\d+$/.test(key) && !event.ctrlKey && !event.altKey)
    throw new Error("Combine letras, números ou Espaço com Ctrl ou Alt.");
  return [
    event.ctrlKey ? "Ctrl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    key,
  ]
    .filter(Boolean)
    .join("+");
}
export function matchesHotkey(event: KeyboardEvent, shortcut: string): boolean {
  try {
    return hotkeyFromEvent(event) === shortcut;
  } catch {
    return false;
  }
}
