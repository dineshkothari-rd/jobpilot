import { generateInterviewSession, type InterviewQuestion } from "./interview-engine.ts";
import { generateJobPreparation, type JobPreparation } from "./job-preparation.ts";

export type InterviewLearningInput = {
  job: {
    id: string;
    title: string;
    company: string;
    description: string;
    location: string | null;
    seniority: string | null;
    employmentType: string | null;
    salary: string | null;
    skills: string[];
  };
  candidate: {
    targetRole: string | null;
    experienceYears: number | null;
    skills: string[];
    hasProfile: boolean;
    hasResume: boolean;
    hasUsableResume: boolean;
  };
  matchScore: number | null;
  application: {
    id: string;
    status: string;
    follow_up_at: string | null;
  } | null;
};

export type ReadinessBreakdown = {
  label: string;
  value: number | null;
  detail: string;
};

export type LearningTopic = {
  id: string;
  category: "recommended" | "technical" | "role" | "behavioral" | "company" | "coding" | "final-review";
  title: string;
  status: "recommended" | "session-reviewed";
  difficulty: "Easy" | "Medium" | "Hard";
  importance: "High" | "Medium" | "Low";
  estimatedMinutes: number;
  shortExplanation: string;
  detailedExplanation: string;
  keyConcepts: string[];
  questions: string[];
  practicalExamples: string[];
  commonMistakes: string[];
  interviewTips: string[];
  practiceTask: string;
};

export type VideoLesson = {
  topicId: string;
  title: string;
  description: string;
  durationMinutes: number;
  learningObjectives: string[];
  script: string;
  chapters: { title: string; startMinute: number; summary: string }[];
  thumbnail: string | null;
  videoUrl: string | null;
  providerStatus: "not-configured" | "available";
  trustedResources: { label: string; url: string }[];
};

export type CodingPractice = {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  problem: string;
  expectedConcepts: string[];
  hints: string[];
  solutionApproach: string[];
  edgeCases: string[];
  complexity: string;
  externalUrl: string | null;
};

export type StudyPlanItem = {
  phase: string;
  title: string;
  why: string;
  effort: string;
  action: string;
};

export type WeakArea = {
  title: string;
  why: string;
  action: string;
};

export type InterviewPreparationHub = {
  preparation: JobPreparation;
  readiness: {
    score: number | null;
    label: string;
    progressLabel: string;
    primaryCta: { label: string; href: string };
    breakdown: ReadinessBreakdown[];
  };
  studyPlan: StudyPlanItem[];
  learningTopics: LearningTopic[];
  videoLessons: VideoLesson[];
  questionBank: Array<InterviewQuestion & {
    whyItMayBeAsked: string;
    strongAnswerShouldCover: string[];
    followUps: string[];
  }>;
  codingPractice: CodingPractice[];
  behavioralPrompts: LearningTopic[];
  rolePreparation: {
    jobDerived: string[];
    candidateDerived: string[];
    recommended: string[];
  };
  quickRevision: {
    mustKnowConcepts: string[];
    topQuestions: string[];
    resumeStories: string[];
    mistakes: string[];
    thirtyMinutePlan: string[];
    oneHourPlan: string[];
    threeHourPlan: string[];
  };
  weakAreas: WeakArea[];
  coachActions: { label: string; response: string }[];
  progress: {
    mode: "session-only";
    reviewedTopics: number;
    totalTopics: number;
    note: string;
  };
};

export type VideoLessonProvider = {
  generateLesson(input: LearningTopic): Promise<VideoLesson>;
};

const fallbackSkills = ["role fundamentals", "communication", "problem solving"];

const unique = (items: string[]) =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "topic";

const clamp = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();

function hasSkill(skill: string, candidateSkills: string[]) {
  const target = normalize(skill);
  return candidateSkills.some((candidate) => {
    const current = normalize(candidate);
    return current === target || current.includes(target) || target.includes(current);
  });
}

