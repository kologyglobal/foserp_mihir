import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  approveVendorAdjustmentSchema,
  cancelVendorAdjustmentSchema,
  createVendorAdjustmentSchema,
  listVendorAdjustmentsQuerySchema,
  markVendorAdjustmentReadySchema,
  rejectVendorAdjustmentSchema,
  reviseVendorAdjustmentSchema,
  submitVendorAdjustmentSchema,
  updateVendorAdjustmentSchema,
} from './vendor-adjustment.schemas.js'
import { postVendorAdjustmentSchema, reverseVendorAdjustmentSchema } from './posting/vendor-adjustment-posting.schemas.js'
import * as controller from './vendor-adjustment.controller.js'
import * as postingController from './posting/vendor-adjustment-posting.controller.js'
import * as allocationController from '../allocations/payable-allocation.controller.js'
import {
  allocatableInvoicesQuerySchema,
  createPayableAllocationBodySchema,
  listPayableAllocationsQuerySchema,
} from '../allocations/payable-allocation.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('finance.ap.adjustment.view'), validateQuery(listVendorAdjustmentsQuerySchema), controller.listVendorAdjustments)
router.post('/', requirePermission('finance.ap.adjustment.create'), validateBody(createVendorAdjustmentSchema), controller.createVendorAdjustment)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.ap.adjustment.view'), controller.getVendorAdjustment)
router.patch('/:id', validateParams(uuidParamSchema), requirePermission('finance.ap.adjustment.edit'), validateBody(updateVendorAdjustmentSchema), controller.updateVendorAdjustment)
router.post('/:id/validate', validateParams(uuidParamSchema), requirePermission('finance.ap.adjustment.view'), controller.validateVendorAdjustment)
router.post('/:id/submit', validateParams(uuidParamSchema), requirePermission('finance.ap.adjustment.submit'), validateBody(submitVendorAdjustmentSchema), controller.submitVendorAdjustment)
router.post('/:id/approve', validateParams(uuidParamSchema), requirePermission('finance.ap.adjustment.approve'), validateBody(approveVendorAdjustmentSchema), controller.approveVendorAdjustment)
router.post('/:id/reject', validateParams(uuidParamSchema), requirePermission('finance.ap.adjustment.approve'), validateBody(rejectVendorAdjustmentSchema), controller.rejectVendorAdjustment)
router.post('/:id/revise', validateParams(uuidParamSchema), requirePermission('finance.ap.adjustment.edit'), validateBody(reviseVendorAdjustmentSchema), controller.reviseVendorAdjustment)
router.post('/:id/mark-ready', validateParams(uuidParamSchema), requirePermission('finance.ap.adjustment.mark_ready'), validateBody(markVendorAdjustmentReadySchema), controller.markVendorAdjustmentReady)
router.post('/:id/cancel', validateParams(uuidParamSchema), requirePermission('finance.ap.adjustment.cancel'), validateBody(cancelVendorAdjustmentSchema), controller.cancelVendorAdjustment)
router.post(
  '/:id/post',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.adjustment.post'),
  validateBody(postVendorAdjustmentSchema),
  postingController.postVendorAdjustment,
)
router.get(
  '/:id/reversal-preview',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.adjustment.view'),
  postingController.getVendorAdjustmentReversalPreviewHandler,
)
router.post(
  '/:id/reverse',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.adjustment.reverse'),
  validateBody(reverseVendorAdjustmentSchema),
  postingController.reverseVendorAdjustment,
)
router.get('/:id/approval', validateParams(uuidParamSchema), requirePermission('finance.ap.adjustment.view'), controller.getVendorAdjustmentApproval)

// ─── Phase 4C2 — debit note allocation (subledger only, no GL) ────────────────
router.get(
  '/:id/allocatable-payables',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.allocation.view'),
  validateQuery(allocatableInvoicesQuerySchema),
  allocationController.getAllocatablePayablesForDebitNoteHandler,
)
router.post(
  '/:id/allocations',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.allocation.create'),
  validateBody(createPayableAllocationBodySchema),
  allocationController.createVendorAdjustmentAllocation,
)
router.get(
  '/:id/allocations',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.allocation.view'),
  validateQuery(listPayableAllocationsQuerySchema),
  allocationController.listVendorAdjustmentAllocations,
)

export default router
