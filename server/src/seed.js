import "dotenv/config";
import { createStore } from "./store.js";
import { seedDemo } from "./demo.js";
import { loadConfig } from "./config.js";
const config = loadConfig();
if (config.production)
  throw new Error("Demo seeding is disabled in production");
const store = await createStore({ uri: config.mongoUri });
await seedDemo(store, { password: config.demoPassword });
await store.close();
console.log("Demo accounts and fictional jobs are ready.");
