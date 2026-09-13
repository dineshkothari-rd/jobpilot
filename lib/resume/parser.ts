export type ParsedResume = {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    location: string;
    github: string;
    linkedin: string;
    portfolio: string;
  };

  summary: string;

  skills: {
    frontend: string[];
    backend: string[];
    database: string[];
    tools: string[];
    other: string[];
  };

  experience: {
    company: string;
    role: string;
    location: string;
    startDate: string;
    endDate: string;
    description: string[];
  }[];

  education: {
    degree: string;
    institution: string;
    location: string;
    startDate: string;
    endDate: string;
    details: string[];
  }[];

  projects: {
    name: string;
    description: string[];
    technologies: string[];
  }[];
  achievements: string[];
};

function cleanLine(line: string) {
  return line
    .replace(/\s+/g, " ")
    .replace(/^[-•*]\s*/, "")
    .trim();
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractEmail(text: string) {
  return (
    text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    )?.[0] ?? ""
  );
}

function extractPhone(text: string) {
  return (
    text.match(
      /(?:\+91[\s-]?)?[6-9]\d{9}/,
    )?.[0] ?? ""
  );
}

function extractGithub(text: string) {
  return (
    text.match(
      /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_.-]+/i,
    )?.[0] ?? ""
  );
}

function extractLinkedIn(text: string) {
  return (
    text.match(
      /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[A-Za-z0-9_./-]+/i,
    )?.[0] ?? ""
  );
}

function extractPortfolio(text: string) {
  const urls =
    text.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) ?? [];

  const filtered = urls
    .map((url) => url.replace(/[),.;]+$/, ""))
    .filter(
      (url) =>
        !url.toLowerCase().includes("github.com") &&
        !url.toLowerCase().includes("linkedin.com"),
    );

  return filtered[0] ?? "";
}

function extractName(text: string) {
  const lines = text
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  return lines[0] ?? "";
}

function extractLocation(text: string) {
  const match = text.match(
    /([A-Za-z .'-]+),\s*([A-Za-z .'-]+)\s*\|/,
  );

  if (match) {
    return `${match[1].trim()}, ${match[2].trim()}`;
  }

  return "";
}

function getLines(text: string) {
  return text
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);
}

function getSection(
  text: string,
  sectionName: string,
  nextSections: string[],
) {
  const lines = getLines(text);

  const startIndex = lines.findIndex(
    (line) =>
      line.toLowerCase() === sectionName.toLowerCase(),
  );

  if (startIndex === -1) {
    return [];
  }

  const remaining = lines.slice(startIndex + 1);

  const nextIndex = remaining.findIndex((line) =>
    nextSections.some(
      (section) =>
        line.toLowerCase() === section.toLowerCase(),
    ),
  );

  return nextIndex === -1
    ? remaining
    : remaining.slice(0, nextIndex);
}

function parseSkills(text: string): ParsedResume["skills"] {
  const lines = getSection(text, "CORE SKILLS", [
    "PROFESSIONAL EXPERIENCE",
    "EXPERIENCE",
    "WORK EXPERIENCE",
    "EDUCATION",
    "PROJECTS",
    "INDEPENDENT PROJECTS",
    "ACHIEVEMENTS",
  ]);

  const frontend: string[] = [];
  const backend: string[] = [];
  const database: string[] = [];
  const tools: string[] = [];
  const other: string[] = [];

  const knownFrontend = [
    "React",
    "React.js",
    "Next.js",
    "TypeScript",
    "JavaScript",
    "Redux Toolkit",
    "Context API",
    "HTML5",
    "CSS3",
    "Tailwind CSS",
    "Material UI",
    "MUI",
    "Ant Design",
    "Fabric.js",
    "React Native",
  ];

  const knownBackend = [
    "Node.js",
    "Express",
    "REST APIs",
    "REST API",
    "Java",
    "Spring Boot",
  ];

  const knownDatabase = [
    "Firebase",
    "Firestore",
    "MongoDB",
    "PostgreSQL",
    "MySQL",
  ];

  const knownTools = [
    "Git",
    "GitHub",
    "Vite",
    "Expo",
    "Module Federation",
    "Microfrontends",
    "Flyway",
  ];

  const categories = [
    {
      skills: knownFrontend,
      target: frontend,
    },
    {
      skills: knownBackend,
      target: backend,
    },
    {
      skills: knownDatabase,
      target: database,
    },
    {
      skills: knownTools,
      target: tools,
    },
  ];

  for (const line of lines) {
    const colonIndex = line.indexOf(":");

    if (colonIndex === -1) {
      continue;
    }

    const value = line.slice(colonIndex + 1);

    const extracted = value
      .split(",")
      .map(cleanLine)
      .map((skill) => {
        const normalized = skill.toLowerCase();

        if (normalized === "ant") {
          return "Ant Design";
        }

        if (normalized === "firebase auth") {
          return "Firebase Auth";
        }

        return skill;
      })
      .filter(Boolean);

    for (const skill of extracted) {
      let matched = false;

      for (const category of categories) {
        const match = category.skills.find(
          (known) =>
            known.toLowerCase() === skill.toLowerCase(),
        );

        if (match) {
          category.target.push(match);
          matched = true;
          break;
        }
      }

      if (!matched) {
        other.push(skill);
      }
    }
  }

  return {
    frontend: unique(frontend),
    backend: unique(backend),
    database: unique(database),
    tools: unique(tools),
    other: unique(other),
  };
}

