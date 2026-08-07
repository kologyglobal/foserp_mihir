import { logger } from '../../../config/logger.js'
import { resolveKnowledgeChatLlmConfig } from '../llm-config.js'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatStreamHandlers = {
  onToken: (text: string) => void
  signal?: AbortSignal
}

export type ChatCompletionResult = {
  content: string
  modelId: string
  provider: 'openai-compatible' | 'gemini-native' | 'local-extractive'
  tokenIn: number | null
  tokenOut: number | null
}

function chatConfig() {
  const cfg = resolveKnowledgeChatLlmConfig()
  if (!cfg) return null
  return {
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    provider: cfg.provider,
    transport: cfg.transport,
  }
}

function friendlyChatApiError(status: number, body: string, provider: 'gemini' | 'openai'): string {
  const lower = body.toLowerCase()
  if (status === 429 || lower.includes('insufficient_quota') || lower.includes('exceeded your current quota')) {
    return provider === 'gemini'
      ? 'Gemini quota/rate limit hit. Check Google AI Studio billing or remove GEMINI_API_KEY for local answers.'
      : 'OpenAI quota exceeded (billing/plan). Top up at platform.openai.com or remove OPENAI_API_KEY for local answers.'
  }
  if (status === 401 || status === 403 || lower.includes('invalid_api_key')) {
    return provider === 'gemini'
      ? 'Gemini API key rejected. Check GEMINI_API_KEY in backend/.env and restart the backend.'
      : 'OpenAI API key rejected. Check OPENAI_API_KEY in backend/.env and restart.'
  }
  return `Chat API ${status}: ${body.slice(0, 280)}`
}

/** Stream chat completions (Gemini native or OpenAI-compatible); falls back to local extractive answer. */
export async function streamChatCompletion(
  messages: ChatMessage[],
  handlers: ChatStreamHandlers,
): Promise<ChatCompletionResult> {
  const cfg = chatConfig()
  if (!cfg) {
    return streamLocalExtractive(messages, handlers)
  }

  try {
    return cfg.transport === 'gemini-native'
      ? await streamGeminiNative(cfg, messages, handlers)
      : await streamOpenAiCompatible(cfg, messages, handlers)
  } catch (err) {
    if (handlers.signal?.aborted) {
      return {
        content: '',
        modelId: cfg.model,
        provider: cfg.transport === 'gemini-native' ? 'gemini-native' : 'openai-compatible',
        tokenIn: null,
        tokenOut: null,
      }
    }
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('Generative chat unavailable; using local extractive answer', {
      message: message.slice(0, 280),
    })
    return streamLocalExtractive(messages, handlers)
  }
}

type ChatConfig = {
  apiKey: string
  baseUrl: string
  model: string
  provider: 'gemini' | 'openai'
  transport: 'gemini-native' | 'openai-compatible'
}

async function streamOpenAiCompatible(
  cfg: ChatConfig,
  messages: ChatMessage[],
  handlers: ChatStreamHandlers,
): Promise<ChatCompletionResult> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: true,
      temperature: 0.2,
    }),
    signal: handlers.signal,
  })

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '')
    throw new Error(friendlyChatApiError(res.status, body, cfg.provider))
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  let finished = false

  while (!finished) {
    if (handlers.signal?.aborted) {
      try {
        await reader.cancel()
      } catch {
        // ignore
      }
      break
    }
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') {
        finished = true
        break
      }
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>
        }
        const token = json.choices?.[0]?.delta?.content
        if (token) {
          full += token
          handlers.onToken(token)
        }
      } catch {
        // skip malformed SSE chunk
      }
    }
  }

  return {
    content: full,
    modelId: cfg.model,
    provider: 'openai-compatible',
    tokenIn: null,
    tokenOut: null,
  }
}

/** Google's native generateContent API uses 'user'/'model' roles and a separate systemInstruction field. */
function toGeminiRequestBody(messages: ChatMessage[], temperature: number) {
  const systemParts: string[] = []
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []

  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content)
      continue
    }
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  }

  return {
    ...(systemParts.length ? { systemInstruction: { parts: [{ text: systemParts.join('\n\n') }] } } : {}),
    contents,
    generationConfig: { temperature },
  }
}

type GeminiStreamChunk = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  error?: { message?: string; status?: string }
}

