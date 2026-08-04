import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { getRouteParam, getTenantId, getContext } from '../../types/request-context.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import { AuthenticationError, ValidationError } from '../../utils/errors.js'
import * as service from './knowledge.service.js'
import * as chatService from './chat/chat.service.js'
import * as copilotService from './copilot/copilot.service.js'
import type {
  CreateKnowledgeDocumentJson,
  TransitionKnowledgeDocumentInput,
  UpdateKnowledgeDocumentInput,
} from './knowledge.validation.js'

function requireUserId(req: Request): string {
  const userId = req.context?.userId
  if (!userId) throw new AuthenticationError()
  return userId
}

export const getWaveStatus = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getWaveStatus(tenantId)
  return sendSuccess(res, 'Knowledge Base wave status', data)
})

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { items, meta } = await service.listDocuments(tenantId, req.query as never)
  return sendPaginated(res, 'Knowledge documents', items, meta)
})

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const data = await service.getDocument(tenantId, id)
  return sendSuccess(res, 'Knowledge document', data)
})

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const isMultipart = Boolean(req.is('multipart/form-data'))
  const file = (req as Request & { file?: Express.Multer.File }).file

  if (isMultipart || file) {
    const data = await service.createDocumentFromMultipart(
      req,
      tenantId,
      userId,
      {
        title: typeof req.body?.title === 'string' ? req.body.title : undefined,
        description: typeof req.body?.description === 'string' ? req.body.description : undefined,
        categoryId: typeof req.body?.categoryId === 'string' ? req.body.categoryId : undefined,
        sourceId: typeof req.body?.sourceId === 'string' ? req.body.sourceId : undefined,
        language: typeof req.body?.language === 'string' ? req.body.language : undefined,
        publish:
          req.body?.publish === true ||
          req.body?.publish === 'true' ||
          req.body?.publish === '1',
      },
      file,
    )
    return sendCreated(res, 'Knowledge document created', data)
  }

  if (!req.body || typeof req.body !== 'object') {
    throw new ValidationError('Request body is required')
  }

  const data = await service.createDocumentFromJson(
    req,
    tenantId,
    userId,
    req.body as CreateKnowledgeDocumentJson,
  )
  return sendCreated(res, 'Knowledge document created', data)
})

export const updateDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const id = getRouteParam(req, 'id')
  const data = await service.updateDocument(
    req,
    tenantId,
    userId,
    id,
    req.body as UpdateKnowledgeDocumentInput,
  )
  return sendSuccess(res, 'Knowledge document updated', data)
})

export const transitionDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const id = getRouteParam(req, 'id')
  const data = await service.transitionDocument(
    req,
    tenantId,
    userId,
    id,
    req.body as TransitionKnowledgeDocumentInput,
  )
  return sendSuccess(res, 'Knowledge document status updated', data)
})

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const id = getRouteParam(req, 'id')
  const data = await service.deleteDocument(req, tenantId, userId, id)
  return sendSuccess(res, 'Knowledge document deleted', data)
})

export const reindexDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const id = getRouteParam(req, 'id')
  const data = await service.reindexDocument(req, tenantId, userId, id)
  return sendSuccess(res, 'Knowledge document indexed', data)
})

export const listDocumentVersions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const items = await service.listDocumentVersions(tenantId, id)
  return sendPaginated(res, 'Document versions', items, {
    page: 1,
    limit: items.length || 20,
    total: items.length,
    totalPages: 1,
  })
})

