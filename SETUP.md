# SETUP.md: repo, Claude Code and deployment

Follow this top to bottom. Steps 1 to 4 take about 20 minutes. After that Claude Code does the building and you review, write the guide, and deploy.

## 1. What you need

Accounts: GitHub, Vercel (the free Hobby plan is enough; sign up with GitHub), and a Claude plan or Console account that includes Claude Code.

On your machine:

- **git** and a current **Node LTS**
- **pnpm**: `corepack enable` (ships with Node) or `npm install -g pnpm`
- **Claude Code**:
  - macOS, Linux or WSL: `curl -fsSL https://claude.ai/install.sh | bash`
  - Windows PowerShell: `irm https://claude.ai/install.ps1 | iex`
  - Check it with `claude --version`. Full instructions and troubleshooting: https://code.claude.com/docs/en/setup
- Optional: the GitHub CLI (`gh`), which makes step 3 one command.

## 2. Put the starter repo in place

Unzip `speedrun_edu.zip` wherever you keep projects. It contains:

```
speedrun_edu/
  CLAUDE.md            conventions Claude Code reads at the start of every session
  SETUP.md             this file
  README.md            public-facing readme
  .env.example
  .gitignore
  docs/
    PLAN.md            the one-day plan and your decisions
    DATA_NOTES.md      API notes, live snapshot, probes to run first
    DECISIONS.md       running decision log, already seeded
    reference/         put the product tour PDF here
```

Copy the product tour PDF into `docs/reference/`. That folder is gitignored on purpose: the PDF is speedrun's material and the repo will be public.

Then create your local env file:

```
cd speedrun_edu
cp .env.example .env.local
```

Leave `ANTHROPIC_API_KEY` blank unless you already have a Console API key. Without one, Claude Code does the responsibility extraction inside the session instead of through a script, and logs that choice.

## 3. Create the GitHub repo

```
git init -b main
git add .
git commit -m "Add plan, data notes and project conventions"
```

With the GitHub CLI:

```
gh repo create speedrun_edu --public --source=. --push
```

Without it: create an empty repo named `speedrun_edu` at github.com/new (no README, no .gitignore), then:

```
git remote add origin https://github.com/<your-username>/speedrun_edu.git
git push -u origin main
```

Public is the better choice here. For a Product Engineer application, a readable repo with a decision log is part of the pitch. Before you push, run `git status` and confirm that neither `.env.local` nor the PDF is listed.

## 4. Start Claude Code and kick off

From the repo root:

```
claude
```

Log in when prompted. Claude Code loads `CLAUDE.md` automatically. Paste this as your first message:

> Read CLAUDE.md, docs/PLAN.md, docs/DATA_NOTES.md and the product tour PDF in docs/reference/ fully before doing anything. The goal is a deployed site by end of day tomorrow. Start with step A in PLAN section 11: run the probes in DATA_NOTES section 7 against the REST API with `source=role-decoder-edison` on every call, save raw responses to fixtures/, append a results table to DATA_NOTES.md, check whether https://speedrun-talent-network.com/roles resolves, apply the flagship decision rule in PLAN section 5, and stop for my confirmation. If any probe result contradicts the plan, especially the early-stage student door hypothesis in PLAN section 1, say so plainly before building. After I confirm, work through steps B to I, stopping only at Checkpoint B, and log decisions in docs/DECISIONS.md.

Claude Code will ask permission before running commands and editing files. Approve as you go; choosing the "don't ask again" option for routine commands such as `pnpm` and `git` saves a lot of clicking.

## 5. Checkpoint A: what to look at (5 minutes)

When Claude Code stops after the probes, check four things before saying go:

1. **The student door at seed to Series B** for the candidate roles. This decides the headline stat and whether the "wide at big companies, narrow at startups" story holds.
2. **Which flagship the decision rule picked**, and whether you can write its guide from experience.
3. **The role definition** (which craft, specialty or title terms). Skim the 30 sample titles and make sure they are the role you mean.
4. **Clean pay-band count.** If it is under 15, the pay card will be suppressed. Decide now whether that is acceptable for your flagship.

Then reply with the flagship and "go".

## 6. Connect Vercel early

Do this as soon as step B (the scaffold) is pushed, not at the end. Deploying an empty scaffold catches build and environment problems while they are cheap.

1. Go to vercel.com/new and import the `speedrun_edu` GitHub repo.
2. Vercel detects Next.js. Leave the build settings alone.
3. Under Environment Variables add `SPEEDRUN_SOURCE_TAG` = `role-decoder-edison` and `SPEEDRUN_API_BASE` = `https://speedrun-talent-network.com/api/v1`. Do not add `ANTHROPIC_API_KEY`; the deployed site makes no LLM calls.
4. Deploy.

From then on every push to `main` deploys to production, and every other branch gets its own preview URL. Hourly regeneration needs no extra setup: the pages declare a one-hour revalidate and Vercel handles the rest.

Vercel assigns the production URL when you create the project. Put it in `README.md` and use it as the link in your application.

## 7. Your jobs while Claude Code builds

| When | You do | Time |
| --- | --- | --- |
| After Checkpoint A | Start writing `content/roles/<slug>/guide.mdx`: a week in the role, how it changes from seed to Series B, how students get in | 1.5 h |
| After step D | Review `extracted.json`. Delete anything vague or wrong, then tell Claude Code to mark it approved | 30 min |
| Any time | Fill in the resources TODO with your own links and a line on why each matters | 15 min |
| After step G | Look at the site on your phone and give Claude Code a short fix list | 20 min |
| Step J | Write the pitch paragraph for the application form | 30 min |

## 8. Working with Claude Code through the day

- **One step at a time.** PLAN section 11 has steps A to J. Ask for a commit at the end of each.
- **Fresh context between big steps.** After a commit, `/clear` starts a clean session. Everything it needs is in `CLAUDE.md`, the docs and the git history, so tell it: "Read CLAUDE.md and docs/DECISIONS.md, then continue from step F."
- **Make it prove things.** Useful prompts:
  - "Run typecheck, lint and test, and show me the output."
  - "List every number on the flagship page with its n, its as-of time and the API query behind it."
  - "Show me any place where a fixture or hard-coded value could reach production."
  - "Which thresholds suppressed a stat on this page, and what does the page say about it?"
- **When it is wrong,** say what you saw and ask it to find the cause before changing code.

## 9. Before you submit

- [ ] Flagship page: all four layers present, guide written by you, extraction approved
- [ ] Resources section holds only your links, or is still a clearly labeled TODO
- [ ] Every stat shows n and an as-of time; suppressed stats explain why
- [ ] "Unofficial" appears in the header, footer and /about; no a16z or speedrun logos anywhere
- [ ] Outbound job links go to speedrun-talent-network.com and carry your source tag
- [ ] `/decode` handles a pasted title and a pasted posting, and says when it is unsure
- [ ] `/api/roles/<slug>` returns the same data as the page
- [ ] Site works on a phone
- [ ] `git log` shows no secrets and no PDF; CI is green
- [ ] README has the live URL

## 10. If you run out of time

Cut in this order: data-only pages for other crafts, the JSON routes, CI, decoder polish. Do not cut the honesty rules or the unofficial notice. One page that is correct and clearly yours is a stronger link than four that are thin.
