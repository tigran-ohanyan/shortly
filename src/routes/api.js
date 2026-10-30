import { Router } from "express";
import rateLimit from "express-rate-limit";

import { normalizeUrl, randomSlug, validateSlug } from "../slug.js";

export function apiRouter({ repo, baseUrl, apiKey }) {
  const router = Router();

  const requireKey = (req, res, next) => {
    if (!apiKey) return next();
    if (req.get("x-api-key") === apiKey) return next();
    return res.status(401).json({ error: "API key required" });
  };

  const createLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many links created, slow down" },
  });

  const present = (link) => ({
    slug: link.slug,
    short_url: `${baseUrl}/${link.slug}`,
    url: link.url,
    clicks: link.clicks,
    created_at: link.created_at,
    expires_at: link.expires_at,
  });

  router.post("/links", createLimiter, requireKey, (req, res) => {
    const url = normalizeUrl(req.body?.url);
    if (!url) return res.status(400).json({ error: "Please provide a valid http(s) URL" });

    let slug = typeof req.body?.slug === "string" ? req.body.slug.trim() : "";
    if (slug) {
      const problem = validateSlug(slug);
      if (problem) return res.status(400).json({ error: problem });
      if (repo.get(slug)) return res.status(409).json({ error: "That slug is already taken" });
    } else {
      do slug = randomSlug(); while (repo.get(slug));
    }

    let expiresAt = null;
    const days = req.body?.expires_in_days;
    if (days !== undefined && days !== null && days !== "") {
      const n = Number(days);
      if (!Number.isInteger(n) || n < 1 || n > 3650) {
        return res.status(400).json({ error: "expires_in_days must be a whole number from 1 to 3650" });
      }
      expiresAt = new Date(Date.now() + n * 86400000).toISOString();
    }

    const link = repo.create({ slug, url, expiresAt });
    return res.status(201).json(present(link));
  });

  router.get("/links", requireKey, (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    res.json(repo.list(limit).map(present));
  });

  router.get("/links/:slug", (req, res) => {
    const link = repo.get(req.params.slug);
    if (!link) return res.status(404).json({ error: "Link not found" });
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    res.json({ ...present(link), stats: repo.stats(link, days) });
  });

  router.delete("/links/:slug", requireKey, (req, res) => {
    if (!repo.remove(req.params.slug)) return res.status(404).json({ error: "Link not found" });
    res.status(204).end();
  });

  router.get("/health", (_req, res) => res.json({ status: "ok" }));

  return router;
}
