import "dotenv/config";
import { createStore } from "./store.js";
import { createApp } from "./app.js";
import { seedDemo } from "./demo.js";
import { loadConfig } from "./config.js";
const config = loadConfig();
const store = await createStore({ uri: config.mongoUri });
if (store.mode === "local-demo")
  await seedDemo(store, { password: config.demoPassword });
const server = createApp(store, {
  production: config.production,
  origin: config.origin,
  secret: config.jwtSecret,
}).listen(
  config.port,
  config.host,
  () =>
    console.log(
      `CareerLaunch API listening on ${config.host}:${config.port} (${store.mode})`,
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await store.close();
      process.exit(0);
    }),
  );
