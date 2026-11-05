import { invoke } from "@tauri-apps/api/core";
import { native } from "./bridge";
import { icon } from "./icons";
import { esc } from "./utils";
import type { MenuItem } from "./types";
const cache = new Map<string, Promise<string | null>>();
let active = 0;
const waiting: (() => void)[] = [];
async function resolve(item: MenuItem): Promise<string | null> {
  if (!native) {
    if (item.action?.type !== "url") return null;
    try {
      const url = new URL(item.action.value);
      if (url.protocol !== "https:" || url.username || url.password)
        return null;
      return new URL("/favicon.ico", url.origin).href;
    } catch {
      return null;
    }
  }
  if (active >= 4) await new Promise<void>((done) => waiting.push(done));
  active++;
  try {
    const value = await invoke<string | null>("get_item_icon", { id: item.id });
    return value &&
      value.length < 256 * 1024 &&
      /^data:image\/(png|jpeg|gif|webp|svg\+xml|x-icon);base64,[a-zA-Z0-9+/=]+$/.test(
        value,
      )
      ? value
      : null;
  } catch {
    return null;
  } finally {
    active--;
    waiting.shift()?.();
  }
}
export function itemIcon(item: MenuItem) {
  return `<span class="automatic-icon" data-icon-id="${esc(item.id)}" aria-hidden="true">${icon(item.icon)}<img alt="" hidden decoding="async" referrerpolicy="no-referrer" /></span>`;
}
export function hydrateIcons(root: HTMLElement, items: MenuItem[]) {
  for (const el of root.querySelectorAll<HTMLElement>("[data-icon-id]")) {
    const item = items.find((item) => item.id === el.dataset.iconId);
    if (!item) continue;
    const key = `${item.id}:${item.action?.value ?? ""}`;
    if (!cache.has(key)) cache.set(key, resolve(item));
    void cache.get(key)!.then((src) => {
      if (!src || !el.isConnected) return;
      const image = el.querySelector<HTMLImageElement>("img")!;
      image.onload = () => {
        if (el.isConnected) {
          image.hidden = false;
          el.classList.add("is-loaded");
        }
      };
      image.onerror = () => {
        image.hidden = true;
        el.classList.remove("is-loaded");
      };
      image.src = src;
      // Keep the fallback until the image is decoded. Do not lazy-load these
      // tiny icons: Chromium can defer transparent placeholders indefinitely.
      image.hidden = false;
    });
  }
}
