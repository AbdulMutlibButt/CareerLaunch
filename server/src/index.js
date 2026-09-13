import "dotenv/config";
import { createStore } from "./store.js";
import { createApp } from "./create-app.js";
import { seedDemo } from "./demo.js";
import { loadConfig } from "./config.js";
import { isVercelRuntime, startLocalServer } from "./listener.js";
const config = loadConfig();
const runningOnVercel = isVercelRuntime();
const store = await createStore({
  uri: config.mongoUri,
  disconnectOnClose: !runningOnVercel,
});
if (store.mode === "local-demo")
  await seedDemo(store, { password: config.demoPassword });
const app = createApp(store, {
  production: config.production,
  origin: config.origin,
  secret: config.jwtSecret,
});

export default app;
startLocalServer(app, store, config);
