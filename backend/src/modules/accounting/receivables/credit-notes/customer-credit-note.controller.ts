import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListCustomerCreditNotesQuery } from './customer-credit-note.schemas.js'
import * as draft from './customer-credit-note-draft.service.js'
import * as read from './customer-credit-note-read.service.js'
import * as approval from './customer-credit-note-approval.service.js'
import { postCustomerCreditNoteFromRequest } from './posting/customer-credit-note-posting.service.js'

export const listCustomerCreditNotes = asyncHandler(async (req: Request, res: Response) => {
  const result = await read.listCustomerCreditNotes(req, getTenantId(req), req.query as unknown as ListCustomerCreditNotesQuery)
  return sendPaginated(res, 'customer credit notes listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const createCustomerCreditNote = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'customer credit note draft created', await draft.createCustomerCreditNoteDraft(req, getTenantId(req), req.body)))
export const getCustomerCreditNote = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'customer credit note fetched', await read.getCustomerCreditNote(req, getTenantId(req), getRouteParam(req, 'id'))))
export const updateCustomerCreditNote = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'customer credit note updated', await draft.updateCustomerCreditNoteDraft(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))
export const validateCustomerCreditNote = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'customer credit note validated', await draft.validateCustomerCreditNoteRecord(req, getTenantId(req), getRouteParam(req, 'id'))))
export const markCustomerCreditNoteReady = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'customer credit note marked ready', await draft.markCustomerCreditNoteReady(req, getTenantId(req), getRouteParam(req, 'id'))))
export const submitCustomerCreditNote = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'customer credit note submitted', await draft.submitCustomerCreditNote(req, getTenantId(req), getRouteParam(req, 'id'))))
export const approveCustomerCreditNote = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'customer credit note approved', await approval.approveCustomerCreditNote(req, getTenantId(req), getRouteParam(req, 'id'), req.body.comments)))
export const rejectCustomerCreditNote = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'customer credit note rejected', await approval.rejectCustomerCreditNote(req, getTenantId(req), getRouteParam(req, 'id'), req.body.comments)))
export const cancelCustomerCreditNote = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'customer credit note cancelled', await draft.cancelCustomerCreditNote(req, getTenantId(req), getRouteParam(req, 'id'), req.body.cancellationReason)))
export const postCustomerCreditNote = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'customer credit note posted', await postCustomerCreditNoteFromRequest(req, getTenantId(req), getRouteParam(req, 'id'))))
