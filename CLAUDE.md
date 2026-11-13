# CLAUDE.md

speedrun_edu is an unofficial, data-backed library of startup roles for students and new grads, built on the public speedrun talent network API. It is Edison's side project for his application to the speedrun talent team's Product Engineer role. Target: deployed by end of day 14 Nov 2026.

## Read first, in this order

1. `docs/PLAN.md`: scope, page anatomy, thresholds, build sequence, Edison's decisions.
2. `docs/DATA_NOTES.md`: API spec summary, live snapshot, quirks, and the probes to run first.
3. `docs/reference/`: the speedrun product tour PDF (local only, not committed).
4. `docs/DECISIONS.md`: running log. Add to it; never rewrite history.

If these documents disagree with each other or with what the live API returns, stop and tell Edison.

## Principles (non-negotiable)

- **Honest data.** Every number traces to live postings. Every stat shows its sample size and an as-of time. Unlabeled counts are shown. Stats below threshold are suppressed with the reason. Never invent numbers, companies, quotes or URLs.
- **Useful first.** Built for job seekers, not as an ad.
- **People and agents.** Anything a person can see, an agent can fetch as JSON.
- **Respect the source.** Public REST API only. `source=role-decoder-edison` on every call. Cache responsibly. Do not scrape HTML pages. Respect stealth masking. No a16z or speedrun logos. Link to the canonical job `url` returned by the API; never re-host listing text.
- **Student-honest.** Always show how wide the door is for students, even when the answer is zero.

## Hard rules from Edison

- **Name:** speedrun_edu, set in its own wordmark. The word "Unofficial" appears in the header, the footer and on /about. Footer line: "Unofficial. Built on the public speedrun talent network API."
- **Resources:** the resources block on the flagship page ships as a visible TODO. Edison supplies every link. Do not add, suggest or search for resources.
- **Guide prose:** sections Edison will write are marked DRAFT with TODOs. Do not present drafted guide text as finished.
- **No outreach.** Do not draft emails or messages to the speedrun team or anyone else. The project goes through the application form only.
- **No live LLM calls on page load.** The decoder is an alias map plus keyword scoring.

## Stack

Next.js App Router, TypeScript strict, Tailwind, pnpm, Zod, Vitest, ESLint, Prettier. Vercel with hourly incremental regeneration. No database. Light mode only for v1.

The repo already contains `docs/`, `CLAUDE.md`, `SETUP.md`, `README.md`, `.env.example` and `.gitignore`. Scaffold Next.js around them without overwriting. If `create-next-app` refuses a non-empty directory, scaffold into a temporary folder and move the files in, then merge `.gitignore`.

## Commands

Fill these in once the scaffold exists, and keep them current:

- `pnpm dev`: local server
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`: Vitest
- `pnpm build`
- `pnpm probe`: runs `scripts/probe.ts` and writes to `fixtures/`
- `pnpm extract <slug>`: runs `scripts/extract-responsibilities.ts`

Run typecheck, lint and test before every commit.

## Structure

- `app/`: `/` (roles index), `/roles/[slug]`, `/decode`, `/about`, `/api/roles`, `/api/roles/[slug]`
- `lib/speedrun/`: typed client, Zod schemas with string normalisation, source tag, one retry, caching. Server-side fetch only.
- `lib/stats/`: pure aggregation, cleaning, thresholds, dedupe. Fully unit tested against fixtures.
- `lib/decode/`: alias map and keyword scorer. Pure and tested.
- `content/roles/<slug>/`: `meta.json` (query definition, review status), `extracted.json`, `guide.mdx`
- `scripts/`: `probe.ts`, `extract-responsibilities.ts`, `snapshot-fixtures.ts`
- `fixtures/`: small real API snapshots
- `docs/`: plan, data notes, decisions

## Data rules

The full methodology is in PLAN.md section 7. The ones most often broken:

- Compute everything from `/jobs`. Do not mix in `/stats/hiring` numbers.
- Student door means `lvl` in (intern, new_grad). Junior is reported separately.
- Pay bands: USD, annual, midpoint, outliers dropped and counted, shown at n of 15 or more.
- Shares always state their denominator and the unlabeled count.
- A Zod parse failure renders a visible "data unavailable" state. Never fall back silently to a fixture or a hard-coded number in production.
- Match the salary page's conventions where they exist (DATA_NOTES section 8), so this reads as an extension of it.

## Extraction

If `ANTHROPIC_API_KEY` is set in `.env.local`, use the Anthropic TypeScript SDK script, choose a current model from docs.claude.com, and log the cost and quality tradeoff in DECISIONS.md. If no key is set, do the clustering in this session from the saved fixtures and log that choice instead. Either way: every item cites the job ids it came from and a frequency ("appears in X of N sampled postings"), items are paraphrased clusters and never quoted description text, and output stays `needs_review` in `meta.json` until Edison approves it.

## Working agreements

- Two checkpoints only. **A:** after the probes, before any app code, with the flagship recommendation. **B:** a deployed preview link. Otherwise state assumptions and proceed; ask only when blocked.
- Small commits with clear messages. No new dependency without a reason logged in DECISIONS.md.
- Never commit secrets, `.env.local`, or anything in `docs/reference/`.
- If an API call fails or data looks wrong, say so plainly. Do not work around it quietly.
- If time runs short, cut in this order: data-only pages for other crafts, JSON routes, CI, decoder polish. Never cut the honesty rules or the unofficial notice.

## Adding a role

1. Create `content/roles/<slug>/meta.json` with `{ name, definition: { fn, spec?, q?, founding? }, review: "needs_review" }`.
2. Run `pnpm probe` and confirm the definition returns the roles you expect by spot-checking 30 titles.
3. Run `pnpm extract <slug>`, then have Edison review `extracted.json`.
4. Add `guide.mdx` with DRAFT markers. Edison writes it.
5. Set `review` to `approved` only when Edison says so. Unapproved roles render as data-only pages.
