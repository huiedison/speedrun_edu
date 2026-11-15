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

## Probe results (step A, 13 Nov 2026)

Run from Claude Code with `node scripts/probe.ts`, every call tagged `source=role-decoder-edison`. Responses were fetched between 10:40 and 10:51 UTC on 13 Nov 2026. Raw list responses are in `fixtures/probe/`, the extracted numbers in `fixtures/probe/summary.json`. Job detail responses contain description text, so they sit in `fixtures/local/`, which is gitignored. Counts drift; the board read 23,466 here against 23,504 at 08:00 UTC the same day.

"Student door" below means `lvl` in (intern, new_grad). "Seed to B" means `stage=seed,series_a,series_b`.

### What the probes say, in short

1. **The early-stage hypothesis holds, but stage is not the main reason.** Board-wide the student door is 9,681 of 23,466 roles (41.3%). At seed to Series B it is 425 of 3,163 (13.4%, with 201 of those roles carrying no level label). Only 4.4% of student roles sit at seed to Series B; 92.2% sit at growth or public companies and 70.5% at companies with 5,000 or more people.
2. **The bigger split is by tier.** 9,211 of the 9,681 student roles (95.1%) are in the `market` tier, where 81.3% of all roles are intern or new grad. In the a16z tier the student door is 465 of 11,924 (3.9%); in the speedrun tier 5 of 211 (2.4%). Inside the portfolio the door is about as narrow at every stage: 86 of 2,754 seed to Series B roles (3.1%) at a16z and speedrun tier companies. The 13.4% early-stage figure is itself held up by market-tier companies (339 of their 409 early-stage roles are student roles).
3. **`fn=strategy` is not BizOps.** 212 roles, of which 167 (78.8%) are intern or new grad, 133 at public companies, 169 in the market tier, and 6 at seed to Series B. It is mostly corporate strategy internships at large companies. Startup BizOps is classified under operations, in the `bizops`, `chief_of_staff` and `founders_office_generalist` specialties.
4. **Sales does not have the widest door.** 337 of 1,656 (20.4%), the lowest share among the candidates, and 3 student roles at seed to Series B. Its early-stage way in is junior (32 roles), not intern. Founding sales (`fn=sales&founding=1`) is 67 roles with 0 student roles.
5. **The API rate-limits bursts.** A burst of about 17 calls at 300 ms spacing produced HTTP 429 (Cloudflare error 1015). At 2.5 s spacing, about 170 calls ran with no 429. The app's client needs spacing and shared caching, not parallel fetches at build time.
6. **`/roles` returns 404.** No roles hub exists at that path. Per-title listing pages return 200 at `/jobs/founding-engineer`, `/jobs/chief-of-staff`, `/jobs/sales`, `/jobs/account-executive`, `/jobs/forward-deployed-engineer` and `/jobs/internships`; `/jobs/bizops`, `/jobs/business-operations`, `/jobs/product-manager` and `/jobs/intern` return 404. Status codes only; page contents were not fetched or parsed.

### Probe 1: per craft

