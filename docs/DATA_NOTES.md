# DATA_NOTES.md

Snapshot taken 13 Nov 2026 (about 08:00 UTC) from the public speedrun talent network API, v1.5.0. Every number below came from a live response on that date. Counts drift by the minute, so treat them as a snapshot and re-run before quoting any of them.

## 0. What this covers and what it does not

Done in chat: the full OpenAPI spec, `/stats/hiring`, one unfiltered `/jobs` page with board-wide facets, and a read of the live site and developer docs.

Not done in chat: anything needing a filtered query or a job detail call. The chat fetcher dropped query strings and refused `/jobs/{id}`, so there are no per-function cross-tabs, no specialty vocabulary, and no job descriptions here. Section 7 lists the exact probes to run first in Claude Code. Until they run, anything per-function in PLAN.md is a hypothesis.

## 1. Basics

- Base: `https://speedrun-talent-network.com/api/v1`
- Read-only, no auth, open CORS, JSON, edge-cached 1 to 5 minutes.
- Spec: `/api/v1/openapi.json` (OpenAPI 3.1). The docs call it complete and accurate to the implementation.
- Errors: `{"error":{"code","message"}}` with a matching status (400, 404, 500, and 503 on stats).
- `source`: optional on every endpoint, max 64 chars, pattern `^[a-zA-Z0-9._:-]+$`, echoed back. On `/jobs` it also stamps `utm_source=<source>&utm_medium=agent` onto each job `url`, so outbound clicks from this app are attributable on speedrun's side with no extra work.
- Fair use (from /developers): identify yourself with `source`, link to the canonical `url` fields rather than re-hosting listings, expect a few minutes of cache lag, heavy anonymous scraping gets rate-limited. Stealth companies are masked in the query layer and cannot be unmasked.
- The developer page lists a contact address for people building on the API. Edison has decided on no outreach; do not use it.

## 2. Endpoints

| Endpoint | Returns | Paging |
| --- | --- | --- |
| `GET /jobs` | `jobs[]`, `total`, `page`, `page_size` (50), `total_pages`, `has_more`, `next_page`, `facets`, `scope`, `beyond_portfolio`, `source` | 0-based, 50 per page, pages 0 to 200 only |
| `GET /jobs/{id}` | `job` (JobDetail). Accepts UUID, first 8 hex chars, or canonical slug. Closed roles return 200 with `status:"closed"`; unknown ids 404 | none |
| `GET /companies` | `companies[]`, `total`, paging fields | 100 per page |
| `GET /companies/{slug}` | company plus its live `jobs[]` | none |
| `GET /collections` | `collections[]`, `total` | none |
| `GET /collections/{slug}` | collection plus ranked `members[]` | 100 per page |
| `GET /stats/hiring` | board aggregates (see section 5) | none |

Paging ceiling: 201 pages of 50 means at most 10,050 rows per query. The board holds about 23,500, so always filter (by `fn` at least) before paging. The largest craft, engineering at 4,809, fits.

## 3. `/jobs` parameters

| Param | Values | Notes |
| --- | --- | --- |
| `q` | free text, max 120 | title, company, location; synonyms expand |
| `fn` | engineering, research, product, design, sales, marketing, operations, other, data, growth, customer, finance, legal, people, business_development, strategy, executive, hardware_manufacturing | comma-separated. Read `facets.fn` for the live set |
| `spec` | specialty slugs | only meaningful with exactly one `fn`. Vocabulary lives in `facets.spec` under that craft. Not yet probed |
| `sen` | founding, exec, staff, senior, junior, intern, `_` | legacy ladder, remapped onto `lvl` server-side |
| `lvl` | intern, new_grad, junior, mid, senior, staff_principal, lead_manager, director, vp, c_level, founder, `_` | classified ladder. `_` selects unlabeled |
| `yoe` | 0, under_1, 1_2, 3_5, 6_9, 10_14, 15_plus, `_` | minimum experience band |
| `eng` | full_time, part_time, contract, internship, cofounder, advisor, `_` | classified engagement |
| `emp` | FullTime, PartTime, Intern, Contract, Temporary | raw ATS field |
| `founding` | 1 | classified founding roles only |
| `ai` | 1 | classified AI-native roles only |
| `loc` | city values, or `remote` | see `facets.loc` |
| `remote` | 1 | alias of `wp=remote` |
| `wp` | remote, hybrid, onsite | OR within the group |
| `metro` | sf, nyc, la, sv, dc, chi, sea, bos, aus, lon, oc, dal, atl, tor, sd | max 5 |
| `comp` | integer USD | keeps roles whose posted annual band reaches this (`comp_max >= comp`). Non-annual bands never match |
| `comp_max` | integer USD | keeps roles whose annual band starts at or below this |
| `comp_any` | 1 | with `comp`/`comp_max`, also keep roles with no posted comp |
| `posted` | 24h, 7d, 30d | |
| `stage` | live vocabulary in `facets.stage` | observed: growth, public, series_a, series_b, seed, nonprofit_gov |
| `size` | 1_10, 11_50, 51_200, 201_500, 501_1000, 1001_5000, 5000_plus | |
| `industry` | LinkedIn industry slugs | top 24 in `facets.industry` |
| `lab` | 1 | frontier AI labs |
| `bigtech` | 1 | big tech |
| `portfolio` | speedrun, a16z, market | relationship tier |
| `cohort` | e.g. SR007 | |
| `company` | exact company key | |
| `stealth` | only, hide | |
| `scope` | speedrun, portfolio (default), everywhere | |
| `sort` | rel, new, comp | |
| `page` | 0 to 200 | |
| `source` | attribution tag | pass on every call |

