import { Router } from 'express'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { validateBody, validateQuery } from '../../../../middleware/validation.middleware.js'
import * as controller from './indiamart.controller.js'
import {
  assignEnquirySchema,
  bulkAssignSchema,
  bulkIdsSchema,
  bulkIgnoreSchema,
  createLeadFromEnquirySchema,
  createProductMappingSchema,
  ignoreEnquirySchema,
  linkLeadSchema,
  listEnquiriesQuerySchema,
  syncIndiaMartSchema,
  updateIndiaMartSettingsSchema,
  updateProductMappingSchema,
} from './indiamart.validation.js'

const router = Router({ mergeParams: true })

router.get('/dashboard', requirePermission('crm.indiamart.view'), controller.getDashboard)
router.get('/alerts', requirePermission('crm.indiamart.view'), controller.listAlerts)
router.post('/alerts/mark-all-read', requirePermission('crm.indiamart.view'), controller.markAllAlertsRead)
router.post('/alerts/:id/read', requirePermission('crm.indiamart.view'), controller.markAlertRead)

router.post(
  '/push-webhook/enable',
  requirePermission('crm.indiamart.credentials.manage'),
  controller.enableWebhook,
)
router.post(
  '/push-webhook/rotate',
  requirePermission('crm.indiamart.credentials.manage'),
  controller.rotateWebhook,
)
router.post(
  '/push-webhook/disable',
  requirePermission('crm.indiamart.credentials.manage'),
  controller.disableWebhook,
)

router.get('/settings', requirePermission('crm.indiamart.settings.view'), controller.getSettings)
router.put(
  '/settings',
  requirePermission('crm.indiamart.settings.manage'),
  validateBody(updateIndiaMartSettingsSchema),
  controller.updateSettings,
)
router.post(
  '/test-connection',
  requirePermission('crm.indiamart.credentials.manage'),
  controller.testConnection,
)
router.post(
  '/sync',
  requirePermission('crm.indiamart.sync.run'),
  validateBody(syncIndiaMartSchema),
  controller.syncNow,
)
router.get('/sync-runs', requirePermission('crm.indiamart.sync_history.view'), controller.listSyncRuns)

router.get(
  '/enquiries',
  requirePermission('crm.indiamart.enquiry.view'),
  validateQuery(listEnquiriesQuerySchema),
  controller.listEnquiries,
)

// Bulk routes must be registered before /enquiries/:id
router.post(
  '/enquiries/bulk-create-leads',
  requirePermission('crm.indiamart.enquiry.bulk_manage'),
  validateBody(bulkIdsSchema),
  controller.bulkCreateLeads,
)
router.post(
  '/enquiries/bulk-assign',
  requirePermission('crm.indiamart.enquiry.bulk_manage'),
  validateBody(bulkAssignSchema),
  controller.bulkAssign,
)
router.post(
  '/enquiries/bulk-ignore',
  requirePermission('crm.indiamart.enquiry.bulk_manage'),
  validateBody(bulkIgnoreSchema),
  controller.bulkIgnore,
)

router.get('/enquiries/:id', requirePermission('crm.indiamart.enquiry.view'), controller.getEnquiry)
router.post(
  '/enquiries/:id/create-lead',
  requirePermission('crm.indiamart.enquiry.import'),
  validateBody(createLeadFromEnquirySchema),
  controller.createLead,
)
router.post(
  '/enquiries/:id/link-lead',
  requirePermission('crm.indiamart.enquiry.import'),
  validateBody(linkLeadSchema),
  controller.linkLead,
)
router.post(
  '/enquiries/:id/assign',
  requirePermission('crm.indiamart.enquiry.assign'),
  validateBody(assignEnquirySchema),
  controller.assignEnquiry,
)
router.post(
  '/enquiries/:id/ignore',
  requirePermission('crm.indiamart.enquiry.ignore'),
  validateBody(ignoreEnquirySchema),
  controller.ignoreEnquiry,
)
router.post(
  '/enquiries/:id/retry',
  requirePermission('crm.indiamart.enquiry.import'),
  controller.retryEnquiry,
)

router.get(
  '/product-mappings',
  requirePermission('crm.indiamart.product_mapping.manage'),
  controller.listProductMappings,
)
router.post(
  '/product-mappings',
  requirePermission('crm.indiamart.product_mapping.manage'),
  validateBody(createProductMappingSchema),
  controller.createProductMapping,
)
router.post(
  '/product-mappings/suggest',
  requirePermission('crm.indiamart.product_mapping.manage'),
  controller.suggestProductMappings,
)
router.put(
  '/product-mappings/:id',
  requirePermission('crm.indiamart.product_mapping.manage'),
  validateBody(updateProductMappingSchema),
  controller.updateProductMapping,
)

export default router
