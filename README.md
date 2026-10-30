# shortly

Self-hosted URL shortener with click analytics. Express on Node.js, SQLite through the built-in
`node:sqlite` module (no native build step), and a small vanilla JavaScript frontend.

## Features

- Short links with random 7-character slugs or custom slugs, optional expiry
- Redirects record the day, referrer domain and browser of every click
- Stats per link: total, clicks per day for the last 7–90 days, top referrers, browsers
- Optional API key that protects creating, listing and deleting; redirects stay public
- Rate limit on link creation, `helmet` security headers, JSON body size limit
- Frontend: shorten form with options, copy button, stats panel with bars, recent links table
- 8 integration tests with `node:test` + supertest, CI on Node 22 and 24, Docker image

## Run

```bash
cp .env.example .env     # set BASE_URL to your public domain
docker compose up -d --build
# or
npm install && npm start  # http://localhost:3000
```

## API

| Method | Path | Body / query | Notes |
|---|---|---|---|
| `POST` | `/api/links` | `{ "url", "slug"?, "expires_in_days"? }` | 201 with `short_url`; 409 if the slug is taken |
| `GET` | `/api/links` | `?limit=50` | Newest first |
| `GET` | `/api/links/:slug` | `?days=7` | Link + `stats` object |
| `DELETE` | `/api/links/:slug` | | 204 |
| `GET` | `/:slug` | | 302 to the destination, 410 when expired |
| `GET` | `/api/health` | | `{ "status": "ok" }` |

When `API_KEY` is set, send it as the `X-API-Key` header for `POST`, `GET /api/links` and `DELETE`.

```bash
curl -s -X POST localhost:3000/api/links -H 'content-type: application/json' \
  -d '{"url":"https://example.com/pricing","slug":"pricing"}'
# {"slug":"pricing","short_url":"http://localhost:3000/pricing", ...}
curl -s localhost:3000/api/links/pricing | jq .stats
```

## Project layout

```
src/
  server.js      reads env, opens the database, starts the server
  app.js         express app factory (used by tests)
  db.js          schema and queries on node:sqlite
  slug.js        slug generation/validation, URL normalisation, UA and referrer parsing
  routes/        api.js and redirect.js
public/          frontend
tests/           integration tests against an in-memory database
```

## Notes

- Requires Node 22.13+ for `node:sqlite`. The Docker image uses Node 24.
- SQLite in WAL mode handles thousands of redirects per second on a small VPS. For more, swap
  `db.js` for PostgreSQL; the routes only talk to the `Repo` class.

## License

MIT
