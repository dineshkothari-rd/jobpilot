export type JobPreparationInput = {
  title: string;
  company: string;
  description: string;
  seniority: string | null;
  skills: string[];
  candidateSkills: string[];
  experienceYears: number | null;
  targetRole: string | null;
};

export type JobPreparation = {
  summary: string;
  readinessScore: number;
  strengths: string[];
  skillGaps: string[];
  importantTopics: string[];
  technicalQuestions: string[];
  behavioralQuestions: string[];
  roleSpecificQuestions: string[];
  preparationPlan: {
    day: string;
    title: string;
    tasks: string[];
  }[];
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "your",
  "have",
  "will",
  "our",
  "you",
  "are",
  "job",
  "role",
  "work",
  "team",
  "using",
  "years",
  "year",
  "experience",
  "strong",
  "good",
  "ability",
  "skills",
  "required",
  "preferred",
  "looking",
  "including",
]);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function extractKeywords(text: string) {
  const normalized = normalize(text);

  const words = normalized
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 3 &&
        !STOP_WORDS.has(word),
    );

  return unique(words);
}

function canonicalSkill(skill: string) {
  const value = normalize(skill);

  const aliases: Record<string, string> = {
    js: "javascript",
    javascript: "javascript",
    ts: "typescript",
    typescript: "typescript",
    reactjs: "react",
    "react.js": "react",
    "next.js": "next.js",
    nextjs: "next.js",
    nodejs: "node.js",
    "node.js": "node.js",
    "tailwindcss": "tailwind css",
    "tailwind css": "tailwind css",
    "material ui": "material ui",
    mui: "material ui",
  };

  return aliases[value] || value;
}

function scoreSkills(
  requiredSkills: string[],
  candidateSkills: string[],
) {
  const candidate = new Set(
    candidateSkills.map(canonicalSkill),
  );

  const matched = requiredSkills.filter((skill) =>
    candidate.has(canonicalSkill(skill)),
  );

  return {
    matched,
    missing: requiredSkills.filter(
      (skill) =>
        !candidate.has(canonicalSkill(skill)),
    ),
  };
}

function inferTopics(input: JobPreparationInput) {
  const text = normalize(
    `${input.title} ${input.description}`,
  );

  const topics: string[] = [];

  const topicMap = [
    ["react", "React fundamentals and advanced concepts"],
    ["next.js", "Next.js rendering, routing and architecture"],
    ["javascript", "JavaScript fundamentals and runtime behavior"],
    ["typescript", "TypeScript design and type safety"],
    ["node", "Node.js and backend fundamentals"],
    ["api", "REST APIs and API integration"],
    ["graphql", "GraphQL"],
    ["sql", "SQL and database fundamentals"],
    ["postgres", "PostgreSQL"],
    ["mongodb", "MongoDB"],
    ["aws", "AWS fundamentals"],
    ["azure", "Azure fundamentals"],
    ["docker", "Docker and containerization"],
    ["kubernetes", "Kubernetes"],
    ["python", "Python"],
    ["java", "Java"],
    ["spring", "Spring / Spring Boot"],
    ["testing", "Testing strategy and automation"],
    ["cypress", "Cypress"],
    ["playwright", "Playwright"],
    ["jest", "Jest"],
    ["redux", "State management"],
    ["microfrontend", "Microfrontend architecture"],
    ["module federation", "Module Federation"],
    ["graphql", "GraphQL APIs"],
    ["security", "Application security"],
    ["performance", "Performance optimization"],
    ["accessibility", "Web accessibility"],
    ["system design", "System design and architecture"],
    ["design system", "Design systems"],
  ] as const;

  for (const [keyword, topic] of topicMap) {
    if (text.includes(keyword)) {
      topics.push(topic);
    }
  }

  if (topics.length === 0) {
    topics.push(
      "Role fundamentals",
      "Problem solving",
      "System design",
      "Communication",
    );
  }

  return unique(topics).slice(0, 12);
}

