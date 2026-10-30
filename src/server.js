import { createApp } from "./app.js";
import { openDb } from "./db.js";

const port = Number(process.env.PORT) || 3000;
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, "");
const repo = openDb(process.env.DB_PATH || "data/shortly.db");

const app = createApp({ repo, baseUrl, apiKey: process.env.API_KEY || "" });
const server = app.listen(port, () => console.log(`shortly listening on ${baseUrl}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      repo.close();
      process.exit(0);
    });
  });
}
