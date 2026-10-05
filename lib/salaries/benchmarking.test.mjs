import test from "node:test";
import assert from "node:assert/strict";
import {
  filterSalaryJobs,
  classifyJobRole,
  classifyExperienceLevel,
  computePercentile,
  calculateSalaryBenchmark,
  formatCompensationValue,
} from "./benchmarking.ts";

test("classifyJobRole maps job titles to correct tech domains", () => {
  assert.equal(classifyJobRole("Senior React Frontend Engineer"), "frontend");
  assert.equal(classifyJobRole("Python Backend Developer"), "backend");
  assert.equal(classifyJobRole("Fullstack Node.js / React Specialist"), "fullstack");
  assert.equal(classifyJobRole("iOS & Android Flutter Engineer"), "mobile");
  assert.equal(classifyJobRole("Cloud DevOps & Kubernetes Lead"), "devops");
  assert.equal(classifyJobRole("Staff AI / Machine Learning Scientist"), "data-ai");
  assert.equal(classifyJobRole("UI/UX Product Designer"), "product-design");
  assert.equal(classifyJobRole("SDET Quality Assurance Engineer"), "qa-testing");
  assert.equal(classifyJobRole("General Software Engineer"), "general-software");
});

test("classifyExperienceLevel categorizes by seniority and title clues", () => {
  assert.equal(classifyExperienceLevel("junior", "Software Engineer"), "entry");
  assert.equal(classifyExperienceLevel("", "Graduate Fresher Trainee"), "entry");
  assert.equal(classifyExperienceLevel("mid", "Frontend Engineer"), "mid");
  assert.equal(classifyExperienceLevel("senior", "Backend Developer"), "senior");
  assert.equal(classifyExperienceLevel("lead", "Staff Engineer"), "lead");
  assert.equal(classifyExperienceLevel(null, "Engineering Director"), "lead");
  assert.equal(classifyExperienceLevel(null, "Software Engineer"), "unknown");
});

test("computePercentile calculates mathematical percentiles reliably", () => {
  const dataset = [10, 20, 30, 40, 50];
  assert.equal(computePercentile(dataset, 50), 30);
  assert.equal(computePercentile(dataset, 0), 10);
  assert.equal(computePercentile(dataset, 100), 50);

  const dataset2 = [100];
  assert.equal(computePercentile(dataset2, 50), 100);
});

test("calculateSalaryBenchmark calculates stats without fabricating figures", () => {
  const jobs = [
    {
      id: "1",
      title: "Senior React Engineer",
      company_name: "Acme",
      location: "Bengaluru",
      seniority: "senior",
      salary_min: 2_400_000,
      salary_max: 3_200_000,
      salary_currency: "INR",
      source: "himalayas",
      published_at: "2026-10-01",
    },
    {
      id: "2",
      title: "Lead Frontend Engineer",
      company_name: "Beta",
      location: "Remote",
      seniority: "lead",
      salary_min: 3_500_000,
      salary_max: 4_500_000,
      salary_currency: "INR",
      source: "remotive",
      published_at: "2026-10-02",
    },
    {
      id: "3",
      title: "Frontend Developer",
      company_name: "Gamma",
      location: "Hyderabad",
      seniority: "mid",
      salary_min: 1_200_000,
      salary_max: 1_600_000,
      salary_currency: "INR",
      source: "arbeitnow",
      published_at: "2026-10-03",
    },
  ];

  const result = calculateSalaryBenchmark(jobs, "frontend", "INR");
  assert.equal(result.sampleCount, 3);
  assert.equal(result.insufficientData, false);
  assert.equal(result.median, 2_800_000);
  assert.equal(result.min, 1_400_000);
  assert.equal(result.max, 4_000_000);
  assert.deepEqual(result.sources.sort(), ["arbeitnow", "himalayas", "remotive"]);
  assert.equal(result.experienceBreakdown.senior.sampleCount, 1);
  assert.equal(result.experienceBreakdown.senior.median, null);
});

