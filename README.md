# karl

ThinkEngine Report Studio is a React client-reporting app backed by a Cloudflare Worker, D1 records and R2 files.

## Reporting features

- Client records, staff profiles, logos and portrait uploads.
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

Apply each migration once to a fresh local database. Production schema changes are generated through `npm run db:generate` and deployed through Sites. Local state, dependency folders, generated build output and secret files are excluded from Git.

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
