export function homeNextAction(input: {
  needsSetup: boolean;
  hasResume: boolean | null;
  dueJobId?: string;
  readyJobId?: string;
  hasMatches: boolean;
}) {
  if (input.needsSetup) return { title: "Set up your job search", text: "Add your target role, location and job preferences. You only need to do this once.", href: "/profile", cta: "Complete profile" };
  if (input.hasResume === false) return { title: "Add your resume", text: "Upload your PDF and check the imported details before preparing applications.", href: "/resume", cta: "Upload resume" };
  if (input.dueJobId) return { title: "A follow-up is due", text: "Review the recorded application and send a follow-up if appropriate.", href: `/applications?jobId=${encodeURIComponent(input.dueJobId)}`, cta: "Review follow-up" };
  if (input.readyJobId) return { title: "Your next application is ready", text: "Check your resume and answers, complete the company form, then confirm your submission.", href: `/applications?jobId=${encodeURIComponent(input.readyJobId)}`, cta: "Review & apply" };
  if (input.hasMatches) return { title: "Choose a job worth applying to", text: "Open a strong match and review the role. Autopilot can prepare your resume and answers when you are ready.", href: "/jobs", cta: "Review job matches" };
  return { title: "Find your first job match", text: "Browse jobs matched to your profile. Save roles you like; saving is not an application.", href: "/jobs", cta: "Find jobs" };
}