export function generateJobPreparation(
  input: JobPreparationInput,
): JobPreparation {
  const descriptionKeywords =
    extractKeywords(input.description);

  const explicitSkills = unique(
    input.skills.map(canonicalSkill),
  );

  const inferredSkills =
    descriptionKeywords.filter(
      (keyword) =>
        keyword.length >= 3 &&
        (
          keyword.includes(".") ||
          keyword.includes("+") ||
          explicitSkills.includes(keyword)
        ),
    );

  const requiredSkills = unique([
    ...input.skills,
    ...inferredSkills,
  ]).slice(0, 20);

  const {
    matched,
    missing,
  } = scoreSkills(
    requiredSkills,
    input.candidateSkills,
  );

  const skillScore =
    requiredSkills.length > 0
      ? Math.round(
          (matched.length /
            requiredSkills.length) *
            100,
        )
      : 70;

  const experienceScore =
    input.experienceYears == null
      ? 70
      : input.experienceYears >= 5
        ? 100
        : input.experienceYears >= 3
          ? 90
          : input.experienceYears >= 1
            ? 70
            : 50;

  const readinessScore = Math.min(
    100,
    Math.round(
      skillScore * 0.65 +
        experienceScore * 0.2 +
        70 * 0.15,
    ),
  );

  const strengths = matched
    .slice(0, 8)
    .map(
      (skill) =>
        `Your profile already covers ${skill}.`,
    );

  if (strengths.length === 0) {
    strengths.push(
      "Your profile can be strengthened by aligning your resume and preparation with this role.",
    );
  }

  const skillGaps = missing
    .slice(0, 8)
    .map(
      (skill) =>
        `Prepare ${skill} before the interview.`,
    );

  if (skillGaps.length === 0) {
    skillGaps.push(
      "No major explicit skill gap detected. Focus on depth and interview communication.",
    );
  }

  const importantTopics = inferTopics(input);

  const technicalQuestions = [
    `Explain the most important concepts you would use in ${input.title}.`,
    `How would you design a production-grade solution for this role?`,
    `How do you approach performance, scalability and reliability?`,
    `Describe a difficult technical problem you solved and the trade-offs you made.`,
    `How would you debug a production issue in an unfamiliar codebase?`,
    `How do you decide between different technical approaches?`,
  ];

  const roleSpecificQuestions = [
    `Walk me through your experience relevant to the ${input.title} role.`,
    `Which project from your background is most relevant to this position and why?`,
    `What would you focus on during your first 30 days in this role?`,
    `Which requirement in this job description would be the biggest challenge for you?`,
    `How would you improve an existing system instead of rewriting it completely?`,
  ];

  const behavioralQuestions = [
    "Tell me about yourself and your career journey.",
    "Tell me about a difficult situation you handled at work.",
    "Describe a disagreement with a teammate and how you resolved it.",
    "Tell me about a mistake you made and what you learned.",
    "Describe a time you took ownership beyond your assigned responsibility.",
    "Why are you interested in this opportunity?",
    "Why are you considering a job change?",
    "What kind of environment helps you perform at your best?",
  ];

  const preparationPlan = [
    {
      day: "Day 1",
      title: "Understand the role",
      tasks: [
        "Read the complete job description.",
        "Identify the top responsibilities.",
        "Map your experience to each major requirement.",
      ],
    },
    {
      day: "Day 2",
      title: "Close skill gaps",
      tasks: [
        ...missing.slice(0, 3).map(
          (skill) =>
            `Revise ${skill}.`,
        ),
        "Create concise examples from your own experience.",
      ],
    },
    {
      day: "Day 3",
      title: "Technical depth",
      tasks: [
        ...importantTopics
          .slice(0, 3)
          .map(
            (topic) =>
              `Deep dive into ${topic}.`,
          ),
        "Practice explaining concepts without memorized definitions.",
      ],
    },
    {
      day: "Day 4",
      title: "Projects & problem solving",
      tasks: [
        "Prepare two strong project stories.",
        "Prepare one difficult technical problem.",
        "Prepare trade-offs and architectural decisions.",
      ],
    },
    {
      day: "Day 5",
      title: "Behavioral preparation",
      tasks: [
        "Prepare STAR-format examples.",
        "Practice leadership and conflict questions.",
        "Prepare your introduction and job-change explanation.",
      ],
    },
    {
      day: "Day 6",
      title: "Mock interview",
      tasks: [
        "Complete a timed technical interview.",
        "Practice follow-up questions.",
        "Review weak answers.",
      ],
    },
    {
      day: "Day 7",
      title: "Final revision",
      tasks: [
        "Review skill gaps.",
        "Review company and role context.",
        "Do one final mock interview.",
      ],
    },
  ];

  const company =
    input.company || "the company";

  return {
    summary:
      `This preparation workspace is built around the ${input.title} opportunity at ${company}, your current profile, and the requirements detected in the job description.`,
    readinessScore,
    strengths,
    skillGaps,
    importantTopics,
    technicalQuestions,
    behavioralQuestions,
    roleSpecificQuestions,
    preparationPlan,
  };
}
