import test from "node:test";
import assert from "node:assert/strict";
import { openMissing, canonicalUrl } from "../tabs.js";
function browser(tabs = [], windows = [{ id: 1, incognito: false }]) {
  const calls = [];
  return {
    calls,
    tabs: {
      query: async () => tabs,
      create: async (options) => {
        calls.push(["tab", options]);
        tabs.push({ url: options.url });
        return { id: tabs.length };
      },
    },
    windows: {
      getAll: async () => windows,
      create: async (options) => {
        calls.push(["window", options]);
        const window = { id: 2 };
        windows.push(window);
        tabs.push({ url: options.url });
        return window;
      },
    },
  };
}
test("URLs existentes e navegações pendentes são ignoradas sem ativar abas", async () => {
  const api = browser([
    { url: "https://example.com/a" },
    { pendingUrl: "https://example.com/b" },
  ]);
  const results = await openMissing(api, [
    { id: "a", url: "https://example.com/a" },
    { id: "b", url: "https://example.com/b" },
    { id: "c", url: "https://example.com/c" },
    { id: "again", url: "https://example.com/c" },
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    ["alreadyOpen", "alreadyOpen", "opened", "alreadyOpen"],
  );
  assert.deepEqual(api.calls, [
    ["tab", { windowId: 1, url: "https://example.com/c", active: false }],
  ]);
});
test("sem janela normal, cria uma minimizada sem foco e reutiliza para as demais abas", async () => {
  const api = browser([], []);
  await openMissing(api, [
    { id: "a", url: "https://example.com/a" },
    { id: "b", url: "https://example.com/b" },
  ]);
  assert.deepEqual(api.calls, [
    [
      "window",
      {
        url: "https://example.com/a",
        focused: false,
        state: "minimized",
        type: "normal",
      },
    ],
    ["tab", { windowId: 2, url: "https://example.com/b", active: false }],
  ]);
});
test("não usa uma janela privada como destino e não confunde rotas ou parâmetros", async () => {
  const api = browser(
    [{ url: "https://example.com/?q=1" }],
    [{ id: 1, incognito: true }],
  );
  const result = await openMissing(api, [
    { id: "x", url: "https://example.com/?q=2" },
  ]);
  assert.equal(result[0].status, "opened");
  assert.equal(api.calls[0][0], "window");
  assert.equal(canonicalUrl("HTTPS://EXAMPLE.COM:443"), "https://example.com/");
  assert.notEqual(
    canonicalUrl("https://example.com/#/one"),
    canonicalUrl("https://example.com/#/two"),
  );
});
test("uma falha não interrompe o restante e destinos executáveis são recusados", async () => {
  const api = browser();
  const create = api.tabs.create;
  api.tabs.create = async (options) => {
    if (options.url.endsWith("/fail")) throw Error("recusado");
    return create(options);
  };
  const result = await openMissing(api, [
    { id: "invalid", url: "javascript:alert(1)" },
    { id: "fail", url: "https://example.com/fail" },
    { id: "ok", url: "https://example.com/ok" },
  ]);
  assert.deepEqual(
    result.map((r) => r.status),
    ["error", "error", "opened"],
  );
  assert.equal(canonicalUrl("https://user:secret@example.com"), null);
});

test("worker serializa pedidos simultâneos e responde ao heartbeat", async () => {
  const api = browser();
  const replies = [];
  let listener;
  const done = new Promise((resolve) => {
    const port = {
      onMessage: {
        addListener: (fn) => {
          listener = fn;
        },
      },
      onDisconnect: { addListener: () => {} },
      postMessage: (message) => {
        replies.push(message);
        if (replies.filter((r) => r.type === "results").length === 2) resolve();
      },
    };
    api.runtime = {
      connectNative: () => port,
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      onMessage: { addListener: () => {} },
    };
    api.alarms = { onAlarm: { addListener: () => {} }, create: () => {} };
  });
  globalThis.chrome = api;
  try {
    await import("../background.js");
    listener({ type: "ready" });
    listener({ type: "ping" });
    const entries = [{ id: "one", url: "https://example.com/shared" }];
    listener({ type: "openUrls", requestId: 1, entries });
    listener({ type: "openUrls", requestId: 2, entries });
    await done;
    assert.equal(replies[0].type, "pong");
    assert.deepEqual(
      replies
        .filter((r) => r.type === "results")
        .map((r) => r.results[0].status),
      ["opened", "alreadyOpen"],
    );
    assert.equal(api.calls.length, 1);
  } finally {
    delete globalThis.chrome;
  }
});
