import { Router } from "express";

import { detectBrowser, referrerHost } from "../slug.js";

export function redirectRouter({ repo }) {
  const router = Router();

  router.get("/:slug", (req, res, next) => {
    const link = repo.get(req.params.slug);
    if (!link) return next();
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).type("text").send("This link has expired.");
    }
    repo.recordClick(link.id, {
      referrer: referrerHost(req.get("referer")),
      browser: detectBrowser(req.get("user-agent")),
    });
    res.set("Cache-Control", "no-store");
    return res.redirect(302, link.url);
  });

  return router;
}
