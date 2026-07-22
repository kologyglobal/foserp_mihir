/**
 * Source-document resolver for Sales Order / Purchase Order / GRN eligibility.
 * Soft links only — no Prisma FKs from accounting invoices.
 */
import type { CrmSalesOrder, GoodsReceipt, PurchaseOrder } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { AppError, NotFoundError } from '../../../../utils/errors.js'
import type { SalesOrderLineDto } from '../../../crm/sales-orders/sales-order.types.js'

export type VendorInvoiceSourceMode = 'DIRECT' | 'PURCHASE_ORDER' | 'GRN' | 'PURCHASE_ORDER_AND_GRN'

export class SourceDocumentNotFoundError extends NotFoundError {
  constructor(message = 'Source document not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'SOURCE_DOCUMENT_NOT_FOUND' })
  }
}

export class SourceDocumentIneligibleError extends AppError {
  constructor(message: string, code = 'SOURCE_DOCUMENT_INELIGIBLE') {
    super(422, message, code)
  }
}

export class SourceDocumentPartyMismatchError extends AppError {
  constructor(message = 'Source document party does not match invoice party') {
    super(422, message, 'SOURCE_DOCUMENT_PARTY_MISMATCH')
  }
}

/** Statuses allowed when creating/linking a Sales Invoice from a Sales Order. */
export const SALES_ORDER_INVOICE_ELIGIBLE_STATUSES = new Set([
  'open',
  'confirmed',
  'in_production',
  'ready_dispatch',
  'dispatched',
])

export const PURCHASE_ORDER_INVOICE_ELIGIBLE_STATUSES = new Set([
  'APPROVED',
  'SENT_TO_VENDOR',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'PARTIALLY_INVOICED',
])

export const GRN_INVOICE_ELIGIBLE_STATUSES = new Set([
  'SUBMITTED',
  'RECEIVING_COMPLETED',
  'QC_PENDING',
  'PARTIALLY_ACCEPTED',
  'FULLY_ACCEPTED',
  'INVENTORY_POSTED',
  'CLOSED',
])

export interface SourceEligibilityResult {
  eligible: boolean
  documentId: string
  documentNumber: string
  documentDate: string | null
  status: string
  partyId: string
  errors: Array<{ code: string; message: string }>
  warnings: Array<{ code: string; message: string }>
  snapshot: Record<string, unknown>
}

function parseSoLines(value: unknown): SalesOrderLineDto[] {
  return Array.isArray(value) ? (value as SalesOrderLineDto[]) : []
}

function soSnapshot(order: CrmSalesOrder) {
  return {
    id: order.id,
    orderNumber: order.salesOrderNo,
    customerId: order.companyId,
    status: order.status,
    orderDate: order.orderDate ? order.orderDate.toISOString().slice(0, 10) : null,
    customerPoNumber: order.customerPoNumber,
    qty: Number(order.qty),
    lines: parseSoLines(order.lines),
  }
}

function poSnapshot(order: PurchaseOrder) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    vendorId: order.vendorId,
    status: order.status,
    orderDate: order.orderDate.toISOString().slice(0, 10),
    currencyCode: order.currencyCode,
    totalAmount: String(order.totalAmount),
  }
}

function grnSnapshot(grn: GoodsReceipt) {
  return {
    id: grn.id,
    grnNumber: grn.grnNumber,
    vendorId: grn.vendorId,
    purchaseOrderId: grn.purchaseOrderId,
    purchaseOrderNumber: grn.purchaseOrderNumber,
    status: grn.status,
    receiptDate: grn.receiptDate.toISOString().slice(0, 10),
  }
}

// ─── Sales Orders ────────────────────────────────────────────────────────────

export interface FindSalesOrdersForInvoiceQuery {
  search?: string
  customerId?: string
  page?: number
  limit?: number
  eligibleOnly?: boolean
}

