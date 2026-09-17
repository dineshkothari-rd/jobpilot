import "server-only";
// Answer keys must never be sent in lesson DTOs or client bundles.
export type Question = { prompt: string; options: string[]; correct: number; explanation: string };
export function gradeAssessment(pathId: string, answers: unknown, questions: Question[]) {
  if (!pathId || !questions || questions.length !== 3 || !Array.isArray(answers) || answers.length !== questions.length || questions.some((question, index) => !Number.isInteger(answers[index]) || answers[index] < 0 || answers[index] >= question.options.length)) throw new Error("Answer every question using the available choices.");
  const correct = questions.filter((question, index) => question.correct === answers[index]).length;
  return { score: Math.round(correct / questions.length * 100), passed: correct >= 2,
    feedback: questions.map((question, index) => ({ correct: question.correct === answers[index], explanation: question.explanation })) };
}
