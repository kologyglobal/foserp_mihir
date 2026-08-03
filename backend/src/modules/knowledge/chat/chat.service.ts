import type { Request, Response } from 'express'
import { prisma } from '../../../config/prisma.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import {
  NotFoundError,
  ValidationError,
} from '../../../utils/errors.js'
import { hybridSearch } from '../indexing/search.js'
import { buildRagSystemPrompt, streamChatCompletion, type ChatMessage } from './llm.js'

export type Citation = {
  index: number
  documentId: string
  documentTitle: string
  chunkId: string
  chunkIndex: number
  headingPath: string | null
  snippet: string
  score: number
}

/** Active stream aborts by assistant message id (for Stop). */
const activeStreams = new Map<string, AbortController>()

export function abortChatGeneration(assistantMessageId: string): boolean {
  const ctrl = activeStreams.get(assistantMessageId)
  if (!ctrl) return false
  ctrl.abort()
  activeStreams.delete(assistantMessageId)
  return true
}

function mapSession(row: {
  id: string
  title: string | null
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
  contextJson?: unknown
}) {
  return {
    id: row.id,
    title: row.title,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    context: row.contextJson ?? null,
  }
}

function mapMessage(row: {
  id: string
  role: string
  content: string
  citationsJson: unknown
  modelId: string | null
  tokenIn: number | null
  tokenOut: number | null
  createdAt: Date
}) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    citations: row.citationsJson ?? null,
    modelId: row.modelId,
    tokenIn: row.tokenIn,
    tokenOut: row.tokenOut,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createSession(
  tenantId: string,
  userId: string,
  input: { title?: string | null; context?: unknown },
) {
  const row = await prisma.knowledgeChatSession.create({
    data: {
      tenantId,
      userId,
      title: input.title?.trim() || 'New chat',
      contextJson: input.context === undefined ? undefined : (input.context as object),
      lastMessageAt: new Date(),
    },
  })
  return mapSession(row)
}

export async function getSession(tenantId: string, userId: string, sessionId: string) {
  const row = await prisma.knowledgeChatSession.findFirst({
    where: { id: sessionId, userId, ...tenantActiveFilter(tenantId) },
  })
  if (!row) throw new NotFoundError('Chat session not found')
  return mapSession(row)
}

export async function softDeleteSession(tenantId: string, userId: string, sessionId: string) {
  const result = await prisma.knowledgeChatSession.updateMany({
    where: { id: sessionId, userId, ...tenantActiveFilter(tenantId) },
    data: { deletedAt: new Date() },
  })
  if (result.count === 0) throw new NotFoundError('Chat session not found')
  return { id: sessionId, deleted: true }
}