function parseSummary(text: string) {
  const lines = getSection(text, "PROFESSIONAL SUMMARY", [
    "CORE SKILLS",
    "PROFESSIONAL EXPERIENCE",
    "EXPERIENCE",
    "WORK EXPERIENCE",
    "EDUCATION",
    "PROJECTS",
    "INDEPENDENT PROJECTS",
    "ACHIEVEMENTS",
  ]);

  return lines.join(" ").trim();
}

function parseExperience(
  text: string,
): ParsedResume["experience"] {
  const lines = getSection(text, "PROFESSIONAL EXPERIENCE", [
    "EDUCATION",
    "PROJECTS",
    "INDEPENDENT PROJECTS",
    "ACHIEVEMENTS",
    "CERTIFICATIONS",
  ]);

  const experience: ParsedResume["experience"] = [];

  const datePattern =
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\s*[-–]\s*(Present|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}))\b/i;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const nextLine = lines[index + 1] ?? "";

    const dateMatch = nextLine.match(datePattern);

    if (!dateMatch || !line.includes("|")) {
      continue;
    }

    const parts = line
      .split("|")
      .map(cleanLine)
      .filter(Boolean);

    const location = nextLine
      .replace(dateMatch[0], "")
      .replace(/\s*\|\s*$/, "")
      .trim();

    const item: ParsedResume["experience"][number] = {
      company: parts[1] ?? parts[0] ?? "",
      role: parts[0] ?? "",
      location,
      startDate: dateMatch[1],
      endDate: dateMatch[2],
      description: [],
    };

    index += 1;

    while (index + 1 < lines.length) {
      const currentLine = lines[index + 1];

      const nextDateLine = lines[index + 2] ?? "";

      const nextExperience =
        currentLine.includes("|") &&
        datePattern.test(nextDateLine);

      const sectionHeading = [
        "EDUCATION",
        "PROJECTS",
        "INDEPENDENT PROJECTS",
        "ACHIEVEMENTS",
        "CERTIFICATIONS",
      ].some(
        (section) =>
          currentLine.toLowerCase() ===
          section.toLowerCase(),
      );

      if (nextExperience || sectionHeading) {
        break;
      }

      item.description.push(currentLine);
      index += 1;
    }

    item.description = unique(item.description);

    experience.push(item);
  }

  return experience;
}

function parseEducation(
  text: string,
): ParsedResume["education"] {
  const lines = getSection(text, "EDUCATION", [
    "PROJECTS",
    "INDEPENDENT PROJECTS",
    "ACHIEVEMENTS",
    "CERTIFICATIONS",
  ]);

  const education: ParsedResume["education"] = [];

  const datePattern =
    /\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}))\s*[-–]\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}))\b/i;

  for (const line of lines) {
    const dateMatch = line.match(datePattern);

    if (!dateMatch) {
      continue;
    }

    const beforeDate = line
      .replace(dateMatch[0], "")
      .replace(/\s*\|\s*$/, "")
      .trim();

    const parts = beforeDate
      .split("|")
      .map(cleanLine)
      .filter(Boolean);

    education.push({
      degree: parts[0] ?? "",
      institution: parts[1] ?? "",
      location: parts[2] ?? "",
      startDate: dateMatch[1],
      endDate: dateMatch[2],
      details: [],
    });
  }

  return education;
}

function parseProjects(
  text: string,
): ParsedResume["projects"] {
  const lines = getSection(text, "INDEPENDENT PROJECTS", [
    "EDUCATION",
    "ACHIEVEMENTS",
    "CERTIFICATIONS",
  ]);

  const projects: ParsedResume["projects"] = [];

  let current: ParsedResume["projects"][number] | null =
    null;

  const technologyPattern =
    /React Native|React|Next\.js|TypeScript|JavaScript|Vite|Java|Spring Boot|PostgreSQL|Flyway|Firebase|Firestore|REST APIs|JWT|Expo/gi;

  for (const line of lines) {
    const isProjectName =
      line.includes("|") &&
      !line.startsWith("Built ") &&
      !line.startsWith("Implemented ");

    if (isProjectName) {
      if (current) {
        projects.push(current);
      }

      const parts = line
        .split("|")
        .map(cleanLine)
        .filter(Boolean);

      current = {
        name: parts[0] ?? "",
        description: [],
        technologies: unique(
          (parts[1] ?? "")
            .split(",")
            .map(cleanLine),
        ),
      };

      continue;
    }

    if (!current) {
      continue;
    }

    current.description.push(line);

    const matches = line.match(technologyPattern) ?? [];

    current.technologies.push(...matches);
  }

  if (current) {
    projects.push(current);
  }

  return projects.map((project) => ({
    ...project,
    description: unique(project.description),
    technologies: unique(project.technologies),
  }));
}

function parseAchievements(text: string): string[] {
  const lines = getSection(text, "ACHIEVEMENTS", [
    "EDUCATION",
    "EDUCATIONAL QUALIFICATIONS",
    "ACADEMIC QUALIFICATIONS",
    "CERTIFICATIONS",
  ]);

  return lines
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseResume(text: string): ParsedResume {
  return {
    personalInfo: {
      name: extractName(text),
      email: extractEmail(text),
      phone: extractPhone(text),
      location: extractLocation(text),
      github: extractGithub(text),
      linkedin: extractLinkedIn(text),
      portfolio: extractPortfolio(text),
    },

    summary: parseSummary(text),

    skills: parseSkills(text),

    experience: parseExperience(text),

    education: parseEducation(text),

    projects: parseProjects(text),

    achievements: parseAchievements(text),
  };
}
