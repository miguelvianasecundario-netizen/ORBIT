import { openMissing } from "./tabs.js";
const HOST = "app.orbit.launcher.browser";
let port = null;
let connected = false;
let blocked = false;
let detail = "Abra o Orbit e prepare a extensão nas configurações.";
let queue = Promise.resolve();
function connect() {
  if (port || blocked) return;
  try {
    const current = chrome.runtime.connectNative(HOST);
    port = current;
    current.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      if (port === current) {
        port = null;
        connected = false;
      }
      if (error)
        detail =
          "Orbit desconectado. Abra o aplicativo e clique em Reconectar.";
      if (!blocked) setTimeout(connect, 1000);
    });
    current.onMessage.addListener((message) => {
      if (message.type === "ready") {
        connected = true;
        detail = "Este perfil do Brave está conectado ao Orbit.";
        return;
      }
      if (message.type === "connectionError") {
        connected = false;
        blocked = true;
        detail = message.message;
        return;
      }
      if (message.type === "ping") {
        current.postMessage({ type: "pong" });
        return;
      }
      if (message.type === "openUrls") {
        queue = queue
          .then(async () => {
            let results;
            try {
              results = await openMissing(chrome, message.entries);
            } catch (error) {
              results = (message.entries || []).map((entry) => ({
                id: entry.id,
                status: "error",
                detail: String(error?.message || error),
              }));
            }
            if (port === current)
              current.postMessage({
                type: "results",
                requestId: message.requestId,
                results,
              });
          })
          .catch(() => {});
      }
    });
  } catch {
    port = null;
    connected = false;
    detail =
      "Não foi possível conectar. Prepare a extensão nas configurações do Orbit.";
  }
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("orbit-reconnect", { periodInMinutes: 0.5 });
  connect();
});
chrome.runtime.onStartup.addListener(connect);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "orbit-reconnect") connect();
});
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message.type === "reconnect") {
    port?.disconnect();
    port = null;
    connected = false;
    blocked = false;
    connect();
  }
  reply({ connected, detail });
});
connect();