test("calculateSalaryBenchmark flags insufficient data honestly", () => {
  const result = calculateSalaryBenchmark([], "frontend", "INR", 2);
  assert.equal(result.sampleCount, 0);
  assert.equal(result.insufficientData, true);
  assert.equal(result.median, 0);
});

test("formatCompensationValue formats INR LPA and USD $k accurately", () => {
  assert.equal(formatCompensationValue(2_400_000, "INR"), "24 LPA");
  assert.equal(formatCompensationValue(850_000, "INR"), "8.5 LPA");
  assert.equal(formatCompensationValue(120_000, "USD"), "$120k");
  assert.equal(formatCompensationValue(null, "USD"), "N/A");
});


test("benchmark excludes mixed currencies, unrelated roles and invalid salary ranges", () => {
  const job = { id: "1", title: "Frontend Engineer", location: "Bangalore", salary_min: 100000, salary_max: 200000, salary_currency: "USD", source: "himalayas" };
  const jobs = [job, { ...job, salary_currency: "EUR" }, { ...job, salary_currency: null }, { ...job, title: "General Software Engineer" }, { ...job, salary_min: -1 }, { ...job, salary_min: 300000 }, { ...job, salary_max: Infinity }];
  assert.deepEqual(filterSalaryJobs(jobs, "frontend", "USD", "bengaluru"), [job]);
  assert.equal(calculateSalaryBenchmark(jobs, "frontend", "USD").sampleCount, 1);
  assert.equal(filterSalaryJobs([job], "frontend", "USD", "delhi").length, 0);
  assert.equal(classifyJobRole("React Native Developer"), "mobile");
  assert.equal(filterSalaryJobs([{ ...job, location: "Gurgaon" }], "frontend", "USD", "delhi").length, 1);
});

test("salary API validates filters, excludes private/expired jobs and reads beyond one page", async () => {
  const { readFileSync } = await import("node:fs");
  const { default: Module } = await import("node:module");
  const { default: ts } = await import("typescript");
  const model = await import("./benchmarking.ts");
  let fail = false;
  const pages = [];
  const client = { from(table) {
    assert.equal(table, "jobs");
    const query = {
      select: () => query,
      is: (key, value) => { assert.equal(key, "created_by"); assert.equal(value, null); return query; },
      or: (filter) => { assert.match(filter, /^(expires_at\.is\.null,expires_at\.gt\.|salary_min\.not\.is\.null,salary_max\.not\.is\.null)/); return query; },
      in: (key, values) => { assert.equal(key, "salary_currency"); assert.deepEqual(values, ["USD", "$"]); return query; },
      order: (key) => { assert.equal(key, "id"); return query; },
      range: async (start, end) => {
        pages.push([start, end]);
        if (fail) return { error: { message: "private database detail" } };
        return { data: Array.from({ length: start === 0 ? 500 : 1 }, (_, i) => ({ id: String(start + i), title: "Frontend Engineer", salary_min: 100000, salary_max: 200000, salary_currency: "USD", location: "Bangalore" })) };
      },
    };
    return query;
  } };
  const loaded = new Module(import.meta.filename);
  loaded.require = (id) => {
    if (id === "@/lib/supabase/server") return { createClient: async () => client };
    assert.equal(id, "@/lib/salaries/benchmarking");
    return model;
  };
  loaded._compile(ts.transpileModule(readFileSync(new URL("../../app/api/salaries/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, import.meta.filename);
  const get = (params) => loaded.exports.GET(new Request(`https://jobpilot.test/api/salaries?${params}`));
  assert.equal((await get("currency=EUR")).status, 400);
  assert.equal((await get("role=__proto__")).status, 400);
  const response = await get("currency=USD&role=frontend&location=bengaluru");
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.benchmark.sampleCount, 501);
  assert.equal(data.matchingJobs.length, 12);
  assert.deepEqual(pages, [[0, 499], [500, 999]]);
  fail = true;
  const errorResponse = await get("currency=USD&role=frontend");
  assert.equal(errorResponse.status, 500);
  assert.deepEqual(await errorResponse.json(), { error: "Unable to load salary benchmarks." });
});
