# PLAN.md: speedrun_edu, one-day build

Written 13 Nov 2026, updated the same day with Edison's answers. Target: a deployed link by end of day 14 Nov, about 10 focused hours. Priorities, in your order: one excellent role page, the decoder, design polish, the live data layer, then user testing and pitch.

Read DATA_NOTES.md alongside this. Section 7 there lists probes that could not run in chat; anything per-function below is a hypothesis until they do.

## 1. What discovery changed

**The original brief does not fit in a day.** Five phases, four flagship pages, an MCP server, dark mode, share images, Playwright and 5 to 8 user tests is one to two weeks of work. This plan keeps the idea and cuts the breadth.

**"The door is narrow" is not true of the board as a whole, and that is the more interesting story.** 41% of open roles are classified intern or new grad (9,687 of 23,504). But about half the board is a wider-market tier of early-career organisations, and 85% of roles sit at growth-stage or public companies. Seed through Series B is 13.5% of the board. The likely truth is that the door is wide at large companies and narrow at actual startups, which is exactly what a student curious about startups needs to see. That is a hypothesis until probe 2 and probe 3 run. If it holds, the headline stat on every role page becomes the student door at seed to Series B, shown next to the board-wide figure.

**Roles are not functions.** The API classifies 18 crafts. BizOps, Founding GTM and Forward Deployed Engineer are title archetypes that cut across them. Each role page needs an explicit, published query definition rather than a bare `fn` value.

**There is no roles hub on the live site.** The nav item "Roles" and the salary page's "All roles" breadcrumb both point at the jobs board. The Founding Engineer Salary page is the only role explainer found, and an MCP server already exists. So role explainers for other titles are open ground, and a generic MCP server would be a duplicate. See DATA_NOTES section 8 for what the salary page does, since this app should match its conventions.

**Honest data stays.** The live data layer was ranked fourth, but the brief calls honest data non-negotiable. This plan keeps every honesty rule (they are cheap) and cuts data breadth (charts, sub-cuts, extra stats).

## 2. Problem and users

Students and new grads who want startup work cannot tell what a title means, because the same title covers different jobs at different companies, and nothing tells them plainly how many of those jobs are open to them.

- **Primary:** students and new grads curious about startups.
- **Secondary:** first-time founders hiring a function for the first time. Deferred beyond v1.

## 3. Jobs to be done

1. "I saw this title. What is it, in two minutes?"
2. "Is there a real way in for someone like me, and where?"
3. "Show me actual openings I could apply to now."
4. "I have a posting in front of me. Which role is this really?" (the decoder)

## 4. Scope for v1

**In:**

- One flagship role page with all four layers, written and reviewed.
- Data-only pages for every other craft, rendered from the same template (live numbers and the exit, with a clear "guide not written yet" note). This satisfies "the template renders any function from data" at almost no cost.
- `/` as the roles index: one card per craft with open roles and student door.
- `/decode`: alias map plus keyword scoring, no LLM.
- `/about`: methodology, thresholds, role definitions, unofficial notice, who built it.
- `/api/roles` and `/api/roles/[slug]`: the same object the page renders, as JSON.
- One design pass, mobile-first, light mode.
- Typecheck, lint and unit tests for `lib/stats` in CI.

**Out (explicit non-goals for the day):** second through fourth flagship guides, MCP server, LLM decoder fallback, dark mode, per-role share images, Playwright, Lighthouse tuning beyond obvious fixes, the founder section, analytics beyond Vercel's built-in, and the 5 to 8 person user study.

**On testing:** the pitch brief asks for one number from testing. There will not be one in a day. Use a live number from the data instead, and say plainly that it is untested with users. If you can get two or three classmates to try it for five minutes each before you send it, report that as what it is.

## 5. Flagship recommendation

Scoring needs probe results. What can be said now:

| Candidate | Query basis | Roles | Posted bands (legacy stats) | Confusion for students | Student door |
| --- | --- | --- | --- | --- | --- |
| BizOps / Strategy & Ops | `fn=strategy`, plus title terms inside operations | 212 in strategy | not broken out | very high | unknown |
| Founding GTM / Sales | `fn=sales`, `founding=1` cut | 1,670 | 413 | high (SDR, AE, founding GTM) | unknown, likely widest |
| Product | `fn=product` | 471 | 138 | high (PM, APM, product engineer) | unknown, likely narrow |
| Forward Deployed Engineer | `q` title match | unknown | unknown | very high, and current | unknown |
| Design | `fn=design` | 337 | 151 | low | unknown |
| Operations | `fn=operations` | 2,879 | 543 | medium, but very mixed (warehouse to program management) | unknown |

