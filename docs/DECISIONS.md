# DECISIONS.md

Running log. Newest at the bottom. Format: date, decision, why, alternatives considered.

| Date | Decision | Why | Alternatives considered |
| --- | --- | --- | --- |
| 2026-11-13 | Rescope from five phases to a one-day build with one flagship role | Deadline is end of day 14 Nov | Full brief over one to two weeks |
| 2026-11-13 | Priority order: one excellent role page, decoder, design, data breadth, testing and pitch | Edison's ranking | n/a |
| 2026-11-13 | Keep every honest-data rule; cut data breadth instead | The brief calls honest data non-negotiable and the rules are cheap | Dropping n and as-of labels to save time |
| 2026-11-13 | Compute all page stats from `/jobs`, never `/stats/hiring` | The two endpoints report different totals (23,504 vs 18,276) and different function taxonomies | Using `/stats/hiring` pay bands directly |
| 2026-11-13 | Student door is `lvl` in (intern, new_grad); junior shown separately | Four intern-like fields disagree; `lvl` is the classified ladder | `sen=intern`, `emp=Intern`, `eng=internship` |
| 2026-11-13 | Pay band floor of n = 15, USD annual midpoints, outliers dropped and counted | Matches the floor in speedrun's own stats endpoint and the salary page's exclusions | n = 30; including non-USD bands |
| 2026-11-13 | A role is an explicit query definition in `meta.json`, printed on the page | Titles like BizOps or Forward Deployed Engineer cut across the API's crafts; the salary page also defines its role by title | One page per `fn` value |
| 2026-11-13 | Drop Design from the flagship set; provisional flagship is BizOps / Strategy & Ops, fallback Founding GTM / Sales | Design is the least confusing; final choice follows the decision rule after probes | Four flagships as in the brief |
| 2026-11-13 | No MCP server | speedrun already runs one over the same data | list_roles, get_role_guide, decode_title tools |
| 2026-11-13 | No user study; pitch uses a live data point and says it is untested | No time for 5 to 8 sessions | Inventing or implying a testing result (never) |
| 2026-11-13 | Source tag `role-decoder-edison` | Edison's choice; makes the traffic attributable to him | `role-decoder` |
| 2026-11-13 | Site name speedrun_edu, with "Unofficial" in header, footer and /about | Edison's choice; the extra labelling offsets the risk of looking official | Role Decoder |
| 2026-11-13 | Resources section ships as a TODO; only Edison adds links | Edison's instruction | Claude-suggested resources |
| 2026-11-13 | No outreach to the speedrun team; application form only | Edison's instruction | Emailing the developer contact |
| 2026-11-13 | Reference PDF is gitignored | It is speedrun's material and the repo is public | Committing it |
