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

export function recommendPaths(skills: string[], targetRole: string, jobs: { title: string; skills: string[] }[], paths: LearningPath[], goals: string[] = []) {
  const known = new Set(skills.map((skill) => skill.trim().toLowerCase()));
  const role = targetRole.trim().toLowerCase();
  const relevantJobs = role ? jobs.filter((job) => role.split(/\s+/).filter((word) => word.length > 3 && !["developer", "engineer", "senior", "junior", "manager", "specialist", "associate"].includes(word)).some((word) => ` ${job.title.toLowerCase().replace(/[-/]+/g, " ")} `.includes(` ${word} `))) : [];
  return paths.map((path) => {
    const gaps = path.skills.filter((skill) => !known.has(skill.toLowerCase()));
    const demand = relevantJobs.filter((job) => job.skills.some((skill) => gaps.some((gap) => skill.toLowerCase() === gap.toLowerCase()))).length;
    const roleRelevant = Boolean(role && path.roles.some((term) => ` ${role.replace(/[-/]+/g, " ")} `.includes(` ${term} `)));
    const overlap = path.skills.filter(skill => known.has(skill.toLowerCase()));
    const goalMatches = path.skills.filter(skill => goals.some(goal => goal.trim().toLowerCase() === skill.toLowerCase()));
    return { pathId: path.id, score: goalMatches.length * 20 + (goalMatches.length / Math.max(1, path.skills.length)) + (roleRelevant ? 10 : 0) + Math.min(demand, 5) * 4 + (roleRelevant ? gaps.length : 0) + overlap.length,
      reason: goalMatches.length ? `Matches your learning goals: ${goalMatches.join(", ")}.` : demand ? `${demand} of ${relevantJobs.length} sampled related job listings mention a skill not found in your primary resume: ${gaps.join(", ")}. This is a gap signal, not proof you lack the skill.` : roleRelevant ? `Relevant to ${targetRole}. ${gaps.length ? "Not found in your primary resume: " + gaps.join(", ") + "." : "Use this path to practise skills already listed."}` : `Practise skills listed in your primary resume: ${overlap.join(", ")}. This is skill-based, not proof this course is required for your role.`,
    };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
}
