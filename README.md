# karl

ThinkEngine Report Studio is a React client-reporting app backed by a Cloudflare Worker, D1 records and R2 files.

## Reporting features

- Client records, staff profiles, logos and portrait uploads.
- Administrator-managed services: add, rename, archive and restore offerings in Agency settings. Client service selections use the shared catalogue. New custom services have report sections with summaries, metrics, CSV imports and PDF output.
- Agency-settings staff invitations, Administrator/Staff/Viewer roles, deactivation, linked profiles, and user-management activity.
- Monthly SEO, PPC, paid social, analytics and email report sections.
- Branded A4 PDF exports with an account-team page and preparer details.
- CSV and screenshot uploads, reviewed extraction, configurable column mapping, KPI snapshots, top 10s and biggest-change tables.
- Nineteen versioned platform templates for Facebook, Instagram, LinkedIn, TikTok, Google Ads, GA4 and Search Console, with separate organic, paid and content reporting options. Administrators can edit metric aliases, definitions, units and aggregations, duplicate templates, and archive them in Agency settings.
- Exact previous-calendar-month comparisons, automatically matched by client, section, dataset name, platform, account and template report type, or supplied as a separate reviewed baseline.
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

Also apply `drizzle/0002_peaceful_nightcrawler.sql` and `drizzle/0003_small_blade.sql` once to an existing local database before starting this version. For a fresh database, apply all migrations in order.

For browser development, copy `.dev.vars.example` to `dist/server/.dev.vars` and uncomment `LOCAL_DEV_AUTH` and `LOCAL_DEV_USER_EMAIL`. This optional development identity works only on loopback URLs without Sites dispatch headers; never configure these variables on the hosted Site.

Apply each migration once to a fresh local database. Production schema changes are generated through `npm run db:generate` and deployed through Sites. Local state, dependency folders, generated build output and secret files are excluded from Git.

## Preview sessions

The Services panel uses the catalogue and revision returned with workspace state, avoiding a separate initial catalogue request. Service mutations use `/api/agency/services`; `/api/services` remains an API compatibility alias. Failed loads stop the loading indicator. Authentication failures offer a platform sign-in link in a new tab, retain an entered service name, and allow retry after sign-in. A preview forwarding an email without the platform account ID is rejected; it does not inherit owner permissions.

## Screenshot ingestion

In a report, open **Data & insights → Import screenshot**. Upload a clear PNG, JPG or WebP table or KPI-card screenshot (up to 8 MB and 20 megapixels), optionally with the exact previous month’s screenshot. English OCR runs in the browser using bundled Tesseract.js assets and language data; no API key or third-party image service is required. Charts without visible numbers and complex layouts are not reliable extraction sources.

Review every extracted cell beside the original screenshot, correct headings/values, and explicitly confirm the reporting months and units. The next step uses the existing column mapping and aggregation controls. Only approved imports save data. Original screenshots, the reviewed CSV representation, and normalized comparison data are stored in R2; source provenance and approval time are retained on the dataset. Removing the dataset removes its associated source images too.

Previous-month comparisons either use the uploaded baseline or automatically match the same client, service section and dataset name in the exact previous calendar month. Screenshot and CSV datasets share the same normalization and compatibility checks. Keep dataset names, dimension headings, units and aggregations consistent. Missing values and absent baselines are not converted into invented changes. PDF output includes reviewed data and source provenance. Screenshot imports are available for data-only/combined service modes; free-text-only services remain text only.

The build copies only the browser OCR worker, LSTM core, and English model needed at runtime; no CDN is used. Development browser QA verifies actual OCR on two table screenshots, stored originals, automatic previous-report comparisons, an explicit baseline upload, reviewed corrections, cleanup and PDF output. Quantitative accuracy still requires user review of every screenshot.

## Service reporting formats

When adding or editing a service, choose **CSV only**, **Free text only**, or **CSV + free text**. CSV-only sections show import/analysis controls and exclude manual summaries, metrics, images and written dataset commentary. Free-text sections show narrative fields and exclude CSV imports, data tables and images. Combined sections retain both workflows. New and copied reports use the current service default. Existing reports keep their mode snapshot; **Apply current service settings** changes the mode for that report after saving. Stored content is retained when switching modes, and PDF output includes only content supported by the selected mode. Changing a service default does not silently rewrite existing reports or their saved PDFs.

## Agency services

Agency settings → Services manages the shared service catalogue, stored in D1 settings. Existing service names and client assignments are retained on first use. Rename aliases keep historical client assignments linked; existing report headings and content are snapshots and are not rewritten. Archived offerings disappear from new selections but stay on existing clients and reports. Restore them to make them selectable again. Duplicate names, including historical aliases, are rejected, and revision checks prevent concurrent catalogue edits from overwriting each other. Only administrators can change the catalogue; staff can assign active services to clients and add their sections to reports.

