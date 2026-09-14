import type { ParsedResume } from "./parser.ts";

export type AtsIssue = {
  id: string;
  severity: "critical" | "warning" | "improvement";
  section: string;
  title: string;
  reason: string;
  correction: string;
};

export type ResumeSuggestion = {
  id: string;
  section: "summary" | "experience";
  itemIndex?: number;
  bulletIndex?: number;
  before: string;
  after: string;
  requiresConfirmation: boolean;
};

export type AtsAnalysis = {
  score: number;
  label: string;
  categories: {
    contact: number;
    structure: number;
    content: number;
    targeting: number;
  };
  issues: AtsIssue[];
  passed: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: ResumeSuggestion[];
  preparationPlan: { day: string; title: string; tasks: string[] }[];
};

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "but", "for", "from", "have",
  "into", "job", "our", "role", "that", "the", "their", "this", "using",
  "will", "with", "work", "years", "you", "your",
]);

function words(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function resumeText(resume: ParsedResume) {
  return [
    resume.summary,
    ...Object.values(resume.skills).flat(),
    ...resume.experience.flatMap((item) => [item.role, item.company, ...item.description]),
    ...resume.projects.flatMap((item) => [item.name, ...item.technologies, ...item.description]),
    ...resume.education.flatMap((item) => [item.degree, item.institution, ...item.details]),
    ...resume.achievements,
  ].join(" ");
}

function addIssue(issues: AtsIssue[], issue: Omit<AtsIssue, "id">) {
  issues.push({ ...issue, id: `${issue.section}-${issues.length + 1}` });
}

function keywordComparison(resume: ParsedResume, jobDescription: string) {
  if (!jobDescription.trim()) return { matched: [], missing: [] };

  const counts = new Map<string, number>();
  for (const word of words(jobDescription)) counts.set(word, (counts.get(word) || 0) + 1);

  const jobKeywords = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([word]) => word)
    .slice(0, 24);
  const candidateWords = new Set(words(resumeText(resume)));

  return {
    matched: jobKeywords.filter((word) => candidateWords.has(word)).slice(0, 12),
    missing: jobKeywords.filter((word) => !candidateWords.has(word)).slice(0, 12),
  };
}

function buildSuggestions(resume: ParsedResume): ResumeSuggestion[] {
  const suggestions: ResumeSuggestion[] = [];
  const skills = unique(Object.values(resume.skills).flat()).slice(0, 5);
  const latestRole = resume.experience[0]?.role.trim();

  if (!resume.summary.trim() && latestRole && skills.length) {
    suggestions.push({
      id: "grounded-summary",
      section: "summary",
      before: "",
      after: `${latestRole} with experience using ${skills.join(", ")}.`,
      requiresConfirmation: false,
    });
  }

  resume.experience.forEach((experience, itemIndex) => {
    experience.description.forEach((bullet, bulletIndex) => {
      const cleaned = bullet.trim();
      if (/^responsible for\s+/i.test(cleaned)) {
        suggestions.push({
          id: `experience-${itemIndex}-${bulletIndex}`,
          section: "experience",
          itemIndex,
          bulletIndex,
          before: bullet,
          after: cleaned.replace(/^responsible for\s+/i, "Worked on "),
          requiresConfirmation: false,
        });
      }
    });
  });

  return suggestions.slice(0, 8);
}

