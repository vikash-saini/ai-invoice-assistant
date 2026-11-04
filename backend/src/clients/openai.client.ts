import OpenAI from "openai";

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    maxRetries: 2,
    timeout: 30_000,
  });
}
