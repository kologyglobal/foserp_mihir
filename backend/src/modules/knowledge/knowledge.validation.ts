import { z } from 'zod'
import { paginationSchema } from '../../utils/pagination.js'

export const listKnowledgeDocumentsQuerySchema = paginationSchema.extend({
  status: z
    .enum(['DRAFT', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED'])
    .optional(),
  categoryId: z.string().uuid().optional(),
  kind: z.enum(['UPLOAD', 'URL', 'HTML', 'MARKDOWN', 'TEXT', 'ERP_LINK']).optional(),
  search: z.string().trim().max(200).optional(),
})

export const listKnowledgeCategoriesQuerySchema = paginationSchema

export const listKnowledgeTagsQuerySchema = paginationSchema

export const listKnowledgeSourcesQuerySchema = paginationSchema

export const listKnowledgeSessionsQuerySchema = paginationSchema

export const listKnowledgeActivityQuerySchema = paginationSchema.extend({
  action: z.string().trim().min(1).max(64).optional(),
})

export const knowledgeSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(1000),
  topK: z.coerce.number().int().min(1).max(50).optional(),
  categoryId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
})

export const knowledgeSearchBodySchema = z.object({
  q: z.string().trim().min(1).max(1000),
  topK: z.number().int().min(1).max(50).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
})

export type KnowledgeSearchInput = {
  q: string
  topK?: number
  categoryId?: string | null
  documentId?: string | null
}

export const createChatSessionSchema = z.object({
  title: z.string().trim().min(1).max(300).optional().nullable(),
  context: z.unknown().optional(),
})

export const postChatMessageSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  /** Default true for SSE streaming. */
  stream: z.boolean().optional().default(true),
})

export const regenerateMessageSchema = z.object({
  stream: z.boolean().optional().default(true),
})

export const stopGenerationSchema = z.object({
  assistantMessageId: z.string().uuid(),
})

export const feedbackSchema = z.object({
  sessionId: z.string().uuid().optional().nullable(),
  messageId: z.string().uuid().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  rating: z.enum(['UP', 'DOWN', 'SCORE']).default('UP'),
  score: z.number().int().min(1).max(5).optional().nullable(),
  comment: z.string().trim().max(2000).optional().nullable(),
})

export const copilotErpContextSchema = z.object({
  moduleKey: z.string().trim().max(64).optional().nullable(),
  routePath: z.string().trim().min(1).max(500),
  entityType: z.string().trim().max(64).optional().nullable(),
  entityId: z.string().trim().max(64).optional().nullable(),
  screenHints: z.array(z.string().trim().max(200)).max(20).optional(),
  pageTitle: z.string().trim().max(300).optional().nullable(),
})

export const copilotCompleteSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  stream: z.boolean().optional().default(true),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(20_000),
      }),
    )
    .max(20)
    .optional(),
  context: copilotErpContextSchema,
})

export const copilotStopSchema = z.object({
  streamId: z.string().uuid(),
})

export const messageIdParamSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
})

const optionalUuid = z.string().uuid().optional().nullable()

export const createKnowledgeDocumentJsonSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5000).optional().nullable(),
    categoryId: optionalUuid,
    sourceId: optionalUuid,
    language: z.string().trim().max(16).optional().nullable(),
    kind: z.enum(['UPLOAD', 'URL', 'HTML', 'MARKDOWN', 'TEXT', 'ERP_LINK']).optional(),
    sourceUrl: z.string().trim().url().max(2000).optional().nullable(),
    /** Inline Markdown / plain text stored as version 1 (no binary). */
    markdownContent: z.string().max(2_000_000).optional().nullable(),
    /** When true and markdown present, move DRAFT → READY after create. */
    publish: z.boolean().optional().default(false),
    file: z
      .object({
        originalFilename: z.string().trim().min(1).max(500),
        mimeType: z.string().trim().min(1).max(128),
        contentBase64: z.string().min(1),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    const hasMd = Boolean(val.markdownContent?.trim())
    const hasFile = Boolean(val.file)
    const hasUrl = Boolean(val.sourceUrl?.trim())
    if (!hasMd && !hasFile && !hasUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide markdownContent, file (base64), or sourceUrl',
        path: ['markdownContent'],
      })
    }
    if (hasFile && hasMd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either file or markdownContent, not both',
        path: ['file'],
      })
    }
  })

export type CreateKnowledgeDocumentJson = z.infer<typeof createKnowledgeDocumentJsonSchema>

export const updateKnowledgeDocumentSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  categoryId: optionalUuid,
  sourceId: optionalUuid,
  language: z.string().trim().max(16).optional().nullable(),
  sourceUrl: z.string().trim().url().max(2000).optional().nullable(),
  /** Replace version content (creates a new version). */
  markdownContent: z.string().max(2_000_000).optional().nullable(),
  changeSummary: z.string().trim().max(500).optional().nullable(),
})

export type UpdateKnowledgeDocumentInput = z.infer<typeof updateKnowledgeDocumentSchema>

export const transitionKnowledgeDocumentSchema = z.object({
  status: z.enum(['DRAFT', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED']),
  reason: z.string().trim().max(500).optional().nullable(),
})

export type TransitionKnowledgeDocumentInput = z.infer<typeof transitionKnowledgeDocumentSchema>

/** Multipart form fields (strings); file arrives via multer. */
export const createKnowledgeDocumentMultipartMetaSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).optional(),
  categoryId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  language: z.string().trim().max(16).optional(),
  publish: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
})
