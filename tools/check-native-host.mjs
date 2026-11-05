// Exercises the production Rust native host on Linux with framed pipes and a local peer.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const dir = await mkdtemp(join(tmpdir(), "orbit-host-test-"));
const token = randomUUID(),
  origin = "chrome-extension://gdlabbbhfoddkklcganebipckpnaflio/";
function channel(reader, writer = reader) {
  let buffer = Buffer.alloc(0);
  const queued = [],
    waiting = [];
  reader.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32LE()) {
      const size = buffer.readUInt32LE();
      assert(size > 0 && size <= 1048576);
      const value = JSON.parse(buffer.subarray(4, 4 + size));
      buffer = buffer.subarray(4 + size);
      if (waiting.length) waiting.shift()(value);
      else queued.push(value);
    }
  });
  return {
    read: () =>
      new Promise((resolve, reject) => {
        if (queued.length) return resolve(queued.shift());
        const timeout = setTimeout(() => reject(Error("Host timeout")), 5000);
        waiting.push((value) => {
          clearTimeout(timeout);
          resolve(value);
        });
      }),
    write: (value) => {
      const body = Buffer.from(JSON.stringify(value));
      const header = Buffer.alloc(4);
      header.writeUInt32LE(body.length);
      writer.write(Buffer.concat([header, body]));
    },
  };
}
let host, socket;
const server = createServer();
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  await mkdir(join(dir, "app.orbit.launcher"));
  await writeFile(
    join(dir, "app.orbit.launcher/browser-connection.json"),
    JSON.stringify({ address: `127.0.0.1:${server.address().port}`, token }),
  );
  const connected = new Promise((resolve) =>
    server.once("connection", resolve),
  );
  host = spawn(resolve("src-tauri/target/debug/orbit"), [origin], {
    env: { ...process.env, LOCALAPPDATA: dir },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const chrome = channel(host.stdout, host.stdin);
  socket = await connected;
  const orbit = channel(socket);
  assert.deepEqual(await orbit.read(), { token, origin });
  orbit.write({ type: "ready" });
  assert.deepEqual(await chrome.read(), { type: "ready" });
  const request = {
    type: "openUrls",
    requestId: 7,
    entries: [{ id: "one", url: "https://example.com/" }],
  };
  orbit.write(request);
  assert.deepEqual(await chrome.read(), request);
  const response = {
    type: "results",
    requestId: 7,
    results: [{ id: "one", status: "alreadyOpen" }],
  };
  chrome.write(response);
  assert.deepEqual(await orbit.read(), response);
  const exited = new Promise((resolve) => host.once("exit", resolve));
  host.stdin.end();
  assert.equal(await exited, 0);
  console.log(
    "Passed: Rust native host authentication, stdio framing, bidirectional forwarding and clean shutdown. Linux; Windows registry not exercised.",
  );
} finally {
  host?.kill();
  socket?.destroy();
  server.close();
  await rm(dir, { recursive: true, force: true });
}
