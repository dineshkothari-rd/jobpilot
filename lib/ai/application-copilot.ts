export type CopilotInput = {
  job: {
    title: string;
    company: string;
    description: string;
    location: string;
    seniority: string;
    employmentType: string;
    skills: string[];
  };
  candidate: {
    name: string;
    targetRole: string;
    experienceYears: number;
    location: string;
    skills: string[];
    summary: string;
    experience: Array<{
      role: string;
      company: string;
      duration: string;
      descriptions: string[];
    }>;
    projects: Array<{
      name: string;
      description: string;
    }>;
  };
};

export type CopilotResult = {
  fitScore: number;
  fitLabel: string;
  primaryRecommendation: string;
  strengths: string[];
  missingKeywords: string[];
  improvementAreas: string[];
  roleAlignment: string;
  skillAlignment: string;
  experienceAlignment: string;
  resumeHighlights: string[];
  tailoredSummary: string;
  tailoredBullets: string[];
  suggestedKeywords: string[];
  coverLetter: string;
  strategy: Array<{ title: string; description: string }>;
  strongestSellingPoints: string[];
  potentialObjections: string[];
  positioning: string;
  preparationActions: string[];
};

const skillAliases: Record<string, string[]> = {
  react: ["react", "react.js", "reactjs"],
  "next.js": ["next.js", "nextjs", "next js"],
  typescript: ["typescript", "ts"],
  javascript: ["javascript", "js"],
  "redux toolkit": ["redux toolkit", "redux"],
  "tailwind css": ["tailwind css", "tailwind"],
  "material ui": ["material ui", "mui"],
  "rest apis": ["rest api", "rest apis", "restful api", "restful apis"],
  microfrontends: ["microfrontend", "microfrontends", "micro frontends"],
  "module federation": ["module federation"],
  "react native": ["react native"],
  firebase: ["firebase"],
  firestore: ["firestore"],
  "fabric.js": ["fabric.js", "fabric"],
  vite: ["vite"],
  git: ["git"],
};

