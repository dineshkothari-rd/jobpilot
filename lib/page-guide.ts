const guides = {
  dashboard: ["Make a little progress today", "Your recommended next step uses your saved profile and applications. Or choose what you want to work on below.", "Find a job", "/jobs"],
  jobs: ["Find a role worth your time", "Compare the role, location and requirements. Save it for later, or prepare an application. Saving a job does not apply to it.", "See your saved jobs", "/saved-jobs"],
  applications: ["Pick up where you left off", "Open an application to review your resume and answers. Submit on the employer’s website, then record the outcome here. Prepared does not mean submitted.", "Prepare more applications", "/autopilot"],
  autopilot: ["Let JobPilot handle the preparation", "Set your preferences, then choose Prepare now. Answer any missing questions and review each prepared application. You stay in control of the final submission.", "Review your applications", "/applications"],
  learn: ["Learn one useful thing at a time", "Choose a free path, read a lesson and try the exercise. Save your work to continue later. JobPilot completion records are separate from provider certifications.", "Explore free learning", "/learn"],
  practice: ["Try an answer, then improve it", "Choose a topic and a short session. Write your answer, use the review checklist and save your progress. This is self-review, not an automatic interview grade.", "Brush up on a skill", "/learn"],
  portfolio: ["Turn real work into useful evidence", "Record what you personally did, review every claim and copy it only when you are ready to use it. Nothing is published automatically.", "Review your resume", "/resume"],
  "saved-jobs": ["Turn your shortlist into a next step", "Open a saved role to check the details and prepare an application. Remove roles you no longer want; saving alone never submits anything.", "Check your applications", "/applications"],
  resume: ["Show what you can really do", "Upload your resume and check the imported details. Use the editor to improve wording without adding experience you do not have. Review changes before using them.", "Open the resume editor", "/resume/studio"],
  profile: ["Help us find better matches", "Add your target role, location and preferences, then save. You can update them whenever your plans change. Use your actual work authorization and notice period.", "Find matching jobs", "/jobs"],
  career: ["Choose a manageable next step", "Use your career plan to spot a skill to build or a role to explore. Suggestions are a starting point, not a hiring prediction.", "Build a skill", "/learn"],
} as const;

export function pageGuide(pathname: string) {
  const segments = pathname.split("/");
  if (segments[1] === "jobs" && segments[2] && segments[3] === "interview") return pageGuide("/practice");
  if (segments[1] === "jobs" && segments[2] && ["prepare", "copilot"].includes(segments[3])) {
    return { title: "Prepare for this role", text: "Use the job details and your real experience to prepare. Check suggestions for accuracy before using them; preparation never submits an application for you.", action: "Review your applications", href: "/applications" };
  }
  const segment = segments[1];
  const key = Object.hasOwn(guides, segment) ? segment as keyof typeof guides : "dashboard";
  const [title, text, action, href] = guides[key];
  return { title, text, action, href };
}

export const searchGoals = [
  { title: "Find my next role", text: "Browse matches and save roles you like.", action: "Find jobs", href: "/jobs" },
  { title: "Get an application ready", text: "Prepare your resume and answers, then review before applying.", action: "Prepare applications", href: "/autopilot" },
  { title: "Build a skill", text: "Choose a free lesson and try a practical exercise.", action: "Explore learning", href: "/learn" },
  { title: "Feel ready for an interview", text: "Practise one answer at a time and revisit what needs work.", action: "Start interview practice", href: "/practice" },
] as const;
