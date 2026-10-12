# karl

ThinkEngine Report Studio is a React client-reporting app backed by a Cloudflare Worker, D1 records and R2 files.

## Reporting features

- Client records, staff profiles, logos and portrait uploads.
- Administrator-managed services: add, rename, archive and restore offerings in Agency settings. Client service selections use the shared catalogue. New custom services have report sections with summaries, metrics, CSV imports and PDF output.
- Agency-settings staff invitations, Administrator/Staff/Viewer roles, deactivation, linked profiles, and user-management activity.
- Monthly SEO, PPC, paid social, analytics and email report sections.
- Branded A4 PDF exports with an account-team page and preparer details.
- CSV uploads, configurable column mapping, KPI snapshots, top 10s and biggest-change tables.
- Exact previous-calendar-month comparisons, automatically matched by client, section and dataset name, or supplied as a separate baseline CSV.
- Editable AI insight drafts and manually written commentary. Only reviewed commentary is included in PDFs; stale commentary is flagged when source comparisons change.

CSV imports support UTF-8, quoted values, BOMs, preamble/header-row selection, decimal-point or decimal-comma numbers, currencies, percentages and time values. Limits per file: 2 MB, 10,000 rows, 64 columns and 200,000 cells. Rate and unit-cost metrics support weighted averages; missing values and zero baselines are handled explicitly. Rows labelled as export totals are excluded to prevent double counting.

## Open in your browser

[Open ThinkEngine Report Studio](https://thinkengine-report-studio.thinkengine-8919.chatgpt.site). Sign in with your authorised account. GitHub stores the source; a static preview or GitHub Pages cannot run the D1/R2-backed reporting API.

For a local browser preview, run the Worker using the commands below and open `http://127.0.0.1:5173`.

## Local development

Use Node.js 22 or newer.

```sh
npm ci
npm test
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cynical_queen_noir.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_fine_starhawk.sql
npx wrangler dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 5173 --inspector-port 0
```

Also apply `drizzle/0002_peaceful_nightcrawler.sql` once to an existing local database before starting this version. For a fresh database, apply all three migrations in order.

For browser development, copy `.dev.vars.example` to `dist/server/.dev.vars` and uncomment `LOCAL_DEV_AUTH` and `LOCAL_DEV_USER_EMAIL`. This optional development identity works only on loopback URLs without Sites dispatch headers; never configure these variables on the hosted Site.

Apply each migration once to a fresh local database. Production schema changes are generated through `npm run db:generate` and deployed through Sites. Local state, dependency folders, generated build output and secret files are excluded from Git.

## Preview sessions

The Services panel uses the catalogue and revision returned with workspace state, avoiding a separate initial catalogue request. Service mutations use `/api/agency/services`; `/api/services` remains an API compatibility alias. Failed loads stop the loading indicator. Authentication failures offer a platform sign-in link in a new tab, retain an entered service name, and allow retry after sign-in. A preview forwarding an email without the platform account ID is rejected; it does not inherit owner permissions.

## Service reporting formats

When adding or editing a service, choose **CSV only**, **Free text only**, or **CSV + free text**. CSV-only sections show import/analysis controls and exclude manual summaries, metrics, images and written dataset commentary. Free-text sections show narrative fields and exclude CSV imports, data tables and images. Combined sections retain both workflows. New and copied reports use the current service default. Existing reports keep their mode snapshot; **Apply current service settings** changes the mode for that report after saving. Stored content is retained when switching modes, and PDF output includes only content supported by the selected mode. Changing a service default does not silently rewrite existing reports or their saved PDFs.

## Agency services

Agency settings → Services manages the shared service catalogue, stored in D1 settings. Existing service names and client assignments are retained on first use. Rename aliases keep historical client assignments linked; existing report headings and content are snapshots and are not rewritten. Archived offerings disappear from new selections but stay on existing clients and reports. Restore them to make them selectable again. Duplicate names, including historical aliases, are rejected, and revision checks prevent concurrent catalogue edits from overwriting each other. Only administrators can change the catalogue; staff can assign active services to clients and add their sections to reports.

Custom services selected on a client are added to new report templates and to copied reports if missing. Use **Add service section** in an existing report to include a newer offering, then save the report. Generic sections support a summary, a three-column metrics table, supporting images, and the existing CSV snapshots/comparisons/insights workflow.

## Staff accounts and invitations

The hosted app uses the Sites platform’s authenticated ChatGPT identity and workspace access policy. Every active workspace member may join as Staff; an administrator can pre-register a business account email with another role. Invitations are claimed automatically when the matching account first opens the app. The invitation screen provides the app link to share; it does **not** send an email or add someone to the ChatGPT workspace. A colleague must already be a workspace member. Direct Google sign-in is not implemented.

The verified owner email is seeded in the user-access settings by migration 0002. The first authenticated owner login becomes an administrator. Account identity is bound to the stable Sites user ID after sign-in. Administrators can change others’ roles or deactivate/reactivate access; the owner cannot be demoted or deactivated. All application API routes require an active account, with server-side checks for user management, branding, viewer writes, and staff profile ownership. Viewer PDF downloads use existing exports. Staff profiles link to individual accounts and default the report preparer. Existing reports and team profiles are retained.

The invitation role is applied before first sign-in. Existing users should be managed through their user-list row. Deactivation also cancels unclaimed invitations. User-management actions are recorded in a bounded recent-activity view. This is app-level access management and does not alter workspace membership or give Site source-editing permissions.

## AI insight writing

AI drafts use the OpenAI Responses API, server-side only. They are grounded in calculated totals, rankings and month-on-month differences, with validated evidence references. The model receives aggregated facts and labels, not the original CSV file. Drafts require review before inclusion in a client PDF.

Configure `OPENAI_API_KEY` as a secret in the Site's runtime environment to enable generation. `OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`. Do not put API keys in browser code, database records or Git. API usage is charged to the connected OpenAI account.

For local testing, copy `.dev.vars.example` to `dist/server/.dev.vars` after building and add your development key. Without a configured key, CSV analysis and manual commentary work normally, and the app shows the remaining AI connection requirement. Automated tests use mocked AI responses; no live API key is included.

## Source layout

- `src/App.jsx`: reporting workspace and report editor.
- `src/DataInsights.jsx`: CSV mapping, data snapshots, rankings and commentary.
- `src/analytics.js`: CSV parsing, aggregation and comparisons.
- `src/dataset-api.js`: stored imports and server-side AI generation.
- `src/pdf.js`: branded PDF exports and data visualisations.
- `src/worker.js`: application API and file serving.
- `db/schema.ts` and `drizzle/`: D1 schema and migrations.
