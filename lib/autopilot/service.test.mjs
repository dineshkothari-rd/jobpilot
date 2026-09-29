import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import { evaluateAutoApply } from "./eligibility.ts";
import { preferencesFromRow } from "./preferences.ts";
import { shouldPrepare } from "./schedule.ts";
import { candidateAnswersWithFacts, parseApplicationFacts } from "../applications/facts.ts";

// Compile only this service in memory so the check needs no Next.js server or real database.
const service = new Module(import.meta.filename);
service.require = (name) => {
  if (name === "server-only") return {};
  if (name === "./schedule") return { shouldPrepare };
  if (name === "../applications/facts") return { candidateAnswersWithFacts, parseApplicationFacts };
  if (name === "./preferences") return { preferencesFromRow };
  if (name === "./eligibility") return { evaluateAutoApply };
  if (name === "../matching/scorer") return { calculateMatchScore: () => ({ score: 90 }), getResumeSkills: () => [] };
  if (name === "../ai/application-copilot") return { generateApplicationCopilot: () => ({ tailoredSummary: "Grounded summary", coverLetter: "Cover note" }) };
  throw new Error(`Unexpected dependency: ${name}`);
};
service._compile(ts.transpileModule(readFileSync(new URL("./service.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, import.meta.filename);
const { runAutopilot } = service.exports;

function database({ busy = false, failSave = false, submissions = [], facts = {} } = {}) {
  const writes = [];
  return {
    writes,
    from(table) {
      let operation = "select";
      let payload;
      let single = false;
      const query = new Proxy({}, {
        get(_, method) {
          if (method === "then") return (resolve) => {
            if (operation !== "select") writes.push({ table, operation, payload });
            let data = [];
            let error = null;
            if (table === "autopilot_preferences") data = { enabled: true, daily_limit: 1, work_authorization: "Authorized", notice_period: "Immediate", match_threshold: 70 };
            if (table === "profiles") data = { full_name: "Candidate Name", target_role: "Engineer", location: "India", experience_years: 2, application_facts: facts };
            if (table === "resumes") data = operation === "insert" ? { id: "tailored" } : { id: "primary", file_name: "resume.pdf", parsed_data: { summary: "Real experience", skills: {} } };
            if (table === "jobs") data = ["job-1", "job-2"].map((id) => ({ id, title: "Engineer", company_name: "Acme", application_url: "https://example.com/apply" }));
            if (table === "application_submissions") data = operation === "select" ? submissions : { id: "package", created_at: new Date().toISOString(), ...payload };
            if (table === "applications" && operation === "insert") data = { id: "application", ...payload };
            if (table === "automation_actions") {
              data = single ? { id: payload?.job_id ? "job-action" : "run", ...payload } : [];
              if (busy && operation === "insert" && !payload.job_id) error = { code: "23505" };
            }
            if (failSave && table === "saved_jobs" && operation === "upsert") error = new Error("Save failed");
            resolve({ data, error });
          };
          return (...args) => {
            if (["insert", "update", "upsert", "delete"].includes(method)) { operation = method; payload = args[0]; }
            if (["single", "maybeSingle"].includes(method)) single = true;
            return query;
          };
        },
      });
      return query;
    },
  };
}

test("overlapping runs stop before preparing any jobs", async () => {
  const db = database({ busy: true });
  await assert.rejects(runAutopilot(db, "owner"), (error) => error.status === 409);
  assert.equal(db.writes.some((write) => write.table === "resumes"), false);
});

test("daily limit caps packages and leaves no running job action", async () => {
  const db = database();
  const result = await runAutopilot(db, "owner");
  assert.equal(result.processed, 1);
  assert.equal(db.writes.filter((write) => write.table === "application_submissions").length, 1);
  assert.equal(db.writes.filter((write) => write.table === "automation_actions" && write.operation === "update" && write.payload.status === "completed").length, 2);
});

test("preparation records a saved application without claiming submission", async () => {
  const db = database();
  await runAutopilot(db, "owner");
  const application = db.writes.find((write) => write.table === "applications" && write.operation === "insert");
  assert.equal(application.payload.status, "saved");
  assert.notEqual(application.payload.status, "applied");
});

test("prepared packages are not duplicated", async () => {
  const db = database({ submissions: [{ job_id: "job-1", status: "prepared", created_at: "2020-01-01" }] });
  await runAutopilot(db, "owner");
  const packages = db.writes.filter((write) => write.table === "application_submissions");
  assert.equal(packages.length, 1);
  assert.equal(packages[0].payload.job_id, "job-2");
});

test("persisted packages still consume the daily cap when a later step fails", async () => {
  const db = database({ failSave: true });
  await runAutopilot(db, "owner");
  assert.equal(db.writes.filter((write) => write.table === "application_submissions").length, 1);
});

test("preparation reuses confirmed compensation without duplicating legal preference storage", async () => {
  const db = database({ facts: { "Current CTC": "INR 12 lakh/year" } });
  await runAutopilot(db, "owner");
  const answers = db.writes.find((write) => write.table === "application_submissions").payload.application_answers;
  assert.equal(answers.find((answer) => answer.question === "Notice period").answer, "Immediate");
  assert.equal(answers.find((answer) => answer.question === "Current CTC").answer, "INR 12 lakh/year");
});