const normalize = (value: string) => value.toLowerCase()
  .replace(/[^a-z0-9+#.\s-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const unique = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

function containsTerm(text: string, term: string) {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term);
  if (!normalizedText || !normalizedTerm) return false;
  return normalizedText.includes(normalizedTerm) || normalizedTerm.split(" ").filter(Boolean)
    .every((word) => normalizedText.includes(word));
}

function canonicalSkill(skill: string) {
  const normalized = normalize(skill);
  for (const [canonical, aliases] of Object.entries(skillAliases)) {
    if (aliases.some((alias) => normalized === normalize(alias))) return canonical;
  }
  return normalized;
}

function extractRequirementKeywords(description: string) {
  return unique(Object.entries(skillAliases).flatMap(([canonical, aliases]) =>
    [canonical, ...aliases].filter((keyword) => containsTerm(description, keyword)),
  )).map(canonicalSkill);
}

function expectedExperience(seniority: string) {
  const value = normalize(seniority);
  if (/staff|principal|lead|senior/.test(value)) return 5;
  if (/mid|intermediate/.test(value)) return 2;
  return 0;
}

function experienceScore(years: number, seniority: string) {
  const expected = expectedExperience(seniority);
  if (!expected) return years > 0 ? 80 : 55;
  if (years >= expected) return 100;
  if (years >= Math.max(1, expected - 2)) return 70;
  return 40;
}

function buildTailoredBullets(input: CopilotInput, matchedSkills: string[]) {
  const entries = input.candidate.experience
    .flatMap((item) => item.descriptions.map((description) => ({
      text: `${item.role || "Experience"}${item.company ? ` at ${item.company}` : ""}: ${description}`,
      relevance: matchedSkills.filter((skill) => containsTerm(`${item.role} ${description}`, skill)).length,
    })));
  const projects = input.candidate.projects
    .filter((item) => item.description.trim())
    .map((item) => ({
      text: `${item.name || "Project"}: ${item.description.trim()}`,
      relevance: matchedSkills.filter((skill) => containsTerm(item.description, skill)).length,
    }));
  return [...entries, ...projects]
    .sort((a, b) => b.relevance - a.relevance)
    .map((item) => item.text)
    .slice(0, 5);
}

function buildCoverLetter(input: CopilotInput, matchedSkills: string[]) {
  const role = input.job.title || "the position";
  const company = input.job.company || "your company";
  const years = input.candidate.experienceYears > 0
    ? `I bring ${input.candidate.experienceYears}+ years of professional experience.`
    : "My resume outlines the experience and projects relevant to my application.";
  const skills = matchedSkills.length
    ? `My resume-supported skills relevant to this role include ${matchedSkills.slice(0, 5).join(", ")}.`
    : "I would welcome the opportunity to discuss how my documented experience relates to your needs.";
  const example = input.candidate.experience.find((item) => item.descriptions.length);
  const evidence = example
    ? `One example from my experience as ${example.role || "a contributor"}${example.company ? ` at ${example.company}` : ""} is: ${example.descriptions[0]}`
    : "I am prepared to discuss the projects and experience included in my resume.";

  return `Dear Hiring Manager,

I am applying for the ${role} role at ${company}. ${years}

${skills} ${evidence}

I am interested in learning more about the team, its priorities, and how my background could contribute. I would value the opportunity to discuss the role with you.

Best regards,
${input.candidate.name}`;
}

export function generateApplicationCopilot(input: CopilotInput): CopilotResult {
  const jobText = [input.job.title, input.job.description, input.job.skills.join(" "), input.job.seniority].join(" ");
  const requirements = unique([
    ...input.job.skills.map(canonicalSkill),
    ...extractRequirementKeywords(jobText),
  ]);
  const candidateSkills = unique(input.candidate.skills.map(canonicalSkill));
  const matchedSkills = requirements.filter((requirement) => candidateSkills.some((skill) =>
    skill === requirement || skill.includes(requirement) || requirement.includes(skill),
  ));
  const missingKeywords = requirements.filter((skill) => !matchedSkills.includes(skill));
  const skillCoverage = requirements.length ? Math.round(matchedSkills.length / requirements.length * 100) : 50;
  const roleMatched = containsTerm(input.job.title, input.candidate.targetRole);
  const roleScore = input.candidate.targetRole ? (roleMatched ? 100 : 55) : 50;
  const experienceFit = experienceScore(input.candidate.experienceYears, input.job.seniority);
  const fitScore = Math.round(skillCoverage * 0.55 + roleScore * 0.25 + experienceFit * 0.2);
  const fitLabel = fitScore >= 85 ? "Excellent fit" : fitScore >= 70 ? "Strong fit" : fitScore >= 55 ? "Potential fit" : "Needs work";
  const strengths = [
    matchedSkills.length ? `Resume-supported overlap: ${matchedSkills.slice(0, 6).join(", ")}.` : "No verified keyword overlap was found in the current resume.",
    input.candidate.experience.length
      ? `${input.candidate.experience.length} work experience ${input.candidate.experience.length === 1 ? "entry is" : "entries are"} available to tailor.`
      : "No work experience entries were found in the parsed resume.",
  ];
  const improvementAreas = [
    ...missingKeywords.slice(0, 5).map((keyword) => `Add ${keyword} only if your real experience supports it; otherwise prepare to address the gap.`),
    ...(input.candidate.experience.length ? [] : ["Add accurate work experience or relevant projects before applying."]),
  ];
  const tailoredBullets = buildTailoredBullets(input, matchedSkills);
  const baseSummary = input.candidate.summary.trim();
  const tailoredSummary = [
    baseSummary,
    matchedSkills.length ? `Relevant resume-supported skills for this role include ${matchedSkills.slice(0, 6).join(", ")}.` : "",
  ].filter(Boolean).join(" ") || "Add a professional summary to your resume before tailoring it for this role.";
  const roleAlignment = input.candidate.targetRole
    ? (roleMatched ? `The job title aligns with your target role: ${input.candidate.targetRole}.` : `The job title does not directly match your target role: ${input.candidate.targetRole}.`)
    : "No target role is configured in your profile.";
  const skillAlignment = requirements.length
    ? `${matchedSkills.length} of ${requirements.length} detected requirements are supported by your resume skills.`
    : "The job listing does not provide enough recognized skill keywords for a confident comparison.";
  const requiredYears = expectedExperience(input.job.seniority);
  const experienceAlignment = requiredYears
    ? `${input.candidate.experienceYears} years recorded against an estimated ${requiredYears}+ years for the listed seniority.`
    : `${input.candidate.experienceYears} years are recorded; the listing does not provide a clear experience threshold.`;
  const primaryRecommendation = missingKeywords.length
    ? `Lead with ${matchedSkills.slice(0, 3).join(", ") || "your documented experience"}, and do not add unsupported keywords.`
    : "Lead with the resume evidence already aligned to this role, then add measurable outcomes where accurate.";
  const potentialObjections = improvementAreas.length
    ? improvementAreas.slice(0, 4)
    : ["The resume may still need clearer measurable outcomes and role-specific evidence."];
  const positioning = `Position yourself around ${matchedSkills.slice(0, 3).join(", ") || "your strongest documented experience"}; keep every claim traceable to your resume.`;
  const preparationActions = [
    "Review every suggested sentence and remove anything you cannot verify.",
    missingKeywords.length ? `Prepare honest examples for: ${missingKeywords.slice(0, 4).join(", ")}.` : "Prepare one concrete impact story for each major responsibility.",
    "Use Interview Studio to practice role-specific answers before submitting.",
  ];
  const strategy = [
    { title: "Lead with evidence", description: positioning },
    { title: "Close only real gaps", description: potentialObjections[0] },
    { title: "Make impact concrete", description: "Add metrics only where you can verify the outcome, scope, or improvement." },
    { title: "Prepare the handoff", description: preparationActions[2] },
  ];

  return {
    fitScore,
    fitLabel,
    primaryRecommendation,
    strengths,
    missingKeywords,
    improvementAreas,
    roleAlignment,
    skillAlignment,
    experienceAlignment,
    resumeHighlights: tailoredBullets,
    tailoredSummary,
    tailoredBullets,
    suggestedKeywords: matchedSkills,
    coverLetter: buildCoverLetter(input, matchedSkills),
    strategy,
    strongestSellingPoints: strengths,
    potentialObjections,
    positioning,
    preparationActions,
  };
}