function getSkillGaps(jobSkills: string[], candidateSkills: string[]) {
  return jobSkills.filter((skill) => !hasSkill(skill, candidateSkills));
}

function importance(index: number, isGap: boolean): "High" | "Medium" | "Low" {
  if (isGap || index < 3) return "High";
  if (index < 6) return "Medium";
  return "Low";
}

function topicDifficulty(skill: string, seniority: string | null): "Easy" | "Medium" | "Hard" {
  const value = normalize(`${skill} ${seniority || ""}`);
  if (/system design|architecture|security|performance|senior|lead|staff/.test(value)) return "Hard";
  if (/typescript|react|node|api|testing|database|sql/.test(value)) return "Medium";
  return "Easy";
}

function buildLearningTopic(
  skill: string,
  input: InterviewLearningInput,
  category: LearningTopic["category"],
  index: number,
): LearningTopic {
  const isGap = !hasSkill(skill, input.candidate.skills);
  const role = input.job.title || "this role";

  return {
    id: slug(`${category}-${skill}`),
    category,
    title: skill,
    status: "recommended",
    difficulty: topicDifficulty(skill, input.job.seniority),
    importance: importance(index, isGap),
    estimatedMinutes: isGap ? 45 : 25,
    shortExplanation: `${skill} appears relevant to ${role}.`,
    detailedExplanation:
      `Prepare ${skill} through the lens of ${role}: what it solves, when to use it, trade-offs, failure modes, and one example from your own work if your resume supports it.`,
    keyConcepts: unique([
      `${skill} fundamentals`,
      "trade-offs",
      "debugging approach",
      "production constraints",
      input.job.seniority ? `${input.job.seniority} expectations` : "",
    ]),
    questions: [
      `How have you used ${skill} in a real project?`,
      `What trade-offs matter when using ${skill}?`,
      `How would you debug a production issue involving ${skill}?`,
    ],
    practicalExamples: [
      isGap
        ? `Prepare a small, honest example that demonstrates ${skill} before claiming it.`
        : `Use a resume-backed project where ${skill} influenced the outcome.`,
    ],
    commonMistakes: [
      "Giving definitions without examples.",
      "Claiming experience not supported by the resume.",
      "Skipping trade-offs, limitations, or failure cases.",
    ],
    interviewTips: [
      "Answer with context, decision, trade-off, and result.",
      "Name uncertainty instead of inventing experience.",
      "Tie the topic back to the job description.",
    ],
    practiceTask: `Explain ${skill} in two minutes, then answer one follow-up about a trade-off.`,
  };
}

function buildVideoLesson(topic: LearningTopic): VideoLesson {
  return {
    topicId: topic.id,
    title: `${topic.title} interview lesson`,
    description: `Narration-ready lesson for ${topic.title}.`,
    durationMinutes: Math.max(8, Math.ceil(topic.estimatedMinutes / 4)),
    learningObjectives: topic.keyConcepts.slice(0, 4),
    script: [
      `Today we are preparing ${topic.title} for an interview context.`,
      topic.detailedExplanation,
      `Start with ${topic.keyConcepts[0] || "the fundamentals"}, then connect it to a real project or an honest learning example.`,
      `Close with trade-offs, mistakes to avoid, and how you would apply it in this job.`,
    ].join("\n\n"),
    chapters: [
      { title: "Context", startMinute: 0, summary: topic.shortExplanation },
      { title: "Core concepts", startMinute: 2, summary: topic.keyConcepts.slice(0, 3).join(", ") },
      { title: "Interview answer", startMinute: 5, summary: topic.interviewTips[0] },
      { title: "Practice", startMinute: 8, summary: topic.practiceTask },
    ],
    thumbnail: null,
    videoUrl: null,
    providerStatus: "not-configured",
    trustedResources: [],
  };
}

