import { safeYoutubeResource } from "../resources/provider.ts";

export type Lesson = {
  id: string;
  title: string;
  provider: string;
  url: string;
  format: "reading" | "video";
  minutes: number;
  task: string;
  alternative: string;
  embedUrl: string | null;
  verifiedOn: string;
  access: string;
};
export type LearningPath = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  roles: string[];
  level: "Beginner" | "Intermediate";
  prerequisites: string;
  lessons: Lesson[];
  project: string;
  credential: { title: string; issuer: string; url: string; requirements: string } | null;
};

const mdn = "https://developer.mozilla.org/en-US/docs/";
const cs50 = "https://cs50.harvard.edu/x/";
const lesson = (id: string, title: string, provider: string, url: string, minutes: number, task: string, alternative: string, videoId?: string): Lesson => ({
  id, title, provider, url, minutes, task, alternative,
  format: videoId || provider === "CS50" ? "video" : "reading",
  embedUrl: videoId ? safeYoutubeResource(videoId, title, "", null)?.embedUrl || null : null,
  verifiedOn: "2026-09-17",
  access: provider === "CS50" ? "Free lecture. Provider assignments/credential require a separate account. Open on CS50; content is not rehosted." : "Free public learning. No certificate is issued for this individual resource. Optional provider upgrades are not required.",
});
const fccCredential = {
  title: "Explore a full freeCodeCamp certification", issuer: "freeCodeCamp",
  url: "https://www.freecodecamp.org/learn/",
  requirements: "Separate provider account and the complete relevant provider curriculum/projects are required. This shorter JobPilot path does not earn a freeCodeCamp certificate.",
};

