import { env } from '../../config/env.js'

export type KnowledgeLlmProvider = 'gemini' | 'openai'

export type KnowledgeChatLlmConfig = {
  apiKey: string
  baseUrl: string
  model: string
  provider: KnowledgeLlmProvider
}

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai'
const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1'

/** True when Copilot / KB chat can use a generative model (not local-extractive). */
export function hasKnowledgeGenerativeLlm(): boolean {
  return Boolean(env.GEMINI_API_KEY?.trim() || env.OPENAI_API_KEY?.trim())
}

/** Chat + Copilot LLM config. Prefers Gemini when GEMINI_API_KEY is set. */
export function resolveKnowledgeChatLlmConfig(): KnowledgeChatLlmConfig | null {
  const geminiKey = env.GEMINI_API_KEY?.trim()
  if (geminiKey) {
    return {
      apiKey: geminiKey,
      baseUrl: (env.OPENAI_BASE_URL?.trim() || GEMINI_OPENAI_BASE).replace(/\/$/, ''),
      model: env.KB_CHAT_MODEL?.trim() || 'gemini-2.0-flash',
      provider: 'gemini',
    }
  }

  const openaiKey = env.OPENAI_API_KEY?.trim()
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseUrl: (env.OPENAI_BASE_URL?.trim() || OPENAI_DEFAULT_BASE).replace(/\/$/, ''),
      model: env.KB_CHAT_MODEL?.trim() || 'gpt-4o-mini',
      provider: 'openai',
    }
  }

  return null
}

/** Embeddings API config (OpenAI or explicit OPENAI_BASE_URL + OPENAI_API_KEY only). */
export function resolveKnowledgeEmbeddingLlmConfig(): Omit<KnowledgeChatLlmConfig, 'provider'> & {
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