function buildCodingPractice(topics: LearningTopic[]): CodingPractice[] {
  const codingTopics = topics.filter((topic) =>
    /react|typescript|javascript|node|api|sql|database|performance|testing|system design/i.test(topic.title),
  );

  return codingTopics.slice(0, 3).map((topic) => ({
    title: `${topic.title} practical scenario`,
    difficulty: topic.difficulty,
    topic: topic.title,
    problem:
      `Design or implement a small production-minded feature involving ${topic.title}. Explain the data flow, edge cases, and testing approach before writing code.`,
    expectedConcepts: topic.keyConcepts,
    hints: [
      "Clarify input and output first.",
      "Handle empty, invalid, and slow-path cases.",
      "Explain trade-offs before optimizing.",
    ],
    solutionApproach: [
      "Define the simplest working contract.",
      "Break the problem into data, state, and error paths.",
      "Add one focused test or self-check for the riskiest branch.",
    ],
    edgeCases: [
      "Missing data",
      "Malformed input",
      "Large payloads",
      "Network or persistence failure",
    ],
    complexity: "Discuss expected time/space complexity when the problem has an algorithmic core; otherwise discuss operational complexity.",
    externalUrl: null,
  }));
}

function buildStudyPlan(preparation: JobPreparation, gaps: string[]): StudyPlanItem[] {
  const firstGap = gaps[0] || preparation.importantTopics[0] || "role fundamentals";

  return [
    {
      phase: "Foundation",
      title: `Map the job to your real evidence`,
      why: "Strong interviews start with specific, defensible examples.",
      effort: "30-45 min",
      action: "Read the job description and mark the requirements your resume already supports.",
    },
    {
      phase: "Technical Preparation",
      title: `Deepen ${firstGap}`,
      why: gaps.length ? "This is a detected gap for the role." : "This is one of the strongest role topics.",
      effort: "45-90 min",
      action: `Study fundamentals, trade-offs, and one practical scenario for ${firstGap}.`,
    },
    {
      phase: "Role-specific Preparation",
      title: "Prepare your first-30-days answer",
      why: "Role-fit questions test judgment, prioritization, and product thinking.",
      effort: "25 min",
      action: "Write a concise 30-day plan using only job-derived context.",
    },
    {
      phase: "Behavioral Preparation",
      title: "Build STAR stories",
      why: "Behavioral answers need real situations, not generic claims.",
      effort: "40 min",
      action: "Prepare ownership, conflict, failure, and ambiguity stories from your actual resume.",
    },
    {
      phase: "Mock Interviews",
      title: "Run a timed practice session",
      why: "Practice exposes weak answers better than rereading notes.",
      effort: "30-60 min",
      action: "Use Interview Studio and review missed coverage.",
    },
    {
      phase: "Final Review",
      title: "Compress into a last-minute brief",
      why: "The final pass should improve recall, not add new material.",
      effort: "30 min",
      action: "Review must-know concepts, top questions, mistakes, and one opening pitch.",
    },
  ];
}

function buildQuestionBank(sessionQuestions: InterviewQuestion[], preparation: JobPreparation) {
  const extra: InterviewQuestion[] = preparation.roleSpecificQuestions.slice(0, 2).map((question, index) => ({
    id: `resume-role-${index + 1}`,
    category: "role-specific",
    difficulty: "Medium",
    question,
    focusArea: "Resume-based positioning",
    whatToCover: ["Relevant resume evidence", "Impact", "Trade-offs", "Role fit"],
    evaluationCriteria: ["Specificity", "Truthfulness", "Job relevance"],
  }));

  return [...sessionQuestions, ...extra].map((question) => ({
    ...question,
    whyItMayBeAsked: `Likely based on this role: ${question.focusArea || question.category}.`,
    strongAnswerShouldCover: question.whatToCover,
    followUps: [
      "Can you give a concrete example?",
      "What trade-off did you make?",
      "What would you improve next time?",
    ],
  }));
}