export async function listMessages(tenantId: string, userId: string, sessionId: string) {
  await getSession(tenantId, userId, sessionId)
  const rows = await prisma.knowledgeChatMessage.findMany({
    where: { tenantId, sessionId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  return rows.map(mapMessage)
}

async function retrieveCitations(
  tenantId: string,
  question: string,
  topK = 6,
): Promise<Array<Citation & { content: string }>> {
  const search = await hybridSearch({
    tenantId,
    query: question,
    topK,
  })
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
  // Express 5 / some environments
  const flushable = res as Response & { flushHeaders?: () => void }
  if (typeof flushable.flushHeaders === 'function') flushable.flushHeaders()
}

/**
 * Persist user message, retrieve RAG context, stream assistant answer via SSE.
 */
export async function streamChatMessage(opts: {
  req: Request
  res: Response
  tenantId: string
  userId: string
  sessionId: string
  content: string
  stream: boolean
}): Promise<void> {
  const { res, tenantId, userId, sessionId } = opts
  const content = opts.content.trim()
  if (!content) {
    throw new ValidationError('Message content is required', [
      { field: 'content', message: 'Enter a question' },
    ])
  }

  const session = await prisma.knowledgeChatSession.findFirst({
    where: { id: sessionId, userId, ...tenantActiveFilter(tenantId) },
  })
  if (!session) throw new NotFoundError('Chat session not found')

  const userMsg = await prisma.knowledgeChatMessage.create({
    data: {
      tenantId,
      sessionId,
      role: 'USER',
      content,
    },
  })

  // Auto-title on first message
  if (!session.title || session.title === 'New chat') {
    const title = content.length > 80 ? `${content.slice(0, 77)}…` : content
    await prisma.knowledgeChatSession.update({
      where: { id: sessionId },
      data: { title, lastMessageAt: new Date() },
    })
  } else {
    await prisma.knowledgeChatSession.update({
      where: { id: sessionId },
      data: { lastMessageAt: new Date() },
    })
  }

  const citations = await retrieveCitations(tenantId, content)
  const system = buildRagSystemPrompt(citations)

  const history = await prisma.knowledgeChatMessage.findMany({
    where: { tenantId, sessionId },
    orderBy: { createdAt: 'asc' },
    take: 24,
    select: { role: true, content: true },
  })

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...history
      .filter((m) => (m.role === 'USER' || m.role === 'ASSISTANT') && m.content.trim())
      .map((m) => ({
        role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
  ]

  const assistantMsg = await prisma.knowledgeChatMessage.create({
    data: {
      tenantId,
      sessionId,
      role: 'ASSISTANT',
      content: '',
      citationsJson: citations.map(({ content: _c, ...rest }) => rest),
    },
  })

  const ctrl = new AbortController()
  activeStreams.set(assistantMsg.id, ctrl)
  opts.req.on('close', () => {
    if (!res.writableEnded) ctrl.abort()
  })

  if (!opts.stream) {
    try {
      let full = ''
      const result = await streamChatCompletion(messages, {
        signal: ctrl.signal,
        onToken: (t) => {
          full += t
        },
      })
      const finalContent = result.content || full
      const updated = await prisma.knowledgeChatMessage.update({
        where: { id: assistantMsg.id },
        data: {
          content: finalContent,
          modelId: result.modelId,
          tokenIn: result.tokenIn,
          tokenOut: result.tokenOut,
        },
      })
      activeStreams.delete(assistantMsg.id)
      res.status(201).json({
        success: true,
        message: 'Chat message completed',
        data: {
          sessionId,
          userMessage: mapMessage(userMsg),
          assistantMessage: mapMessage(updated),
          citations: citations.map(({ content: _c, ...rest }) => rest),
          provider: result.provider,
        },
        meta: null,
      })
    } catch (err) {
      activeStreams.delete(assistantMsg.id)
      const message = err instanceof Error ? err.message : String(err)
      await prisma.knowledgeChatMessage.update({
        where: { id: assistantMsg.id },
        data: { content: `Error: ${message}` },
      })
      throw err
    }
    return
  }

  initSse(res)
  writeSse(res, 'meta', {
    sessionId,
    userMessageId: userMsg.id,
    assistantMessageId: assistantMsg.id,
    citations: citations.map(({ content: _c, ...rest }) => rest),
  })

  let full = ''
  try {
    const result = await streamChatCompletion(messages, {
      signal: ctrl.signal,
      onToken: (token) => {
        full += token
        writeSse(res, 'token', { text: token })
      },
    })
    const finalContent = result.content || full
    await prisma.knowledgeChatMessage.update({
      where: { id: assistantMsg.id },
      data: {
        content: finalContent,
        modelId: result.modelId,
        tokenIn: result.tokenIn,
        tokenOut: result.tokenOut,
      },
    })
    writeSse(res, 'done', {
      content: finalContent,
      modelId: result.modelId,
      provider: result.provider,
      assistantMessageId: assistantMsg.id,
      citations: citations.map(({ content: _c, ...rest }) => rest),
      stopped: ctrl.signal.aborted,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!ctrl.signal.aborted) {
      await prisma.knowledgeChatMessage.update({
        where: { id: assistantMsg.id },
        data: { content: full || `Error: ${message}` },
      })
      writeSse(res, 'error', { message })
    } else {
      await prisma.knowledgeChatMessage.update({
        where: { id: assistantMsg.id },
        data: { content: full || '(generation stopped)' },
      })
      writeSse(res, 'done', {
        content: full,
        assistantMessageId: assistantMsg.id,
        stopped: true,
        citations: citations.map(({ content: _c, ...rest }) => rest),
      })
    }
  } finally {
    activeStreams.delete(assistantMsg.id)
    if (!res.writableEnded) res.end()
  }
}

export async function regenerateAssistantMessage(opts: {
  req: Request
  res: Response
  tenantId: string
  userId: string
  sessionId: string
  assistantMessageId: string
  stream: boolean
}): Promise<void> {
  const { tenantId, userId, sessionId, assistantMessageId } = opts
  await getSession(tenantId, userId, sessionId)

  const assistant = await prisma.knowledgeChatMessage.findFirst({
    where: { id: assistantMessageId, tenantId, sessionId, role: 'ASSISTANT' },
  })
  if (!assistant) throw new NotFoundError('Assistant message not found')

  const priorUser = await prisma.knowledgeChatMessage.findFirst({
    where: {
      tenantId,
      sessionId,
      role: 'USER',
      createdAt: { lt: assistant.createdAt },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!priorUser) throw new ValidationError('No prior user message to regenerate from')

  await prisma.knowledgeChatMessage.delete({ where: { id: assistant.id } })

  // Soft re-post of the same content without duplicating the user message:
  // re-run pipeline using priorUser.content but don't create a second USER row.
  await streamRegenerateFromUser(opts, priorUser.content)
}

async function streamRegenerateFromUser(
  opts: {
    req: Request
    res: Response
    tenantId: string
    userId: string
    sessionId: string
    stream: boolean
  },
  userContent: string,
): Promise<void> {
  const { res, tenantId, sessionId } = opts
  const citations = await retrieveCitations(tenantId, userContent)
  const system = buildRagSystemPrompt(citations)

  const history = await prisma.knowledgeChatMessage.findMany({
    where: { tenantId, sessionId },
    orderBy: { createdAt: 'asc' },
    take: 24,
    select: { role: true, content: true },
  })

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...history
      .filter((m) => (m.role === 'USER' || m.role === 'ASSISTANT') && m.content.trim())
      .map((m) => ({
        role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
  ]

  const assistantMsg = await prisma.knowledgeChatMessage.create({
    data: {
      tenantId,
      sessionId,
      role: 'ASSISTANT',
      content: '',
      citationsJson: citations.map(({ content: _c, ...rest }) => rest),
    },
  })

  const ctrl = new AbortController()
  activeStreams.set(assistantMsg.id, ctrl)
  opts.req.on('close', () => {
    if (!res.writableEnded) ctrl.abort()
  })

  if (!opts.stream) {
    try {
      let full = ''
      const result = await streamChatCompletion(messages, {
        signal: ctrl.signal,
        onToken: (t) => {
          full += t
        },
      })
      const finalContent = result.content || full
      const updated = await prisma.knowledgeChatMessage.update({
        where: { id: assistantMsg.id },
        data: {
          content: finalContent,
          modelId: result.modelId,
        },
      })
      activeStreams.delete(assistantMsg.id)
      res.status(201).json({
        success: true,
        message: 'Regenerated answer',
        data: {
          sessionId,
          assistantMessage: mapMessage(updated),
          citations: citations.map(({ content: _c, ...rest }) => rest),
          provider: result.provider,
        },
        meta: null,
      })
    } catch (err) {
      activeStreams.delete(assistantMsg.id)
      throw err
    }
    return
  }

  initSse(res)
  writeSse(res, 'meta', {
    sessionId,
    assistantMessageId: assistantMsg.id,
    citations: citations.map(({ content: _c, ...rest }) => rest),
    regenerated: true,
  })

  let full = ''
  try {
    const result = await streamChatCompletion(messages, {
      signal: ctrl.signal,
      onToken: (token) => {
        full += token
        writeSse(res, 'token', { text: token })
      },
    })
    const finalContent = result.content || full
    await prisma.knowledgeChatMessage.update({
      where: { id: assistantMsg.id },
      data: { content: finalContent, modelId: result.modelId },
    })
    writeSse(res, 'done', {
      content: finalContent,
      modelId: result.modelId,
      provider: result.provider,
      assistantMessageId: assistantMsg.id,
      stopped: ctrl.signal.aborted,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    writeSse(res, 'error', { message })
    await prisma.knowledgeChatMessage.update({
      where: { id: assistantMsg.id },
      data: { content: full || `Error: ${message}` },
    })
  } finally {
    activeStreams.delete(assistantMsg.id)
    if (!res.writableEnded) res.end()
  }
}

export async function suggestedQuestions(tenantId: string): Promise<string[]> {
  const docs = await prisma.knowledgeDocument.findMany({
    where: { ...tenantActiveFilter(tenantId), status: 'READY' },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { title: true },
  })
  if (docs.length === 0) {
    return [
      'What knowledge documents are available?',
      'How do I upload and reindex a document?',
      'How does semantic search work?',
    ]
  }
  return docs.slice(0, 3).map((d) => `What does the document “${d.title}” cover?`)
}

export async function submitFeedback(input: {
  tenantId: string
  userId: string
  sessionId?: string | null
  messageId?: string | null
  documentId?: string | null
  rating: 'UP' | 'DOWN' | 'SCORE'
  score?: number | null
  comment?: string | null
}) {
  const row = await prisma.knowledgeFeedback.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      messageId: input.messageId ?? null,
      documentId: input.documentId ?? null,
      rating: input.rating,
      score: input.score ?? null,
      comment: input.comment ?? null,
    },
  })
  return {
    id: row.id,
    rating: row.rating,
    createdAt: row.createdAt.toISOString(),
  }
}