Facet behaviour that matters: each facet group is computed against the query but excludes its own filter. So with `lvl=intern` applied, `facets.lvl` still lists every level; read `total` for the filtered count and use the other facet groups for cross-breakdowns. One call with `fn=X` therefore returns level mix, stage mix, workplace mix, specialty list and comp availability for that craft.

## 4. Response shapes

**Job (list item):** `id`, `title`, `company` ("Stealth" when masked), `company_slug`, `company_url`, `url` (canonical, link users here), `location`, `workplace_type`, `employment_type`, `function`, `seniority` (legacy ladder), `remote` (bool), `comp_min`, `comp_max`, `comp_currency`, `comp_period` (year, hour, month, week, day, or null meaning annual), `published_at`, `stealth`, `cohort`, `tier` (speedrun, a16z, market, universe).

List items do not carry `lvl`, `spec`, `yoe`, `eng` or company stage. Those are reachable only as filters and facets, or through `labels` on the detail endpoint.

**JobDetail:** the Job fields plus `status` (open, closed), `comp_summary`, `apply {kind: onsite|external, url}`, `description_text` (plain text, capped at 15,000 chars, null when closed), and `labels {function, specialty, seniority, min_experience, workplace, engagement, founding_role, ai_native_role}` as display strings, any of which can be null.

**Company:** `slug`, `name`, `url`, `tier`, `cohort`, `open_roles`, `location`, `industries[]`, `blurb`, `logo`, and on detail `labels {stage, size, business_model, industry, frontier_lab, big_tech, ai_native, hardware}`.

**Collection:** `slug`, `title`, `description`, `group` (pinned, industries, hubs, investors, signals), `url`, `companies`, `roles`, `portfolio_members`.

**Facets:** arrays of `{v, n}` for `fn`, `sen`, `emp`, `cohort`, `portfolio`, `loc`, `workplace`, `metro`, `stage`, `spec`, `lvl`, `yoe`, `eng`, `size`, `industry`; integers for `fnUnspecified`, `lvlUnspecified`, `senUnspecified`, `yoeUnspecified`, `engUnspecified`, `stageUnspecified`, `sizeUnspecified`, `industryUnspecified`, `founding`, `foundingUnspecified`, `aiRole`, `aiUnspecified`, `frontierLab`, `bigTech`, `compAvailable`, `compHidden`, `stealth`, `named`; and `posted {24h, 7d, 30d}`.

## 5. Board snapshot (default scope, 13 Nov 2026)

Total: **23,504** open roles. Beyond-portfolio universe: 36,697 more.

**By tier:** a16z 11,956 (50.9%), market 11,338 (48.2%), speedrun 210 (0.9%). The spec describes `market` as wider-market early-career organisations, not portfolio companies.

**By company stage:** growth 11,403, public 8,502, series_a 1,588, series_b 815, seed 759, nonprofit_gov 151, unlabeled 286. Seed through Series B is 3,162 roles, 13.5% of the board. Growth plus public is 84.7%.

**By craft (`facets.fn`):**

| Craft | Roles | Craft | Roles |
| --- | --- | --- | --- |
| engineering | 4,809 | data | 536 |
| hardware_manufacturing | 3,942 | product | 471 |
| operations | 2,879 | legal | 382 |
| sales | 1,670 | business_development | 376 |
| customer | 895 | design | 337 |
| finance | 849 | strategy | 212 |
| research | 751 | growth | 54 |
| marketing | 744 | executive | 10 |
| people | 659 | unlabeled | 3,391 |
| other | 537 | | |