/** Stream via Google's native generateContent endpoint (works with both AIza… and AQ. keys). */
async function streamGeminiNative(
  cfg: ChatConfig,
  messages: ChatMessage[],
  handlers: ChatStreamHandlers,
): Promise<ChatCompletionResult> {
  const res = await fetch(`${cfg.baseUrl}/models/${cfg.model}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': cfg.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(toGeminiRequestBody(messages, 0.2)),
    signal: handlers.signal,
  })

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '')
    throw new Error(friendlyChatApiError(res.status, body, 'gemini'))
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    if (handlers.signal?.aborted) {
      try {
        await reader.cancel()
      } catch {
        // ignore
      }
      break
    }
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data) continue
      try {
        const json = JSON.parse(data) as GeminiStreamChunk
        if (json.error) {
          throw new Error(`Chat API ${json.error.status ?? 'ERROR'}: ${json.error.message ?? 'unknown error'}`)
        }
        const token = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
        if (token) {
          full += token
          handlers.onToken(token)
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message.startsWith('Chat API')) throw parseErr
        // skip malformed SSE chunk
      }
    }
  }

  return {
    content: full,
    modelId: cfg.model,
    provider: 'gemini-native',
    tokenIn: null,
    tokenOut: null,
  }
}

/** Non-streaming convenience wrapper. */
export async function completeChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<ChatCompletionResult> {
  let content = ''
  return streamChatCompletion(messages, {
    signal,
    onToken: (t) => {
      content += t
    },
  }).then((r) => ({ ...r, content: r.content || content }))
}

/** Pure answer builder used by local stream mode (unit-testable without I/O). */
export function buildLocalExtractiveAnswer(messages: ChatMessage[]): string {
  const system = messages.find((m) => m.role === 'system')?.content ?? ''
  const user = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const sourcesBlock = extractSourcesSection(system)

  if (!sourcesBlock.trim()) {
    return 'I could not find relevant knowledge documents for that question. Upload and reindex documents, then try again.'
  }
  return [
    'Based on the retrieved knowledge sources (local answer mode — set `GEMINI_API_KEY` or `OPENAI_API_KEY` in backend/.env for generative Copilot):',
    '',
    sourcesBlock,
    '',
    `**Question:** ${user}`,
    '',
    'Use the citations above for full detail. I only summarized what appears in indexed chunks.',
  ].join('\n')
}

/**
 * Offline / no-key mode: answer from retrieved sources without claiming LLM inventiveness.
 * Streams in word batches so the UI path matches SSE clients.
 */
async function streamLocalExtractive(
  messages: ChatMessage[],
  handlers: ChatStreamHandlers,
): Promise<ChatCompletionResult> {
  const answer = buildLocalExtractiveAnswer(messages)

  const tokens = answer.match(/\S+\s*|\n+/g) ?? [answer]
  for (const t of tokens) {
    if (handlers.signal?.aborted) break
    handlers.onToken(t)
    // tiny yield so SSE flushes between words
    await new Promise((r) => setTimeout(r, 0))
  }

  return {
    content: answer,
    modelId: 'kb-local-extractive-v1',
    provider: 'local-extractive',
    tokenIn: null,
    tokenOut: null,
  }
}

function extractSourcesSection(systemPrompt: string): string {
  const marker = '## Retrieved sources'
  const idx = systemPrompt.indexOf(marker)
  if (idx < 0) return ''
  return systemPrompt.slice(idx + marker.length).trim()
}

export function buildRagSystemPrompt(citations: Array<{
  index: number
  documentTitle: string
  documentId: string
  chunkId: string
  headingPath: string | null
  content: string
}>): string {
  const blocks = citations.map((c) => {
    const head = c.headingPath ? ` (${c.headingPath})` : ''
    return `[${c.index}] ${c.documentTitle}${head}\nDoc: ${c.documentId} · Chunk: ${c.chunkId}\n${c.content}`
  })

  return [
    'You are the FOS ERP Knowledge Base assistant.',
    'Answer using ONLY the retrieved sources below. If sources are insufficient, say you do not know.',
    'Cite sources inline as [1], [2] matching the source numbers.',
    'Prefer concise Markdown (bullets, short paragraphs). Do not invent policy or numeric data.',
    '',
    '## Retrieved sources',
    blocks.join('\n\n---\n\n') || '(none)',
  ].join('\n')
}