function buildWeakAreas(gaps: string[], preparation: JobPreparation, hasUsableResume: boolean): WeakArea[] {
  const weakAreas = gaps.slice(0, 5).map((gap) => ({
    title: gap,
    why: `${gap} appears in this job's preparation requirements but is not supported by the parsed resume skills.`,
    action: `Practice ${gap} and add it to your resume only if it reflects real experience.`,
  }));

  if (!hasUsableResume) {
    weakAreas.unshift({
      title: "Resume signal",
      why: "Personalization is limited without a usable primary resume.",
      action: "Upload or review your primary resume before relying on readiness scoring.",
    });
  }

  if (!weakAreas.length) {
    weakAreas.push({
      title: "Answer depth",
      why: "No major skill gap was detected, so the likely risk is shallow examples.",
      action: "Practice concise answers with measurable, resume-supported evidence.",
    });
  }

  return unique(weakAreas.map((area) => area.title)).map((title) =>
    weakAreas.find((area) => area.title === title) as WeakArea,
  );
}

function buildQuickRevision(topics: LearningTopic[], questions: InterviewPreparationHub["questionBank"], preparation: JobPreparation) {
  const topTopics = topics.slice(0, 5).map((topic) => topic.title);

  return {
    mustKnowConcepts: topTopics,
    topQuestions: questions.slice(0, 5).map((question) => question.question),
    resumeStories: preparation.strengths.slice(0, 4),
    mistakes: unique(topics.flatMap((topic) => topic.commonMistakes)).slice(0, 5),
    thirtyMinutePlan: [
      "Review the job requirements.",
      "Practice your opening pitch.",
      "Answer the top two role-specific questions aloud.",
    ],
    oneHourPlan: [
      "Review top technical gaps.",
      "Practice one behavioral STAR story.",
      "Run one short mock interview.",
    ],
    threeHourPlan: [
      "Study priority topics.",
      "Complete one coding or system scenario.",
      "Run a mixed mock interview and revise weak answers.",
    ],
  };
}

function buildCoachActions(topics: LearningTopic[], weakAreas: WeakArea[]) {
  const topic = topics[0]?.title || "this role";
  const weakArea = weakAreas[0]?.title || topic;

  return [
    {
      label: "Explain this topic",
      response: `Focus on what ${topic} solves, the core concepts, trade-offs, and one resume-supported example.`,
    },
    {
      label: "Give me an example",
      response: `Use a real project. Describe the context, your decision, the trade-off, and the outcome. Do not invent ${topic} experience.`,
    },
    {
      label: "Ask me a harder question",
      response: `How would you handle a production failure involving ${weakArea}, and what would you measure first?`,
    },
    {
      label: "Give me a 10-minute revision",
      response: `Spend 4 minutes on fundamentals, 3 minutes on trade-offs, and 3 minutes answering one question aloud.`,
    },
  ];
}