export const downloadDocumentFile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const file = await service.downloadDocumentFile(tenantId, id)
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${file.filename.replace(/"/g, '')}"`,
  )
  res.setHeader('Content-Length', String(file.buffer.length))
  return res.send(file.buffer)
})

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { items, meta } = await service.listCategories(tenantId, req.query as never)
  return sendPaginated(res, 'Knowledge categories', items, meta)
})

export const listTags = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { items, meta } = await service.listTags(tenantId, req.query as never)
  return sendPaginated(res, 'Knowledge tags', items, meta)
})

export const listSources = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { items, meta } = await service.listSources(tenantId, req.query as never)
  return sendPaginated(res, 'Knowledge sources', items, meta)
})

export const keywordSearch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.searchDocuments(tenantId, 'keyword', req.query as never)
  return sendSuccess(res, 'Keyword search results', data)
})

export const semanticSearch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.searchDocuments(tenantId, 'semantic', req.body as never)
  return sendSuccess(res, 'Semantic search results', data)
})

export const hybridSearch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.searchDocuments(tenantId, 'hybrid', req.body as never)
  return sendSuccess(res, 'Hybrid search results', data)
})

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const { items, meta } = await service.listSessions(tenantId, userId, req.query as never)
  return sendPaginated(res, 'Chat sessions', items, meta)
})

export const createSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const data = await chatService.createSession(tenantId, userId, {
    title: req.body?.title,
    context: req.body?.context,
  })
  return sendCreated(res, 'Chat session created', data)
})

export const getSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const id = getRouteParam(req, 'id')
  const data = await chatService.getSession(tenantId, userId, id)
  return sendSuccess(res, 'Chat session', data)
})

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const id = getRouteParam(req, 'id')
  const data = await chatService.softDeleteSession(tenantId, userId, id)
  return sendSuccess(res, 'Chat session deleted', data)
})

export const listSessionMessages = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const id = getRouteParam(req, 'id')
  const items = await chatService.listMessages(tenantId, userId, id)
  return sendPaginated(res, 'Chat messages', items, {
    page: 1,
    limit: items.length || 50,
    total: items.length,
    totalPages: 1,
  })
})

/**
 * Stream assistant answer (SSE) or return JSON when `stream: false`.
 * SSE is the default — do not wrap in sendSuccess.
 */
export const postChatMessage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const id = getRouteParam(req, 'id')
  const stream = req.body?.stream !== false
  await chatService.streamChatMessage({
    req,
    res,
    tenantId,
    userId,
    sessionId: id,
    content: req.body?.content ?? '',
    stream,
  })
})

export const regenerateMessage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const sessionId = getRouteParam(req, 'id')
  const messageId = getRouteParam(req, 'messageId')
  const stream = req.body?.stream !== false
  await chatService.regenerateAssistantMessage({
    req,
    res,
    tenantId,
    userId,
    sessionId,
    assistantMessageId: messageId,
    stream,
  })
})

export const stopGeneration = asyncHandler(async (req: Request, res: Response) => {
  const assistantMessageId = req.body?.assistantMessageId as string
  const stopped = chatService.abortChatGeneration(assistantMessageId)
  return sendSuccess(res, stopped ? 'Generation stop signal sent' : 'No active generation', {
    assistantMessageId,
    stopped,
  })
})

export const suggestedQuestions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const items = await chatService.suggestedQuestions(tenantId)
  return sendSuccess(res, 'Suggested questions', { items })
})

export const copilotComplete = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const ctx = getContext(req)
  const stream = req.body?.stream !== false
  await copilotService.streamCopilotComplete({
    req,
    res,
    tenantId,
    userId,
    permissions: ctx.permissions,
    isSuperAdmin: ctx.isSuperAdmin,
    content: req.body?.content ?? '',
    stream,
    history: req.body?.history,
    context: req.body?.context ?? { routePath: '/' },
  })
})

export const copilotStop = asyncHandler(async (req: Request, res: Response) => {
  const streamId = req.body?.streamId as string
  const stopped = copilotService.abortCopilotStream(streamId)
  return sendSuccess(res, stopped ? 'Copilot stop signal sent' : 'No active copilot stream', {
    streamId,
    stopped,
  })
})

export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getInsightsSummary(tenantId)
  return sendSuccess(res, 'Knowledge insights summary', data)
})

export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getAnalyticsOverview(tenantId)
  return sendSuccess(res, 'Knowledge analytics overview', data)
})

export const submitFeedback = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const userId = requireUserId(req)
  const data = await chatService.submitFeedback({
    tenantId,
    userId,
    sessionId: req.body?.sessionId,
    messageId: req.body?.messageId,
    documentId: req.body?.documentId,
    rating: req.body?.rating ?? 'UP',
    score: req.body?.score,
    comment: req.body?.comment,
  })
  return sendCreated(res, 'Feedback recorded', data)
})

export const listActivity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { items, meta } = await service.listActivity(tenantId, req.query as never)
  return sendPaginated(res, 'Knowledge activity', items, meta)
})

export const getAdminSettings = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, 'Knowledge admin settings scaffold', {
    wave: 5,
    embeddingModel: process.env.KB_EMBEDDING_MODEL ?? null,
    chatModel: process.env.KB_CHAT_MODEL ?? null,
    chunkSize: process.env.KB_CHUNK_SIZE ? Number(process.env.KB_CHUNK_SIZE) : 1200,
    chunkOverlap: process.env.KB_CHUNK_OVERLAP ? Number(process.env.KB_CHUNK_OVERLAP) : 200,
    indexingEnabled: process.env.KB_INDEXING_ENABLED !== 'false',
    ocrEnabled: process.env.KB_OCR_ENABLED === 'true',
    embeddingMode: process.env.OPENAI_API_KEY ? 'openai-compatible' : 'local-hash',
    chatMode: process.env.OPENAI_API_KEY ? 'openai-compatible' : 'local-extractive',
    copilotMode: process.env.OPENAI_API_KEY ? 'openai-compatible' : 'local-extractive',
    note: 'Copilot is stream-first with ERP context + RAG. Insights/admin settings ships in Wave 6.',
  })
})
