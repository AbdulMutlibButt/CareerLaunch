import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveApiOrigin } from "../../client/lib/api-origin.mjs";

test("the Next.js proxy requires a public HTTPS API origin in production", () => {
  assert.equal(
    resolveApiOrigin({ production: false }),
    "http://127.0.0.1:4000",
  );
  assert.equal(
    resolveApiOrigin({
      value: "https://careerlaunch-api.onrender.com/",
      production: true,
    }),
    "https://careerlaunch-api.onrender.com",
  );
  for (const value of [
    undefined,
    "http://careerlaunch-api.onrender.com",
    "https://localhost:4000",
    "https://127.0.0.1:4000",
    "https://192.168.1.10",
    "https://api.internal",
    "https://careerlaunch-api.onrender.com/api",
  ])
    assert.throws(
      () => resolveApiOrigin({ value, production: true }),
      /API_URL/,
    );
});

test("the Render Blueprint binds publicly and keeps secrets out of source", async () => {
  const blueprint = await readFile(
    new URL("../../render.yaml", import.meta.url),
    "utf8",
  );
  assert.match(blueprint, /name: careerlaunch-api\s+runtime: node\s+plan: free/);
  assert.match(blueprint, /autoDeployTrigger: "off"/);
  assert.match(blueprint, /healthCheckPath: \/api\/health/);
  assert.match(blueprint, /key: HOST\s+value: "0\.0\.0\.0"/);
  assert.match(blueprint, /key: PORT\s+value: "10000"/);
  assert.match(blueprint, /key: APP_ORIGIN\s+sync: false/);
  assert.match(blueprint, /key: MONGODB_URI\s+sync: false/);
  assert.match(blueprint, /key: JWT_SECRET\s+generateValue: true/);
  assert.doesNotMatch(blueprint, /mongodb(?:\+srv)?:\/\//i);
});