export async function listSalesOrdersForInvoice(
  tenantId: string,
  query: FindSalesOrdersForInvoiceQuery,
): Promise<{
  items: Array<{
    id: string
    orderNumber: string
    customerId: string
    status: string
    orderDate: string | null
    customerPoNumber: string | null
    qty: number
  }>
  total: number
  page: number
  limit: number
}> {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })
  const where = {
    tenantId,
    deletedAt: null,
    ...(query.customerId ? { companyId: query.customerId } : {}),
    ...(query.eligibleOnly
      ? { status: { in: [...SALES_ORDER_INVOICE_ELIGIBLE_STATUSES] } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { salesOrderNo: { contains: query.search } },
            { customerPoNumber: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.crmSalesOrder.findMany({
      where,
      skip,
      take,
      orderBy: { orderDate: 'desc' },
      select: {
        id: true,
        salesOrderNo: true,
        companyId: true,
        status: true,
        orderDate: true,
        customerPoNumber: true,
        qty: true,
      },
    }),
    prisma.crmSalesOrder.count({ where }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      orderNumber: r.salesOrderNo,
      customerId: r.companyId,
      status: r.status,
      orderDate: r.orderDate ? r.orderDate.toISOString().slice(0, 10) : null,
      customerPoNumber: r.customerPoNumber,
      qty: Number(r.qty),
    })),
    total,
    page,
    limit,
  }
}

export async function assessSalesOrderInvoiceEligibility(
  tenantId: string,
  salesOrderId: string,
  expectedCustomerId?: string,
): Promise<SourceEligibilityResult> {
  const order = await prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, tenantId, deletedAt: null },
  })
  if (!order) throw new SourceDocumentNotFoundError(`Sales order not found: ${salesOrderId}`)

  const errors: SourceEligibilityResult['errors'] = []
  const warnings: SourceEligibilityResult['warnings'] = []
  const status = order.status.trim().toLowerCase()

  if (status === 'cancelled' || status === 'canceled') {
    errors.push({ code: 'SALES_ORDER_CANCELLED', message: 'Cannot invoice a cancelled sales order' })
  } else if (!SALES_ORDER_INVOICE_ELIGIBLE_STATUSES.has(status)) {
    errors.push({
      code: 'SALES_ORDER_STATUS_NOT_ELIGIBLE',
      message: `Sales order status "${order.status}" is not eligible for invoicing`,
    })
  }

  if (expectedCustomerId && order.companyId !== expectedCustomerId) {
    errors.push({
      code: 'SALES_ORDER_CUSTOMER_MISMATCH',
      message: 'Customer does not match the linked sales order',
    })
  }

  const existingCount = await prisma.salesInvoice.count({
    where: {
      tenantId,
      sourceType: 'SALES_ORDER',
      sourceDocumentId: salesOrderId,
      status: { not: 'CANCELLED' },
    },
  })
  if (existingCount > 0) {
    warnings.push({
      code: 'SALES_ORDER_ALREADY_INVOICED',
      message: 'Another sales invoice is already linked to this sales order',
    })
  }

  const lines = parseSoLines(order.lines)
  const orderedQty =
    lines.length > 0 ? lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0) : Number(order.qty) || 0
  if (orderedQty > 0 && existingCount > 0) {
    warnings.push({
      code: 'SALES_ORDER_REMAINING_QTY_UNKNOWN',
      message: `Sales order ordered qty is ${orderedQty}; confirm remaining qty before invoicing (partial invoice tracking is soft)`,
    })
  }

  const snapshot = soSnapshot(order)
  return {
    eligible: errors.length === 0,
    documentId: order.id,
    documentNumber: order.salesOrderNo,
    documentDate: snapshot.orderDate,
    status: order.status,
    partyId: order.companyId,
    errors,
    warnings,
    snapshot,
  }
}

export async function requireEligibleSalesOrder(
  tenantId: string,
  salesOrderId: string,
  expectedCustomerId: string,
): Promise<SourceEligibilityResult> {
  const result = await assessSalesOrderInvoiceEligibility(tenantId, salesOrderId, expectedCustomerId)
  if (!result.eligible) {
    const first = result.errors[0]!
    if (first.code === 'SALES_ORDER_CUSTOMER_MISMATCH') {
      throw new SourceDocumentPartyMismatchError(first.message)
    }
    throw new SourceDocumentIneligibleError(first.message, first.code)
  }
  return result
}

// ─── Purchase Orders ─────────────────────────────────────────────────────────

export interface FindPurchaseOrdersForInvoiceQuery {
  search?: string
  vendorId?: string
  page?: number
  limit?: number
  eligibleOnly?: boolean
}