export function analyzeResume(
  resume: ParsedResume,
  jobDescription = "",
): AtsAnalysis {
  const issues: AtsIssue[] = [];
  const passed: string[] = [];
  const contactChecks = [resume.personalInfo.name, resume.personalInfo.email, resume.personalInfo.phone];

  if (!resume.personalInfo.name.trim()) addIssue(issues, {
    severity: "critical", section: "Contact", title: "Name is missing",
    reason: "Recruiters and ATS tools need a clear candidate identity.", correction: "Add your full professional name.",
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.personalInfo.email.trim())) addIssue(issues, {
    severity: "critical", section: "Contact", title: "Email is missing or invalid",
    reason: "An unreadable email prevents recruiter follow-up.", correction: "Add a valid professional email address.",
  });
  if (!resume.personalInfo.phone.trim()) addIssue(issues, {
    severity: "warning", section: "Contact", title: "Phone number is missing",
    reason: "Many recruiters use phone screening as the first step.", correction: "Add a reachable phone number with country code.",
  });
  if (contactChecks.every((value) => value.trim())) passed.push("Core contact details are present");

  if (!resume.summary.trim()) addIssue(issues, {
    severity: "warning", section: "Summary", title: "Professional summary is missing",
    reason: "A short grounded summary helps establish role fit quickly.", correction: "Add a 2–3 line summary based only on your real experience and skills.",
  }); else if (words(resume.summary).length > 80) addIssue(issues, {
    severity: "improvement", section: "Summary", title: "Summary is too long",
    reason: "Dense summaries hide the most relevant information.", correction: "Reduce the summary to 40–70 words.",
  }); else passed.push("Professional summary is concise");

  if (!resume.experience.length) addIssue(issues, {
    severity: "warning", section: "Experience", title: "Experience section is empty",
    reason: "ATS matching relies heavily on role and responsibility context.", correction: "Add genuine work, internship, freelance, or relevant project experience.",
  }); else passed.push("Experience section is present");

  if (!unique(Object.values(resume.skills).flat()).length) addIssue(issues, {
    severity: "warning", section: "Skills", title: "Skills section is empty",
    reason: "Explicit skills improve accurate keyword matching.", correction: "Add only skills you can genuinely demonstrate.",
  }); else passed.push("Machine-readable skills are present");

  const bullets = resume.experience.flatMap((item) => item.description);
  const longBullets = bullets.filter((bullet) => words(bullet).length > 35).length;
  if (longBullets) addIssue(issues, {
    severity: "improvement", section: "Experience", title: `${longBullets} long bullet${longBullets === 1 ? "" : "s"}`,
    reason: "Long bullets are difficult to scan and can bury outcomes.", correction: "Keep each bullet focused on one action and outcome, usually under 35 words.",
  }); else if (bullets.length) passed.push("Experience bullets are scannable");

  const normalizedBullets = bullets.map((bullet) => words(bullet).join(" ")).filter(Boolean);
  if (new Set(normalizedBullets).size < normalizedBullets.length) addIssue(issues, {
    severity: "improvement", section: "Experience", title: "Repeated experience bullets",
    reason: "Repeated statements reduce information density.", correction: "Keep the strongest version and replace duplicates with distinct factual contributions.",
  }); else if (bullets.length) passed.push("No duplicate experience bullets detected");

  const comparison = keywordComparison(resume, jobDescription);
  if (jobDescription.trim() && comparison.missing.length) addIssue(issues, {
    severity: "improvement", section: "Job targeting", title: "Relevant terms need review",
    reason: "The job description contains terms not found in this resume.", correction: "Review missing terms and add only those that truthfully describe your background.",
  }); else if (jobDescription.trim()) passed.push("Resume includes the main detected job keywords");

  const deductions = issues.reduce((total, issue) =>
    total + (issue.severity === "critical" ? 15 : issue.severity === "warning" ? 9 : 4), 0);
  const targeting = !jobDescription.trim()
    ? 70
    : Math.round((comparison.matched.length / Math.max(1, comparison.matched.length + comparison.missing.length)) * 100);
  const score = Math.max(0, Math.min(100, 100 - deductions - (jobDescription.trim() ? Math.round((100 - targeting) * 0.15) : 0)));

  const focus = comparison.missing.slice(0, 3);
  const role = resume.experience[0]?.role || "the target role";
  const preparationPlan = [
    ["Day 1", "Map the role", ["Review the job description line by line.", `Mark evidence from your resume for ${role}.`]],
    ["Day 2", "Close knowledge gaps", focus.length ? focus.map((item) => `Review ${item}; add it only if you can demonstrate it.`) : ["Review the role's core skills and note genuine examples."]],
    ["Day 3", "Prepare project stories", resume.projects.slice(0, 3).map((item) => `Prepare the problem, action and outcome for ${item.name}.`)],
    ["Day 4", "Prepare experience stories", resume.experience.slice(0, 3).map((item) => `Prepare a factual STAR example from ${item.role} at ${item.company}.`)],
    ["Day 5", "Technical practice", unique(Object.values(resume.skills).flat()).slice(0, 4).map((item) => `Revise ${item} fundamentals and one real usage example.`)],
    ["Day 6", "Mock interview", ["Practice a 60-second introduction.", "Answer five role-specific questions aloud.", "Prepare questions for the interviewer."]],
    ["Day 7", "Final review", ["Review the tailored resume for factual accuracy.", "Check dates, links and contact details.", "Rest and prepare interview logistics."]],
  ].map(([day, title, tasks]) => ({ day: day as string, title: title as string, tasks: (tasks as string[]).filter(Boolean) }));

  return {
    score,
    label: score >= 85 ? "Strong" : score >= 70 ? "Good foundation" : score >= 50 ? "Needs work" : "High priority fixes",
    categories: {
      contact: Math.max(0, 100 - issues.filter((issue) => issue.section === "Contact").length * 25),
      structure: resume.experience.length && resume.education.length ? 100 : 70,
      content: Math.max(0, 100 - issues.filter((issue) => ["Summary", "Experience", "Skills"].includes(issue.section)).length * 12),
      targeting,
    },
    issues,
    passed,
    matchedKeywords: comparison.matched,
    missingKeywords: comparison.missing,
    suggestions: buildSuggestions(resume),
    preparationPlan,
  };
}

export function applyResumeSuggestion(resume: ParsedResume, suggestion: ResumeSuggestion) {
  const updated = structuredClone(resume);
  if (suggestion.requiresConfirmation) return updated;

  if (suggestion.section === "summary") updated.summary = suggestion.after;
  if (suggestion.section === "experience" && suggestion.itemIndex != null && suggestion.bulletIndex != null) {
    const bullet = updated.experience[suggestion.itemIndex]?.description[suggestion.bulletIndex];
    if (bullet === suggestion.before) updated.experience[suggestion.itemIndex].description[suggestion.bulletIndex] = suggestion.after;
  }

  return updated;
}
