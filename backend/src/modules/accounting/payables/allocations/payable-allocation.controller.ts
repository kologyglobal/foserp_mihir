import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../../utils/response.js'
import { allocateVendorPayment, allocateVendorAdjustment } from './payable-allocation.service.js'
import { reversePayableAllocation } from './payable-allocation-reverse.service.js'
import {
  getAllocatableInvoicesForPayment,
  getAllocatablePayablesForDebitNote,
  getPayableAllocationById,
  listAllocationsForInvoice,
  listAllocationsForPayment,
  listAllocationsForVendorAdjustment,
} from './payable-allocation-read.service.js'
import type {
  AllocatableInvoicesQueryInput,
  CreatePayableAllocationBodyInput,
  ListPayableAllocationsQueryInput,
  ReversePayableAllocationBodyInput,
} from './payable-allocation.schemas.js'

export const getAllocatableInvoices = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const vendorPaymentId = getRouteParam(req, 'id')
  const query = req.query as unknown as AllocatableInvoicesQueryInput
  const result = await getAllocatableInvoicesForPayment(tenantId, vendorPaymentId, {
    targetAmount: query.targetAmount,
    page: query.page,
    pageSize: query.pageSize ?? query.limit,
  })
  return sendSuccess(res, 'allocatable vendor invoices listed', result)
})

export const getAllocatablePayablesForDebitNoteHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const vendorAdjustmentId = getRouteParam(req, 'id')
  const query = req.query as unknown as AllocatableInvoicesQueryInput
  const result = await getAllocatablePayablesForDebitNote(tenantId, vendorAdjustmentId, {
    targetAmount: query.targetAmount,
    page: query.page,
    pageSize: query.pageSize ?? query.limit,
  })
  return sendSuccess(res, 'allocatable vendor payables listed', result)
})

export const createVendorAdjustmentAllocation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const vendorAdjustmentId = getRouteParam(req, 'id')
  const body = req.body as CreatePayableAllocationBodyInput
  const result = await allocateVendorAdjustment(
    vendorAdjustmentId,
    {
      expectedAdjustmentUpdatedAt: body.expectedAdjustmentUpdatedAt,
      expectedSourceOpenItemUpdatedAt: body.expectedSourceOpenItemUpdatedAt,
      allocationDate: body.allocationDate,
      idempotencyKey: body.idempotencyKey,
      lines: body.lines,
    },
    {
      tenantId,
      userId: req.context!.userId,
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    },
  )
  return sendSuccess(res, 'vendor adjustment allocation created', result)
})

export const createVendorPaymentAllocation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const vendorPaymentId = getRouteParam(req, 'id')
  const body = req.body as CreatePayableAllocationBodyInput
  const result = await allocateVendorPayment(
    vendorPaymentId,
    {
      expectedPaymentUpdatedAt: body.expectedPaymentUpdatedAt,
      expectedSourceOpenItemUpdatedAt: body.expectedSourceOpenItemUpdatedAt,
      allocationDate: body.allocationDate,
      idempotencyKey: body.idempotencyKey,
      lines: body.lines,
    },
    {
      tenantId,
      userId: req.context!.userId,
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    },
  )
  return sendSuccess(res, 'vendor payment allocation created', result)
})

export const listVendorPaymentAllocations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const vendorPaymentId = getRouteParam(req, 'id')
  const query = req.query as unknown as ListPayableAllocationsQueryInput
  const result = await listAllocationsForPayment(tenantId, vendorPaymentId, query)
  return sendPaginated(
    res,
    'vendor payment allocations listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const listVendorInvoiceAllocations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const vendorInvoiceId = getRouteParam(req, 'id')
  const query = req.query as unknown as ListPayableAllocationsQueryInput
  const result = await listAllocationsForInvoice(tenantId, vendorInvoiceId, query)
  return sendPaginated(
    res,
    'vendor invoice allocations listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const listVendorAdjustmentAllocations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const vendorAdjustmentId = getRouteParam(req, 'id')
  const query = req.query as unknown as ListPayableAllocationsQueryInput
  const result = await listAllocationsForVendorAdjustment(tenantId, vendorAdjustmentId, query)
  return sendPaginated(
    res,
    'vendor adjustment allocations listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getPayableAllocation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const allocationId = getRouteParam(req, 'allocationId')
  const result = await getPayableAllocationById(tenantId, allocationId)
  return sendSuccess(res, 'payable allocation fetched', result)
})

export const reversePayableAllocationHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const allocationId = getRouteParam(req, 'allocationId')
  const body = req.body as ReversePayableAllocationBodyInput
  const result = await reversePayableAllocation(
    {
      allocationBatchId: allocationId,
      reversalDate: body.reversalDate,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      lineIds: body.lineIds,
      expectedAllocationUpdatedAt: body.expectedAllocationUpdatedAt,
      expectedLines: body.expectedLines,
      expectedOpenItems: body.expectedOpenItems,
    },
    {
      tenantId,
      userId: req.context!.userId,
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    },
  )
  return sendSuccess(res, 'payable allocation reversed', result)
})
