import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../../utils/response.js'
import { ReceiptAllocationIdempotencyKeyRequiredError } from './customer-receipt-allocation.errors.js'
import { previewAllocateCustomerReceipt } from './customer-receipt-allocation-preview.service.js'
import {
  listAllocationsForInvoice,
  listAllocationsForReceipt,
  listCustomerCredits,
} from './customer-receipt-allocation-read.service.js'
import { allocateCustomerReceipt } from './customer-receipt-allocation.service.js'
import { reverseCustomerReceiptAllocation } from './customer-receipt-allocation-reverse.service.js'
import type {
  AllocateCustomerReceiptBodyInput,
  ListCustomerCreditsQueryInput,
  ListReceiptAllocationsQueryInput,
  ReverseAllocationBodyInput,
} from './customer-receipt-allocation.schemas.js'

function getIdempotencyKey(req: Request): string {
  const key = req.header('Idempotency-Key')?.trim()
  if (!key) throw new ReceiptAllocationIdempotencyKeyRequiredError()
  return key
}

export const previewReceiptAllocation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const receiptId = getRouteParam(req, 'receiptId')
  const body = req.body as AllocateCustomerReceiptBodyInput
  const preview = await previewAllocateCustomerReceipt(tenantId, receiptId, body)
  return sendSuccess(res, 'receipt allocation preview', preview)
})

export const postReceiptAllocation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const receiptId = getRouteParam(req, 'receiptId')
  const body = req.body as AllocateCustomerReceiptBodyInput
  const result = await allocateCustomerReceipt(
    { receiptId, allocationDate: body.allocationDate, allocations: body.allocations },
    {
      tenantId,
      userId: req.context!.userId,
      idempotencyKey: getIdempotencyKey(req),
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    },
  )
  return sendSuccess(res, 'receipt allocation posted', result)
})

export const reverseReceiptAllocation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const receiptId = getRouteParam(req, 'receiptId')
  const batchId = getRouteParam(req, 'batchId')
  const body = req.body as ReverseAllocationBodyInput
  const result = await reverseCustomerReceiptAllocation(
    { receiptId, batchId, reason: body.reason },
    {
      tenantId,
      userId: req.context!.userId,
      idempotencyKey: getIdempotencyKey(req),
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    },
  )
  return sendSuccess(res, 'receipt allocation reversed', result)
})

export const getReceiptAllocations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const receiptId = getRouteParam(req, 'receiptId')
  const query = req.query as unknown as ListReceiptAllocationsQueryInput
  const result = await listAllocationsForReceipt(tenantId, receiptId, query)
  return sendPaginated(
    res,
    'receipt allocations listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getInvoiceAllocations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const invoiceId = getRouteParam(req, 'invoiceId')
  const query = req.query as unknown as ListReceiptAllocationsQueryInput
  const result = await listAllocationsForInvoice(tenantId, invoiceId, {
    page: query.page,
    pageSize: query.pageSize,
  })
  return sendPaginated(
    res,
    'invoice allocations listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getCustomerCredits = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListCustomerCreditsQueryInput
  const result = await listCustomerCredits(tenantId, query)
  return sendPaginated(
    res,
    'customer credits listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})
