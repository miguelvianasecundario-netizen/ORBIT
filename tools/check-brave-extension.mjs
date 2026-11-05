// Runs the shipped extension and Rust native host in an isolated Chromium profile.
// The Orbit-side loopback peer is simulated. This does not validate Windows registry/focus.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
const folder = await mkdtemp(join(tmpdir(), "orbit-extension-test-"));
const origin = "chrome-extension://gdlabbbhfoddkklcganebipckpnaflio/";
const host = "app.orbit.launcher.browser";
const token = randomUUID();
const packets = [],
  waiters = [];
let socket, context;
const send = (value) => {
  const body = Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  socket.write(Buffer.concat([header, body]));
};
const next = () =>
  new Promise((resolve, reject) => {
    if (packets.length) return resolve(packets.shift());
    const timer = setTimeout(
      () => reject(Error("Native message timed out")),
      15000,
    );
    waiters.push((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
const server = createServer((client) => {
  socket = client;
  let buffer = Buffer.alloc(0);
  client.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32LE()) {
      const size = buffer.readUInt32LE();
      assert(size > 0 && size <= 1024 * 1024);
      const value = JSON.parse(buffer.subarray(4, size + 4));
      buffer = buffer.subarray(size + 4);
      if (waiters.length) waiters.shift()(value);
      else packets.push(value);
    }
  });
});
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const local = join(folder, "local");
  const config = join(folder, "config");
  const registration = join(config, "chromium", "NativeMessagingHosts");
  await mkdir(registration, { recursive: true });
  await mkdir(join(local, "app.orbit.launcher"), { recursive: true });
  await writeFile(
    join(local, "app.orbit.launcher/browser-connection.json"),
    JSON.stringify({ address: `127.0.0.1:${server.address().port}`, token }),
  );
  await writeFile(
    join(registration, `${host}.json`),
    JSON.stringify({
      name: host,
      description: "Orbit test",
      path: resolve("src-tauri/target/debug/orbit"),
      type: "stdio",
      allowed_origins: [origin],
    }),
  );
  const extension = resolve("browser-extension");
  context = await chromium.launchPersistentContext(join(folder, "profile"), {
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    env: { ...process.env, XDG_CONFIG_HOME: config, LOCALAPPDATA: local },
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const hello = await next();
  assert.deepEqual(hello, { token, origin });
  send({ type: "ready" });
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  assert(worker.url().startsWith(origin));
  await context.route("https://example.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Orbit fixture</title><p>Local test</p>",
    }),
  );
  const page = context.pages()[0];
  await page.goto("https://example.com/existing");
  const active = await worker.evaluate(async () =>
    (await chrome.tabs.query({ active: true })).map((tab) => tab.id),
  );
  const entries = [
    { id: "existing", url: "https://example.com/existing" },
    { id: "new", url: "https://example.com/new" },
    { id: "duplicate", url: "https://example.com/new" },
  ];
  send({ type: "openUrls", requestId: 1, entries });
  const response = await next();
  assert.equal(response.requestId, 1);
  assert.deepEqual(
    response.results.map((result) => result.status),
    ["alreadyOpen", "opened", "alreadyOpen"],
  );
  assert.deepEqual(
    await worker.evaluate(async () =>
      (await chrome.tabs.query({ active: true })).map((tab) => tab.id),
    ),
    active,
  );
  // Two overlapping requests for the same URL must create only one tab.
  const concurrent = [
    { id: "concurrent", url: "https://example.com/concurrent" },
  ];
  send({ type: "openUrls", requestId: 2, entries: concurrent });
  send({ type: "openUrls", requestId: 3, entries: concurrent });
  assert.equal((await next()).results[0].status, "opened");
  assert.equal((await next()).results[0].status, "alreadyOpen");
  const tabs = await worker.evaluate(() => chrome.tabs.query({}));
  assert.equal(tabs.length, 3);
  assert.equal(
    tabs.filter((tab) => (tab.pendingUrl || tab.url) === concurrent[0].url)
      .length,
    1,
  );
  send({ type: "ping" });
  assert.equal((await next()).type, "pong");
  console.log(
    "Passed: real extension ID, native host handshake/framing, live tab deduplication, concurrent batches, active tab preserved, heartbeat. Chromium/Linux; Windows registration/focus not exercised.",
  );
} catch (error) {
  const worker = context?.serviceWorkers()[0];
  console.error(
    "Extension diagnostic:",
    worker
      ? await worker.evaluate(
          () =>
            new Promise((resolve) => {
              const port = chrome.runtime.connectNative(
                "app.orbit.launcher.browser",
              );
              port.onDisconnect.addListener(() =>
                resolve(chrome.runtime.lastError?.message || "disconnected"),
              );
              port.onMessage.addListener((message) => {
                resolve(message.type);
                port.disconnect();
              });
              setTimeout(() => {
                port.disconnect();
                resolve("no response");
              }, 2000);
            }),
        )
      : "no service worker",
  );
  throw error;
} finally {
  await context?.close();
  socket?.destroy();
  server.close();
  await rm(folder, { recursive: true, force: true });
}
