import { env } from '../../config/env.js'

export type KnowledgeLlmProvider = 'gemini' | 'openai' | 'openrouter'
/**
 * 'gemini-native' calls Google's own generateContent API with an `x-goog-api-key` header.
 * 'openai-compatible' calls an OpenAI-shaped `/chat/completions` endpoint with `Authorization: Bearer`.
 *
 * Google AI Studio's newer `AQ.`-prefixed keys are rejected by Google's OpenAI-compatibility
 * endpoint ("Multiple authentication credentials received" — unresolved upstream bug, see
 * https://discuss.ai.google.dev/t/140545), so Gemini defaults to the native transport. Legacy
 * `AIza…` keys work with either transport.
 */
export type KnowledgeChatLlmTransport = 'gemini-native' | 'openai-compatible'

export type KnowledgeChatLlmConfig = {
  apiKey: string
  baseUrl: string
  model: string
  provider: KnowledgeLlmProvider
  transport: KnowledgeChatLlmTransport
}

const GEMINI_NATIVE_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1'
const OPENROUTER_DEFAULT_BASE = 'https://openrouter.ai/api/v1'

/** True when Copilot / KB chat can use a generative model (not local-extractive). */
export function hasKnowledgeGenerativeLlm(): boolean {
  return Boolean(env.OPENROUTER_API_KEY?.trim() || env.GEMINI_API_KEY?.trim() || env.OPENAI_API_KEY?.trim())
}

/**
 * Chat + Copilot LLM config. Provider priority: OpenRouter → Gemini → OpenAI
 * (setting OPENROUTER_API_KEY is an explicit operator choice, so it wins).
 */
export function resolveKnowledgeChatLlmConfig(): KnowledgeChatLlmConfig | null {
  const openrouterKey = env.OPENROUTER_API_KEY?.trim()
  if (openrouterKey) {
    return {
      apiKey: openrouterKey,
      baseUrl: (env.OPENROUTER_BASE_URL?.trim() || OPENROUTER_DEFAULT_BASE).replace(/\/$/, ''),
      // OpenRouter model slugs are vendor-prefixed, e.g. openai/gpt-4o-mini, google/gemini-2.0-flash-001.
      model: env.OPENROUTER_MODEL?.trim() || env.KB_CHAT_MODEL?.trim() || 'openai/gpt-4o-mini',
      provider: 'openrouter',
      transport: 'openai-compatible',
    }
  }

  const geminiKey = env.GEMINI_API_KEY?.trim()
  if (geminiKey) {
    // An explicit OPENAI_BASE_URL means the operator is pointing Gemini at a self-hosted
    // OpenAI-compatible proxy on purpose — honor that instead of going native.
    const proxyBase = env.OPENAI_BASE_URL?.trim()
    if (proxyBase) {
      return {
        apiKey: geminiKey,
        baseUrl: proxyBase.replace(/\/$/, ''),
        model: env.KB_CHAT_MODEL?.trim() || 'gemini-2.0-flash',
        provider: 'gemini',
        transport: 'openai-compatible',
      }
    }
    return {
      apiKey: geminiKey,
      baseUrl: GEMINI_NATIVE_BASE,
      model: env.KB_CHAT_MODEL?.trim() || 'gemini-2.0-flash',
      provider: 'gemini',
      transport: 'gemini-native',
    }
  }

  const openaiKey = env.OPENAI_API_KEY?.trim()
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseUrl: (env.OPENAI_BASE_URL?.trim() || OPENAI_DEFAULT_BASE).replace(/\/$/, ''),
      model: env.KB_CHAT_MODEL?.trim() || 'gpt-4o-mini',
      provider: 'openai',
      transport: 'openai-compatible',
    }
  }

  return null
}

/**
 * Embeddings API config (OpenAI or explicit OPENAI_BASE_URL + OPENAI_API_KEY only).
 * OpenRouter is chat-only — it exposes no /embeddings endpoint, so it is deliberately
 * excluded here; retrieval falls back to local scoring when no OpenAI key is present.
 */
export function resolveKnowledgeEmbeddingLlmConfig(): Omit<KnowledgeChatLlmConfig, 'provider' | 'transport'> & {
  provider: 'openai-compatible'
} | null {
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null
  return {
    apiKey,
    baseUrl: (env.OPENAI_BASE_URL?.trim() || OPENAI_DEFAULT_BASE).replace(/\/$/, ''),
    model: env.KB_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small',
    provider: 'openai-compatible',
  }
}
