import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import {
  cancelGstDocumentSchema,
  generateEInvoiceSchema,
  generateEWayBillSchema,
  gstExtractQuerySchema,
  gstSummaryQuerySchema,
  listGstDocumentQuerySchema,
} from './tax-compliance.schemas.js'
import * as controller from './tax-compliance.controller.js'

/** Keep mergeParams fields (e.g. :id) when re-validating tenant slug. */
const tenantParamsPassthrough = z
  .object({
    tenantId: z.string().uuid().optional(),
    tenantSlug: z.string().min(2).max(100).optional(),
  })
  .passthrough()
  .refine((data) => Boolean(data.tenantId ?? data.tenantSlug), {
    message: 'tenantId or tenantSlug is required',
  })

const taxDocumentIdParamSchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    tenantSlug: z.string().min(2).max(100).optional(),
    id: z.string().uuid(),
  })
  .refine((data) => Boolean(data.tenantId ?? data.tenantSlug), {
    message: 'tenantId or tenantSlug is required',
  })

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantParamsPassthrough),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/outward-supplies',
  requirePermission('finance.tax.view'),
  validateQuery(gstExtractQuerySchema),
  controller.listOutwardSupplies,
)

router.get(
  '/inward-supplies',
  requirePermission('finance.tax.view'),
  validateQuery(gstExtractQuerySchema),
  controller.listInwardSupplies,
)

router.get(
  '/summary',
  requirePermission('finance.tax.view'),
  validateQuery(gstSummaryQuerySchema),
  controller.getSummary,
)

router.get(
  '/e-invoices',
  requirePermission('finance.tax.view'),
  validateQuery(listGstDocumentQuerySchema),
  controller.listEInvoices,
)

router.post(
  '/e-invoices/generate',
  requirePermission('finance.tax.einvoice.manage'),
  validateBody(generateEInvoiceSchema),
  controller.generateEInvoice,
)

router.get(
  '/e-invoices/:id',
  requirePermission('finance.tax.view'),
  validateParams(taxDocumentIdParamSchema),
  controller.getEInvoice,
)

router.post(
  '/e-invoices/:id/cancel',
  requirePermission('finance.tax.einvoice.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(cancelGstDocumentSchema),
  controller.cancelEInvoice,
)

router.get(
  '/e-way-bills',
  requirePermission('finance.tax.view'),
  validateQuery(listGstDocumentQuerySchema),
  controller.listEWayBills,
)

router.post(
  '/e-way-bills/generate',
  requirePermission('finance.tax.eway.manage'),
  validateBody(generateEWayBillSchema),
  controller.generateEWayBill,
)

router.get(
  '/e-way-bills/:id',
  requirePermission('finance.tax.view'),
  validateParams(taxDocumentIdParamSchema),
  controller.getEWayBill,
)

router.post(
  '/e-way-bills/:id/cancel',
  requirePermission('finance.tax.eway.manage'),
  validateParams(taxDocumentIdParamSchema),
  validateBody(cancelGstDocumentSchema),
  controller.cancelEWayBill,
)

export default router
