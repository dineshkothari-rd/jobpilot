import assert from "node:assert/strict";
import test from "node:test";
import * as internships from "./internships.ts";

test("isInternshipOrFresher correctly identifies internships and entry roles", () => {
  assert.equal(
    internships.isInternshipOrFresher({
      title: "Frontend Engineering Intern",
      employment_type: "internship",
    }),
    true,
  );

  assert.equal(
    internships.isInternshipOrFresher({
      title: "Graduate Trainee Software Engineer",
      seniority: "Entry",
    }),
    true,
  );

  assert.equal(
    internships.isInternshipOrFresher({
      title: "Junior Data Analyst (0-2 years)",
      seniority: "Junior",
    }),
    true,
  );

  assert.equal(
    internships.isInternshipOrFresher({
      title: "Associate Product Designer",
      seniority: "Entry Level",
    }),
    true,
  );

  // Senior roles must be excluded even if description mentions interns
  assert.equal(
    internships.isInternshipOrFresher({
      title: "Senior Engineering Manager",
      description: "You will mentor interns and junior engineers",
    }),
    false,
  );

  assert.equal(
    internships.isInternshipOrFresher({
      title: "Principal Architect",
      seniority: "Staff",
    }),
    false,
  );
});

test("classifyOpportunityType differentiates internships from fresher roles", () => {
  assert.equal(
    internships.classifyOpportunityType({
      title: "Summer Software Engineering Intern",
      employment_type: "internship",
    }),
    "internship",
  );

  assert.equal(
    internships.classifyOpportunityType({
      title: "Junior React Developer",
      employment_type: "full-time",
      seniority: "Junior",
    }),
    "fresher",
  );

  assert.equal(
    internships.classifyOpportunityType({
      title: "Graduate Trainee (Batch of 2026)",
      employment_type: "full-time",
    }),
    "fresher",
  );
});

test("detectInternshipDuration extracts duration windows", () => {
  assert.equal(
    internships.detectInternshipDuration({
      title: "Backend Intern (3 months)",
      description: "12 weeks summer program",
    }),
    "1-3m",
  );

  assert.equal(
    internships.detectInternshipDuration({
      title: "Fall Co-op (6 months)",
      description: "24 weeks university semester co-op",
    }),
    "3-6m",
  );

  assert.equal(
    internships.detectInternshipDuration({
      title: "Long term 1 year internship",
      description: "9 months to 1 year commitment",
    }),
    "6m+",
  );

  assert.equal(
    internships.detectInternshipDuration({
      title: "Product Intern",
      description: "Join our active growth team",
    }),
    "flexible",
  );
});

test("parseMonthlyStipend handles monthly stipends and annual conversions", () => {
  // Monthly INR stipend
  const inrStipend = internships.parseMonthlyStipend({
    salary_min: 20000,
    salary_max: 35000,
    salary_currency: "INR",
  });
  assert.equal(inrStipend.isStipend, true);
  assert.equal(inrStipend.monthlyMin, 20000);
  assert.equal(inrStipend.monthlyMax, 35000);

  // Annual INR CTC (e.g. 6 LPA = 600,000 INR)
  const annualInr = internships.parseMonthlyStipend({
    salary_min: 600000,
    salary_max: 900000,
    salary_currency: "INR",
  });
  assert.equal(annualInr.isStipend, false);
  assert.equal(annualInr.monthlyMin, 50000); // 600,000 / 12
  assert.equal(annualInr.monthlyMax, 75000); // 900,000 / 12

  // Monthly USD stipend
  const usdStipend = internships.parseMonthlyStipend({
    salary_min: 1500,
    salary_max: 2500,
    salary_currency: "USD",
  });
  assert.equal(usdStipend.isStipend, true);
  assert.equal(usdStipend.monthlyMin, 1500);
  assert.equal(usdStipend.monthlyMax, 2500);
});

test("matchesInternshipFilters filters correctly by category and stipend", () => {
  const internRole = {
    title: "Data Science Intern",
    employment_type: "internship",
    description: "3 months duration",
    salary_min: 25000,
    salary_max: 30000,
    salary_currency: "INR",
  };

  const fresherRole = {
    title: "Junior Backend Developer",
    employment_type: "full-time",
    seniority: "Junior",
    salary_min: 600000,
    salary_max: 800000,
    salary_currency: "INR",
  };

  // Category filter
  assert.equal(internships.matchesInternshipFilters(internRole, { category: "internship" }), true);
  assert.equal(internships.matchesInternshipFilters(internRole, { category: "fresher" }), false);
  assert.equal(internships.matchesInternshipFilters(fresherRole, { category: "fresher" }), true);
  assert.equal(internships.matchesInternshipFilters(fresherRole, { category: "internship" }), false);

  // Duration filter
  assert.equal(internships.matchesInternshipFilters(internRole, { duration: "1-3m" }), true);
  assert.equal(internships.matchesInternshipFilters(internRole, { duration: "6m+" }), false);

  // Stipend floor
  assert.equal(internships.matchesInternshipFilters(internRole, { minStipendFloor: 20000 }), true);
  assert.equal(internships.matchesInternshipFilters(internRole, { minStipendFloor: 50000 }), false);
});