// Original short path outlines, not copies of provider curricula. Resources remain with their owners.
export const learningPaths: LearningPath[] = [
  {
    id: "web-foundations", title: "Build your first accessible website", description: "Turn a design into a responsive, keyboard-friendly page.",
    skills: ["HTML", "CSS", "Accessibility"], roles: ["frontend", "web", "ui"], level: "Beginner", prerequisites: "A browser and a free local editor; no prior coding required.",
    lessons: [
      lesson("html", "Structure content with HTML", "MDN", mdn + "Learn_web_development/Core/Structuring_content", 60, "Create a job-detail page with semantic headings, a list and a labelled form.", mdn + "Learn_web_development"),
      lesson("html-video", "HTML Full Course — optional video route", "freeCodeCamp.org", "https://www.youtube.com/watch?v=pQN-pnXPaVg", 120, "Apply the HTML concepts to your own job-detail page. Older video: use current MDN for reference.", mdn + "Learn_web_development/Core/Structuring_content", "pQN-pnXPaVg"),
      lesson("layout", "Responsive CSS layout", "MDN", mdn + "Learn_web_development/Core/CSS_layout", 90, "Make your page work at 390px and desktop widths without horizontal scrolling.", mdn + "Learn_web_development"),
      lesson("accessibility", "Accessible interactions", "web.dev", "https://web.dev/learn/accessibility", 90, "Use the form with keyboard only; check labels, focus and error messages.", mdn + "Learn_web_development"),
    ], project: "Build a fictional job-opportunity page with responsive layout and an accessible enquiry form. Document keyboard checks and three design decisions. No paid hosting required.", credential: fccCredential,
  },
  {
    id: "javascript-typescript", title: "JavaScript into reliable TypeScript", description: "Model data, handle asynchronous work and guard unknown inputs.",
    skills: ["JavaScript", "TypeScript"], roles: ["frontend", "full stack", "web"], level: "Intermediate", prerequisites: "Basic HTML and familiarity with variables/functions.",
    lessons: [
      lesson("javascript", "JavaScript foundations", "MDN", mdn + "Web/JavaScript/Guide", 120, "Write a function that filters a list of jobs by location; handle an empty list.", "https://www.youtube.com/watch?v=PkZNo7MFNFg"),
      lesson("javascript-video", "Learn JavaScript — optional video route", "freeCodeCamp.org", "https://www.youtube.com/watch?v=PkZNo7MFNFg", 210, "Implement your own search/filter exercise, rather than copying the instructor project. Older video: cross-check current MDN.", mdn + "Web/JavaScript/Guide", "PkZNo7MFNFg"),
      lesson("promises", "Promises and failure states", "MDN", mdn + "Web/JavaScript/Guide/Using_promises", 60, "Load a local JSON file and display loading, success and failure states.", mdn + "Web/JavaScript/Guide"),
      lesson("types", "Everyday types and narrowing", "TypeScript", "https://www.typescriptlang.org/docs/handbook/2/narrowing.html", 90, "Validate unknown job data before reading it; avoid unsafe casts.", "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html"),
    ], project: "Build a typed job-list filter using local sample data. Add checks for missing fields, duplicate IDs and failed loading; describe your validation boundary.", credential: null,
  },
  {
    id: "react-workflows", title: "React workflows users can trust", description: "Create predictable state, forms and recoverable asynchronous screens.",
    skills: ["React", "JavaScript"], roles: ["react", "frontend", "full stack"], level: "Intermediate", prerequisites: "JavaScript functions, arrays and basic HTML.",
    lessons: [
      lesson("react", "React Quick Start", "React", "https://react.dev/learn", 90, "Split a learning dashboard into small components with explicit props.", "https://react.dev/learn/thinking-in-react"),
      lesson("state", "Manage state deliberately", "React", "https://react.dev/learn/managing-state", 90, "Keep a lesson selection and derive its title; avoid duplicate state.", "https://react.dev/learn/thinking-in-react"),
      lesson("effects", "Synchronize only external systems", "React", "https://react.dev/learn/synchronizing-with-effects", 60, "Fetch sample data with cleanup and a retry button; calculate derived values during rendering.", "https://react.dev/learn"),
      lesson("react-video", "React beginner video — concepts supplement (2022)", "freeCodeCamp.org", "https://www.youtube.com/watch?v=bMknfKXIFA8", 180, "Practise component/state concepts. Skip outdated Create React App setup and follow current React documentation.", "https://react.dev/learn", "bMknfKXIFA8"),
    ], project: "Build a local application tracker with editable notes, a confirmation step and loading/error/empty states. Include keyboard checks and explain how you prevent state drift.", credential: fccCredential,
  },
  {
    id: "backend-apis", title: "Build safe backend APIs", description: "Understand HTTP, asynchronous execution and testable server boundaries.",
    skills: ["Node.js", "API", "Testing"], roles: ["backend", "full stack", "node"], level: "Intermediate", prerequisites: "JavaScript functions and promises; a free local Node.js installation.",
    lessons: [
      lesson("node", "Introduction to Node.js", "Node.js", "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs", 60, "Create a local server returning a fictional course catalogue.", "https://nodejs.org/en/learn/asynchronous-work/overview-of-blocking-vs-non-blocking"),
      lesson("http", "HTTP request/response fundamentals", "MDN", mdn + "Web/HTTP/Guides/Overview", 60, "Write down response codes for unauthenticated access, invalid input and missing data.", "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs"),
      lesson("async", "Blocking versus non-blocking work", "Node.js", "https://nodejs.org/en/learn/asynchronous-work/overview-of-blocking-vs-non-blocking", 60, "Compare sequential and independent concurrent operations without blocking the server.", "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs"),
      lesson("tests", "The built-in test runner", "Node.js", "https://nodejs.org/en/learn/test-runner/introduction", 90, "Test validation and an unauthorized request using the built-in runner.", mdn + "Web/HTTP/Guides/Overview"),
    ], project: "Build a local-only sample learning API with input validation, fictional users and ownership checks. Include runnable happy-path and denial checks. Do not use real personal data.", credential: null,
  },
  {
    id: "sql-data", title: "SQL for useful product questions", description: "Query, join and summarize relational data without losing its meaning.",
    skills: ["SQL", "PostgreSQL"], roles: ["backend", "data", "analyst", "full stack"], level: "Beginner", prerequisites: "A free local PostgreSQL installation or a paper-based query exercise.",
    lessons: [
      lesson("select", "Query a table", "PostgreSQL", "https://www.postgresql.org/docs/current/tutorial-select.html", 60, "Query fictional courses by subject and explain the ordering.", "https://www.postgresql.org/docs/current/tutorial.html"),
      lesson("joins", "Join related tables", "PostgreSQL", "https://www.postgresql.org/docs/current/tutorial-join.html", 60, "Find enrolled learners, including those without an assessment attempt.", "https://www.postgresql.org/docs/current/tutorial.html"),
      lesson("aggregate", "Aggregate without misleading counts", "PostgreSQL", "https://www.postgresql.org/docs/current/tutorial-agg.html", 60, "Count completed lessons per learner and explain GROUP BY versus WHERE.", "https://www.postgresql.org/docs/current/tutorial.html"),
      lesson("sql-video", "CS50 SQL lecture", "CS50", cs50 + "weeks/7/", 120, "Design three product questions and answer them with your own queries.", "https://www.postgresql.org/docs/current/tutorial.html"),
    ], project: "Create a fictional course/enrolment/attempt schema and five useful reporting queries. Include a learner with zero attempts and explain how joins affect counts.", credential: null,
  },
  {
    id: "git-quality", title: "Ship collaboratively and accessibly", description: "Use small commits, reviewable branches and practical accessibility checks.",
    skills: ["Git", "Accessibility", "Testing"], roles: ["software", "frontend", "web", "full stack"], level: "Beginner", prerequisites: "An existing small local project and a free Git installation.",
    lessons: [
      lesson("git", "Pro Git foundations", "Git", "https://git-scm.com/book/en/v2", 60, "Initialize a fictional project and explain the working tree, staging area and repository.", "https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository"),
      lesson("commits", "Record intentional changes", "Git", "https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository", 45, "Make two focused commits and review their diffs before committing.", "https://git-scm.com/book/en/v2"),
      lesson("branches", "Branch and merge safely", "Git", "https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging", 60, "Resolve a conflict in a throwaway local repository; preserve both intended changes.", "https://git-scm.com/book/en/v2"),
      lesson("quality", "Accessibility as a quality check", "web.dev", "https://web.dev/learn/accessibility", 90, "Write a keyboard/focus checklist and fix one real issue in your project.", mdn + "Learn_web_development"),
    ], project: "Submit a small repository with a clear README, focused history and an accessibility checklist. Explain one review improvement and one deliberately deferred limitation.", credential: null,
  },
  {
    id: "computer-science", title: "Explore computer science with CS50", description: "A short orientation across problem solving, Python, SQL and the web—not the full CS50 course.",
    skills: ["Python", "SQL", "HTML"], roles: ["software", "python", "data", "web"], level: "Beginner", prerequisites: "A browser. Completing the external CS50 credential requires its full coursework.",
    lessons: [
      lesson("scratch", "Problem-solving foundations", "CS50", cs50 + "weeks/0/", 120, "Describe inputs, outputs and an algorithm for organizing a fictional job shortlist.", mdn + "Learn_web_development"),
      lesson("python", "Python orientation", "CS50", cs50 + "weeks/6/", 120, "Write a small local script that groups fictional opportunities by location.", "https://docs.python.org/3/tutorial/"),
      lesson("sql", "SQL orientation", "CS50", cs50 + "weeks/7/", 120, "Compare a table-based approach with your script; describe one useful query.", "https://www.postgresql.org/docs/current/tutorial.html"),
      lesson("web", "Web orientation", "CS50", cs50 + "weeks/8/", 120, "Present your fictional shortlist as a semantic web page.", mdn + "Learn_web_development"),
    ], project: "Build a small fictional opportunity organiser. Document the algorithm, data representation and an edge case. Use local tools; no paid cloud services.",
    credential: { title: "Free CS50 Certificate", issuer: "CS50", url: cs50 + "certificate/", requirements: "Requires the full CS50 course, qualifying coursework and final project on the provider. Completing this orientation does not earn it. Choose the free CS50 certificate, not paid edX verification." },
  },
];

