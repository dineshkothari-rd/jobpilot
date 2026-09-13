export type InterviewCategory =
  | "technical"
  | "behavioral"
  | "role-specific"
  | "hr";

export type InterviewQuestion = {
  id: string;
  category: InterviewCategory;
  difficulty: "Easy" | "Medium" | "Hard";
  question: string;
  focusArea?: string;
  whatToCover: string[];
  evaluationCriteria: string[];
};

export type InterviewEvaluation = {
  score: number;
  quality: "Needs work" | "Developing" | "Strong" | "Excellent";
  strengths: string[];
  weaknesses: string[];
  missingPoints: string[];
  suggestedImprovement: string;
  idealAnswerDirection: string;
};

export type InterviewSession = {
  readinessScore: number;
  questions: InterviewQuestion[];
  focusAreas: string[];
  strengths: string[];
};

type InterviewInput = {
  title: string;
  company: string;
  description: string;
  seniority: string;
  skills: string[];
  candidateSkills: string[];
  experienceYears: number;
  targetRole: string;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const unique = (items: string[]) =>
  Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

function buildTechnicalQuestions(
  skills: string[],
): InterviewQuestion[] {
  const normalized = skills.map(normalize);

  const questions: InterviewQuestion[] = [];

  if (
    normalized.some((skill) =>
      skill.includes("react"),
    )
  ) {
    questions.push({
      id: "technical-react-1",
      category: "technical",
      difficulty: "Medium",
      focusArea: "React architecture",
      question:
        "How would you design a scalable React application for a growing product?",
      whatToCover: [
        "Component architecture",
        "State management",
        "Data fetching",
        "Performance",
        "Code organization",
      ],
      evaluationCriteria: [
        "Clear architecture",
        "Separation of concerns",
        "Scalability",
        "Practical trade-offs",
      ],
    });

    questions.push({
      id: "technical-react-2",
      category: "technical",
      difficulty: "Hard",
      focusArea: "React performance",
      question:
        "A React application has become slow as the product and data volume grow. How would you diagnose and improve its performance?",
      whatToCover: [
        "Profiling",
        "Rendering behavior",
        "Memoization",
        "Code splitting",
        "Network performance",
      ],
      evaluationCriteria: [
        "Debugging methodology",
        "Correct identification of bottlenecks",
        "Measured optimization",
      ],
    });
  }

  if (
    normalized.some((skill) =>
      skill.includes("typescript"),
    )
  ) {
    questions.push({
      id: "technical-typescript-1",
      category: "technical",
      difficulty: "Medium",
      focusArea: "TypeScript",
      question:
        "How do you use TypeScript to make a large frontend codebase safer and easier to maintain?",
      whatToCover: [
        "Domain types",
        "Generics",
        "Unions",
        "API types",
        "Runtime validation",
      ],
      evaluationCriteria: [
        "Type safety",
        "Maintainability",
        "Practical examples",
      ],
    });
  }

  if (
    normalized.some(
      (skill) =>
        skill.includes("next") ||
        skill.includes("next.js"),
    )
  ) {
    questions.push({
      id: "technical-next-1",
      category: "technical",
      difficulty: "Medium",
      focusArea: "Next.js architecture",
      question:
        "How would you decide between server-side and client-side rendering in a Next.js application?",
      whatToCover: [
        "Server Components",
        "Client Components",
        "Data fetching",
        "SEO",
        "Interactivity",
      ],
      evaluationCriteria: [
        "Correct rendering model",
        "Performance reasoning",
        "Product considerations",
      ],
    });
  }

  if (
    normalized.some(
      (skill) =>
        skill.includes("node") ||
        skill.includes("api") ||
        skill.includes("rest"),
    )
  ) {
    questions.push({
      id: "technical-api-1",
      category: "technical",
      difficulty: "Medium",
      focusArea: "API design",
      question:
        "How would you design and consume a reliable API layer for a production application?",
      whatToCover: [
        "Error handling",
        "Authentication",
        "Caching",
        "Retries",
        "API contracts",
      ],
      evaluationCriteria: [
        "Reliability",
        "Security awareness",
        "Clear API design",
      ],
    });
  }

  if (
    normalized.some(
      (skill) =>
        skill.includes("firebase") ||
        skill.includes("firestore"),
    )
  ) {
    questions.push({
      id: "technical-firebase-1",
      category: "technical",
      difficulty: "Medium",
      focusArea: "Firebase",
      question:
        "How would you structure Firestore data and security rules for a multi-user application?",
      whatToCover: [
        "Data modeling",
        "Security rules",
        "User ownership",
        "Indexes",
        "Query patterns",
      ],
      evaluationCriteria: [
        "Security",
        "Scalable modeling",
        "Correct authorization",
      ],
    });
  }

  if (questions.length === 0) {
    questions.push({
      id: "technical-general-1",
      category: "technical",
      difficulty: "Medium",
      focusArea: "Technical decision-making",
      question:
        "Walk me through the architecture of a significant product you have worked on.",
      whatToCover: [
        "Architecture",
        "Responsibilities",
        "Trade-offs",
        "Scaling",
        "Technical decisions",
      ],
      evaluationCriteria: [
        "Technical depth",
        "Ownership",
        "Decision making",
        "Communication",
      ],
    });
  }

  return questions;
}

function buildBehavioralQuestions(): InterviewQuestion[] {
  return [
    {
      id: "behavioral-1",
      category: "behavioral",
      difficulty: "Medium",
      focusArea: "Problem-solving story",
      question:
        "Tell me about a difficult technical problem you solved and how you approached it.",
      whatToCover: [
        "Situation",
        "Problem",
        "Actions",
        "Result",
      ],
      evaluationCriteria: [
        "Ownership",
        "Problem solving",
        "Measurable outcome",
      ],
    },
    {
      id: "behavioral-2",
      category: "behavioral",
      difficulty: "Medium",
      focusArea: "Collaboration",
      question:
        "Tell me about a time you disagreed with a technical decision.",
      whatToCover: [
        "Context",
        "Different viewpoints",
        "Communication",
        "Final outcome",
      ],
      evaluationCriteria: [
        "Collaboration",
        "Maturity",
        "Reasoning",
      ],
    },
    {
      id: "behavioral-3",
      category: "behavioral",
      difficulty: "Easy",
      focusArea: "Ownership",
      question:
        "Tell me about a project where you took ownership beyond your assigned responsibilities.",
      whatToCover: [
        "Situation",
        "Ownership",
        "Impact",
      ],
      evaluationCriteria: [
        "Initiative",
        "Leadership",
        "Impact",
      ],
    },
  ];
}

function buildRoleQuestions(
  input: InterviewInput,
): InterviewQuestion[] {
  return [
    {
      id: "role-1",
      category: "role-specific",
      difficulty: "Medium",
      focusArea: "Role alignment",
      question:
        `Why are you a strong candidate for the ${input.title} position?`,
      whatToCover: [
        "Relevant experience",
        "Relevant skills",
        "Product understanding",
        "Impact",
      ],
      evaluationCriteria: [
        "Job relevance",
        "Specific examples",
        "Confidence",
      ],
    },
    {
      id: "role-2",
      category: "role-specific",
      difficulty: "Hard",
      focusArea: "First 30 days",
      question:
        "What would you focus on during your first 30 days in this role?",
      whatToCover: [
        "Learning",
        "Product understanding",
        "Stakeholders",
        "Early wins",
      ],
      evaluationCriteria: [
        "Practical thinking",
        "Prioritization",
        "Business awareness",
      ],
    },
    {
      id: "role-3",
      category: "role-specific",
      difficulty: "Medium",
      focusArea: "Skill gaps",
      question:
        "Which part of this role do you think would be most challenging for you?",
      whatToCover: [
        "Self-awareness",
        "Specific gap",
        "Improvement plan",
      ],
      evaluationCriteria: [
        "Honesty",
        "Self-awareness",
        "Growth mindset",
      ],
    },
  ];
}

function buildHrQuestions(): InterviewQuestion[] {
  return [
    {
      id: "hr-1",
      category: "hr",
      difficulty: "Easy",
      focusArea: "Career motivation",
      question:
        "Why are you looking for your next opportunity?",
      whatToCover: [
        "Positive motivation",
        "Career direction",
        "Role alignment",
      ],
      evaluationCriteria: [
        "Professionalism",
        "Clarity",
        "Positive framing",
      ],
    },
    {
      id: "hr-2",
      category: "hr",
      difficulty: "Medium",
      focusArea: "Company alignment",
      question:
        "What are your expectations from your next company and manager?",
      whatToCover: [
        "Growth",
        "Culture",
        "Ownership",
        "Communication",
      ],
      evaluationCriteria: [
        "Realistic expectations",
        "Self-awareness",
        "Alignment",
      ],
    },
  ];
}

export function generateInterviewSession(
  input: InterviewInput,
): InterviewSession {
  const candidate = new Set(
    input.candidateSkills.map(normalize),
  );

  const jobSkills = unique(input.skills);

  const matchedSkills = jobSkills.filter((skill) => {
    const normalizedSkill = normalize(skill);

    return Array.from(candidate).some(
      (candidateSkill) =>
        candidateSkill.includes(normalizedSkill) ||
        normalizedSkill.includes(candidateSkill),
    );
  });

  const missingSkills = jobSkills.filter(
    (skill) =>
      !matchedSkills.includes(skill),
  );

  const skillCoverage =
    jobSkills.length === 0
      ? 70
      : Math.round(
          (matchedSkills.length /
            jobSkills.length) *
            100,
        );

  const experienceBonus =
    input.experienceYears >= 5
      ? 10
      : input.experienceYears >= 3
        ? 7
        : 4;

  const readinessScore = Math.min(
    96,
    Math.max(
      35,
      Math.round(
        skillCoverage * 0.7 +
          experienceBonus +
          15,
      ),
    ),
  );

  const strengths = [
    matchedSkills.length > 0
      ? `Strong overlap with ${matchedSkills
          .slice(0, 4)
          .join(", ")}.`
      : "Your profile provides a foundation for this role.",
    input.experienceYears >= 3
      ? `${input.experienceYears}+ years of professional experience can support strong scenario-based answers.`
      : "Focus on demonstrating practical project experience.",
  ];

  const focusAreas =
    missingSkills.length > 0
      ? missingSkills
          .slice(0, 5)
          .map(
            (skill) =>
              `Review ${skill} before the interview.`,
          )
      : [
          "Prepare measurable project outcomes.",
          "Practice architecture and trade-off explanations.",
          "Prepare concise STAR stories.",
        ];

  const questions = [
    ...buildTechnicalQuestions(
      jobSkills,
    ),
    ...buildRoleQuestions(input),
    ...buildBehavioralQuestions(),
    ...buildHrQuestions(),
  ];

  return {
    readinessScore,
    questions,
    focusAreas,
    strengths,
  };
}

const ANSWER_STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "for", "from", "in", "of", "or", "the",
  "to", "with", "your",
]);

