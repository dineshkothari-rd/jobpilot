import assert from "node:assert/strict";
import test from "node:test";
import {
  descriptionText,
  discoveryFilters,
  jobPosting,
  jsonLd,
  likeLiteral,
} from "./discovery.ts";
test("public search bounds pages and rejects repeated/oversized filters; LIKE and JSON-LD escape hostile input", () => {
  assert.deepEqual(
    discoveryFilters({ q: " React ", location: "India", page: "2" }),
    { q: "React", location: "India", page: 2 },
  );
  for (const values of [
    { page: "0" },
    { page: "101" },
    { page: "1.5" },
    { q: ["a", "b"] },
    { q: "x".repeat(101) },
  ])
    assert.throws(() => discoveryFilters(values));
  assert.equal(likeLiteral("a%_\\b"), "a\\%\\_\\\\b");
  assert.ok(
    !jsonLd({ title: "</script><script>alert(1)</script>" }).includes("<"),
  );
  assert.deepEqual(JSON.parse(jsonLd({ title: "<text>" })), {
    title: "<text>",
  });
});
test("JobPosting uses direct employer facts and omits expired, aggregated or ambiguous location records", () => {
  const j = {
    id: "fixture",
    source: "jobpilot",
    title: "Engineer",
    company_name: "Employer",
    country: "IN",
    location: "Pune",
    published_at: "2026-01-01T00:00:00Z",
    expires_at: null,
  };
  const s = jobPosting(j, "React\nBuild <products>", "https://jobpilot.test");
  assert.equal(s.jobLocation.address.addressCountry, "IN");
  assert.equal(s.url, "https://jobpilot.test/opportunities/fixture");
  assert.match(s.description, /&lt;products&gt;/);
  assert.equal(s.baseSalary, undefined);
  for (const patch of [
    { source: "remotive" },
    { country: null },
    { published_at: "bad" },
    { expires_at: "2000-01-01" },
    { location: "Remote / India" },
    { location: "Hybrid Pune" },
  ])
    assert.equal(
      jobPosting({ ...j, ...patch }, "Description", "https://jobpilot.test"),
      null,
    );
  const r = jobPosting(
    { ...j, location: "Remote" },
    "Remote in India",
    "https://jobpilot.test",
  );
  assert.equal(r.jobLocationType, "TELECOMMUTE");
  assert.equal(r.applicantLocationRequirements.name, "IN");
});

test("public descriptions extract text without a server DOM and preserve escaped text safely", () => {
  assert.equal(descriptionText('<p>A &amp; B</p><script>alert(1)</script><style>hide</style><!-- hidden --><p>&lt;img src=x onerror=alert(1)&gt; &#x1f680;</p>'), 'A & B\n<img src=x onerror=alert(1)> 🚀');
  assert.equal(descriptionText(null), '');
  assert.equal(descriptionText('&#999999999; &#55296;'), '&#999999999; &#55296;');
  assert.ok(!jsonLd({ description: descriptionText('&lt;/script&gt;') }).includes('<'));
});
