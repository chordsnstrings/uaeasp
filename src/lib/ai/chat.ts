import { getConfig } from "@/lib/settings";

/**
 * Thin chat-completions helper shared by all four growth agents. Uses the same
 * OpenAI-compatible endpoint already configured for provider enrichment
 * (BytePlus Ark by default) — one AI credential for the whole system.
 *
 * Returns null rather than throwing when AI is unconfigured or the call fails,
 * so every agent degrades to its non-AI path instead of stalling the queue.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export async function isAiConfigured(): Promise<boolean> {
  const config = await getConfig();
  return !!(config.aiApiBaseUrl && config.aiApiKey && config.aiModel);
}

export async function chat(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
): Promise<ChatResult | null> {
  const config = await getConfig();
  if (!(config.aiApiBaseUrl && config.aiApiKey && config.aiModel)) return null;

  const baseUrl = config.aiApiBaseUrl.replace(/\/$/, "");
  const endpoint = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/v1/chat/completions`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.aiApiKey}`,
      },
      body: JSON.stringify({
        model: config.aiModel,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1500,
        messages,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
    });
    if (!res.ok) {
      console.error(`[ai-chat] API returned ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return {
      text,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    };
  } catch (err) {
    console.error("[ai-chat] failed:", err);
    return null;
  }
}

/** Extract the first JSON object or array in a model reply (handles fences). */
export function extractJson<T = unknown>(raw: string): T | null {
  const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
