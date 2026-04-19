import OpenAI from "openai";

const missingOpenAIMessage =
  "AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY must be set. Connect the OpenAI AI integration before using AI interview features.";

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "missing",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "http://127.0.0.1:9",
});

export const openai = new Proxy(client, {
  get(target, prop, receiver) {
    if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      throw new Error(missingOpenAIMessage);
    }
    return Reflect.get(target, prop, receiver);
  },
});