Recommendations:

- **Drop Design from the flagship set.** It is the least confusing of your four and adds the least. Replace it with Forward Deployed Engineer if the title probe finds enough postings.
- **Build one flagship today.** My pick is BizOps / Strategy & Ops: highest confusion, and the one where your own experience (two startups, a search fund, banking) makes the human guide credible. Founding GTM / Sales is the fallback because it almost certainly has the most data and the widest door.
- **Decision rule, applied after the probes:** take the first of BizOps, Sales, Product that has at least 100 roles in its definition, at least 15 clean annual USD bands, and at least 10 student-door roles board-wide. If BizOps fails only on the student door, still consider it; a very narrow door is a legitimate finding, but then the exit must lean on junior roles and Join the Network.

## 6. Page anatomy (flagship)

1. **Header.** Role name, one-sentence plain definition, as-of time, the query definition behind the page in small type.
2. **Live numbers.** Four cards: open roles (postings across companies), student door (seed to Series B, with the board-wide figure beside it), median posted band with n, remote share with its denominator. Each card shows n, as-of, and unlabeled count. Below: a one-line stage mix.
3. **The student door list.** Up to 20 intern and new-grad roles, newest first, each linking to the canonical speedrun URL. If the count is zero, say so and show junior roles instead, labeled as such.
4. **What this role actually does.** 6 to 8 responsibilities and 5 to 6 skills, each with "appears in X of N sampled postings" and links to the source postings. Paraphrased clusters only; no reproduced description text.
5. **The guide.** Edison's writing: a week in the role, how it changes from seed to Series B, how students get in. The resources block ships as a visible TODO until Edison supplies his own links. Nobody else adds resources, including Claude Code.
6. **The exit.** Board link filtered to this craft and level, and Join the Network.
7. **Footer.** "Unofficial. Built on the public speedrun talent network API."

Data-only pages show sections 1, 2, 3, 6 and 7.

## 7. Data methodology and thresholds

- **Single source.** Everything is computed from `/jobs`. `/stats/hiring` is not used on pages because its totals and taxonomy differ (DATA_NOTES quirk 1).
- **Scope.** The board default (`portfolio`). The early-stage cut is `stage=seed,series_a,series_b`.
- **Role definition.** Each role has a `meta.json` with `{fn, spec?, q?, founding?}`. The definition is printed on the page and returned in the JSON.
- **Student door.** `lvl` in (intern, new_grad). Junior is shown separately. Always displayed as a count, never suppressed; zero is a finding.
- **Pay band.** USD, annual (`comp_period` null or `year`), midpoint of min and max, midpoints outside 20,000 to 1,000,000 dropped and counted. Median and p25 to p75 shown at n of 15 or more, the same floor speedrun uses in its own stats endpoint. Below that: "Not enough posted bands to report (n = X, minimum 15)."
- **Shares (remote, stage mix).** Shown only when at least 30 roles carry the label. The denominator is labeled roles, and the unlabeled count sits next to it.
- **Extraction.** At least 20 postings from at least 10 companies after deduping by company and normalised title. An item is shown only if it appears in at least 3 postings from at least 3 companies. Output stays `needs_review` until you approve it. Run once, offline; nothing is generated on page load.
- **Every stat** carries n and an as-of time. Regeneration is hourly.
- **Closed roles.** A cited posting that now returns `status:"closed"` keeps its citation but loses its link and gains a "closed" tag.

## 8. Architecture

Your default stack stands, trimmed: Next.js App Router, TypeScript strict, Tailwind, pnpm, Zod, Vitest, ESLint and Prettier, Vercel with hourly incremental regeneration. No database. Playwright is dropped for the day.

- `lib/speedrun/`: typed client, Zod schemas with string normalisation, `source` on every call, one retry with backoff, server-side fetch only so caching is in one place.
- `lib/stats/`: pure functions (median, IQR, cleaning, thresholds, dedupe), unit tested against fixtures.
- `lib/decode/`: alias map and keyword scorer, pure and tested.
- `content/roles/<slug>/`: `meta.json`, `extracted.json`, `guide.mdx`.
- `scripts/`: `probe.ts`, `extract-responsibilities.ts`, `snapshot-fixtures.ts`.
- Load per regeneration: roughly 40 to 60 API calls an hour, all tagged.
- Outbound job links use the `url` returned by the API, which already carries the source tag as a UTM parameter.