function answerTokens(value: string) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((word) => word.length > 2 && !ANSWER_STOP_WORDS.has(word)),
  );
}

export function evaluateInterviewAnswer(
  question: InterviewQuestion,
  answer: string,
): InterviewEvaluation {
  const cleanAnswer = answer.trim();
  const tokens = answerTokens(cleanAnswer);
  const covered = question.whatToCover.filter((point) =>
    Array.from(answerTokens(point)).some((word) => tokens.has(word)),
  );
  const missingPoints = question.whatToCover.filter(
    (point) => !covered.includes(point),
  );
  const wordCount = cleanAnswer.split(/\s+/).filter(Boolean).length;
  const hasExample = /\b(example|project|situation|when|once)\b/i.test(cleanAnswer);
  const hasOutcome = /\b(result|impact|improved|reduced|increased|saved|outcome|learned)\b/i.test(cleanAnswer);
  const hasOwnership = /\b(i|my)\b/i.test(cleanAnswer);

  const score = Math.min(95, Math.max(30, Math.round(
    30 +
      Math.min(20, wordCount / 4) +
      (covered.length / question.whatToCover.length) * 30 +
      (hasExample ? 6 : 0) +
      (hasOutcome ? 6 : 0) +
      (hasOwnership ? 3 : 0),
  )));

  const strengths = [
    ...(covered.length
      ? [`Addresses ${covered.slice(0, 2).join(" and ").toLowerCase()}.`]
      : []),
    ...(hasExample ? ["Uses a concrete example rather than only general claims."] : []),
    ...(hasOutcome ? ["Explains an outcome or impact."] : []),
  ];

  if (!strengths.length) {
    strengths.push("Provides a starting point that can be made more specific.");
  }

  const weaknesses = [
    ...(wordCount < 60 ? ["The answer is brief for an interview response."] : []),
    ...(!hasExample ? ["It does not yet include a concrete example."] : []),
    ...(!hasOutcome ? ["The result or impact is not clear."] : []),
  ];

  if (!weaknesses.length) {
    weaknesses.push("The answer could be tighter and lead with its strongest evidence.");
  }

  const nextPoint = missingPoints[0];

  return {
    score,
    quality: score >= 85 ? "Excellent" : score >= 72 ? "Strong" : score >= 55 ? "Developing" : "Needs work",
    strengths,
    weaknesses,
    missingPoints,
    suggestedImprovement: nextPoint
      ? `Add a specific example that demonstrates ${nextPoint.toLowerCase()}, then close with the result.`
      : "Make the response more concise and lead with the strongest evidence and measurable result.",
    idealAnswerDirection: `Structure the answer around ${question.whatToCover.join(", ")}. Use only examples from your own experience and finish with the outcome or lesson.`,
  };
}
