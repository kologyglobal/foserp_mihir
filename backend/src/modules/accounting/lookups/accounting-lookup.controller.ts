import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import { NotFoundError } from '../../../utils/errors.js'
import {
  getAccountingCustomerLookup,
  listAccountingCustomers,
} from '../shared/master-resolvers/accounting-customer-resolver.js'
import {
  getAccountingVendorLookup,
  listAccountingVendors,
} from '../shared/master-resolvers/accounting-vendor-resolver.js'
import {
  findAccountingItem,
  listAccountingItems,
} from '../shared/master-resolvers/accounting-item-resolver.js'
import {
  assessDispatchInvoiceEligibility,
  assessGrnInvoiceEligibility,
  assessPurchaseOrderInvoiceEligibility,
  assessSalesOrderInvoiceEligibility,
  listDispatchesForInvoice,
  listGrnsForInvoice,
  listPurchaseOrdersForInvoice,
  listSalesOrdersForInvoice,
} from '../shared/master-resolvers/accounting-source-document-resolver.js'

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const q = req.query as {
    search?: string
    page?: number
    limit?: number
    activeOnly?: boolean
    isActive?: boolean
  }
  const isActive = q.isActive ?? (q.activeOnly === false ? undefined : true)
  const result = await listAccountingCustomers(tenantId, {
    search: q.search,
    page: q.page,
    limit: q.limit,
    isActive,
  })
  return sendPaginated(
    res,
    'accounting customer lookups',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const item = await getAccountingCustomerLookup(getTenantId(req), getRouteParam(req, 'id'))
  if (!item) throw new NotFoundError('Customer not found')
  return sendSuccess(res, 'accounting customer lookup fetched', item)
})

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const q = req.query as { search?: string; page?: number; limit?: number; activeOnly?: boolean }
  const result = await listAccountingVendors(tenantId, {
    search: q.search,
    page: q.page,
    limit: q.limit,
    activeOnly: q.activeOnly,
  })
  return sendPaginated(
    res,
    'accounting vendor lookups',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getVendor = asyncHandler(async (req: Request, res: Response) => {
  const item = await getAccountingVendorLookup(getTenantId(req), getRouteParam(req, 'id'))
  if (!item) throw new NotFoundError('Vendor not found')
  return sendSuccess(res, 'accounting vendor lookup fetched', item)
})

export const listItems = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const q = req.query as {
    search?: string
    page?: number
    limit?: number
    activeOnly?: boolean
    itemType?: string
  }
  const result = await listAccountingItems(tenantId, {
    search: q.search,
    page: q.page,
    limit: q.limit,
    activeOnly: q.activeOnly,
    itemType: q.itemType,
  })
  return sendPaginated(
    res,
    'accounting item lookups',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await findAccountingItem(getTenantId(req), getRouteParam(req, 'id'))
  if (!item) throw new NotFoundError('Item not found')
  return sendSuccess(res, 'accounting item lookup fetched', item)
})

export const listSalesOrders = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const q = req.query as {
    search?: string
    page?: number
    limit?: number
    customerId?: string
    eligibleOnly?: boolean
  }
  const result = await listSalesOrdersForInvoice(tenantId, {
    search: q.search,
    page: q.page,
    limit: q.limit,
    customerId: q.customerId,
    eligibleOnly: q.eligibleOnly,
  })
  return sendPaginated(
    res,
    'accounting sales order lookups',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getSalesOrderEligibility = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined
  const result = await assessSalesOrderInvoiceEligibility(tenantId, id, customerId)
  return sendSuccess(res, 'sales order invoice eligibility', result)
})

export const listPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const q = req.query as {
    search?: string
    page?: number
    limit?: number
    vendorId?: string
    eligibleOnly?: boolean
  }
  const result = await listPurchaseOrdersForInvoice(tenantId, {
    search: q.search,
    page: q.page,
    limit: q.limit,
    vendorId: q.vendorId,
    eligibleOnly: q.eligibleOnly,
  })
  return sendPaginated(
    res,
    'accounting purchase order lookups',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getPurchaseOrderEligibility = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const vendorId = typeof req.query.vendorId === 'string' ? req.query.vendorId : undefined
  const result = await assessPurchaseOrderInvoiceEligibility(tenantId, id, vendorId)
  return sendSuccess(res, 'purchase order invoice eligibility', result)
})

export const listGrns = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const q = req.query as {
    search?: string
    page?: number
    limit?: number
    vendorId?: string
    purchaseOrderId?: string
    eligibleOnly?: boolean
  }
  const result = await listGrnsForInvoice(tenantId, {
    search: q.search,
    page: q.page,
    limit: q.limit,
    vendorId: q.vendorId,
    purchaseOrderId: q.purchaseOrderId,
    eligibleOnly: q.eligibleOnly,
  })
  return sendPaginated(
    res,
    'accounting grn lookups',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getGrnEligibility = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const vendorId = typeof req.query.vendorId === 'string' ? req.query.vendorId : undefined
  const result = await assessGrnInvoiceEligibility(tenantId, id, vendorId)
  return sendSuccess(res, 'grn invoice eligibility', result)
})

export const listDispatches = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const q = req.query as {
    search?: string
    page?: number
    limit?: number
    customerId?: string
    salesOrderId?: string
    eligibleOnly?: boolean
  }
  const result = await listDispatchesForInvoice(tenantId, {
    search: q.search,
    page: q.page,
    limit: q.limit,
    customerId: q.customerId,
    salesOrderId: q.salesOrderId,
    eligibleOnly: q.eligibleOnly,
  })
  return sendPaginated(
    res,
    'accounting dispatch lookups',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getDispatchEligibility = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined
  const result = await assessDispatchInvoiceEligibility(tenantId, id, customerId)
  return sendSuccess(res, 'dispatch invoice eligibility', result)
})
