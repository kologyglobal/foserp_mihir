/**
 * Knowledge Base API client (Waves 2–5).
 * Streaming uses fetch + SSE parse (not apiRequest JSON envelope).
 */
import { API_CONFIG } from '../../config/apiConfig'
import { ApiError } from './apiErrors'
import {
  ensureFreshAccessToken,
  getStoredSession,
  SESSION_EXPIRED_NOTICE,
  apiRequest,
  tenantPath,
} from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

export type KnowledgeCitation = {
  index: number
  documentId: string
  documentTitle: string
  chunkId: string
  chunkIndex: number
  headingPath: string | null
  snippet: string
  score: number
}

export type CopilotErpContextPayload = {
  moduleKey?: string | null
  routePath: string
  entityType?: string | null
  entityId?: string | null
  screenHints?: string[]
  pageTitle?: string | null
}

export type SseHandlers = {
  onMeta?: (data: Record<string, unknown>) => void
  onToken?: (text: string) => void
  onDone?: (data: Record<string, unknown>) => void
  onError?: (message: string) => void
  signal?: AbortSignal
}

async function authorizedHeaders(json = true): Promise<Headers> {
  const headers = new Headers()
  if (json) headers.set('Content-Type', 'application/json')
  let session = getStoredSession()
  let accessToken = session?.accessToken
  if (session) {
    accessToken = (await ensureFreshAccessToken()) ?? session.accessToken
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return headers
}

/** POST that expects text/event-stream. */
export async function streamSsePost(
  resourcePath: string,
  body: unknown,
  handlers: SseHandlers,
): Promise<void> {
  const headers = await authorizedHeaders(true)
  headers.set('Accept', 'text/event-stream')

  const url = `${API_CONFIG.baseUrl}${tenantPath(resourcePath)}`
  let res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: handlers.signal,
  })

  if (res.status === 401) {
    const token = await ensureFreshAccessToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: handlers.signal,
      })
    }
  }

  if (res.status === 401) {
    throw new ApiError(SESSION_EXPIRED_NOTICE, 401)
  }

  if (!res.ok || !res.body) {
    let message = `Stream failed (${res.status})`
    try {
      const j = (await res.json()) as { message?: string }
      if (j.message) message = j.message
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    for (const line of parts) {
      const trimmed = line.replace(/\r$/, '')
      if (trimmed.startsWith('event:')) {
        eventName = trimmed.slice(6).trim()
        continue
      }
      if (trimmed.startsWith('data:')) {
        const raw = trimmed.slice(5).trim()
        let data: Record<string, unknown> = {}
        try {
          data = JSON.parse(raw) as Record<string, unknown>
        } catch {
          handlers.onToken?.(raw)
          continue
        }
        if (eventName === 'meta') handlers.onMeta?.(data)
        else if (eventName === 'token') handlers.onToken?.(String(data.text ?? ''))
        else if (eventName === 'done') handlers.onDone?.(data)
        else if (eventName === 'error') handlers.onError?.(String(data.message ?? 'Stream error'))
        eventName = 'message'
      }
    }
  }
}

// ─── Status / documents ─────────────────────────────────────────────────────

export async function fetchKnowledgeStatus() {
  return apiRequest<{
    wave: number
    features: Record<string, boolean>
    chatMode?: string
    copilotMode?: string
    counts?: Record<string, number>
  }>(tenantPath('/kb/status'))
}

export type KnowledgeDocumentRow = {
  id: string
  title: string
  status: string
  kind: string
  updatedAt: string
  index?: {
    status?: string
    chunkCount?: number
    error?: string | null
  }
}

export async function fetchKnowledgeDocuments(params?: {
  page?: number
  limit?: number
  status?: string
  search?: string
}) {
  return apiRequest<KnowledgeDocumentRow[]>(
    `${tenantPath('/kb/documents')}${buildQuery(params)}`,
  )
}

/** Create from inline Markdown / text (indexes + can publish to READY). */
export async function createKnowledgeDocumentMarkdown(input: {
  title: string
  markdownContent: string
  description?: string
  publish?: boolean
}) {
  return apiRequest<KnowledgeDocumentRow>(tenantPath('/kb/documents'), {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      markdownContent: input.markdownContent,
      description: input.description,
      kind: 'MARKDOWN',
      publish: input.publish ?? true,
    }),
  })
}

/** Multipart file upload (`file` field). Indexes when pipeline supports the type. */
export async function uploadKnowledgeDocumentFile(input: {
  file: File
  title?: string
  description?: string
  publish?: boolean
}) {
  const form = new FormData()
  form.append('file', input.file)
  if (input.title?.trim()) form.append('title', input.title.trim())
  if (input.description?.trim()) form.append('description', input.description.trim())
  if (input.publish) form.append('publish', 'true')
  return apiRequest<KnowledgeDocumentRow>(tenantPath('/kb/documents'), {
    method: 'POST',
    body: form,
  })
}

export async function reindexKnowledgeDocument(id: string) {
  return apiRequest<KnowledgeDocumentRow>(tenantPath(`/kb/documents/${id}/reindex`), {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

// ─── Chat (Wave 4) ──────────────────────────────────────────────────────────

export async function createKnowledgeChatSession(input?: { title?: string }) {
  return apiRequest<{ id: string; title: string | null }>(tenantPath('/kb/sessions'), {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  })
}

export async function streamChatMessage(
  sessionId: string,
  content: string,
  handlers: SseHandlers,
): Promise<void> {
  return streamSsePost(
    `/kb/sessions/${sessionId}/messages`,
    { content, stream: true },
    handlers,
  )
}

// ─── Copilot (Wave 5) ───────────────────────────────────────────────────────

export async function streamCopilotComplete(
  input: {
    content: string
    context: CopilotErpContextPayload
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  },
  handlers: SseHandlers,
): Promise<void> {
  return streamSsePost(
    '/kb/copilot/complete',
    { ...input, stream: true },
    handlers,
  )
}

export async function stopCopilotStream(streamId: string) {
  return apiRequest<{ streamId: string; stopped: boolean }>(tenantPath('/kb/copilot/stop'), {
    method: 'POST',
    body: JSON.stringify({ streamId }),
  })
}

export async function fetchChatSuggestions() {
  return apiRequest<{ items: string[] }>(tenantPath('/kb/chat/suggestions'))
}