Labeled crafts sum to 20,113; with 3,391 unlabeled (14.4%) that reconciles to 23,504.

**By level (`facets.lvl`):** intern 8,263, mid 4,689, senior 3,255, junior 1,740, new_grad 1,424, staff_principal 1,134, lead_manager 780, director 449, vp 250, c_level 10, founder 2, unlabeled 1,508 (6.4%). Reconciles to 23,504.

**Experience (`facets.yoe`):** 0 years 8,808, under_1 215, 1_2 1,582, 3_5 4,491, 6_9 2,344, 10_14 828, 15_plus 86, unlabeled 5,150 (21.9%).

**Engagement (`facets.eng`):** full_time 14,760, internship 7,558, contract 165, part_time 116, cofounder 1, unlabeled 904.

**Workplace:** remote 2,099, onsite 4,562, hybrid 1,648. Only 8,309 roles carry a workplace label.

**Comp:** 4,664 roles post a band (19.8%). **Founding roles:** 279 classified, 280 unlabeled. **AI-native:** 1,834. **Stealth:** 1. **Posted:** 222 in 24h, 2,260 in 7d, 8,409 in 30d.

### `/stats/hiring` (same date)

`live_jobs` 18,276, `hiring_companies` 800, `remote_jobs` 2,037, `comp_posted` 3,550. Portfolio split: a16z 10,394, wider market 7,729, speedrun 153.

Posted pay-band midpoints, annual USD, functions with at least 15 bands:

| Function | n | p25 | Median | p75 |
| --- | --- | --- | --- | --- |
| research | 75 | 178,750 | 225,000 | 274,500 |
| product | 138 | 197,500 | 222,100 | 257,500 |
| engineering | 1,555 | 165,000 | 200,000 | 240,000 |
| design | 151 | 158,938 | 192,500 | 227,500 |
| other | 502 | 114,681 | 187,500 | 211,875 |
| sales | 413 | 141,000 | 187,500 | 240,507 |
| marketing | 173 | 150,000 | 170,000 | 200,000 |
| operations | 543 | 120,000 | 155,000 | 195,000 |

## 6. Quirks and traps

1. **Two endpoints, two universes.** `/stats/hiring` reports 18,276 live jobs on the legacy eight functions (with `other` at 5,009). `/jobs` reports 23,504 on eighteen crafts. Cause unknown. Never put a `/stats/hiring` number next to a `/jobs` number on the same page. Compute everything from `/jobs`.
2. **The student door looks wide at board level, and the reason matters.** Intern plus new_grad is 9,687 roles, 41.2% of the board. But 48% of the board is the `market` tier of early-career organisations and 85% of roles sit at growth or public companies. Where the student roles sit by stage and tier is the most important thing still unmeasured.
3. **Four "intern" numbers that disagree.** `lvl=intern` 8,263, `sen=intern` 8,259, `eng=internship` 7,558, `emp=Intern` 1,662. Also `sen=junior` is 3,569 while `lvl` junior plus new_grad is 3,164, despite the spec saying one maps to the other. Pick one definition and print it: student door means `lvl` in (intern, new_grad), with junior reported separately.
4. **Remote share depends entirely on the denominator.** 2,099 remote out of all 23,504 roles is 8.9%. Out of the 8,309 with a workplace label it is 25.3%. Always show which, and show the unlabeled count.
5. **Comp needs cleaning.** Seen on one page: a Mexico-based role with a 1,167,000 to 1,400,000 band tagged USD (almost certainly a currency mislabel), PLN annual bands with a null period, a PLN monthly band, a band where min equals max. Rule: USD only, annual only (`comp_period` null or `year`), midpoint of min and max, drop midpoints outside 20,000 to 1,000,000, and report how many were dropped. Intern pay is usually hourly or monthly, so intern bands will mostly fall out of annual stats; say so on the page.
6. **Only a fifth of roles post pay.** For a 212-role craft that leaves roughly 40 bands before cleaning. Sub-cuts (by stage, by level) will often fall below threshold.
7. **Near-duplicate postings.** The same title repeated per region (several Kong account executive listings, several SpotOn territory reps on one page). This inflates counts and would dominate an extraction sample. Dedupe by company plus normalised title for extraction, and show "N postings across M companies".
8. **Classifier noise.** "Legal Engineer, Madrid" is filed under sales; "Developer Educator" and several others have no craft. 14.4% of roles have no craft label at all.
9. **Inconsistent strings.** `workplace_type` appears as OnSite, Onsite, Hybrid, Remote and null. `published_at` mixes `+00:00`, `Z` and `-05:00` offsets. Normalise in the Zod layer.
10. **Cache drift.** Minutes apart, the homepage showed 23,478 roles while the API returned 23,504, and one posting showed different titles on the two surfaces. Every stat needs its own as-of time.
11. **Roles are not functions.** BizOps, Founding GTM, Forward Deployed Engineer and Product Engineer are title archetypes that cut across crafts. The API offers `fn`, `spec`, `founding=1` and free-text `q`. A role page therefore needs an explicit query definition (see PLAN.md).