## 9. Success metrics

For a one-day artefact, what can honestly be measured is small:

- Outbound clicks to speedrun job URLs and to Join the Network (visible to speedrun through the source tag, and to you through Vercel Analytics).
- Decoder submissions.

Role-page click-through rate and return visits need traffic and time; list them in the pitch as what you would instrument next.

## 10. Risks

| Risk | Likelihood | Response |
| --- | --- | --- |
| Early-stage student door is near zero for the flagship | high | Show it. Lean the exit on junior roles and Join the Network. |
| Too few clean pay bands for the flagship | medium | Suppress with the reason. Do not borrow the `/stats/hiring` figure. |
| Extraction is noisy or dominated by one company | medium | Dedupe, enforce the 3 company floor, and cut the section to 5 solid items rather than 8 weak ones. |
| Classifier noise puts the wrong roles on the page | medium | Print the definition and the unlabeled count. Spot-check 30 titles before shipping. |
| The guide is the slowest part and it is yours | high | Start writing as soon as the flagship is chosen, in parallel with the build. |
| The name speedrun_edu reads as an official speedrun product | medium | No logos, own wordmark, "Unofficial" in the header as well as the footer and /about, and Edison's name on the site. |
| A roles hub exists at a path not linked from the nav | low | Check whether `/roles` resolves during step A. |
| API shape or flags change mid-build | low | Zod parse failures surface as a visible "data unavailable" state, never a silent fallback. |

## 11. Build sequence

| Step | What | Time | Who |
| --- | --- | --- | --- |
| A | Run the probes, append results to DATA_NOTES, pick the flagship by the rule. **Checkpoint A: you confirm the flagship and its definition.** | 0:45 | Claude Code, then you (5 min) |
| B | Scaffold, typed client, Zod schemas, fixtures, `lib/stats` with tests | 1:00 | Claude Code |
| C | Role template with live numbers, student door list and exit; index page; data-only pages | 1:30 | Claude Code |
| D | Extraction script, one run on the flagship, your review of the output | 1:00 | Claude Code, then you (30 min) |
| E | Guide for the flagship, including resources | 1:30 | You, in parallel with F |
| F | Decoder: alias map, scorer, tests, page | 1:30 | Claude Code |
| G | Design pass | 1:30 | Claude Code, your eye |
| H | /about, JSON routes, unofficial notice, CI | 0:45 | Claude Code |
| I | Deploy, phone check, fix list. **Checkpoint B: preview link.** | 1:00 | Both |
| J | Pitch paragraph for the application form | 0:30 | You, with a draft from Claude Code |

About 9.5 hours of build with E running in parallel, plus whatever buffer the day allows. If time runs short, cut in this order: data-only pages for other crafts, JSON routes, CI, then decoder polish. Do not cut the honesty rules or the unofficial notice.

## 12. Decisions from Edison (13 Nov 2026)

1. Source tag: `role-decoder-edison` on every API call.
2. Deadline: end of day 14 Nov. No hard clock time.
3. The product tour PDF is in `docs/reference/`. Read it before step A. Salary page: https://speedrun-talent-network.com/founding-engineer-salary
4. Resources: Edison supplies them. Leave the section as a TODO and add no others.
5. Site name: speedrun_edu.
6. No outreach. The project goes only through the application form. Do not draft emails to the developer contact or anyone else.

## 13. Kickoff prompt for Claude Code

The same text lives in SETUP.md, ready to paste.

> Read CLAUDE.md, docs/PLAN.md, docs/DATA_NOTES.md and the product tour PDF in docs/reference/ fully before doing anything. The goal is a deployed site by end of day tomorrow. Start with step A in PLAN section 11: run the probes in DATA_NOTES section 7 against the REST API with `source=role-decoder-edison` on every call, save raw responses to fixtures/, append a results table to DATA_NOTES.md, check whether https://speedrun-talent-network.com/roles resolves, apply the flagship decision rule in PLAN section 5, and stop for my confirmation. If any probe result contradicts the plan, especially the early-stage student door hypothesis in PLAN section 1, say so plainly before building. After I confirm, work through steps B to I, stopping only at Checkpoint B, and log decisions in docs/DECISIONS.md.
