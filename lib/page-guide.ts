const guides = {
  dashboard: ["Make a little progress today", "Your recommended next step uses your saved profile and applications. Or choose what you want to work on below.", "Find a job", "/jobs"],
  jobs: ["Find a role worth your time", "Compare the role, location and requirements. Save it for later, or prepare an application. Saving a job does not apply to it.", "See your saved jobs", "/saved-jobs"],
  applications: ["Pick up where you left off", "Open an application to review your resume and answers. Submit on the employer’s website, then record the outcome here. Prepared does not mean submitted.", "Prepare more applications", "/autopilot"],
  autopilot: ["Let Parth Careers handle the preparation", "Set your preferences, then choose Prepare now. Answer any missing questions and review each prepared application. You stay in control of the final submission.", "Review your applications", "/applications"],
  learn: ["Learn one useful thing at a time", "Choose a free path, read a lesson and try the exercise. Save your work to continue later. Parth Careers completion records are separate from provider certifications.", "Explore free learning", "/learn"],
  practice: ["Try an answer, then improve it", "Choose a topic and a short session. Write your answer, use the review checklist and save your progress. This is self-review, not an automatic interview grade.", "Brush up on a skill", "/learn"],
  portfolio: ["Turn real work into useful evidence", "Record what you personally did, review every claim and copy it only when you are ready to use it. Nothing is published automatically.", "Review your resume", "/resume"],
  "saved-jobs": ["Turn your shortlist into a next step", "Open a saved role to check the details and prepare an application. Remove roles you no longer want; saving alone never submits anything.", "Check your applications", "/applications"],
  resume: ["Show what you can really do", "Upload your resume and check the imported details. Use the editor to improve wording without adding experience you do not have. Review changes before using them.", "Open the resume editor", "/resume/studio"],
  profile: ["Help us find better matches", "Add your target role, location and preferences, then save. You can update them whenever your plans change. Use your actual work authorization and notice period.", "Find matching jobs", "/jobs"],
  inbox: ["Keep the conversation moving", "Read recruiter messages and interview invitations in one place. Check the company and invitation details before responding; you control who can contact you.", "Review applications", "/applications"],
  recruiter: ["Build your next great team", "Verify your company, publish a clear opening and review genuine applicants. Candidate search respects discoverability and contact consent.", "Manage your plan", "/billing"],
  admin: ["Keep the platform trustworthy", "Review verification, moderation and support with the current account context. Sensitive changes require a reason and are recorded in the audit history.", "Review reported jobs", "/moderation"],
  moderation: ["Review reports with care", "Read the report and available job evidence before changing visibility. A report alone is not proof of misconduct.", "Open admin operations", "/admin"],
  "company-verifications": ["Make hiring trustworthy", "Review company evidence and record the reason for your decision. Verification does not guarantee any job outcome.", "Open admin operations", "/admin"],
  billing: ["Choose the right fit for your search", "Compare your current plan, allowances and payment history. Check test/live status before checkout; cancellation and refund requests are separate actions.", "Compare plans", "/plans"],
  companies: ["Get to know the team first", "Explore company openings and genuine employee reviews. Follow companies you care about; ratings reflect submitted reviews, not a hiring guarantee.", "Browse openings", "/jobs"],
  salaries: ["Put an offer in context", "Compare source-backed salary ranges by role and location. Data coverage and currency matter; a benchmark is not a promised offer.", "Explore matching roles", "/jobs"],
  internships: ["Find a place to begin", "Explore internships and fresher roles, then check stipend, duration and requirements. Missing source information stays explicitly unknown.", "Build your first resume", "/resume"],
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

export const workspaceDestinations = [
  ["dashboard", "Today"], ["jobs", "Find jobs"], ["applications", "Applications"],
  ["resume", "Resume"], ["profile", "Profile"], ["saved-jobs", "Saved jobs"],
  ["autopilot", "Application preparation"], ["inbox", "Hiring inbox"],
  ["learn", "Learning"], ["practice", "Interview practice"], ["portfolio", "Portfolio"],
  ["career", "Career plan"], ["companies", "Companies"], ["internships", "Internships & freshers"],
  ["salaries", "Salary insights"], ["recruiter", "Hiring workspace"], ["billing", "Plans & billing"],
] as const;