## 7. Probes to run first in Claude Code (about 30 to 45 minutes)

Set `BASE=https://speedrun-talent-network.com/api/v1` and `SRC=role-decoder-edison`. Save raw responses under `fixtures/` as you go.

1. **Per craft, 18 calls.** `GET /jobs?fn={fn}&source=$SRC`. Record `total`, `facets.lvl`, `lvlUnspecified`, `facets.stage`, `stageUnspecified`, `facets.workplace`, `facets.spec`, `compAvailable`, `founding`.
2. **Where student roles live, 1 call.** `GET /jobs?lvl=intern,new_grad&source=$SRC`. Record `facets.portfolio`, `facets.stage`, `facets.fn`, `facets.size`. This settles quirk 2.
3. **Early-stage student door per craft.** `GET /jobs?fn={fn}&lvl=intern,new_grad&stage=seed,series_a,series_b&source=$SRC`. Record `total` and the list. Run for strategy, operations, sales, business_development, product, design, growth, marketing, engineering.
4. **Title archetypes.** `GET /jobs?q={term}&source=$SRC` for: bizops, "business operations", "strategy and operations", "chief of staff", "founding gtm", "founding account executive", "forward deployed", "product engineer", "growth". Record `total` and `facets.fn` to see which crafts each title lands in.
5. **Comp per candidate craft.** `GET /jobs?fn={fn}&comp=1&sort=comp&source=$SRC`, page until `has_more` is false, apply the cleaning rule in quirk 5, report n kept, n dropped and the median.
6. **Descriptions.** For the top two candidates, take 25 to 30 ids after dedupe (quirk 7), call `GET /jobs/{id}`, and judge: share with a usable `description_text`, typical length, share with a recognisable responsibilities section, and how many `labels.specialty` values are null. Then run a trial clustering on one craft and eyeball the noise.
7. **speedrun-only board.** `GET /jobs?scope=speedrun&source=$SRC`. With about 210 roles it is too thin for stats but may make a good highlighted list.

Report results as a table appended to this file, then apply the flagship decision rule in PLAN.md.

## 8. Live site check

- The top nav reads Roles, Collections, Join the Network. "Roles" links to the site root, which is the jobs board itself. No role explainer or roles hub was visible from the homepage or the developer docs.
- Footer links: Network stats (`/network`), a16z portfolio jobs, Layoff tracker, Developers, State of Talent 2026 survey.
- Collections include New This Week, Founding Roles (89 founding roles shown), Frontier AI Labs, and city hubs.
- An MCP server already exists with ten tools, including `search_jobs`, `get_job`, `get_hiring_stats`, `join_network` and `express_interest`. A second generic MCP server from us would duplicate it; only a guide-specific tool would add anything.
- Also machine-readable on their side: `/llms.txt`, `/jobs.md`, `/jobs.rss`.
- **Salary page, verified 13 Nov 2026** (`/founding-engineer-salary`). Its "All roles" breadcrumb links to `/jobs`, the board, so it does not imply a roles hub. Conventions worth matching:
  - The role is defined by title ("founding-titled roles"), not by a craft filter: 82 open roles at 58 companies, 34 with a posted annual band.
  - Four stat cards: median posted salary, typical posted band, open roles, share open to remote.
  - "Typical band" is the median floor to the median ceiling. The p25, median and p75 are of band midpoints. Both are shown, and they are different numbers.
  - Numbered sections in the form "01 · The role", a histogram of band midpoints with a table fallback, a filterable list of the real roles, a data-backed FAQ, and a closing methodology paragraph.
  - Methodology: USD-normalised bands, midpoint is the average of floor and ceiling, and roles with no band, non-annual periods or implausible bands are listed but excluded from the math, with the excluded count stated.
  - A companion listing page exists at `/jobs/founding-engineer`, and `/jobs?sen=founding` is used as the "every founding seat" link. Check whether similar per-title listing pages exist for the flagship before building the exit.
- The product tour PDF was not readable from the planning chat. Read `docs/reference/` before step A and note anything that changes this file.
- The Product Engineer posting asks applicants to see what the team has built, share one idea with a link, and say who they are. It states the team builds tools that are useful to job seekers rather than ads, which matches this project's "useful first" principle.