Custom services selected on a client are added to new report templates and to copied reports if missing. Use **Add service section** in an existing report to include a newer offering, then save the report. Generic sections support a summary, a three-column metrics table, supporting images, and the existing CSV snapshots/comparisons/insights workflow.

## Internal staff accounts and external invitations

This platform is for internal staff only. There is no client account type or public registration. Unlisted accounts are rejected even if they can open the hosted Site. Existing approved accounts remain available; the verified owner can bootstrap an administrator account. New invitations require an explicit internal-staff confirmation and assign Administrator, Staff, or read-only staff permissions.

In Agency settings, choose whether staff use an account inside or outside the Business workspace. Workspace invitations register the staff account and provide a shareable link. External invitations additionally use the request-scoped Sites connector to inspect and update the hosting allowlist. The connector declaration uses the canonical Sites plugin and connector confirmed eligible for this workspace. Hosted calls use the submitting administrator’s connection, consent, and provider permissions; source-editing credentials are not used or stored in the application.

External grants preserve the existing audience and all current user emails. Other visitors and groups are retained. Only provider-confirmed grants permit external staff to claim an invitation. If hosting access fails or needs reconnection, the pending staff record stays visible with an accurate failure status and a Retry access action. A retry reads the current provider state before deciding whether a write is needed. Uncertain writes are reconciled by reading rather than blindly replayed. No email delivery is claimed because the hosting result does not confirm delivery; administrators can share the app link directly.

Deactivation or cancellation blocks app data first, then attempts hosted revocation. Failed revocations remain visible and can be retried; app access stays blocked throughout. Existing reports and profiles remain saved. Owner and self-demotion safeguards are retained. Staff must use the invited email on first sign-in; subsequent access uses the stable platform identity. Direct Google sign-in is not implemented.

`STAFF_BOOTSTRAP_INVITES` is optional owner-approved runtime onboarding configuration for explicitly authorised staff with an independently verified hosted grant. It is stored as a runtime secret, never in Git or browser code. It inserts missing invitations once and does not reactivate disabled accounts. Normal invitations use the database and Sites connection, not this configuration.

Validation: unit tests use a mocked Sites connector to check grant/revoke reconciliation and failures. Local previews do not have hosted connector write authority and must show an unconfirmed status for external grants. A live external grant for the user-provided test account was confirmed through the native Sites operation. Full acceptance and report creation by that external account require that person to sign in and remain a separate live check.

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

## Platform screenshot and CSV imports

In a report, open **Data & insights → Import screenshot** (or **Import CSV**). Choose the platform, report type and consistent account/page/property identifier. Review OCR labels and values, then confirm metric mappings, currency, percentage scale and reporting months. Original screenshots and reviewed data stay attached to the monthly report and its PDF provenance. Generic manual imports remain available.

Templates recognise common headings and can derive missing CTR, CPC, CPA, CPL and ROAS only when the required numerator and denominator are available. Zero denominators remain unavailable. Unique reach, users and follower totals use snapshot aggregation: conflicting values have no overall total and are flagged rather than summed. Platform engagement rates are preserved as reported; social rates are not inferred using an assumed denominator.

Every platform import stores a template version and definition snapshot. Template changes affect future imports; incompatible metric definitions or units prevent misleading previous-month comparisons. Automatic comparisons require the same dataset name, report section, client, platform, template and account in the exact preceding month. Use one consistent account identifier each month.

Extraction uses browser OCR and requires staff review. Crop to visible tables or metric cards; it does not infer values from chart shapes or retrieve hidden/off-screen data. The templates and real browser OCR flow have been checked with representative fixtures; each platform's live dashboard layouts still need verification against agency exports. AI-written commentary separately requires an OpenAI API connection; without that connection, calculated summaries and manual insights remain available.

## Import accuracy and recovery drafts

New imports store a review version. Uploaded previous-month files have independent number formats, currencies and percentage scales; symbol-free percentages require confirmation. Compatible ratio/percent rates are normalized before comparison; incompatible currencies, definitions and calculations are excluded. The app and PDF show fully comparable, partially comparable or no comparable metrics.

K/k, uppercase M and B/b notation is expanded while the original CSV/screenshot remains intact. Expanded values and dependent calculations are approximate and disclosed in data notes. Lowercase m is ambiguous for counts; correct it to uppercase M for millions or review the value manually. Valid per-post reach/unique snapshots remain importable even when no combined total exists.

Affected legacy rate imports and imports with invalid cells show a source-review warning. Their saved calculations, source files and stored PDFs are preserved. Reimport reviewed source data to confirm both months' units.

Report and commentary recovery drafts are stored in this browser, scoped to the signed-in staff member and report. Drafts do not replace server saves. Refresh/close warnings apply to unsaved edits. A report draft can be restored only against its original revision; otherwise download/copy it and reconcile with the latest report. Storage failures are shown so staff can save manually. Shared computers should use separate browser profiles.

AI connection setup is unchanged by this update.
