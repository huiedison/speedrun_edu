/**
 * Step A probes (docs/DATA_NOTES.md section 7).
 *
 * Runs against the public speedrun talent network REST API, tags every call
 * with the source tag, saves each raw response under fixtures/probe/ and
 * writes a compact fixtures/probe/summary.json.
 *
 * No dependencies. Run with Node 24+: `node scripts/probe.ts [phase]`
 *   phase "core" (default): probes 1 to 5 and 7
 *   phase "detail <name> <query>": probe 6 for one role definition, e.g.
 *     node scripts/probe.ts detail sales "fn=sales"
 *
 * Job detail responses contain description text. They are written to
 * fixtures/local/, which is gitignored, so listing text is never re-hosted.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.SPEEDRUN_API_BASE ?? "https://speedrun-talent-network.com/api/v1";
const SRC = process.env.SPEEDRUN_SOURCE_TAG ?? "role-decoder-edison";
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "fixtures", "probe");
const LOCAL = path.join(ROOT, "fixtures", "local");
// The API sits behind a Cloudflare rate limit (HTTP 429, error 1015) that a
// burst of about 17 calls at 300 ms spacing tripped on 13 Nov 2026. Stay slow.
const DELAY_MS = 2500;
const MAX_ATTEMPTS = 4;
// Responses already on disk and younger than this are reused, so an
// interrupted run resumes without repeating calls.
const REUSE_MS = process.env.PROBE_FRESH ? 0 : 90 * 60 * 1000;

const CRAFTS = [
  "engineering",
  "research",
  "product",
  "design",
  "sales",
  "marketing",
  "operations",
  "other",
  "data",
  "growth",
  "customer",
  "finance",
  "legal",
  "people",
  "business_development",
  "strategy",
  "executive",
  "hardware_manufacturing",
];
const EARLY = "seed,series_a,series_b";
const STUDENT = "intern,new_grad";
const P3_CRAFTS = [
  "strategy",
  "operations",
  "sales",
  "business_development",
  "product",
  "design",
  "growth",
  "marketing",
  "engineering",
];
const TITLE_TERMS = [
  "bizops",
  "business operations",
  "strategy and operations",
  "chief of staff",
  "founding gtm",
  "founding account executive",
  "forward deployed",
  "product engineer",
  "growth",
];
/** Role definitions whose pay bands are paged and cleaned (probe 5). */
const COMP_DEFS: Record<string, Record<string, string>> = {
  strategy: { fn: "strategy" },
  "strategy-strategy_ops": { fn: "strategy", spec: "strategy_ops" },
  sales: { fn: "sales" },
  "sales-founding": { fn: "sales", founding: "1" },
  product: { fn: "product" },
  operations: { fn: "operations" },
  design: { fn: "design" },
  business_development: { fn: "business_development" },
  "operations-bizops": { fn: "operations", spec: "bizops" },
  "operations-bizops-cos-founders": { fn: "operations", spec: "bizops,chief_of_staff,founders_office_generalist" },
  "q-bizops": { q: "bizops" },
  "q-business-operations": { q: "business operations" },
  "q-strategy-and-operations": { q: "strategy and operations" },
  "q-chief-of-staff": { q: "chief of staff" },
  "q-forward-deployed": { q: "forward deployed" },
  "q-product-engineer": { q: "product engineer" },
};

