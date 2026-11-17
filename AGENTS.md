# Working on Karl

Read `docs/base-code.md` for portable development and preview setup. Use Node.js
24 LTS (22+ supported), `npm ci`, and `npm run dev`. The dev command builds,
applies local migrations, starts local D1/R2 and watches source files. No
Cloudflare credentials are needed for development. Use `npm run setup` for
setup without starting a server.

For forwarded cloud previews, configure `HOST=0.0.0.0`, the platform's `PORT`,
and a secret `PREVIEW_PASSWORD` of at least 16 characters. Expose only the
gateway port. Use `PREVIEW_ORIGIN` for HTTPS proxies that rewrite Host. Preserve
the loopback-only Worker and production authentication rules.

Keep the existing React/Worker/D1/R2 stack. Do not replace it with Base44 entities
or login as part of environment setup. Keep preview data separate from production
and from other branches. Never commit secrets, `.wrangler/` or `dist/` output.

Run `npm test` and `npm run build` for changes. When touching reporting flows or
preview infrastructure, also run `npm run test:browser` against a running dev
server with a fresh `KARL_LOCAL_STATE`. Set `CHROMIUM_PATH` if Google Chrome is
not installed. This test writes fixture data and must never target production.
Default QA artifacts are in `dist/qa/browser/`.

Work on feature branches and use GitHub pull requests. Production deployment
continues through Sites; Base Code is a development environment. Staff hosting
grants require the live request-scoped Sites connector; never report a preview
grant as successful without provider confirmation.
