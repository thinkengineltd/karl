# Karl in Base Code

Create a new Base Code project inside the intended existing Base44 workspace.
Connect `https://github.com/thinkengineltd/karl` and select `main` after the
portability changes have been merged. Keep this repository as the shared source
of truth for Codex and Base Code. This is an existing-codebase project; it does
not use Base44 entities, authentication or the Base44 SDK.

## Environment setup

Use Linux with Node.js 24 LTS (22 or newer supported), npm, and development
dependencies enabled. The app uses Wrangler's local Worker runtime with local
D1 and R2 emulators. No Cloudflare account, API token or production database is
needed. Use these commands from the repository root:

```sh
npm ci
npm run setup
npm run dev
```

`setup` builds the app and applies tracked migrations. `dev` also performs these
steps, starts the Worker, waits for the API to be ready, then starts the browser
gateway and watches `src/` and `public/`. Saving source rebuilds the bundle;
refresh the browser after a successful rebuild. Restart `dev` after changing
dependencies, migrations, build scripts or secrets. Startup migrations are
idempotent: rerunning setup preserves existing preview records.

Configure the preview's environment variables in Base Code before starting:

| Variable | Value |
| --- | --- |
| `HOST` | `0.0.0.0`, so the platform can forward the preview port |
| `PORT` | The port selected by the platform; defaults to `5173` |
| `PREVIEW_PASSWORD` | A unique secret of at least 16 characters |
| `PREVIEW_ORIGIN` | Optional exact HTTPS preview origin, e.g. `https://your-preview.example`; set this if the platform rewrites the Host header and saves return 403 |
| `KARL_LOCAL_STATE` | Optional writable persistent directory; default `.wrangler/preview-state` relative to the repo |
| `OPENAI_API_KEY` | Optional development key for live AI insight drafts |
| `OPENAI_MODEL` | Optional model; app default is `gpt-4.1-mini` |

Use Base Code's secret entry UI for passwords and API keys. Never commit them or
put them in chat prompts. The preview gateway accepts HTTP Basic authentication:
username **preview**, password **PREVIEW_PASSWORD**. Access shared previews over
the platform's HTTPS URL. If the embedded preview cannot show a browser login
prompt, open the preview in a new tab. If the platform removes Authorization
headers, its forwarding configuration must be adjusted; do not disable preview
authentication to work around it.

The public gateway forwards app routes only. The Worker stays on a separate
loopback port. Caller-supplied platform identity headers are stripped. Everyone
who knows the preview password shares the development administrator account;
this is not a production staff sign-in system. Treat preview data as disposable
test data and avoid importing client data into it.

## What works in the preview

- Client records, report editing, service and template settings.
- CSV analysis, previous-month comparisons and screenshot OCR with bundled assets.
- Local D1 records and local R2 uploads, images, original sources and saved PDFs.
- PDF generation, commentary and browser recovery drafts.
- AI insight drafts if a development OpenAI key is configured. Without it, manual
  commentary and calculated analysis still work.

External staff hosting grants require the request-scoped Sites connector on the
hosted app. Base Code does not provide that connector or a Sites identity. Grant
attempts in previews remain unconfirmed/failed; the app does not pretend that an
external user has access. Test real staff sign-in and invitations on the hosted
Site. The preview does not weaken the production Worker's authentication rules.

## Data and deployment

Preview configuration, secrets and data live under ignored `.wrangler/`, outside
the production `dist/server/` package. Optional local AI settings can be read from
the root `.dev.vars`; only `OPENAI_API_KEY` and `OPENAI_MODEL` are copied into
preview Worker settings. Process environment values take precedence.

Base Code environment rebuilds may discard its local filesystem. Use a persistent
directory for `KARL_LOCAL_STATE` if available. Each branch/environment should have
its own directory; never point previews at production storage. Browser recovery
drafts are also specific to the preview origin and browser profile.

Base Code provides development previews, not production hosting. Continue to
deploy the tested production Worker through the existing Sites deployment flow.
GitHub merges do not themselves publish the app. `npm run build` produces the
same production package and does not embed preview passwords or identities.

## Shared development workflow

Start changes from the latest `main` in either tool, work on a feature branch,
and open a GitHub pull request. Run:

```sh
npm test
npm run build
```

For browser acceptance checks, start `dev` with a fresh `KARL_LOCAL_STATE`, then
run `npm run test:browser`. The test creates fixtures and modifies preview data;
do not run it against production or an everyday preview database. Set
`CHROMIUM_PATH` to an installed Chromium executable, or install Google Chrome
(the default browser). `QA_BASE_URL` selects a different preview URL and
`QA_OUTPUT` selects an artifact directory (default `dist/qa/browser`). Browser
tests use `PREVIEW_PASSWORD` automatically when set. Their dependencies are
locked in the repository.

The browser checks exercise CSV units, real OCR, local storage, PDF text,
report/commentary recovery, revision conflicts and mobile overflow. Review and
merge after checks pass, then refresh the other platform from GitHub before
starting another change. Avoid simultaneous edits to the same branch.

## First prompt for Base Code

> Set up this existing Karl repository using docs/base-code.md. Preserve its
> React, Cloudflare Worker, D1 and R2 architecture. Run npm ci, npm run setup and
> npm run dev. Request PREVIEW_PASSWORD through the secrets UI and expose only
> the gateway port with HOST=0.0.0.0. Use isolated local test data. Do not replace
> authentication with Base44 login or migrate storage to Base44 entities. Run
> npm test, npm run build and the browser checks before proposing changes.
