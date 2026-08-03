import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { prisma } from '../../../config/prisma.js'
import { ValidationError } from '../../../utils/errors.js'
import { hybridSearch } from '../indexing/search.js'
import { buildRagSystemPrompt, streamChatCompletion, type ChatMessage } from '../chat/llm.js'
import {
  formatResolvedContextForPrompt,
  resolveErpContextForCopilot,
  type CopilotErpContextInput,
  type ResolvedErpContext,
} from './context-resolver.js'

export type CopilotCitation = {
  index: number
  documentId: string
  documentTitle: string
  chunkId: string
  chunkIndex: number
  headingPath: string | null
  snippet: string
  score: number
}

/** Active copilot streams by streamId (Stop support). */
const activeStreams = new Map<string, AbortController>()

export function abortCopilotStream(streamId: string): boolean {
  const ctrl = activeStreams.get(streamId)
  if (!ctrl) return false
  ctrl.abort()
  activeStreams.delete(streamId)
  return true
}

function writeSse(res: Response, event: string, data: unknown): void {
  if (res.writableEnded) return
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function initSse(res: Response): void {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  const flushable = res as Response & { flushHeaders?: () => void }
  if (typeof flushable.flushHeaders === 'function') flushable.flushHeaders()
}

async function retrieveCitations(
  tenantId: string,
  question: string,
  topK = 6,
): Promise<Array<CopilotCitation & { content: string }>> {
  const search = await hybridSearch({ tenantId, query: question, topK })
  if (search.hits.length === 0) return []

  const chunkIds = search.hits.map((h) => h.chunkId)
  const full = await prisma.knowledgeChunk.findMany({
    where: { tenantId, id: { in: chunkIds } },
    select: { id: true, contentMd: true },
  })
  const contentMap = new Map(full.map((c) => [c.id, c.contentMd]))

  return search.hits.map((h, i) => ({
    index: i + 1,
    documentId: h.documentId,
    documentTitle: h.documentTitle,
    chunkId: h.chunkId,
    chunkIndex: h.chunkIndex,
    headingPath: h.headingPath,
    snippet: h.snippet,
    score: h.score,
    content: (contentMap.get(h.chunkId) ?? h.snippet).slice(0, 4000),
  }))
}

function buildCopilotSystemPrompt(
  resolved: ResolvedErpContext,
  citations: Array<{
    index: number
    documentTitle: string
    documentId: string
    chunkId: string
    headingPath: string | null
    content: string
  }>,
): string {
  const rag = buildRagSystemPrompt(citations)
  return [
    'You are the FOS ERP Copilot — an in-app assistant available on any ERP screen.',
    'Ground answers in retrieved knowledge sources and the permitted ERP screen context.',
    'Never invent inventory balances, financial totals, or policy text.',
    'If screen context is incomplete, say what is missing and ask a clarifying question.',
    'Cite knowledge sources as [1], [2]. Do not claim elevated permissions.',
    '',
    formatResolvedContextForPrompt(resolved),
    '',
    rag,
  ].join('\n')
}

/**
 * Stream (SSE) or JSON copilot answer for the current ERP screen + knowledge RAG.
 * Does not persist a chat session (use Wave 4 /sessions when the user wants history).
 */
export async function streamCopilotComplete(opts: {
  req: Request
  res: Response
  tenantId: string
  userId: string
  permissions: string[]
  isSuperAdmin: boolean
  content: string
  stream: boolean
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  context: CopilotErpContextInput
}): Promise<void> {
  const content = opts.content.trim()
  if (!content) {
    throw new ValidationError('Message content is required', [
      { field: 'content', message: 'Enter a question' },
    ])
  }

  const resolved = await resolveErpContextForCopilot({
    tenantId: opts.tenantId,
    permissions: opts.permissions,
    isSuperAdmin: opts.isSuperAdmin,
    context: opts.context,
  })

  const citations = await retrieveCitations(opts.tenantId, content)
  const systemPrompt = buildCopilotSystemPrompt(
    resolved,
    citations.map((c) => ({
      index: c.index,
      documentTitle: c.documentTitle,
      documentId: c.documentId,
      chunkId: c.chunkId,
      headingPath: c.headingPath,
      content: c.content,
    })),
  )

  const history = (opts.history ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
    .slice(-16)

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content },
  ]

  const citationPayload = citations.map(({ content: _c, ...rest }) => rest)
  const streamId = randomUUID()
  const ctrl = new AbortController()
  activeStreams.set(streamId, ctrl)
  opts.req.on('close', () => {
    if (!opts.res.writableEnded) ctrl.abort()
  })

  const publicContext = {
    routePath: resolved.routePath,
    moduleKey: resolved.moduleKey,
    entityType: resolved.entityType,
    entityId: resolved.entityId,
    pageTitle: resolved.pageTitle,
    facts: resolved.facts,
    permissionNotes: resolved.permissionNotes,
  }

  if (!opts.stream) {
    try {
      let full = ''
      const result = await streamChatCompletion(messages, {
        signal: ctrl.signal,
        onToken: (t) => {
          full += t
        },
      })
      activeStreams.delete(streamId)
      opts.res.status(200).json({
        success: true,
        message: 'Copilot response completed',
        data: {
          streamId,
          content: result.content || full,
          modelId: result.modelId,
          provider: result.provider,
          citations: citationPayload,
          context: publicContext,
        },
        meta: null,
      })
    } catch (err) {
      activeStreams.delete(streamId)
      throw err
    }
    return
  }

  initSse(opts.res)
  writeSse(opts.res, 'meta', {
    streamId,
    citations: citationPayload,
    context: publicContext,
  })

  let full = ''
  try {
    const result = await streamChatCompletion(messages, {
      signal: ctrl.signal,
      onToken: (token) => {
        full += token
        writeSse(opts.res, 'token', { text: token })
      },
    })
    const finalContent = result.content || full
    writeSse(opts.res, 'done', {
      content: finalContent,
      modelId: result.modelId,
      provider: result.provider,
      streamId,
      citations: citationPayload,
      stopped: ctrl.signal.aborted,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (ctrl.signal.aborted) {
      writeSse(opts.res, 'done', {
        content: full,
        streamId,
        stopped: true,
        citations: citationPayload,
      })
    } else {
      writeSse(opts.res, 'error', { message, streamId })
    }
  } finally {
    activeStreams.delete(streamId)
    if (!opts.res.writableEnded) opts.res.end()
  }
}
