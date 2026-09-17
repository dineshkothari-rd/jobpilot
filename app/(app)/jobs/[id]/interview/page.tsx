import { PracticeStudio } from "../../../practice/practice-studio";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PracticeStudio initialJob={id} />;
}