export function generateInterviewPreparationHub(input: InterviewLearningInput): InterviewPreparationHub {
  const jobSkills = unique(input.job.skills).slice(0, 12);
  const candidateSkills = unique(input.candidate.skills);
  const skills = jobSkills.length ? jobSkills : fallbackSkills;
  const gaps = getSkillGaps(skills, candidateSkills);
  const preparation = generateJobPreparation({
    title: input.job.title,
    company: input.job.company,
    description: input.job.description,
    seniority: input.job.seniority,
    skills,
    candidateSkills,
    experienceYears: input.candidate.experienceYears,
    targetRole: input.candidate.targetRole,
  });
  const session = generateInterviewSession({
    title: input.job.title,
    company: input.job.company,
    description: input.job.description,
    seniority: input.job.seniority || "",
    skills,
    candidateSkills,
    experienceYears: input.candidate.experienceYears || 0,
    targetRole: input.candidate.targetRole || "",
  });
  const learningTopics = unique([
    ...gaps,
    ...skills,
    ...preparation.importantTopics,
    "STAR behavioral answers",
    "First 30 days in role",
    "Final review",
  ]).slice(0, 12).map((topic, index) =>
    buildLearningTopic(
      topic,
      input,
      /star|behavior/i.test(topic)
        ? "behavioral"
        : /30 days|role/i.test(topic)
          ? "role"
          : /final/i.test(topic)
            ? "final-review"
            : "technical",
      index,
    ),
  );
  const skillCoverage = skills.length
    ? clamp((skills.length - gaps.length) / skills.length * 100)
    : null;
  const readinessParts: ReadinessBreakdown[] = [
    {
      label: "Technical preparation",
      value: skillCoverage,
      detail: skills.length ? `${skills.length - gaps.length} of ${skills.length} job skills are resume-supported.` : "No explicit job skills were found.",
    },
    {
      label: "Role-specific knowledge",
      value: input.candidate.targetRole ? 75 : null,
      detail: input.candidate.targetRole ? "Target role is configured." : "Set a target role for better role preparation.",
    },
    {
      label: "Behavioral preparation",
      value: input.candidate.hasUsableResume ? 70 : null,
      detail: input.candidate.hasUsableResume ? "Resume exists for STAR story prompts." : "Upload a usable resume to ground behavioral stories.",
    },
    {
      label: "Interview practice",
      value: null,
      detail: "Interview practice is session-only and not persisted yet.",
    },
    {
      label: "Resume/job alignment",
      value: input.matchScore,
      detail: input.matchScore == null ? "Match score unavailable." : "Derived from the existing JobPilot matching engine.",
    },
  ];
  const scorable = readinessParts.filter((part) => part.value != null);
  const readinessScore = input.candidate.hasProfile && input.candidate.targetRole && input.candidate.hasUsableResume && scorable.length
    ? clamp(scorable.reduce((sum, part) => sum + (part.value as number), 0) / scorable.length)
    : null;
  const questionBank = buildQuestionBank(session.questions, preparation);
  const weakAreas = buildWeakAreas(gaps, preparation, input.candidate.hasUsableResume);

  return {
    preparation,
    readiness: {
      score: readinessScore,
      label: readinessScore == null ? "Setup needed" : readinessScore >= 80 ? "Strong" : readinessScore >= 65 ? "Developing" : "Needs focus",
      progressLabel: "Session progress only",
      primaryCta: {
        label: readinessScore == null
          ? "Improve setup"
          : gaps.length
            ? "Review Weak Areas"
            : input.application
              ? "Start Mock Interview"
              : "Start Preparation",
        href: readinessScore == null
          ? input.candidate.hasProfile && input.candidate.targetRole ? "/resume" : "/profile"
          : gaps.length
            ? "#weak-areas"
            : `/jobs/${input.job.id}/interview`,
      },
      breakdown: readinessParts,
    },
    studyPlan: buildStudyPlan(preparation, gaps),
    learningTopics,
    videoLessons: learningTopics.slice(0, 5).map(buildVideoLesson),
    questionBank,
    codingPractice: buildCodingPractice(learningTopics),
    behavioralPrompts: learningTopics.filter((topic) => topic.category === "behavioral"),
    rolePreparation: {
      jobDerived: unique([
        input.job.title,
        input.job.company,
        input.job.location || "",
        input.job.seniority || "",
        input.job.employmentType || "",
        input.job.salary || "",
        ...skills,
      ]).slice(0, 10),
      candidateDerived: input.candidate.hasUsableResume
        ? unique([input.candidate.targetRole || "", ...candidateSkills]).slice(0, 10)
        : ["No usable primary resume detected."],
      recommended: [
        "Prepare a concise role-fit pitch.",
        "Map each top requirement to a real example.",
        "Practice one challenge or gap answer honestly.",
      ],
    },
    quickRevision: buildQuickRevision(learningTopics, questionBank, preparation),
    weakAreas,
    coachActions: buildCoachActions(learningTopics, weakAreas),
    progress: {
      mode: "session-only",
      reviewedTopics: 0,
      totalTopics: learningTopics.length,
      note: "Progress on this hub is kept in the current browser session. No roadmap database table was added.",
    },
  };
}