export const findLearningPath = (id: string) => learningPaths.find((path) => path.id === id);

export function recommendPaths(skills: string[], targetRole: string, jobs: { title: string; skills: string[] }[]) {
  const known = new Set(skills.map((skill) => skill.trim().toLowerCase()));
  const role = targetRole.trim().toLowerCase();
  const relevantJobs = role ? jobs.filter((job) => role.split(/\s+/).filter((word) => word.length > 3 && !["developer", "engineer", "senior", "junior"].includes(word)).some((word) => job.title.toLowerCase().includes(word))) : [];
  return learningPaths.map((path) => {
    const gaps = path.skills.filter((skill) => !known.has(skill.toLowerCase()));
    const demand = relevantJobs.filter((job) => job.skills.some((skill) => gaps.some((gap) => skill.toLowerCase() === gap.toLowerCase()))).length;
    const roleRelevant = Boolean(role && path.roles.some((term) => ` ${role.replace(/[-/]+/g, " ")} `.includes(` ${term} `)));
    const overlap = path.skills.filter(skill => known.has(skill.toLowerCase()));
    return { pathId: path.id, score: (roleRelevant ? 10 : 0) + Math.min(demand, 5) * 4 + (roleRelevant ? gaps.length : 0) + overlap.length,
      reason: demand ? `${demand} of ${relevantJobs.length} sampled related job listings mention a skill not found in your primary resume: ${gaps.join(", ")}. This is a gap signal, not proof you lack the skill.` : roleRelevant ? `Relevant to ${targetRole}. ${gaps.length ? "Not found in your primary resume: " + gaps.join(", ") + "." : "Use this path to practise skills already listed."}` : `Practise skills listed in your primary resume: ${overlap.join(", ")}. This is skill-based, not proof this course is required for your role.`,
    };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
}
