import type { Metadata } from "next";
import { PrepareHubClient } from "./prepare-hub-client";

export const metadata: Metadata = {
  title: "Interview Preparation Hub",
  description: "Job-specific interview preparation grounded in your resume and the job description.",
  robots: { index: false, follow: false },
};

export default function PreparePage() {
  return <PrepareHubClient />;
}
