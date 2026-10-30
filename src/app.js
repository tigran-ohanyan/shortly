import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import helmet from "helmet";

import { apiRouter } from "./routes/api.js";
import { redirectRouter } from "./routes/redirect.js";

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

export function createApp({ repo, baseUrl = "http://localhost:3000", apiKey = "" }) {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "16kb" }));

  app.use("/api", apiRouter({ repo, baseUrl, apiKey }));
  app.use(express.static(PUBLIC_DIR, { index: "index.html", extensions: ["html"] }));
  app.use(redirectRouter({ repo }));

  app.use((req, res) => {
    if (req.accepts("html")) return res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
    return res.status(404).json({ error: "Not found" });
  });

  app.use((err, req, res, _next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