export async function listPurchaseOrdersForInvoice(
  tenantId: string,
  query: FindPurchaseOrdersForInvoiceQuery,
): Promise<{
  items: Array<{
    id: string
    orderNumber: string
    vendorId: string
    status: string
    orderDate: string
    currencyCode: string
    totalAmount: string
  }>
  total: number
  page: number
  limit: number
}> {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })
  const where = {
    tenantId,
    deletedAt: null,
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.eligibleOnly
      ? { status: { in: [...PURCHASE_ORDER_INVOICE_ELIGIBLE_STATUSES] as never[] } }
      : {}),
    ...(query.search ? { orderNumber: { contains: query.search } } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take,
      orderBy: { orderDate: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        vendorId: true,
        status: true,
        orderDate: true,
        currencyCode: true,
        totalAmount: true,
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      vendorId: r.vendorId,
      status: r.status,
      orderDate: r.orderDate.toISOString().slice(0, 10),
      currencyCode: r.currencyCode,
      totalAmount: String(r.totalAmount),
    })),
    total,
    page,
    limit,
  }
}

export async function assessPurchaseOrderInvoiceEligibility(
  tenantId: string,
  purchaseOrderId: string,
  expectedVendorId?: string,
): Promise<SourceEligibilityResult> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, tenantId, deletedAt: null },
  })
  if (!order) throw new SourceDocumentNotFoundError(`Purchase order not found: ${purchaseOrderId}`)

  const errors: SourceEligibilityResult['errors'] = []
  const warnings: SourceEligibilityResult['warnings'] = []

  if (order.status === 'CANCELLED' || order.status === 'CLOSED' || order.status === 'DRAFT' || order.status === 'REJECTED') {
    errors.push({
      code: 'PURCHASE_ORDER_STATUS_NOT_ELIGIBLE',
      message: `Purchase order status "${order.status}" is not eligible for vendor invoicing`,
    })
  } else if (!PURCHASE_ORDER_INVOICE_ELIGIBLE_STATUSES.has(order.status) && order.status !== 'FULLY_INVOICED') {
    errors.push({
      code: 'PURCHASE_ORDER_STATUS_NOT_ELIGIBLE',
      message: `Purchase order status "${order.status}" is not eligible for vendor invoicing`,
    })
  }

  if (order.status === 'FULLY_INVOICED') {
    warnings.push({
      code: 'PURCHASE_ORDER_FULLY_INVOICED',
      message: 'Purchase order is already fully invoiced',
    })
  }

  if (expectedVendorId && order.vendorId !== expectedVendorId) {
    errors.push({
      code: 'PURCHASE_ORDER_VENDOR_MISMATCH',
      message: 'Vendor does not match the linked purchase order',
    })
  }

  const snapshot = poSnapshot(order)
  return {
    eligible: errors.length === 0,
    documentId: order.id,
    documentNumber: order.orderNumber,
    documentDate: snapshot.orderDate,
    status: order.status,
    partyId: order.vendorId,
    errors,
    warnings,
    snapshot,
  }
}

export async function requireEligiblePurchaseOrder(
  tenantId: string,
  purchaseOrderId: string,
  expectedVendorId: string,
): Promise<SourceEligibilityResult> {
  const result = await assessPurchaseOrderInvoiceEligibility(tenantId, purchaseOrderId, expectedVendorId)
  if (!result.eligible) {
    const first = result.errors[0]!
    if (first.code === 'PURCHASE_ORDER_VENDOR_MISMATCH') {
      throw new SourceDocumentPartyMismatchError(first.message)
    }
    throw new SourceDocumentIneligibleError(first.message, first.code)
  }
  return result
}

// ─── GRNs ────────────────────────────────────────────────────────────────────

export interface FindGrnsForInvoiceQuery {
  search?: string
  vendorId?: string
  purchaseOrderId?: string
  page?: number
  limit?: number
  eligibleOnly?: boolean
}

