export function canonicalUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      value.length > 8192
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

// Uses live tabs, including pending navigations. It does not rely on launch history.
export async function openMissing(api, entries) {
  if (!Array.isArray(entries) || entries.length > 100)
    throw new Error("Lista de sites inválida.");
  const tabs = await api.tabs.query({});
  const seen = new Set(
    tabs
      .flatMap((tab) => [
        canonicalUrl(tab.url || ""),
        canonicalUrl(tab.pendingUrl || ""),
      ])
      .filter(Boolean),
  );
  let target = (await api.windows.getAll({ windowTypes: ["normal"] })).find(
    (window) => !window.incognito,
  );
  const results = [];
  for (const entry of entries) {
    const url = canonicalUrl(entry.url);
    if (!url || typeof entry.id !== "string") {
      results.push({
        id: entry.id,
        status: "error",
        detail: "URL HTTPS inválida.",
      });
      continue;
    }
    if (seen.has(url)) {
      results.push({ id: entry.id, status: "alreadyOpen" });
      continue;
    }
    try {
      if (!target) {
        target = await api.windows.create({
          url,
          focused: false,
          state: "minimized",
          type: "normal",
        });
      } else {
        await api.tabs.create({ windowId: target.id, url, active: false });
      }
      seen.add(url);
      results.push({ id: entry.id, status: "opened" });
    } catch (error) {
      results.push({
        id: entry.id,
        status: "error",
        detail: String(error?.message || error),
      });
    }
  }
  return results;
}
