import "server-only";
// Answer keys must never be sent in lesson DTOs or client bundles.
type Question = { prompt: string; options: string[]; correct: number; explanation: string };
const q = (prompt: string, options: string[], correct: number, explanation: string): Question => ({ prompt, options, correct, explanation });
const assessments: Record<string, Question[]> = {
  "web-foundations": [
    q("A clickable action should normally use which HTML element?", ["A styled div", "A button", "A heading"], 1, "A native button supplies keyboard and interaction semantics."),
    q("What is the useful first check for a narrow-screen layout?", ["Check for overflow at a narrow viewport", "Hide all text", "Disable browser zoom"], 0, "Content should remain readable without horizontal overflow or blocking zoom."),
    q("How should an input's purpose be communicated?", ["Only with colour", "Only with placeholder text", "With an associated visible label"], 2, "A persistent associated label supports comprehension and accessible naming."),
  ],
  "javascript-typescript": [
    q("What should you do with unknown external data?", ["Cast it and trust it", "Validate before reading its fields", "Ignore failure cases"], 1, "Type assertions do not perform runtime validation."),
    q("Which promise outcome needs a recoverable UI state?", ["Only success", "Only pending", "Rejection as well as success and pending"], 2, "Users need useful loading and error recovery, not just the happy path."),
    q("What does narrowing a union type achieve?", ["Proves which operations are valid in that branch", "Encrypts the value", "Makes network requests synchronous"], 0, "A guard narrows the possibilities and allows safe type-specific operations."),
  ],
  "react-workflows": [
    q("A title can be calculated from a selected lesson ID. Where should it usually come from?", ["A second independently updated state variable", "A calculation from the current selection", "A timer"], 1, "Deriving values avoids redundant state drifting out of sync."),
    q("Which task is an effect suitable for?", ["Calculating a total from props", "Formatting a label", "Synchronizing an external subscription with cleanup"], 2, "Effects synchronize external systems; rendering calculations usually do not need them."),
    q("When switching between independently reviewed applications, what must happen?", ["Reset the review confirmation for the new application", "Reuse the previous confirmation", "Hide the application title"], 0, "Approval belongs to the reviewed item and must not leak to another item."),
  ],
  "backend-apis": [
    q("What should an API check before changing private user data?", ["Only the requested record ID", "Authentication and ownership", "Only the button label"], 1, "An authenticated user still must be authorized for the specific row."),
    q("What does a TypeScript type do to an incoming JSON body at runtime?", ["Nothing; validation is still required", "Automatically rejects invalid data", "Automatically authenticates the request"], 0, "Static types do not validate incoming untrusted data."),
    q("Which is safe for independent asynchronous reads?", ["Busy-waiting", "Blocking the event loop", "Concurrent promises with failure handling"], 2, "Independent asynchronous work can run concurrently without blocking execution."),
  ],
  "sql-data": [
    q("Which join can retain a learner who has no attempt?", ["INNER JOIN", "LEFT JOIN from learners", "CROSS JOIN"], 1, "A left join retains rows from the left side, even without a match."),
    q("What does GROUP BY help express?", ["One summary per chosen grouping", "Deleting duplicate tables", "Authorization by itself"], 0, "Grouping supports aggregates such as attempts per learner."),
    q("Can a browser-supplied user ID alone authorize a private SQL update?", ["Yes", "Only if it is a UUID", "No; enforce authenticated ownership"], 2, "A valid-looking identifier is not proof of permission."),
  ],
  "git-quality": [
    q("What should you inspect before making a focused commit?", ["Only the filename", "The staged diff", "Only the last commit message"], 1, "The staged diff reveals the exact changes you are about to record."),
    q("A merge conflict should be resolved by doing what?", ["Understanding and preserving intended changes", "Always deleting both sides", "Always choosing the newest line"], 0, "A conflict is a semantic decision, not merely a timestamp comparison."),
    q("What is a useful accessibility check?", ["Disable focus outlines", "Check only with a mouse", "Navigate and operate controls with the keyboard"], 2, "Keyboard checks reveal focus and interaction problems that mouse-only testing misses."),
  ],
  "computer-science": [
    q("What should an algorithm description make clear?", ["Only its font", "Inputs, operations and expected outputs", "Only a certificate name"], 1, "An algorithm transforms defined inputs through clear steps into outputs."),
    q("When grouping data, which is an important edge case?", ["Only the longest title", "Only the happy path", "An empty collection or missing grouping value"], 2, "Empty and incomplete data must be handled intentionally."),
    q("Does this short orientation earn a CS50 provider certificate?", ["No; complete the provider's full requirements", "Yes, after opening one video", "Yes, if a screenshot is uploaded"], 0, "Provider credentials are issued only by that provider under its requirements."),
  ],
};

export function assessmentQuestions(pathId: string) {
  return (assessments[pathId] || []).map(({ prompt, options }) => ({ prompt, options }));
}
export function gradeAssessment(pathId: string, answers: unknown) {
  const questions = assessments[pathId];
  if (!questions || !Array.isArray(answers) || answers.length !== questions.length || questions.some((question, index) => !Number.isInteger(answers[index]) || answers[index] < 0 || answers[index] >= question.options.length)) throw new Error("Answer every question using the available choices.");
  const correct = questions.filter((question, index) => question.correct === answers[index]).length;
  return { score: Math.round(correct / questions.length * 100), passed: correct >= 2,
    feedback: questions.map((question, index) => ({ correct: question.correct === answers[index], explanation: question.explanation })) };
}