type Facet = { v: string; n: number };
type Job = {
  id: string;
  title: string;
  company: string;
  company_slug: string | null;
  url: string;
  function: string | null;
  seniority: string | null;
  workplace_type: string | null;
  comp_min: number | null;
  comp_max: number | null;
  comp_currency: string | null;
  comp_period: string | null;
  published_at: string | null;
  tier: string | null;
};
type JobsResponse = {
  jobs: Job[];
  total: number;
  page: number;
  total_pages: number;
  has_more: boolean;
  next_page: number | null;
  facets: Record<string, Facet[] | number | Record<string, number>>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
let calls = 0;
let rateLimited = 0;
// Earliest and latest fetch time across every response used, including reused ones.
let fetchedFrom = Infinity;
let fetchedTo = 0;
const noteFetch = (ms: number) => {
  fetchedFrom = Math.min(fetchedFrom, ms);
  fetchedTo = Math.max(fetchedTo, ms);
};

async function get<T>(endpoint: string, params: Record<string, string>, file: string): Promise<T> {
  try {
    const st = await stat(file);
    if (Date.now() - st.mtimeMs < REUSE_MS) {
      noteFetch(st.mtimeMs);
      return JSON.parse(await readFile(file, "utf8")) as T;
    }
  } catch {
    // not on disk yet
  }
  const url = new URL(BASE + endpoint);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("source", SRC);
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      calls++;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      const text = await res.text();
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Math.max(Number.isFinite(retryAfter) ? retryAfter * 1000 : 0, 30_000 * (attempt + 1));
        console.warn(`429 rate limited; waiting ${Math.round(waitMs / 1000)}s (retry-after: ${res.headers.get("retry-after")})`);
        rateLimited++;
        lastError = new Error(`HTTP 429 for ${url}`);
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 200)}`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text);
      noteFetch(Date.now());
      await sleep(DELAY_MS);
      return JSON.parse(text) as T;
    } catch (err) {
      lastError = err;
      await sleep(2000);
    }
  }
  throw lastError;
}

const facetList = (r: JobsResponse, key: string): Facet[] => {
  const f = r.facets[key];
  return Array.isArray(f) ? f : [];
};
const facetNum = (r: JobsResponse, key: string): number | null => {
  const f = r.facets[key];
  return typeof f === "number" ? f : null;
};
const facetMap = (r: JobsResponse, key: string): Record<string, number> =>
  Object.fromEntries(facetList(r, key).map((f) => [f.v, f.n]));
const sumOf = (m: Record<string, number>, keys: string[]) =>
  keys.reduce((a, k) => a + (m[k] ?? 0), 0);

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
function quantile(xs: number[], q: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

/** Cleaning rule from DATA_NOTES quirk 5 and PLAN section 7. */
function cleanBands(jobs: Job[]) {
  const dropped: Record<string, number> = {};
  const drop = (why: string) => {
    dropped[why] = (dropped[why] ?? 0) + 1;
  };
  const mids: number[] = [];
  const companies = new Set<string>();
  for (const j of jobs) {
    if (j.comp_min == null && j.comp_max == null) drop("no band");
    else if (j.comp_currency !== "USD") drop(`currency ${j.comp_currency ?? "null"}`);
    else if (j.comp_period != null && j.comp_period !== "year") drop(`period ${j.comp_period}`);
    else if (j.comp_min == null || j.comp_max == null) drop("one-sided band");
    else {
      const mid = (j.comp_min + j.comp_max) / 2;
      if (mid < 20_000 || mid > 1_000_000) drop("midpoint outside 20k to 1M");
      else {
        mids.push(mid);
        companies.add(j.company);
      }
    }
  }
  return {
    returned: jobs.length,
    kept: mids.length,
    kept_companies: companies.size,
    dropped,
    p25: quantile(mids, 0.25),
    median: median(mids),
    p75: quantile(mids, 0.75),
  };
}

function craftRow(r: JobsResponse) {
  const lvl = facetMap(r, "lvl");
  const stage = facetMap(r, "stage");
  return {
    total: r.total,
    lvl,
    lvlUnspecified: facetNum(r, "lvlUnspecified"),
    student: sumOf(lvl, ["intern", "new_grad"]),
    junior: lvl["junior"] ?? 0,
    stage,
    stageUnspecified: facetNum(r, "stageUnspecified"),
    early: sumOf(stage, ["seed", "series_a", "series_b"]),
    workplace: facetMap(r, "workplace"),
    spec: facetList(r, "spec"),
    compAvailable: facetNum(r, "compAvailable"),
    founding: facetNum(r, "founding"),
    portfolio: facetMap(r, "portfolio"),
  };
}

const listItem = (j: Job) => ({
  id: j.id,
  title: j.title.trim(),
  company: j.company,
  seniority: j.seniority,
  fn: j.function,
  tier: j.tier,
  url: j.url,
});

async function core() {
  const summary: Record<string, unknown> = { base: BASE, source: SRC };

  // Probe 1: per craft.
  const p1: Record<string, ReturnType<typeof craftRow>> = {};
  for (const fn of CRAFTS) {
    const r = await get<JobsResponse>("/jobs", { fn }, path.join(OUT, `p1-fn-${fn}.json`));
    p1[fn] = craftRow(r);
    console.log(`p1 ${fn}: ${r.total}`);
  }
  summary.p1 = p1;

  // Board-wide baseline, for totals and reconciliation.
  const board = await get<JobsResponse>("/jobs", {}, path.join(OUT, "p0-board.json"));
  summary.p0 = { ...craftRow(board), fn: facetMap(board, "fn"), fnUnspecified: facetNum(board, "fnUnspecified") };

  // Probe 2: where student roles live.
  const p2 = await get<JobsResponse>("/jobs", { lvl: STUDENT }, path.join(OUT, "p2-student.json"));
  summary.p2 = {
    total: p2.total,
    portfolio: facetMap(p2, "portfolio"),
    stage: facetMap(p2, "stage"),
    stageUnspecified: facetNum(p2, "stageUnspecified"),
    fn: facetMap(p2, "fn"),
    fnUnspecified: facetNum(p2, "fnUnspecified"),
    size: facetMap(p2, "size"),
    sizeUnspecified: facetNum(p2, "sizeUnspecified"),
  };
  // Early-stage baseline: all levels at seed to Series B, for the denominator.
  const early = await get<JobsResponse>("/jobs", { stage: EARLY }, path.join(OUT, "p2b-early-stage.json"));
  summary.p2b = {
    total: early.total,
    lvl: facetMap(early, "lvl"),
    lvlUnspecified: facetNum(early, "lvlUnspecified"),
    fn: facetMap(early, "fn"),
    portfolio: facetMap(early, "portfolio"),
  };
  console.log(`p2 student roles: ${p2.total}; early-stage roles: ${early.total}`);

  // Probe 3: early-stage student door per craft, plus the junior comparison.
  const p3: Record<string, unknown> = {};
  for (const fn of P3_CRAFTS) {
    const r = await get<JobsResponse>(
      "/jobs",
      { fn, lvl: STUDENT, stage: EARLY, sort: "new" },
      path.join(OUT, `p3-early-student-${fn}.json`),
    );
    const j = await get<JobsResponse>(
      "/jobs",
      { fn, lvl: "junior", stage: EARLY, sort: "new" },
      path.join(OUT, `p3-early-junior-${fn}.json`),
    );
    p3[fn] = {
      early_student: r.total,
      early_junior: j.total,
      portfolio: facetMap(r, "portfolio"),
      list: r.jobs.map(listItem),
    };
    console.log(`p3 ${fn}: early-stage student ${r.total}, early-stage junior ${j.total}`);
  }
  const allEarlyStudent = await get<JobsResponse>(
    "/jobs",
    { lvl: STUDENT, stage: EARLY, sort: "new" },
    path.join(OUT, "p3-early-student-all.json"),
  );
  p3["_all"] = {
    early_student: allEarlyStudent.total,
    fn: facetMap(allEarlyStudent, "fn"),
    fnUnspecified: facetNum(allEarlyStudent, "fnUnspecified"),
    portfolio: facetMap(allEarlyStudent, "portfolio"),
  };
  summary.p3 = p3;

  // Probe 4: title archetypes.
  const p4: Record<string, unknown> = {};
  for (const term of TITLE_TERMS) {
    const s = slug(term);
    const r = await get<JobsResponse>("/jobs", { q: term }, path.join(OUT, `p4-q-${s}.json`));
    const st = await get<JobsResponse>(
      "/jobs",
      { q: term, lvl: STUDENT, sort: "new" },
      path.join(OUT, `p4-q-${s}-student.json`),
    );
    const es = await get<JobsResponse>(
      "/jobs",
      { q: term, lvl: STUDENT, stage: EARLY, sort: "new" },
      path.join(OUT, `p4-q-${s}-early-student.json`),
    );
    p4[term] = {
      ...craftRow(r),
      fn: facetMap(r, "fn"),
      fnUnspecified: facetNum(r, "fnUnspecified"),
      student_total: st.total,
      early_student_total: es.total,
      sample_titles: r.jobs.slice(0, 30).map((j) => `${j.title.trim()} | ${j.company}`),
    };
    console.log(`p4 "${term}": ${r.total} (student ${st.total}, early-stage student ${es.total})`);
  }
  summary.p4 = p4;

  // Definition variants for the flagship candidates.
  const variants: Record<string, Record<string, string>> = {
    "strategy-strategy_ops": { fn: "strategy", spec: "strategy_ops" },
    "sales-founding": { fn: "sales", founding: "1" },
    "founding-all": { founding: "1" },
    "operations-bizops": { fn: "operations", spec: "bizops" },
    "operations-bizops-cos-founders": { fn: "operations", spec: "bizops,chief_of_staff,founders_office_generalist" },
    "sales-sdr_bdr": { fn: "sales", spec: "sdr_bdr" },
  };
  const pv: Record<string, unknown> = {};
  for (const [name, params] of Object.entries(variants)) {
    const r = await get<JobsResponse>("/jobs", params, path.join(OUT, `pv-${name}.json`));
    const es = await get<JobsResponse>(
      "/jobs",
      { ...params, lvl: STUDENT, stage: EARLY },
      path.join(OUT, `pv-${name}-early-student.json`),
    );
    pv[name] = {
      params,
      ...craftRow(r),
      fn: facetMap(r, "fn"),
      early_student_total: es.total,
      early_student_list: es.jobs.map(listItem),
      sample_titles: r.jobs.slice(0, 30).map((j) => `${j.title.trim()} | ${j.company}`),
    };
    console.log(`variant ${name}: ${r.total}`);
  }
  summary.variants = pv;

  // Probe 5: comp per candidate definition, paged to the end and cleaned.
  const p5: Record<string, unknown> = {};
  for (const [name, params] of Object.entries(COMP_DEFS)) {
    const jobs: Job[] = [];
    let page = 0;
    let total = 0;
    for (;;) {
      const r = await get<JobsResponse>(
        "/jobs",
        { ...params, comp: "1", sort: "comp", page: String(page) },
        path.join(OUT, "comp", `p5-${name}-page${page}.json`),
      );
      total = r.total;
      jobs.push(...r.jobs);
      if (!r.has_more || r.next_page == null) break;
      page = r.next_page;
    }
    p5[name] = { params, api_total: total, ...cleanBands(jobs) };
    console.log(`p5 ${name}: ${total} with comp=1, ${(p5[name] as { kept: number }).kept} clean`);
  }
  summary.p5 = p5;

  // Probe 7: speedrun-only scope.
  const p7 = await get<JobsResponse>("/jobs", { scope: "speedrun" }, path.join(OUT, "p7-scope-speedrun.json"));
  summary.p7 = { ...craftRow(p7), fn: facetMap(p7, "fn"), fnUnspecified: facetNum(p7, "fnUnspecified") };
  console.log(`p7 speedrun scope: ${p7.total}`);

  summary.fetched_from = new Date(fetchedFrom).toISOString();
  summary.fetched_to = new Date(fetchedTo).toISOString();
  summary.calls_this_run = calls;
  summary.rate_limited_responses_this_run = rateLimited;
  await writeFile(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(`done: ${calls} calls, summary at fixtures/probe/summary.json`);
}

const normTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[-–—,|/:].*$/, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Probe 6: job detail quality for one role definition. */
async function detail(name: string, query: string, want = 30) {
  const params = Object.fromEntries(new URLSearchParams(query));
  const picked: Job[] = [];
  const seen = new Set<string>();
  const perCompany = new Map<string, number>();
  for (let page = 0; page < 8 && picked.length < want; page++) {
    const r = await get<JobsResponse>(
      "/jobs",
      { ...params, sort: "new", page: String(page) },
      path.join(LOCAL, "detail", name, `list-page${page}.json`),
    );
    for (const j of r.jobs) {
      const key = `${j.company}::${normTitle(j.title)}`;
      const n = perCompany.get(j.company) ?? 0;
      if (seen.has(key) || n >= 2) continue; // dedupe (quirk 7) and cap any one company
      seen.add(key);
      perCompany.set(j.company, n + 1);
      picked.push(j);
      if (picked.length >= want) break;
    }
    if (!r.has_more) break;
  }
  type Detail = {
    job: Job & {
      status: string;
      description_text: string | null;
      labels: Record<string, string | boolean | null> | null;
    };
  };
  const rows = [];
  for (const j of picked) {
    const d = await get<Detail>("/jobs/" + j.id, {}, path.join(LOCAL, "detail", name, `${j.id}.json`));
    const text = d.job.description_text ?? "";
    rows.push({
      id: j.id,
      title: j.title.trim(),
      company: j.company,
      status: d.job.status,
      chars: text.length,
      has_resp_section:
        /(responsibilit|what you.ll do|what you will do|what you.ll be doing|the role|your role|you will|in this role|key duties|day.to.day)/i.test(
          text,
        ),
      has_req_section: /(requirement|qualification|what we.re looking for|who you are|you have|about you|skills)/i.test(
        text,
      ),
      specialty: d.job.labels?.specialty ?? null,
      seniority_label: d.job.labels?.seniority ?? null,
    });
  }
  const lens = rows.map((r) => r.chars).filter((n) => n > 0);
  const out = {
    name,
    params,
    as_of: new Date().toISOString(),
    sampled: rows.length,
    companies: new Set(rows.map((r) => r.company)).size,
    usable_description: rows.filter((r) => r.chars >= 500).length,
    median_chars: median(lens),
    min_chars: lens.length ? Math.min(...lens) : null,
    max_chars: lens.length ? Math.max(...lens) : null,
    with_responsibilities_section: rows.filter((r) => r.has_resp_section).length,
    with_requirements_section: rows.filter((r) => r.has_req_section).length,
    specialty_null: rows.filter((r) => r.specialty == null).length,
    rows,
  };
  // The summary holds no description text, so it can live with the other fixtures.
  await writeFile(path.join(OUT, `p6-detail-${name}.json`), JSON.stringify(out, null, 2) + "\n");
  const { rows: _rows, ...head } = out;
  console.log(head);
}

const [phase = "core", a, b, c] = process.argv.slice(2);
if (phase === "core") await core();
else if (phase === "detail" && a && b) await detail(a, b, c ? Number(c) : 30);
else {
  console.error('usage: node scripts/probe.ts [core | detail <name> "<query>" [n]]');
  process.exit(1);
}
