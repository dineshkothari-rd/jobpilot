import {
  evaluateInterviewAnswer,
  type InterviewQuestion,
} from "../interview-engine.ts";
import type {
  GroundedInterviewContext,
  InterviewAiProvider,
} from "./types.ts";

const first = <T>(items: T[], fallback: T) => items[0] ?? fallback;

function topicName(context: GroundedInterviewContext) {
  return context.topic?.title || context.question?.focusArea || context.job.skills[0] || "this role";
}

function questionFor(context: GroundedInterviewContext): InterviewQuestion {
  return context.question || {
    id: "deterministic-question",
    category: "technical",
    difficulty: "Medium",
    question: `How would you apply ${topicName(context)} in ${context.job.title || "this role"}?`,
    focusArea: topicName(context),
    whatToCover: context.topic?.keyConcepts || [topicName(context), "trade-offs", "example"],
    evaluationCriteria: ["Job relevance", "Specificity", "Trade-offs"],
  };
}

export function createDeterministicInterviewProvider(reason = "AI provider is not configured."): InterviewAiProvider {
  const status = { mode: "fallback" as const, provider: "deterministic" as const, model: null, reason };

  return {
    status,
    async explain(context) {
      const topic = topicName(context);
      return {
        provider: "deterministic",
        simple: `${topic} matters because this job signals it as part of the role.`,
        deep: context.topic?.detailedExplanation || `Prepare ${topic} through fundamentals, trade-offs, failure modes, and one honest example.`,
        example: first(context.topic?.practicalExamples || [], `Describe a real project where ${topic} affected a decision or outcome.`),
        interviewRelevance: `Connect ${topic} to ${context.job.title || "the role"} and avoid claims your resume cannot support.`,
        commonMistake: first(context.topic?.commonMistakes || [], "Giving definitions without a concrete example."),
        keyTakeaway: `Have a two-minute answer for ${topic}: context, decision, trade-off, result.`,
      };
    },
    async quiz(context) {
      const topic = topicName(context);
      const concepts = (context.topic?.keyConcepts || [topic, "trade-offs", "debugging"]).slice(0, 4);
      return {
        provider: "deterministic",
        topic,
        questions: [
          {
            question: `Which answer best prepares ${topic} for an interview?`,
            options: [
              "Definition, trade-off, and a real example",
              "Only the textbook definition",
              "A claim not supported by resume evidence",
              "A long unrelated project story",
            ],
            correctAnswer: "Definition, trade-off, and a real example",
            expectedConcepts: concepts,
            explanation: "Interviewers need proof you can apply the topic, not just name it.",
          },
        ],
      };
    },
    async evaluate(context) {
      const evaluation = evaluateInterviewAnswer(questionFor(context), context.answer || "");
      return {
        provider: "deterministic",
        score: evaluation.score,
        rating: evaluation.quality,
        strengths: evaluation.strengths,
        missingPoints: evaluation.missingPoints,
        incorrectAssumptions: [],
        betterStructure: "Answer in this order: context, decision, trade-off, measurable result, what you would improve.",
        suggestedAnswerDirection: evaluation.idealAnswerDirection,
        followUpQuestion: `Can you give a concrete example of ${topicName(context)} from your own work?`,
      };
    },
    async followUp(context) {
      return {
        provider: "deterministic",
        action: "follow-up",
        response: `Harder follow-up: what would fail first if ${topicName(context)} was used at production scale, and how would you detect it?`,
      };
    },
    async revision(context) {
      return {
        provider: "deterministic",
        mustKnowConcepts: (context.topic?.keyConcepts || context.job.skills).slice(0, 5),
        topQuestions: [
          context.question?.question || `How have you used ${topicName(context)}?`,
          `What trade-offs matter for ${topicName(context)}?`,
          `How would you debug an issue involving ${topicName(context)}?`,
        ],
        mistakesToAvoid: context.topic?.commonMistakes || ["Inventing experience", "Skipping trade-offs"],
        reminders: ["Use only real candidate evidence.", "Tie answers back to the job.", "Keep answers concise."],
        sequence: ["5 min fundamentals", "3 min trade-offs", "2 min answer aloud"],
      };
    },
    async coach(context) {
      return {
        provider: "deterministic",
        action: "coach",
        response: `Focus next on ${context.weakAreas[0]?.title || topicName(context)}. Prepare one resume-supported example and one trade-off.`,
      };
    },
    async lesson(context) {
      const topic = topicName(context);
      return {
        provider: "deterministic",
        title: `${topic} lesson`,
        script: `Prepare ${topic} by covering fundamentals, trade-offs, common mistakes, and one truthful example tied to ${context.job.title || "the role"}.`,
        chapters: [
          { title: "Context", summary: `Why ${topic} matters for the role.` },
          { title: "Core concepts", summary: (context.topic?.keyConcepts || [topic]).slice(0, 3).join(", ") },
          { title: "Practice answer", summary: "Say the answer aloud in two minutes." },
        ],
      };
    },
  };
}