| Craft | Roles | Intern | New grad | Student door | Junior | No level label | Seed to B roles | No stage label | Remote / onsite / hybrid | Bands posted | Founding |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| engineering | 4,795 | 1,341 | 434 | 1,775 (37.0%) | 142 | 66 | 799 (16.7%) | 15 | 424 / 1,221 / 487 | 1,341 | 83 |
| hardware_manufacturing | 3,941 | 1,452 | 226 | 1,678 (42.6%) | 272 | 414 | 598 (15.2%) | 78 | 31 / 860 / 35 | 527 | 9 |
| operations | 2,880 | 1,060 | 126 | 1,186 (41.2%) | 225 | 341 | 305 (10.6%) | 27 | 115 / 477 / 79 | 362 | 14 |
| sales | 1,656 | 256 | 81 | 337 (20.4%) | 274 | 50 | 228 (13.8%) | 33 | 365 / 351 / 221 | 486 | 67 |
| customer | 895 | 92 | 57 | 149 (16.6%) | 94 | 48 | 147 (16.4%) | 6 | 204 / 215 / 153 | 268 | 19 |
| finance | 848 | 380 | 30 | 410 (48.3%) | 105 | 33 | 93 (11.0%) | 15 | 58 / 130 / 56 | 131 | 7 |
| research | 749 | 437 | 46 | 483 (64.5%) | 82 | 29 | 87 (11.6%) | 4 | 32 / 103 / 52 | 64 | 1 |
| marketing | 740 | 334 | 12 | 346 (46.8%) | 18 | 10 | 133 (18.0%) | 28 | 114 / 144 / 88 | 175 | 7 |
| people | 660 | 189 | 19 | 208 (31.5%) | 20 | 22 | 88 (13.3%) | 6 | 61 / 148 / 71 | 176 | 8 |
| other | 534 | 200 | 47 | 247 (46.3%) | 25 | 231 | 31 (5.8%) | 1 | 190 / 21 / 2 | 161 | 1 |
| data | 534 | 317 | 30 | 347 (65.0%) | 33 | 11 | 40 (7.5%) | 12 | 56 / 34 / 39 | 67 | 8 |
| product | 472 | 130 | 26 | 156 (33.1%) | 8 | 3 | 72 (15.3%) | 4 | 71 / 98 / 69 | 175 | 9 |
| legal | 382 | 88 | 2 | 90 (23.6%) | 48 | 12 | 65 (17.0%) | 8 | 51 / 80 / 44 | 111 | 4 |
| business_development | 376 | 118 | 21 | 139 (37.0%) | 5 | 4 | 70 (18.6%) | 0 | 70 / 67 / 43 | 100 | 7 |
| design | 338 | 116 | 16 | 132 (39.1%) | 11 | 5 | 61 (18.0%) | 19 | 32 / 94 / 50 | 114 | 13 |
| strategy | 212 | 142 | 25 | 167 (78.8%) | 4 | 5 | 6 (2.8%) | 4 | 7 / 23 / 13 | 15 | 0 |
| growth | 53 | 11 | 0 | 11 (20.8%) | 0 | 3 | 24 (45.3%) | 0 | 12 / 21 / 5 | 15 | 1 |
| executive | 10 | 0 | 0 | 0 (0.0%) | 0 | 3 | 3 (30.0%) | 0 | 2 / 4 / 2 | 1 | 0 |

Board: 23,466 roles, 3,384 with no craft label, 1,506 with no level label, 286 with no stage label, 4,664 with a posted band, 278 founding. Workplace labels: remote 2,095, onsite 4,541, hybrid 1,642.

Specialty vocabulary (`facets.spec`) for the candidate crafts:

- **strategy:** strategy_ops 54, management_consulting 47, market_research_insights 24, corporate_strategy 13, pricing_strategy 11, other 6, competitive_intelligence 2.
- **operations:** logistics_fulfillment 353, supply_chain 326, procurement_sourcing 258, program_management 224, project_management 153, field_operations 141, marketplace_ops 139, facilities_workplace 128, bizops 73, revops 69, trust_safety_ops 59, operations_leadership 51, other 42, customer_ops 20, finance_ops 17, clinical_ops 16, chief_of_staff 15, launch_expansion_ops 10, founders_office_generalist 8, lab_operations 5, people_ops 2.
- **sales:** account_executive_enterprise 242, sales_engineering 239, sdr_bdr 160, sales_leadership 102, account_executive_smb 101, account_management 98, strategic_accounts 76, government_public_sector_sales 67, account_executive_mid_market 60, solutions_consulting 22, sales_enablement 18, inside_sales 18, sales_ops_deal_desk 17, other 17, customer_expansion 6, partner_sales 3, international_expansion_sales 2.
- **product:** ai_ml_pm 35, platform_api_pm 29, technical_pm 21, fintech_pm 19, core_pm 17, growth_pm 15, product_ops 14, product_leadership 14, enterprise_b2b_pm 13, marketplace_pm 11, data_pm 8, hardware_pm 6, consumer_pm 3, founder_pm 2.

`spec` accepts a comma-separated list within one craft (`fn=operations&spec=bizops,chief_of_staff,founders_office_generalist` returned 96, against 73 + 15 + 8).

### Probe 2: where student roles live (9,681 roles)

