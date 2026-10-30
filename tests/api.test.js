import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";

let repo, app;
beforeEach(() => {
  repo = openDb(":memory:");
  app = createApp({ repo, baseUrl: "https://sho.rt" });
});
afterEach(() => repo.close());

describe("POST /api/links", () => {
  it("creates a link with a random slug and normalizes the url", async () => {
    const res = await request(app).post("/api/links").send({ url: "example.com/page?x=1" });
    assert.equal(res.status, 201);
    assert.match(res.body.slug, /^[2-9a-zA-Z]{7}$/);
    assert.equal(res.body.url, "https://example.com/page?x=1");
    assert.equal(res.body.short_url, `https://sho.rt/${res.body.slug}`);
    assert.equal(res.body.clicks, 0);
  });

  it("accepts a custom slug and rejects duplicates and reserved words", async () => {
    const first = await request(app).post("/api/links").send({ url: "https://a.io", slug: "launch" });
    assert.equal(first.status, 201);
    const dup = await request(app).post("/api/links").send({ url: "https://b.io", slug: "launch" });
    assert.equal(dup.status, 409);
    const reserved = await request(app).post("/api/links").send({ url: "https://b.io", slug: "api" });
    assert.equal(reserved.status, 400);
    const bad = await request(app).post("/api/links").send({ url: "https://b.io", slug: "a b" });
    assert.equal(bad.status, 400);
  });

  it("rejects invalid urls", async () => {
    for (const url of ["", "not a url", "ftp://files.example.com", "javascript:alert(1)", 42]) {
      const res = await request(app).post("/api/links").send({ url });
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(url)}`);
    }
  });

  it("validates expiry days", async () => {
    const ok = await request(app).post("/api/links").send({ url: "https://a.io", expires_in_days: 7 });
    assert.equal(ok.status, 201);
    assert.ok(new Date(ok.body.expires_at) > new Date());
    const bad = await request(app).post("/api/links").send({ url: "https://a.io", expires_in_days: 0 });
    assert.equal(bad.status, 400);
  });
});

describe("redirects and stats", () => {
  it("redirects and records the click with referrer and browser", async () => {
    const { body } = await request(app).post("/api/links").send({ url: "https://example.com/" });
    const res = await request(app)
      .get(`/${body.slug}`)
      .set("Referer", "https://www.twitter.com/some/post")
      .set("User-Agent", "Mozilla/5.0 Chrome/124.0 Safari/537.36");
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, "https://example.com/");

    await request(app).get(`/${body.slug}`).set("User-Agent", "curl/8.0");

    const stats = await request(app).get(`/api/links/${body.slug}`);
    assert.equal(stats.status, 200);
    assert.equal(stats.body.clicks, 2);
    assert.equal(stats.body.stats.total, 2);
    assert.equal(stats.body.stats.per_day.length, 7);
    assert.equal(stats.body.stats.per_day.at(-1).count, 2);
    assert.deepEqual(stats.body.stats.referrers.map((r) => r.referrer).sort(), ["direct", "twitter.com"]);
    assert.deepEqual(stats.body.stats.browsers.map((b) => b.browser).sort(), ["Bot", "Chrome"]);
  });

  it("returns 404 for unknown slugs and 410 for expired links", async () => {
    const missing = await request(app).get("/nope123").set("Accept", "application/json");
    assert.equal(missing.status, 404);
    const expired = repo.create({ slug: "old", url: "https://a.io", expiresAt: "2000-01-01T00:00:00.000Z" });
    const res = await request(app).get(`/${expired.slug}`);
    assert.equal(res.status, 410);
    assert.equal(repo.get("old").clicks, 0);
  });

  it("lists and deletes links", async () => {
    await request(app).post("/api/links").send({ url: "https://a.io", slug: "one" });
    await request(app).post("/api/links").send({ url: "https://b.io", slug: "two" });
    const list = await request(app).get("/api/links");
    assert.deepEqual(list.body.map((l) => l.slug), ["two", "one"]);
    assert.equal((await request(app).delete("/api/links/one")).status, 204);
    assert.equal((await request(app).delete("/api/links/one")).status, 404);
    assert.equal((await request(app).get("/one")).status, 404);
  });
});

describe("api key", () => {
  it("protects writes and listing when configured, redirects stay public", async () => {
    const secured = createApp({ repo, baseUrl: "https://sho.rt", apiKey: "k3y" });
    assert.equal((await request(secured).post("/api/links").send({ url: "https://a.io" })).status, 401);
    const ok = await request(secured).post("/api/links").set("X-API-Key", "k3y").send({ url: "https://a.io" });
    assert.equal(ok.status, 201);
    assert.equal((await request(secured).get("/api/links")).status, 401);
    assert.equal((await request(secured).get(`/${ok.body.slug}`)).status, 302);
    assert.equal((await request(secured).get(`/api/links/${ok.body.slug}`)).status, 200);
  });
});
