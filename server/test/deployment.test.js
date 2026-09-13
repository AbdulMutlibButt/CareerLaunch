import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveApiOrigin } from "../../client/lib/api-origin.mjs";
import { connectMongo } from "../src/store.js";
import { startLocalServer } from "../src/listener.js";

test("the Next.js proxy requires a public HTTPS API origin in production", () => {
  assert.equal(
    resolveApiOrigin({ production: false }),
    "http://127.0.0.1:4000",
  );
  assert.equal(
    resolveApiOrigin({
      value: "https://careerlaunch-api.vercel.app/",
      production: true,
    }),
    "https://careerlaunch-api.vercel.app",
  );
  for (const value of [
    undefined,
    "http://careerlaunch-api.vercel.app",
    "https://localhost:4000",
    "https://127.0.0.1:4000",
    "https://192.168.1.10",
    "https://api.internal",
    "https://careerlaunch-api.vercel.app/api",
  ])
    assert.throws(
      () => resolveApiOrigin({ value, production: true }),
      /API_URL/,
    );
});

test("the Vercel entry exports Express without starting a listener", async () => {
  const entry = await readFile(
    new URL("../src/index.js", import.meta.url),
    "utf8",
  );
  assert.match(entry, /const runningOnVercel = isVercelRuntime\(\)/);
  assert.match(entry, /export default app/);
  assert.match(entry, /startLocalServer\(app, store, config\)/);
  assert.match(entry, /disconnectOnClose: !runningOnVercel/);

  let listenCalls = 0;
  const server = startLocalServer(
    {
      listen() {
        listenCalls += 1;
      },
    },
    { mode: "mongodb" },
    { host: "127.0.0.1", port: 4000 },
    { values: { VERCEL: "1" } },
  );
  assert.equal(server, null);
  assert.equal(listenCalls, 0);
});

test("MongoDB connections are reused and failed connections can retry", async () => {
  const cache = { connection: null, promise: null, uri: null };
  let calls = 0;
  const connection = { connection: { readyState: 1 } };
  const connector = async () => {
    calls += 1;
    return connection;
  };
  const [first, second] = await Promise.all([
    connectMongo("mongodb://example.invalid/test", { cache, connector }),
    connectMongo("mongodb://example.invalid/test", { cache, connector }),
  ]);
  assert.equal(first, connection);
  assert.equal(second, connection);
  assert.equal(calls, 1);
  assert.equal(
    await connectMongo("mongodb://example.invalid/test", { cache, connector }),
    connection,
  );
  assert.equal(calls, 1);

  const retryCache = { connection: null, promise: null, uri: null };
  await assert.rejects(
    connectMongo("mongodb://example.invalid/test", {
      cache: retryCache,
      connector: async () => {
        throw new Error("unavailable");
      },
    }),
    /unavailable/,
  );
  await connectMongo("mongodb://example.invalid/test", {
    cache: retryCache,
    connector,
  });
  assert.equal(retryCache.connection, connection);
});