| Cut | Values |
| --- | --- |
| Tier | market 9,211 (95.1%), a16z 465 (4.8%), speedrun 5 (0.1%) |
| Stage | public 6,750, growth 2,175, series_a 162, series_b 161, seed 102, nonprofit_gov 75, no stage label 256 |
| Company size | 5000_plus 6,822, 1001_5000 1,110, 201_500 319, 51_200 211, 501_1000 196, 11_50 112, 1_10 32, no size label 879 |
| Top crafts | engineering 1,775, hardware_manufacturing 1,679, operations 1,186, research 483, finance 410, data 347, marketing 346, sales 337; no craft label 1,819 |

Student door by tier, all stages and at seed to Series B:

| Tier | All roles | Student door | Seed to B roles | Student door at seed to B |
| --- | --- | --- | --- | --- |
| market | 11,331 | 9,211 (81.3%) | 409 | 339 (82.9%) |
| a16z | 11,924 | 465 (3.9%) | 2,544 | 81 (3.2%) |
| speedrun | 211 | 5 (2.4%) | 210 | 5 (2.4%) |
| all | 23,466 | 9,681 (41.3%) | 3,163 | 425 (13.4%) |

### Probe 3: student door at seed to Series B, per craft

| Craft | Seed to B roles | Student door | Junior | Tier of the student roles |
| --- | --- | --- | --- | --- |
| engineering | 799 | 159 | 23 | market 133, a16z 23, speedrun 3 |
| operations | 305 | 21 | 18 | market 14, a16z 7 |
| marketing | 133 | 14 | 3 | market 11, speedrun 2, a16z 1 |
| business_development | 70 | 7 | 1 | market 5, a16z 2 |
| product | 72 | 6 | 1 | market 6 |
| design | 61 | 6 | 1 | market 4, a16z 2 |
| sales | 228 | 3 | 32 | a16z 2, market 1 |
| growth | 24 | 3 | 0 | market 2, a16z 1 |
| strategy | 6 | 3 | 0 | market 3 |

All crafts together: 425, of which engineering 159, hardware_manufacturing 107, research 31, operations 21, data 15, marketing 14, and 35 with no craft label. The lists show classifier noise worth knowing about: SkillBridge (military transition) internships, a research foundation tagged as early stage, and roles such as "Value Engineer" and "Sales Development Representative" tagged intern at one company.

### Probe 4: title archetypes (`q`)

`q` is a fuzzy match with synonym expansion, so totals are upper bounds, not title counts.

| Term | Roles | Student door | Student door at seed to B | Bands posted | Lands in |
| --- | --- | --- | --- | --- | --- |
| bizops | 4 | 0 | 0 | 2 | data 2, operations 1, no craft 1 |
| business operations | 199 | 92 | 5 | 43 | operations 76, business_development 30, data 18, finance 15, people 9, no craft 33 |
| strategy and operations | 58 | 23 | 0 | 5 | strategy 19, operations 15, product 3, no craft 13 |
| chief of staff | 10 | 0 | 0 | 6 | operations 10 (none has a level label) |
| founding gtm | 15 | 1 | 1 | 8 | sales 8, people 2, operations 1, marketing 1, no craft 3 |
| founding account executive | 6 | 0 | 0 | 1 | sales 6 |
| forward deployed | 211 | 41 | 7 | 68 | engineering 94, customer 38, product 12, hardware_manufacturing 6, no craft 55 |
| product engineer | 551 | 107 | 14 | 160 | engineering 222, hardware_manufacturing 143, operations 47, customer 31, product 24, no craft 53 |
| growth | 288 | 76 | 6 | 97 | growth 49, marketing 39, sales 34, engineering 33, business_development 22, no craft 65 |

Forward Deployed Engineer has enough postings for a page (211 matches, 64 clean bands). "product engineer" is polluted by hardware product engineering roles and would need a tighter definition.

### Probe 5: posted pay bands after cleaning

Query `comp=1&sort=comp`, paged to the end. `comp=1` already excludes roles with no band and non-annual bands, so "dropped" counts only what the cleaning rule removed afterwards. Every drop here was a non-USD currency; none fell outside 20,000 to 1,000,000.

