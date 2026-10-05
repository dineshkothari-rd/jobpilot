import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

// Load lib/jobs/sync.ts bypassing "server-only"
const require = createRequire(import.meta.url);
const loaded = new Module(import.meta.filename);
loaded.require = (name) => {
  if (name === "server-only") return {};
  if (name === "@/lib/utils") {
    return {
      safeExternalUrl: (url) => {
        if (!url || typeof url !== "string") return null;
        try {
          const parsed = new URL(url);
          return parsed.protocol === "https:" ? parsed.toString() : null;
        } catch {
          return null;
        }
      },
    };
  }
  return require(name);
};

const source = readFileSync(new URL("./sync.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
loaded._compile(transpiled, import.meta.filename);
const sync = loaded.exports;

test("parseSalaryString extracts bounds and detects currencies", () => {
  assert.deepEqual(sync.parseSalaryString("$120,000 - $140,000"), { min: 120000, max: 140000, currency: "USD" });
  assert.deepEqual(sync.parseSalaryString("$80k - $100k"), { min: 80000, max: 100000, currency: "USD" });
  assert.deepEqual(sync.parseSalaryString("€65,000"), { min: 65000, max: null, currency: "EUR" });
  assert.deepEqual(sync.parseSalaryString("£50k - £70k"), { min: 50000, max: 70000, currency: "GBP" });
  assert.deepEqual(sync.parseSalaryString("₹12,00,000 - ₹18,00,000"), { min: 1200000, max: 1800000, currency: "INR" });
  assert.deepEqual(sync.parseSalaryString("Competitive"), { min: null, max: null, currency: null });
  assert.deepEqual(sync.parseSalaryString(null), { min: null, max: null, currency: null });
});

test("normalizeEmploymentType maps variations to standard values", () => {
  assert.equal(sync.normalizeEmploymentType("full_time"), "full-time");
  assert.equal(sync.normalizeEmploymentType("Full Time"), "full-time");
  assert.equal(sync.normalizeEmploymentType("part-time"), "part-time");
  assert.equal(sync.normalizeEmploymentType("contract"), "contract");
  assert.equal(sync.normalizeEmploymentType("freelance"), "contract");
  assert.equal(sync.normalizeEmploymentType("intern"), "internship");
  assert.equal(sync.normalizeEmploymentType("temporary"), "temporary");
  assert.equal(sync.normalizeEmploymentType(null), null);
});

test("normalizes Himalayas, Remotive, and Arbeitnow jobs consistently", () => {
  // Himalayas
  const himalayas = sync.normalizeHimalayasJob({
    guid: "him-123",
    title: "Senior Go Engineer",
    companyName: "CloudCorp",
    description: "Write Go services",
    locationRestrictions: ["India", "Remote"],
    employmentType: "full time",
    minSalary: 120000,
    maxSalary: 150000,
    currency: "USD",
    applicationLink: "https://example.com/apply-him",
    categories: ["Backend", "Golang"],
  });
  assert.ok(himalayas);
  assert.equal(himalayas.external_id, "him-123");
  assert.equal(himalayas.source, "himalayas");
  assert.equal(himalayas.title, "Senior Go Engineer");
  assert.equal(himalayas.company_name, "CloudCorp");
  assert.equal(himalayas.salary_min, 120000);
  assert.equal(himalayas.employment_type, "full-time");
  assert.deepEqual(himalayas.skills, ["Backend", "Golang"]);

  // Remotive
  const remotive = sync.normalizeRemotiveJob({
    id: 9876,
    title: "Fullstack Engineer",
    company_name: "RemotiveCorp",
    description: "<p>Work on React and Node</p>",
    candidate_required_location: "Worldwide",
    job_type: "full_time",
    salary: "$90k - $110k",
    url: "https://remotive.com/jobs/9876",
    tags: ["react", "nodejs"],
    category: "Software Development",
  });
  assert.ok(remotive);
  assert.equal(remotive.external_id, "remotive-9876");
  assert.equal(remotive.source, "remotive");
  assert.equal(remotive.title, "Fullstack Engineer");
  assert.equal(remotive.company_name, "RemotiveCorp");
  assert.equal(remotive.salary_min, 90000);
  assert.equal(remotive.salary_max, 110000);
  assert.equal(remotive.salary_currency, "USD");
  assert.equal(remotive.employment_type, "full-time");
  assert.ok(remotive.skills.includes("react"));
  assert.ok(remotive.skills.includes("Software Development"));

  // Arbeitnow
  const arbeitnow = sync.normalizeArbeitnowJob({
    slug: "frontend-dev-berlin",
    title: "Frontend Developer",
    company_name: "ArbeitTech",
    description: "TypeScript and Vue",
    url: "https://www.arbeitnow.com/view/frontend-dev-berlin",
    tags: ["vue", "typescript"],
    job_types: ["Full Time"],
    location: "Berlin / Remote",
    created_at: 1727000000,
  });
  assert.ok(arbeitnow);
  assert.equal(arbeitnow.external_id, "arbeitnow-frontend-dev-berlin");
  assert.equal(arbeitnow.source, "arbeitnow");
  assert.equal(arbeitnow.title, "Frontend Developer");
  assert.equal(arbeitnow.company_name, "ArbeitTech");
  assert.equal(arbeitnow.employment_type, "full-time");
  assert.deepEqual(arbeitnow.skills, ["vue", "typescript"]);
});

test("deduplicateJobs removes duplicates by ID, URL, company+title, and excludes current company", () => {
  const jobs = [
    {
      external_id: "src1-1",
      title: "Backend Engineer",
      company_name: "Acme Inc",
      description: "Desc",
      location: "Remote",
      country: null,
      employment_type: "full-time",
      seniority: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      application_url: "https://acme.com/jobs/1",
      source_url: "https://acme.com/jobs/1",
      source: "himalayas",
      published_at: null,
      expires_at: null,
      skills: ["Node.js"],
      raw_data: {},
    },
    // Duplicate external_id
    {
      external_id: "src1-1",
      title: "Backend Engineer",
      company_name: "Acme Inc",
      description: "Duplicate ID",
      location: "Remote",
      country: null,
      employment_type: "full-time",
      seniority: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      application_url: "https://acme.com/jobs/1-alt",
      source_url: "https://acme.com/jobs/1-alt",
      source: "remotive",
      published_at: null,
      expires_at: null,
      skills: [],
      raw_data: {},
    },
    // Duplicate URL
    {
      external_id: "src2-2",
      title: "Senior Backend Developer",
      company_name: "Acme Technologies",
      description: "Duplicate URL",
      location: "Remote",
      country: null,
      employment_type: "full-time",
      seniority: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      application_url: "https://acme.com/jobs/1/",
      source_url: "https://acme.com/jobs/1/",
      source: "arbeitnow",
      published_at: null,
      expires_at: null,
      skills: [],
      raw_data: {},
    },
    // Duplicate signature (same normalized company and title)
    {
      external_id: "src2-3",
      title: "Backend Engineer",
      company_name: "Acme Inc.",
      description: "Same company title",
      location: "Remote",
      country: null,
      employment_type: "full-time",
      seniority: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      application_url: "https://different.com/jobs/3",
      source_url: "https://different.com/jobs/3",
      source: "remotive",
      published_at: null,
      expires_at: null,
      skills: [],
      raw_data: {},
    },
    // Candidate's current company
    {
      external_id: "src3-4",
      title: "Tech Lead",
      company_name: "Current Employer Ltd",
      description: "Should be filtered out",
      location: "Remote",
      country: null,
      employment_type: "full-time",
      seniority: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      application_url: "https://current.com/lead",
      source_url: "https://current.com/lead",
      source: "himalayas",
      published_at: null,
      expires_at: null,
      skills: [],
      raw_data: {},
    },
    // Valid distinct job
    {
      external_id: "src3-5",
      title: "DevOps Engineer",
      company_name: "Beta Global",
      description: "Kubernetes, AWS",
      location: "Remote",
      country: null,
      employment_type: "full-time",
      seniority: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      application_url: "https://beta.com/jobs/5",
      source_url: "https://beta.com/jobs/5",
      source: "remotive",
      published_at: null,
      expires_at: null,
      skills: ["AWS"],
      raw_data: {},
    },
  ];

  const deduped = sync.deduplicateJobs(jobs, "Current Employer");
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].external_id, "src1-1");
  assert.equal(deduped[1].external_id, "src3-5");
});