export async function listGrnsForInvoice(
  tenantId: string,
  query: FindGrnsForInvoiceQuery,
): Promise<{
  items: Array<{
    id: string
    grnNumber: string
    vendorId: string
    purchaseOrderId: string
    purchaseOrderNumber: string
    status: string
    receiptDate: string
  }>
  total: number
  page: number
  limit: number
}> {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })
  const where = {
    tenantId,
    deletedAt: null,
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
    ...(query.eligibleOnly
      ? { status: { in: [...GRN_INVOICE_ELIGIBLE_STATUSES] as never[] } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { grnNumber: { contains: query.search } },
            { purchaseOrderNumber: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where,
      skip,
      take,
      orderBy: { receiptDate: 'desc' },
      select: {
        id: true,
        grnNumber: true,
        vendorId: true,
        purchaseOrderId: true,
        purchaseOrderNumber: true,
        status: true,
        receiptDate: true,
      },
    }),
    prisma.goodsReceipt.count({ where }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      grnNumber: r.grnNumber,
      vendorId: r.vendorId,
      purchaseOrderId: r.purchaseOrderId,
      purchaseOrderNumber: r.purchaseOrderNumber,
      status: r.status,
      receiptDate: r.receiptDate.toISOString().slice(0, 10),
    })),
    total,
    page,
    limit,
  }
}

export async function assessGrnInvoiceEligibility(
  tenantId: string,
  grnId: string,
  expectedVendorId?: string,
): Promise<SourceEligibilityResult> {
  const grn = await prisma.goodsReceipt.findFirst({
    where: { id: grnId, tenantId, deletedAt: null },
  })
  if (!grn) throw new SourceDocumentNotFoundError(`Goods receipt not found: ${grnId}`)

  const errors: SourceEligibilityResult['errors'] = []
  const warnings: SourceEligibilityResult['warnings'] = []

  if (grn.status === 'CANCELLED' || grn.status === 'REVERSED' || grn.status === 'DRAFT') {
    errors.push({
      code: 'GRN_STATUS_NOT_ELIGIBLE',
      message: `Goods receipt status "${grn.status}" is not eligible for vendor invoicing`,
    })
  } else if (!GRN_INVOICE_ELIGIBLE_STATUSES.has(grn.status)) {
    errors.push({
      code: 'GRN_STATUS_NOT_ELIGIBLE',
      message: `Goods receipt status "${grn.status}" is not eligible for vendor invoicing`,
    })
  }

  if (expectedVendorId && grn.vendorId !== expectedVendorId) {
    errors.push({
      code: 'GRN_VENDOR_MISMATCH',
      message: 'Vendor does not match the linked goods receipt',
    })
  }

  const snapshot = grnSnapshot(grn)
  return {
    eligible: errors.length === 0,
    documentId: grn.id,
    documentNumber: grn.grnNumber,
    documentDate: snapshot.receiptDate,
    status: grn.status,
    partyId: grn.vendorId,
    errors,
    warnings,
    snapshot,
  }
}

export async function requireEligibleGrn(
  tenantId: string,
  grnId: string,
  expectedVendorId: string,
): Promise<SourceEligibilityResult> {
  const result = await assessGrnInvoiceEligibility(tenantId, grnId, expectedVendorId)
  if (!result.eligible) {
    const first = result.errors[0]!
    if (first.code === 'GRN_VENDOR_MISMATCH') {
      throw new SourceDocumentPartyMismatchError(first.message)
    }
    throw new SourceDocumentIneligibleError(first.message, first.code)
  }
  return result
}

export function deriveVendorInvoiceSourceMode(
  sourceLinks: Array<{ sourceType: string }>,
): VendorInvoiceSourceMode {
  const types = new Set(sourceLinks.map((l) => l.sourceType))
  const hasPo = types.has('PURCHASE_ORDER')
  const hasGrn = types.has('GOODS_RECEIPT') || types.has('PURCHASE_RECEIPT')
  if (hasPo && hasGrn) return 'PURCHASE_ORDER_AND_GRN'
  if (hasPo) return 'PURCHASE_ORDER'
  if (hasGrn) return 'GRN'
  return 'DIRECT'
}

export interface FindDispatchesForInvoiceQuery {
  search?: string
  page?: number
  limit?: number
  customerId?: string
  salesOrderId?: string
  eligibleOnly?: boolean
}

