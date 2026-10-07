import { createDeterministicInterviewProvider } from "./deterministic-provider.ts";
import { OpenAiCompatibleInterviewProvider } from "./openai-compatible.ts";
import type { AiAction, GroundedInterviewContext, InterviewAiProvider } from "./types.ts";

type Env = Record<string, string | undefined>;

export function getInterviewAiProvider(env: Env = process.env, fetcher?: typeof fetch): InterviewAiProvider {
  const requested = (env.AI_PROVIDER || "").trim().toLowerCase();
  if (!requested) return createDeterministicInterviewProvider();
  if (env.ALLOW_PAID_PROVIDERS !== 'true') return createDeterministicInterviewProvider('External AI is disabled for the free launch.');

  if (!["openai", "openai-compatible"].includes(requested)) {
    return createDeterministicInterviewProvider(`Unsupported AI_PROVIDER "${requested}".`);
  }

  if (!env.AI_API_KEY) {
    return createDeterministicInterviewProvider("AI_PROVIDER is configured, but AI_API_KEY is missing.");
  }

  return new OpenAiCompatibleInterviewProvider({
    apiKey: env.AI_API_KEY,
    baseUrl: env.AI_BASE_URL || "https://api.openai.com/v1",
    model: env.AI_MODEL || "gpt-4o-mini",
    fetcher,
  });
}

export async function runInterviewAiAction(
  action: AiAction,
  context: GroundedInterviewContext,
  env: Env = process.env,
  fetcher?: typeof fetch,
) {
  const provider = getInterviewAiProvider(env, fetcher);
  const fallback = createDeterministicInterviewProvider("AI provider failed; deterministic fallback used.");

  try {
    const result = await method(provider, action)(context);
    return { result, status: provider.status, fallback: provider.status.provider === "deterministic" };
  } catch {
    return { result: await method(fallback, action)(context), status: fallback.status, fallback: true };
  }
}

function method(provider: InterviewAiProvider, action: AiAction) {
  if (action === "follow-up") return provider.followUp.bind(provider);
  return provider[action].bind(provider);
}

export const getAiProviderStatus = (env: Env = process.env) => getInterviewAiProvider(env).status;
