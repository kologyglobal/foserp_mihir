import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  cancelCustomerCreditNoteSchema,
  createCustomerCreditNoteSchema,
  creditNoteDecisionSchema,
  listCustomerCreditNotesQuerySchema,
  reverseCustomerCreditNoteSchema,
  submitCustomerCreditNoteSchema,
  updateCustomerCreditNoteSchema,
} from './customer-credit-note.schemas.js'
import * as controller from './customer-credit-note.controller.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('finance.ar.credit_note.view'), validateQuery(listCustomerCreditNotesQuerySchema), controller.listCustomerCreditNotes)
router.post('/', requirePermission('finance.ar.credit_note.create'), validateBody(createCustomerCreditNoteSchema), controller.createCustomerCreditNote)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.ar.credit_note.view'), controller.getCustomerCreditNote)
router.put('/:id', validateParams(uuidParamSchema), requirePermission('finance.ar.credit_note.edit'), validateBody(updateCustomerCreditNoteSchema), controller.updateCustomerCreditNote)
router.post('/:id/validate', validateParams(uuidParamSchema), requirePermission('finance.ar.credit_note.view'), controller.validateCustomerCreditNote)
router.post('/:id/submit', validateParams(uuidParamSchema), requirePermission('finance.ar.credit_note.submit'), validateBody(submitCustomerCreditNoteSchema), controller.submitCustomerCreditNote)
router.post('/:id/approve', validateParams(uuidParamSchema), requirePermission('finance.ar.credit_note.approve'), validateBody(creditNoteDecisionSchema), controller.approveCustomerCreditNote)
router.post('/:id/reject', validateParams(uuidParamSchema), requirePermission('finance.ar.credit_note.approve'), validateBody(creditNoteDecisionSchema), controller.rejectCustomerCreditNote)
router.post('/:id/mark-ready', validateParams(uuidParamSchema), requirePermission('finance.ar.credit_note.mark_ready'), controller.markCustomerCreditNoteReady)
router.post('/:id/cancel', validateParams(uuidParamSchema), requirePermission('finance.ar.credit_note.cancel'), validateBody(cancelCustomerCreditNoteSchema), controller.cancelCustomerCreditNote)
router.post('/:id/post', validateParams(uuidParamSchema), requirePermission('finance.ar.credit_note.post'), controller.postCustomerCreditNote)
router.post('/:id/reverse', validateParams(uuidParamSchema), requirePermission('finance.ar.credit_note.reverse'), validateBody(reverseCustomerCreditNoteSchema), controller.reverseCustomerCreditNote)

export default router
