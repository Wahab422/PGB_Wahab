# Agent prompt: build the `sync-courses-a-z` daily cron script

Hand this prompt to an implementation agent. It is self-contained — the agent does not need to see the prior conversation.

---

## Goal

Write a TypeScript script, `scripts/sync-courses-a-z.ts`, that runs **once per day** and fully syncs the **Courses A-Z** CMS collection on the Webflow site `SCL` with the live UT Austin catalog subject directory.

The strategy is **clear → fetch → populate in source order** (simple, idempotent, no diffing).

## Source

- Index page: `https://catalog.utexas.edu/general-information/coursesatoz/`
- Each entry on the index is one subject: a display name (e.g., "Comparative Literature") and a relative URL ending in a subject-code slug (e.g., `/general-information/coursesatoz/c-l/`).
- The slug uses lowercase letters with hyphens between code parts: `acc`, `adv`, `a-i`, `c-l`, etc.
- The index lists **~200+** subjects in canonical display order — preserve that order in the `Sort Order` field (1-based).
- Scrape with `cheerio` (or equivalent). Do **not** rely on the page exposing a JSON endpoint.

## Webflow target

All IDs and field metadata live in `scripts/courses-a-z.schema.json` — load that file at startup, do not hardcode IDs in the script.

- Site ID: `6a155cbbc9c28f25a9dcaf1e`
- Collection ID: `6a2960199bd2c50bb20fd020`
- Collection slug: `courses-a-z`

### Field mapping (collection field slug → source value)

| Field slug        | Type             | Value                                                                                                                                                                                                                                          |
| ----------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`            | PlainText        | Subject display name from the catalog (e.g., `Comparative Literature`)                                                                                                                                                                         |
| `slug`            | PlainText        | UT's own URL subject code (e.g., `c-l`, `acc`, `a-i`) — **must be unique per item**; the sync uses it as the natural key                                                                                                                       |
| `starting-letter` | Option           | First letter of `name`, uppercased (`A`–`Z`). The collection field is an Option; pass the option **name** (Webflow's API accepts either name or option ID for option fields — verify against current docs and prefer whichever is more stable) |
| `sort-order`      | Number (integer) | 1-based index of the item in the source order                                                                                                                                                                                                  |
| `external-link`   | Link             | Absolute URL (`https://catalog.utexas.edu` + the relative path), with trailing slash preserved                                                                                                                                                 |

## Algorithm

1. **Load schema** from `scripts/courses-a-z.schema.json`. Validate that the script's hardcoded expectations (field slugs `name`, `slug`, `starting-letter`, `sort-order`, `external-link`) all exist; fail fast with a clear error if not.
2. **Fetch + parse** the index page. Extract `{ name, slug, externalLink }` for every subject, in document order. Validate non-empty.
3. **Wipe** the existing collection:
   - List all items (`GET /collections/{id}/items` with pagination — default page size 100; loop until empty).
   - Delete them in batches via `DELETE /collections/{id}/items` (bulk endpoint accepts up to 100 IDs).
   - Verify the collection is empty before continuing.
4. **Create** the new items in source order. Use bulk create (`POST /collections/{id}/items` accepts up to 100 items per call) — chunk to 100. Assign `sort-order = index + 1` in the chunked loop so numbering is global, not per-chunk.
5. **Publish** all newly created items: `POST /collections/{id}/items/publish` with the full ID list (chunk to 100).
6. Log a summary: source count, deleted count, created count, published count, total wall time.

### Idempotency / failure handling

- The job is destructive-then-rebuild. If step 3 succeeds and step 4 fails, the collection is empty until the next run — that's acceptable for a daily job. Do **not** add partial-rollback complexity.
- Treat any HTTP non-2xx as a hard fail; do not silently skip items.
- Respect Webflow rate limits: 60 req/min on the Data API. Add a small inter-batch sleep if needed (e.g., 1.1s between bulk calls is plenty).

## Wiring + auth

- Use the **Webflow Data API** directly (REST) or the `webflow-api` npm SDK — whichever the rest of `scripts/` already uses; check `package.json` / existing scripts in `scripts/` first.
- Auth token: read `WEBFLOW_API_TOKEN` from env. Fail fast with a clear message if unset.
- Add a `cms:sync-courses` npm script in `package.json` that runs `tsx scripts/sync-courses-a-z.ts` (or whatever runner pattern matches existing scripts).

## Cron / scheduling

The script itself is a one-shot. Pick the scheduling host that fits the project (check the repo for existing patterns first):

- **Vercel Cron** — `vercel.json` already exists; this is the most likely fit. Add a cron entry hitting an API route that invokes the same sync logic, OR run the script directly via a Vercel Cron job if supported.
- **GitHub Actions** — fallback if Vercel Cron isn't viable (no API route surface).
- Schedule: daily at a low-traffic hour in `Asia/Karachi` (the site's timezone — see schema JSON for confirmation) or UTC equivalent.

Document the chosen scheduling approach in a short README comment at the top of the script.

## Deliverables

- `scripts/sync-courses-a-z.ts` — the sync script.
- Updated `package.json` with the `cms:sync-courses` script.
- Updated `vercel.json` (or `.github/workflows/<name>.yml`) with the cron entry.
- A 5-line `README` block at the top of `sync-courses-a-z.ts` covering: what it does, how to run locally, env vars required, schedule.

## Out of scope

- Do **not** touch the schema file (`scripts/courses-a-z.schema.json`) — it is the source of truth, only re-generate it if the Webflow collection schema actually changes.
- Do **not** add a UI, dashboard, or webhook; daily cron only.
- Do **not** add fuzzy matching, diff-based updates, or upserts — clear + rebuild is intentional.

## Verification checklist before declaring done

- [ ] Local dry-run with `--dry-run` flag prints the parsed source list (count + first 5 + last 5) without touching Webflow.
- [ ] Live run on a fresh empty collection populates ~200 items with correct `sort-order`, `starting-letter`, and `external-link`.
- [ ] Re-running the script produces the same final state (idempotent).
- [ ] Cron entry committed and a manual trigger of the cron job (via Vercel/GH UI) succeeds end-to-end.
