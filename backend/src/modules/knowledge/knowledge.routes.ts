import { Router } from 'express'
import multer from 'multer'
import { env } from '../../config/env.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { requireModule } from '../../middleware/require-module.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../utils/pagination.js'
import { ValidationError } from '../../utils/errors.js'
import { KNOWLEDGE_MODULE_KEY } from './knowledge.constants.js'
import * as controller from './knowledge.controller.js'
import {
  copilotCompleteSchema,
  copilotStopSchema,
  createChatSessionSchema,
  createKnowledgeDocumentJsonSchema,
  feedbackSchema,
  knowledgeSearchBodySchema,
  knowledgeSearchQuerySchema,
  listKnowledgeActivityQuerySchema,
  listKnowledgeCategoriesQuerySchema,
  listKnowledgeDocumentsQuerySchema,
  listKnowledgeSessionsQuerySchema,
  listKnowledgeSourcesQuerySchema,
  listKnowledgeTagsQuerySchema,
  messageIdParamSchema,
  postChatMessageSchema,
  regenerateMessageSchema,
  stopGenerationSchema,
  transitionKnowledgeDocumentSchema,
  updateKnowledgeDocumentSchema,
} from './knowledge.validation.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.KB_MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Detailed MIME/extension checks run in the service layer.
    if (!file) {
      cb(new ValidationError('File missing'))
      return
    }
    cb(null, true)
  },
})

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
  requireModule(KNOWLEDGE_MODULE_KEY),
)

/** Wave readiness + table counts. */
router.get('/status', requirePermission('kb.document.view'), controller.getWaveStatus)

// Documents
router.get(
  '/documents',
  requirePermission('kb.document.view'),
  validateQuery(listKnowledgeDocumentsQuerySchema),
  controller.listDocuments,
)

/**
 * Create document:
 * - multipart/form-data with field `file` (+ optional title, description, …)
 * - application/json with markdownContent, file{contentBase64}, or sourceUrl
 */
router.post(
  '/documents',
  requirePermission('kb.document.create'),
  (req, res, next) => {
    const contentType = req.headers['content-type'] ?? ''
    if (contentType.includes('multipart/form-data')) {
      upload.single('file')(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            next(
              new ValidationError('File too large', [
                { field: 'file', message: `Maximum size is ${Math.floor((env.KB_MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024) / (1024 * 1024))} MB` },
              ]),
            )
            return
          }
          next(err)
          return
        }
        next()
      })
      return
    }
    validateBody(createKnowledgeDocumentJsonSchema)(req, res, next)
  },
  controller.uploadDocument,
)

router.get(
  '/documents/:id',
  requirePermission('kb.document.view'),
  validateParams(uuidParamSchema),
  controller.getDocument,
)
router.get(
  '/documents/:id/file',
  requirePermission('kb.document.view'),
  validateParams(uuidParamSchema),
  controller.downloadDocumentFile,
)
router.patch(
  '/documents/:id',
  requirePermission('kb.document.update'),
  validateParams(uuidParamSchema),
  validateBody(updateKnowledgeDocumentSchema),
  controller.updateDocument,
)
router.post(
  '/documents/:id/status',
  requirePermission('kb.document.update'),
  validateParams(uuidParamSchema),
  validateBody(transitionKnowledgeDocumentSchema),
  controller.transitionDocument,
)
router.delete(
  '/documents/:id',
  requirePermission('kb.document.delete'),
  validateParams(uuidParamSchema),
  controller.deleteDocument,
)
router.post(
  '/documents/:id/reindex',
  requirePermission('kb.document.reindex'),
  validateParams(uuidParamSchema),
  controller.reindexDocument,
)
router.get(
  '/documents/:id/versions',
  requirePermission('kb.document.view'),
  validateParams(uuidParamSchema),
  controller.listDocumentVersions,
)

// Taxonomy
router.get(
  '/categories',
  requirePermission('kb.document.view'),
  validateQuery(listKnowledgeCategoriesQuerySchema),
  controller.listCategories,
)
router.get(
  '/tags',
  requirePermission('kb.document.view'),
  validateQuery(listKnowledgeTagsQuerySchema),
  controller.listTags,
)
router.get(
  '/sources',
  requirePermission('kb.document.view'),
  validateQuery(listKnowledgeSourcesQuerySchema),
  controller.listSources,
)

// Search (Wave 3)
router.get(
  '/search',
  requirePermission('kb.search.view'),
  validateQuery(knowledgeSearchQuerySchema),
  controller.keywordSearch,
)
router.post(
  '/search/semantic',
  requirePermission('kb.search.view'),
  validateBody(knowledgeSearchBodySchema),
  controller.semanticSearch,
)
router.post(
  '/search/hybrid',
  requirePermission('kb.search.view'),
  validateBody(knowledgeSearchBodySchema),
  controller.hybridSearch,
)

// Chat (Wave 4)
router.get(
  '/sessions',
  requirePermission('kb.chat.use'),
  validateQuery(listKnowledgeSessionsQuerySchema),
  controller.listSessions,
)
router.post(
  '/sessions',
  requirePermission('kb.chat.use'),
  validateBody(createChatSessionSchema),
  controller.createSession,
)
router.get(
  '/sessions/:id',
  requirePermission('kb.chat.use'),
  validateParams(uuidParamSchema),
  controller.getSession,
)
router.delete(
  '/sessions/:id',
  requirePermission('kb.chat.use'),
  validateParams(uuidParamSchema),
  controller.deleteSession,
)
router.get(
  '/sessions/:id/messages',
  requirePermission('kb.chat.use'),
  validateParams(uuidParamSchema),
  controller.listSessionMessages,
)
router.post(
  '/sessions/:id/messages',
  requirePermission('kb.chat.use'),
  validateParams(uuidParamSchema),
  validateBody(postChatMessageSchema),
  controller.postChatMessage,
)
router.post(
  '/sessions/:id/messages/:messageId/regenerate',
  requirePermission('kb.chat.use'),
  validateParams(messageIdParamSchema),
  validateBody(regenerateMessageSchema),
  controller.regenerateMessage,
)
router.post(
  '/chat/stop',
  requirePermission('kb.chat.use'),
  validateBody(stopGenerationSchema),
  controller.stopGeneration,
)
router.get(
  '/chat/suggestions',
  requirePermission('kb.chat.use'),
  controller.suggestedQuestions,
)

// Copilot (Wave 5)
router.post(
  '/copilot/complete',
  requirePermission('kb.copilot.use'),
  validateBody(copilotCompleteSchema),
  controller.copilotComplete,
)
router.post(
  '/copilot/stop',
  requirePermission('kb.copilot.use'),
  validateBody(copilotStopSchema),
  controller.copilotStop,
)

// Insights / analytics / feedback / admin
router.get('/insights/summary', requirePermission('kb.insights.view'), controller.getInsights)
router.get('/analytics', requirePermission('kb.analytics.view'), controller.getAnalytics)
router.post(
  '/feedback',
  requirePermission('kb.chat.use'),
  validateBody(feedbackSchema),
  controller.submitFeedback,
)
router.get(
  '/activity',
  requirePermission('kb.admin.manage'),
  validateQuery(listKnowledgeActivityQuerySchema),
  controller.listActivity,
)
router.get('/admin/settings', requirePermission('kb.admin.manage'), controller.getAdminSettings)

export default router
