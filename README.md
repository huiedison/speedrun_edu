# speedrun_edu

**Unofficial.** Built on the public speedrun talent network API. Not affiliated with or endorsed by a16z or speedrun.

A live, data-backed library of startup roles for students and new grads. Each role page shows what the role is, what real postings ask for, and how wide the door actually is for interns and new grads, then links straight to open roles on the speedrun board.

- Live site: TODO
- Methodology: see `/about` on the site and `docs/PLAN.md` section 7
- JSON: `/api/roles` and `/api/roles/<slug>`

## Run it

```
pnpm install
cp .env.example .env.local
pnpm dev
```

## How the numbers work

Every figure is computed from live postings through the public API, with a sample size and an as-of time. Stats below a minimum sample are suppressed and the page says why. Nothing is estimated or invented.

Built by Edison.
