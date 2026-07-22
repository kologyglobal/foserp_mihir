import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../../types/request-context.js'
import { asyncHandler } from '../../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../../../utils/response.js'
import { CreditNoteAllocationIdempotencyKeyRequiredError } from './customer-credit-note-allocation.errors.js'
import { previewAllocateCustomerCreditNote } from './customer-credit-note-allocation-preview.service.js'
import { listAllocationsForCreditNote } from './customer-credit-note-allocation-read.service.js'
import { allocateCustomerCreditNote } from './customer-credit-note-allocation.service.js'
import { reverseCustomerCreditNoteAllocation } from './customer-credit-note-allocation-reverse.service.js'
import type {
  AllocateCustomerCreditNoteBodyInput,
  ListCreditNoteAllocationsQueryInput,
  ReverseCreditNoteAllocationBodyInput,
} from './customer-credit-note-allocation.schemas.js'

function getIdempotencyKey(req: Request): string {
  const key = req.header('Idempotency-Key')?.trim()
  if (!key) throw new CreditNoteAllocationIdempotencyKeyRequiredError()
  return key
}

export const previewCreditNoteAllocation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const creditNoteId = getRouteParam(req, 'creditNoteId')
  const body = req.body as AllocateCustomerCreditNoteBodyInput
  const preview = await previewAllocateCustomerCreditNote(tenantId, creditNoteId, body)
  return sendSuccess(res, 'credit note allocation preview', preview)
})

export const postCreditNoteAllocation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const creditNoteId = getRouteParam(req, 'creditNoteId')
  const body = req.body as AllocateCustomerCreditNoteBodyInput
  const result = await allocateCustomerCreditNote(
    { creditNoteId, allocationDate: body.allocationDate, allocations: body.allocations },
    {
      tenantId,
      userId: req.context!.userId,
      idempotencyKey: getIdempotencyKey(req),
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    },
  )
  return sendSuccess(res, 'credit note allocation posted', result)
})

export const reverseCreditNoteAllocation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const creditNoteId = getRouteParam(req, 'creditNoteId')
  const batchId = getRouteParam(req, 'batchId')
  const body = req.body as ReverseCreditNoteAllocationBodyInput
  const result = await reverseCustomerCreditNoteAllocation(
    { creditNoteId, batchId, reason: body.reason },
    {
      tenantId,
      userId: req.context!.userId,
      idempotencyKey: getIdempotencyKey(req),
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    },
  )
  return sendSuccess(res, 'credit note allocation reversed', result)
})

export const getCreditNoteAllocations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const creditNoteId = getRouteParam(req, 'creditNoteId')
  const query = req.query as unknown as ListCreditNoteAllocationsQueryInput
  const result = await listAllocationsForCreditNote(tenantId, creditNoteId, query)
  return sendPaginated(
    res,
    'credit note allocations listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})