| Definition | Roles | Returned | Kept | Companies | Dropped | p25 | Median | p75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fn=strategy` | 212 | 15 | 15 | 9 | 0 | 149,500 | 180,000 | 201,250 |
| `fn=strategy&spec=strategy_ops` | 54 | 5 | 5 | 2 | 0 | below floor | | |
| `fn=operations&spec=bizops` | 73 | 12 | 12 | 11 | 0 | below floor | | |
| `fn=operations&spec=bizops,chief_of_staff,founders_office_generalist` | 96 | 27 | 26 | 23 | 1 | 133,125 | 150,613 | 203,625 |
| BizOps composite (the two rows above with strategy_ops) | 150 | 32 | 31 | 24 | 1 | 133,750 | 157,500 | 202,500 |
| `fn=sales` | 1,656 | 486 | 432 | 77 | 54 | 160,000 | 197,500 | 270,000 |
| `fn=sales&founding=1` | 67 | 24 | 18 | 10 | 6 | 208,125 | 237,500 | 318,263 |
| `fn=product` | 472 | 175 | 173 | 66 | 2 | 200,250 | 226,800 | 261,000 |
| `fn=operations` | 2,880 | 362 | 348 | 70 | 14 | 126,375 | 155,000 | 190,200 |
| `fn=design` | 338 | 114 | 111 | 49 | 3 | 181,250 | 202,500 | 226,250 |
| `fn=business_development` | 376 | 100 | 98 | 45 | 2 | 148,750 | 198,000 | 250,000 |
| `q=forward deployed` | 211 | 68 | 64 | 36 | 4 | 170,000 | 200,000 | 242,500 |
| `q=product engineer` | 551 | 160 | 160 | 63 | 0 | 175,000 | 210,478 | 251,125 |
| `q=business operations` | 199 | 43 | 43 | 20 | 0 | 152,006 | 180,500 | 206,250 |

These are probe figures for choosing the flagship. Page numbers will be recomputed live by `lib/stats`.

### Probe 6: descriptions

Sampled newest first after deduping by company and normalised title, at most two postings per company.

| Sample | Postings | Companies | Usable description (500+ chars) | Median length | Has a responsibilities section | `labels.specialty` null |
| --- | --- | --- | --- | --- | --- | --- |
| BizOps, operations part | 18 | 16 | 18 | 6,128 | 18 | 0 |
| BizOps, strategy_ops part | 12 | 9 | 11 | 6,572 | 11 | 0 |
| Sales (`fn=sales`) | 28 | 22 | 28 | 5,647 | 28 | 3 |

One open posting returned a null `description_text`, so "null when closed" is not the only case. The section check is a keyword match and over-counts; in two postings the keyword hit landed in a benefits paragraph.

Trial clustering on the 30 BizOps postings, read by eye: the operations part clusters cleanly around a handful of themes (owning cross-functional projects nobody else owns, building planning and operating cadence, financial and data analysis for decisions, vendor and spend management, working directly with founders or an executive, automating internal work with AI). Two sources of noise:

- `founders_office_generalist` includes executive and administrative assistant roles (3 of the 4 sampled founders-office postings), and the first page of the operations query also lists two "Executive Business Partner" titles. Their duties (calendars, travel, events) would form their own cluster.
- The `strategy_ops` part is mostly large-company internships whose descriptions are campus-programme boilerplate or a different job entirely (one is a medical affairs co-op). TikTok alone has 25 of the first 100 composite postings.

Extraction for a BizOps page should therefore sample from the operations part and from named strategy and operations titles, and report the company spread.

### Probe 7: speedrun scope (`scope=speedrun`)

211 roles. Level: mid 110, senior 50, staff_principal 25, intern 5, lead_manager 3, vp 2, director 1, founder 1, with 14 roles without a level label. Stage: seed 119, series_a 90, series_b 1, 1 without a stage label. Crafts: engineering 101, marketing 15, customer 14, design 13, product 9, sales 6, operations 6, and 20 with no craft label. 53 post a band, 41 are founding roles. Remote 43, onsite 110, hybrid 36.

The student door at speedrun companies is 5 of 211 (2.4%), which is in line with the unverified reading from the product tour screenshot (intern 3 of 208 on 10 Nov). Too thin for stats; usable as a highlighted list.

### Flagship decision rule (PLAN section 5)

Rule: first of BizOps, Sales, Product with at least 100 roles, at least 15 clean annual USD bands, and at least 10 student-door roles board-wide.

| Candidate | Definition | Roles | Clean bands | Student door, board | Student door, seed to B | Junior, seed to B | Passes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BizOps as planned | `fn=strategy` | 212 | 15 | 167 | 3 | 0 | on paper, with no margin on bands, and it is the wrong population |
| BizOps composite | `fn=strategy&spec=strategy_ops` plus `fn=operations&spec=bizops,chief_of_staff,founders_office_generalist` | 150 | 31 | 73 | 5 | 5 board-wide | yes |
| BizOps, operations part only | `fn=operations&spec=bizops,chief_of_staff,founders_office_generalist` | 96 | 26 | 29 | 4 | 5 board-wide | no (96 roles) |
| Sales | `fn=sales` | 1,656 | 432 | 337 | 3 | 32 | yes |
| Founding sales | `fn=sales&founding=1` | 67 | 18 | 0 | 0 | not probed | no |
| Product | `fn=product` | 472 | 173 | 156 | 6 | 1 | yes |

BizOps composite detail: level intern 66, mid 33, senior 18, new_grad 7, junior 5, staff_principal 2, director 2, vp 1, with 16 roles without a level label. Stage public 64, growth 60, series_a 14, seed 7, series_b 4, 1 without a stage label. Tier market 74, a16z 73, speedrun 3. Workplace remote 11, onsite 36, hybrid 9 (56 labeled, 94 not). Its five student roles at seed to Series B: Founders Associate Internship, CEO Office (Lio); Founders Associate Intern (Clera); Strategic Operations Intern (Clera); Business Operations Internship, Summer 2027 (Perpay); GTM Intern, Strategy & Operations (Simular).

The rule picks **BizOps / Strategy & Ops with the composite definition**, pending Edison's confirmation at Checkpoint A. The composite needs two API queries merged (a posting has one craft, so the two parts cannot overlap), which the single-`fn` definition shape in PLAN section 7 does not yet allow.

Thirty sample titles from the composite (operations part first, then strategy_ops), for the spot check:

1. Company Operations Lead, ElevenLabs
2. Executive Assistant, Kaizen Labs
3. Division Operations Senior Associate, Undersea Dominance, Anduril Industries
4. Operations Generalist, TypeSafe
5. Division Operations Lead, Group 3, Anduril Industries
6. Senior Operations Associate, Headway
7. Operations Analyst, Hardware Platform Operations, Anduril Industries
8. Business Operations Analyst (Afternoon Shift), SpotOn
9. Founders Associate Internship, CEO Office, Lio
10. Head of Business Operations, Glimpse
11. Chief of Staff, Lyft Urban Solutions, Lyft
12. Chief of Staff, Office of the President, Ambience Healthcare
13. Executive Assistant to Founders, Exa
14. Strategy & Ops, Ferry Health
15. Chief of Staff, Office of the President, Replit
16. Senior Business Process Engineer, Anduril Industries
17. Business Operations Generalist, Specter
18. Administrative Assistant, Office of the CEO, Hadrian
19. Chief of Staff, Pindrop
20. Director, Business Operations, Hebbia AI
21. Senior Staff, Workplace AI, Shield AI
22. Product Strategy and Operations, Senior Manager, New Verticals, EliseAI
23. Lead, Enterprise Strategy and Operations, Shield AI
24. Commercial Marketplace Strategy and Operations Intern (Summer 2027), Zipline
25. Senior Associate, Payer Strategy & Ops, Headway
26. Summer 2027 Internship: Analyst, Strategy & Operations, QTS
27. Treasury & Payment Solutions Strategy Intern, Summer 2027, Bank of Montreal
28. Medical Affairs Strategy & Execution, Oncology Co-op, Johnson & Johnson
29. Strategy & Planning Analyst Graduate, Marsh
30. Strategy & Operations Internship Summer 2027, Enova
