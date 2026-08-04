import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateParams } from '../../../middleware/validation.middleware.js'
import { getTenantId, getRouteParam } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import { z } from 'zod'
import {
  getItemSupplierQualityHistory,
  getSupplierQualityReports,
  getVendorQualityScorecard,
} from './supplier-quality.service.js'

const router = Router({ mergeParams: true })

router.get(
  '/reports',
  requirePermission('purchase.reports.view'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, 'Supplier quality reports', await getSupplierQualityReports(getTenantId(req)))
  }),
)

router.get(
  '/dashboard-widgets',
  requirePermission('purchase.dashboard.view'),
  asyncHandler(async (req, res) => {
    const reports = await getSupplierQualityReports(getTenantId(req))
    sendSuccess(res, 'Supplier quality dashboard', reports.dashboard)
  }),
)

router.get(
  '/vendors/:vendorId/scorecard',
  requirePermission('purchase.view'),
  validateParams(z.object({ tenantSlug: z.string().min(1), vendorId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      'Vendor quality scorecard',
      await getVendorQualityScorecard(getTenantId(req), getRouteParam(req, 'vendorId')),
    )
  }),
)

router.get(
  '/items/:itemId/history',
  requirePermission('purchase.view'),
  validateParams(z.object({ tenantSlug: z.string().min(1), itemId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      'Item supplier quality history',
      await getItemSupplierQualityHistory(getTenantId(req), getRouteParam(req, 'itemId')),
    )
  }),
)

export default router