/** Confirmed outbound dispatches available for AR invoicing. */
export async function listDispatchesForInvoice(
  tenantId: string,
  query: FindDispatchesForInvoiceQuery,
): Promise<{
  items: Array<{
    id: string
    dispatchNo: string
    salesOrderId: string | null
    salesOrderNo: string | null
    customerId: string | null
    customerName: string | null
    status: string
    confirmedAt: string | null
    lineCount: number
  }>
  total: number
  page: number
  limit: number
}> {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })

  const where = {
    tenantId,
    deletedAt: null,
    ...(query.eligibleOnly !== false ? { status: 'CONFIRMED' as const } : {}),
    ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
    ...(query.search
      ? {
          OR: [
            { dispatchNo: { contains: query.search } },
            { salesOrderNo: { contains: query.search } },
          ],
        }
      : {}),
    ...(query.customerId
      ? { salesOrder: { companyId: query.customerId, deletedAt: null } }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.outboundDispatch.findMany({
      where,
      skip,
      take,
      orderBy: { confirmedAt: 'desc' },
      select: {
        id: true,
        dispatchNo: true,
        salesOrderId: true,
        salesOrderNo: true,
        status: true,
        confirmedAt: true,
        _count: { select: { lines: true } },
        salesOrder: {
          select: { companyId: true, company: { select: { name: true } } },
        },
      },
    }),
    prisma.outboundDispatch.count({ where }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      dispatchNo: r.dispatchNo,
      salesOrderId: r.salesOrderId,
      salesOrderNo: r.salesOrderNo,
      customerId: r.salesOrder?.companyId ?? null,
      customerName: r.salesOrder?.company?.name ?? null,
      status: r.status,
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      lineCount: r._count.lines,
    })),
    total,
    page,
    limit,
  }
}

export async function assessDispatchInvoiceEligibility(
  tenantId: string,
  outboundDispatchId: string,
  expectedCustomerId?: string,
): Promise<SourceEligibilityResult> {
  const dispatch = await prisma.outboundDispatch.findFirst({
    where: { id: outboundDispatchId, tenantId, deletedAt: null },
    include: {
      salesOrder: { select: { companyId: true, salesOrderNo: true, status: true } },
      lines: { select: { id: true, quantity: true } },
    },
  })
  if (!dispatch) throw new SourceDocumentNotFoundError(`Outbound dispatch not found: ${outboundDispatchId}`)

  const errors: SourceEligibilityResult['errors'] = []
  const warnings: SourceEligibilityResult['warnings'] = []

  if (dispatch.status !== 'CONFIRMED') {
    errors.push({
      code: 'DISPATCH_NOT_CONFIRMED',
      message: `Only CONFIRMED dispatches can be invoiced (status=${dispatch.status})`,
    })
  }

  if (expectedCustomerId && dispatch.salesOrder?.companyId && dispatch.salesOrder.companyId !== expectedCustomerId) {
    errors.push({
      code: 'DISPATCH_CUSTOMER_MISMATCH',
      message: 'Dispatch customer does not match invoice customer',
    })
  }

  if (dispatch.lines.length === 0) {
    errors.push({ code: 'DISPATCH_NO_LINES', message: 'Dispatch has no lines to invoice' })
  }

  // Soft: closed SO still financially open may be invoiced; warn only.
  if (dispatch.salesOrder?.status?.toLowerCase() === 'closed') {
    warnings.push({
      code: 'SALES_ORDER_CLOSED',
      message: 'Linked sales order is closed — commercial invoicing of remaining dispatched qty is still allowed',
    })
  }

  return {
    eligible: errors.length === 0,
    documentId: dispatch.id,
    documentNumber: dispatch.dispatchNo,
    documentDate: dispatch.confirmedAt?.toISOString().slice(0, 10) ?? null,
    status: dispatch.status,
    partyId: dispatch.salesOrder?.companyId ?? '',
    errors,
    warnings,
    snapshot: {
      sourceType: 'OUTBOUND_DISPATCH',
      dispatchNo: dispatch.dispatchNo,
      salesOrderId: dispatch.salesOrderId,
      salesOrderNo: dispatch.salesOrderNo ?? dispatch.salesOrder?.salesOrderNo ?? null,
      lineCount: dispatch.lines.length,
    },
  }
}