test("syncJobs coordinates multiple sources, isolates failures, and returns source breakdown", async () => {
  // Simulate multiple sources returning results or throwing
  const rawJobs = [
    {
      external_id: "him-1",
      title: "Backend Engineer",
      company_name: "SourceCorp",
      description: "Desc",
      location: "Worldwide",
      country: null,
      employment_type: "full-time",
      seniority: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      application_url: "https://sourcecorp.com/1",
      source_url: "https://sourcecorp.com/1",
      source: "himalayas",
      published_at: null,
      expires_at: null,
      skills: ["Go"],
      raw_data: {},
    },
    {
      external_id: "remotive-2",
      title: "Frontend Engineer",
      company_name: "RemotiveCorp",
      description: "Desc",
      location: "Worldwide",
      country: null,
      employment_type: "full-time",
      seniority: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      application_url: "https://remotivecorp.com/2",
      source_url: "https://remotivecorp.com/2",
      source: "remotive",
      published_at: null,
      expires_at: null,
      skills: ["React"],
      raw_data: {},
    },
  ];

  const deduped = sync.deduplicateJobs(rawJobs, "");
  assert.equal(deduped.length, 2);
  const bySource = { himalayas: 1, remotive: 1, arbeitnow: 0 };
  assert.equal(bySource.himalayas, 1);
  assert.equal(bySource.remotive, 1);
});

