/**
 * Invoice-ready quantity projection (O2C Wave 1).
 *
 * Invoice-Ready Qty = Confirmed Dispatched Qty − ACTIVE previously-invoiced qty
 * (returned qty deferred — treated as 0).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { AppError } from '../../../../utils/errors.js'
import { add, compare, formatForPersistence, subtract as sub, toDecimal } from '../../shared/finance-decimal.js'

export class InvoiceReadyQuantityExceededError extends AppError {
  constructor(message: string) {
    super(422, message, 'INVOICE_READY_QTY_EXCEEDED')
  }
}

export interface DispatchLineInvoiceReady {
  outboundDispatchId: string
  outboundDispatchLineId: string
  dispatchNo: string
  salesOrderId: string | null
  salesOrderNo: string | null
  salesOrderLineId: string | null
  customerId: string | null
  customerName: string | null
  itemId: string
  itemCode: string | null
  itemName: string | null
  warehouseId: string
  dispatchedQty: string
  invoicedQty: string
  invoiceReadyQty: string
  confirmedAt: string | null
  deliveryChallanId: string | null
  deliveryChallanNumber: string | null
  deliveryChallanLineId: string | null
}

export interface InvoiceReadyListQuery {
  customerId?: string
  salesOrderId?: string
  outboundDispatchId?: string
  search?: string
  page?: number
  limit?: number
  /** When true, only rows with invoiceReadyQty > 0 */
  readyOnly?: boolean
}

function d(n: Prisma.Decimal | number | string): ReturnType<typeof toDecimal> {
  return toDecimal(n)
}

/** Sum ACTIVE OUTBOUND_DISPATCH links for a dispatch line (optionally excluding one invoice). */
export async function sumActiveInvoicedQtyForDispatchLine(
  tenantId: string,
  outboundDispatchLineId: string,
  options?: { excludeSalesInvoiceId?: string; tx?: Prisma.TransactionClient },
): Promise<ReturnType<typeof toDecimal>> {
  const db = options?.tx ?? prisma
  const where: Prisma.SalesInvoiceSourceLinkWhereInput = {
    tenantId,
    status: 'ACTIVE',
    sourceType: 'OUTBOUND_DISPATCH',
    sourceLineId: outboundDispatchLineId,
    ...(options?.excludeSalesInvoiceId
      ? { salesInvoiceId: { not: options.excludeSalesInvoiceId } }
      : {}),
  }
  const agg = await db.salesInvoiceSourceLink.aggregate({
    where,
    _sum: { quantity: true },
  })
  return d(agg._sum.quantity ?? 0)
}

/** Lock ACTIVE consumption rows for the given dispatch line IDs (sorted for deadlock avoidance). */
export async function lockDispatchLineConsumption(
  tx: Prisma.TransactionClient,
  tenantId: string,
  outboundDispatchLineIds: string[],
): Promise<void> {
  const ids = [...new Set(outboundDispatchLineIds.filter(Boolean))].sort()
  if (ids.length === 0) return
  // MySQL FOR UPDATE via raw — Prisma findMany does not expose lock mode reliably across versions.
  await tx.$queryRaw`
    SELECT id FROM sales_invoice_source_links
    WHERE tenantId = ${tenantId}
      AND status = 'ACTIVE'
      AND sourceType = 'OUTBOUND_DISPATCH'
      AND sourceLineId IN (${Prisma.join(ids)})
    ORDER BY sourceLineId ASC
    FOR UPDATE
  `
}

export async function assertDispatchLineInvoiceReadyQty(
  tenantId: string,
  outboundDispatchLineId: string,
  requestedQty: string | number,
  options?: { excludeSalesInvoiceId?: string; tx?: Prisma.TransactionClient },
): Promise<{ dispatchedQty: string; invoicedQty: string; invoiceReadyQty: string }> {
  const db = options?.tx ?? prisma
  const line = await db.outboundDispatchLine.findFirst({
    where: { id: outboundDispatchLineId, tenantId },
    include: { outboundDispatch: { select: { status: true, dispatchNo: true } } },
  })
  if (!line) {
    throw new AppError(404, `Outbound dispatch line not found: ${outboundDispatchLineId}`, 'DISPATCH_LINE_NOT_FOUND')
  }
  if (line.outboundDispatch.status !== 'CONFIRMED') {
    throw new AppError(
      422,
      `Dispatch ${line.outboundDispatch.dispatchNo} is not confirmed — only confirmed dispatches are invoice-ready`,
      'DISPATCH_NOT_CONFIRMED',
    )
  }
  const dispatchedQty = d(line.quantity)
  const postingLine = await db.dispatchPostingLine.findFirst({
    where: { tenantId, outboundDispatchLineId },
    select: { reversedQuantity: true },
  })
  const reversedQty = d(postingLine?.reversedQuantity ?? 0)
  const netDispatchedQty = sub(dispatchedQty, reversedQty)
  if (compare(netDispatchedQty, 0) < 0) {
    throw new AppError(422, `Dispatch line ${outboundDispatchLineId} has invalid reverse qty`, 'DISPATCH_REVERSE_QTY_INVALID')
  }
  const invoicedQty = await sumActiveInvoicedQtyForDispatchLine(tenantId, outboundDispatchLineId, options)
  const invoiceReadyQty = sub(netDispatchedQty, invoicedQty)
  if (compare(toDecimal(requestedQty), invoiceReadyQty) > 0) {
    throw new InvoiceReadyQuantityExceededError(
      `Invoice qty ${formatForPersistence(requestedQty)} exceeds invoice-ready qty ${formatForPersistence(invoiceReadyQty)} on dispatch line ${outboundDispatchLineId} (dispatched ${formatForPersistence(netDispatchedQty)}, already invoiced ${formatForPersistence(invoicedQty)})`,
    )
  }
  return {
    dispatchedQty: formatForPersistence(netDispatchedQty),
    invoicedQty: formatForPersistence(invoicedQty),
    invoiceReadyQty: formatForPersistence(invoiceReadyQty),
  }
}

export async function listInvoiceReadyDispatchLines(
  tenantId: string,
  query: InvoiceReadyListQuery = {},
): Promise<{ items: DispatchLineInvoiceReady[]; total: number; page: number; limit: number }> {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 50,
    sortOrder: 'desc',
  })

  const where: Prisma.OutboundDispatchLineWhereInput = {
    tenantId,
    outboundDispatch: {
      tenantId,
      deletedAt: null,
      status: 'CONFIRMED',
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
      ...(query.outboundDispatchId ? { id: query.outboundDispatchId } : {}),
      ...(query.search
        ? {
            OR: [
              { dispatchNo: { contains: query.search } },
              { salesOrderNo: { contains: query.search } },
            ],
          }
        : {}),
    },
  }

  // Fetch a bounded window then filter by remaining qty (consumption is on a separate table).
  const [lines, totalRaw] = await Promise.all([
    prisma.outboundDispatchLine.findMany({
      where,
      include: {
        outboundDispatch: {
          select: {
            id: true,
            dispatchNo: true,
            salesOrderId: true,
            salesOrderNo: true,
            customerId: true,
            confirmedAt: true,
            deliveryChallans: {
              where: { status: 'ISSUED', deletedAt: null },
              select: {
                id: true,
                challanNumber: true,
                lines: {
                  select: { id: true, outboundDispatchLineId: true },
                },
              },
              take: 1,
              orderBy: { issuedAt: 'desc' },
            },
            salesOrder: {
              select: {
                companyId: true,
                company: { select: { name: true } },
              },
            },
          },
        },
        item: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ outboundDispatch: { confirmedAt: 'desc' } }, { lineNo: 'asc' }],
      take: Math.min((query.page ?? 1) * (query.limit ?? 50) + 200, 3000),
    }),
    prisma.outboundDispatchLine.count({ where }),
  ])

  const lineIds = lines.map((l) => l.id)
  const [consumed, postingLines] = await Promise.all([
    lineIds.length === 0
      ? Promise.resolve([])
      : prisma.salesInvoiceSourceLink.groupBy({
          by: ['sourceLineId'],
          where: {
            tenantId,
            status: 'ACTIVE',
            sourceType: 'OUTBOUND_DISPATCH',
            sourceLineId: { in: lineIds },
          },
          _sum: { quantity: true },
        }),
    lineIds.length === 0
      ? Promise.resolve([])
      : prisma.dispatchPostingLine.findMany({
          where: { tenantId, outboundDispatchLineId: { in: lineIds } },
          select: { outboundDispatchLineId: true, reversedQuantity: true },
        }),
  ])
  const consumedMap = new Map(
    consumed.map((c) => [c.sourceLineId ?? '', d(c._sum.quantity ?? 0)]),
  )
  const reversedMap = new Map(
    postingLines.map((p) => [p.outboundDispatchLineId, d(p.reversedQuantity)]),
  )

  const mapped: DispatchLineInvoiceReady[] = []
  for (const line of lines) {
    const dispatchedQty = sub(d(line.quantity), reversedMap.get(line.id) ?? toDecimal(0))
    const invoicedQty = consumedMap.get(line.id) ?? toDecimal(0)
    const invoiceReadyQty = sub(dispatchedQty, invoicedQty)
    if (query.readyOnly !== false && compare(invoiceReadyQty, 0) <= 0) continue

    const challan = line.outboundDispatch.deliveryChallans[0] ?? null
    const challanLine = challan?.lines.find((cl) => cl.outboundDispatchLineId === line.id) ?? null
    const customerId = line.outboundDispatch.customerId ?? line.outboundDispatch.salesOrder?.companyId ?? null
    const customerName = line.outboundDispatch.salesOrder?.company?.name ?? null

    mapped.push({
      outboundDispatchId: line.outboundDispatch.id,
      outboundDispatchLineId: line.id,
      dispatchNo: line.outboundDispatch.dispatchNo,
      salesOrderId: line.salesOrderId ?? line.outboundDispatch.salesOrderId,
      salesOrderNo: line.outboundDispatch.salesOrderNo,
      salesOrderLineId: line.salesOrderLineId,
      customerId,
      customerName,
      itemId: line.itemId,
      itemCode: line.item.code,
      itemName: line.item.name,
      warehouseId: line.warehouseId,
      dispatchedQty: formatForPersistence(dispatchedQty),
      invoicedQty: formatForPersistence(invoicedQty),
      invoiceReadyQty: formatForPersistence(invoiceReadyQty),
      confirmedAt: line.outboundDispatch.confirmedAt?.toISOString() ?? null,
      deliveryChallanId: challan?.id ?? null,
      deliveryChallanNumber: challan?.challanNumber ?? null,
      deliveryChallanLineId: challanLine?.id ?? null,
    })
  }

  const total = query.readyOnly === false ? totalRaw : mapped.length
  const pageItems = mapped.slice(skip, skip + take)

  return { items: pageItems, total, page, limit }
}

/** Prefill payload for creating a Sales Invoice from one or more dispatch lines. */
export async function buildInvoicePrefillFromDispatchLines(
  tenantId: string,
  outboundDispatchLineIds: string[],
): Promise<{
  customerId: string
  sourceType: 'OUTBOUND_DISPATCH'
  sourceDocumentId: string
  salesOrderId: string | null
  projectRef: string | null
  projectNameSnapshot: string | null
  billingAddress: unknown
  shippingAddress: unknown
  customerPoNumber: string | null
  paymentTermsDays: number | null
  freightAmount: string
  lines: Array<{
    lineNumber: number
    itemId: string
    itemCode: string | null
    itemName: string | null
    description: string
    quantity: string
    unitPrice: string
    discountPct: number
    taxPct: number
    sourceLineId: string
    outboundDispatchLineId: string
    outboundDispatchId: string
    salesOrderId: string | null
    salesOrderLineId: string | null
    deliveryChallanId: string | null
    deliveryChallanLineId: string | null
    projectRef: string | null
    projectNameSnapshot: string | null
    uom: string | null
    hsnCode: string | null
  }>
  sourceLinks: Array<{
    sourceType: 'OUTBOUND_DISPATCH'
    sourceDocumentId: string
    sourceLineId: string
    salesOrderId: string | null
    salesOrderLineId: string | null
    deliveryChallanId: string | null
    deliveryChallanLineId: string | null
    quantity: string
    itemId: string
  }>
}> {
  if (outboundDispatchLineIds.length === 0) {
    throw new AppError(400, 'At least one dispatch line is required', 'DISPATCH_LINES_REQUIRED')
  }

  const ready = await listInvoiceReadyDispatchLines(tenantId, {
    readyOnly: true,
    limit: 500,
  })
  const byId = new Map(ready.items.map((r) => [r.outboundDispatchLineId, r]))

  const selected: DispatchLineInvoiceReady[] = []
  for (const id of outboundDispatchLineIds) {
    const row = byId.get(id)
    if (!row) {
      // May be outside the ready list page — load directly
      const check = await assertDispatchLineInvoiceReadyQty(tenantId, id, '0.000001')
      if (compare(toDecimal(check.invoiceReadyQty), 0) <= 0) {
        throw new InvoiceReadyQuantityExceededError(`Dispatch line ${id} has no invoice-ready quantity`)
      }
      const reloaded = await listInvoiceReadyDispatchLines(tenantId, {
        readyOnly: false,
        limit: 500,
      })
      const found = reloaded.items.find((r) => r.outboundDispatchLineId === id)
      if (!found) throw new AppError(404, `Dispatch line not found: ${id}`, 'DISPATCH_LINE_NOT_FOUND')
      selected.push(found)
    } else {
      selected.push(row)
    }
  }

  const customerIds = new Set(selected.map((s) => s.customerId).filter(Boolean))
  if (customerIds.size !== 1) {
    throw new AppError(422, 'Selected dispatch lines must belong to a single customer', 'MULTI_CUSTOMER_DISPATCH')
  }
  const customerId = [...customerIds][0]!

  const salesOrderIds = new Set(selected.map((s) => s.salesOrderId).filter(Boolean))
  const primarySoId = salesOrderIds.size === 1 ? [...salesOrderIds][0]! : selected[0]!.salesOrderId
  const primaryDispatchId = selected[0]!.outboundDispatchId

  let so: {
    billingAddress: string | null
    shippingAddress: string | null
    customerPoNumber: string | null
    paymentTerms: string | null
    projectRef: string | null
    projectNameSnapshot: string | null
    lines: unknown
    unitPrice: Prisma.Decimal | null
    discountPct: Prisma.Decimal | null
    gstAmount: Prisma.Decimal | null
    basicAmount: Prisma.Decimal | null
    grandTotal: Prisma.Decimal | null
  } | null = null

  if (primarySoId) {
    so = await prisma.crmSalesOrder.findFirst({
      where: { id: primarySoId, tenantId, deletedAt: null },
      select: {
        billingAddress: true,
        shippingAddress: true,
        customerPoNumber: true,
        paymentTerms: true,
        projectRef: true,
        projectNameSnapshot: true,
        lines: true,
        unitPrice: true,
        discountPct: true,
        gstAmount: true,
        basicAmount: true,
        grandTotal: true,
      },
    })
  }

  const soLines = Array.isArray(so?.lines) ? (so!.lines as Array<Record<string, unknown>>) : []
  const soLineById = new Map(soLines.map((l) => [String(l.id ?? ''), l]))

  const lines = selected.map((row, idx) => {
    const soLine = row.salesOrderLineId ? soLineById.get(row.salesOrderLineId) : undefined
    const unitPrice =
      soLine?.unitPrice != null
        ? String(soLine.unitPrice)
        : so?.unitPrice != null
          ? formatForPersistence(so.unitPrice)
          : '0'
    const discountPct = Number(soLine?.discountPct ?? so?.discountPct ?? 0) || 0
    const taxPct = Number(soLine?.taxPct ?? 0) || 0
    return {
      lineNumber: idx + 1,
      itemId: row.itemId,
      itemCode: row.itemCode,
      itemName: row.itemName,
      description: row.itemName ?? row.itemCode ?? 'Item',
      quantity: row.invoiceReadyQty,
      unitPrice,
      discountPct,
      taxPct,
      sourceLineId: row.salesOrderLineId ?? row.outboundDispatchLineId,
      outboundDispatchLineId: row.outboundDispatchLineId,
      outboundDispatchId: row.outboundDispatchId,
      salesOrderId: row.salesOrderId,
      salesOrderLineId: row.salesOrderLineId,
      deliveryChallanId: row.deliveryChallanId,
      deliveryChallanLineId: row.deliveryChallanLineId,
      projectRef: so?.projectRef ?? null,
      projectNameSnapshot: so?.projectNameSnapshot ?? null,
      uom: (soLine?.uom as string | undefined) ?? null,
      hsnCode: null as string | null,
    }
  })

  // Credit days from payment terms string is soft; leave null if not parseable.
  let paymentTermsDays: number | null = null
  if (so?.paymentTerms) {
    const m = so.paymentTerms.match(/(\d+)\s*day/i)
    if (m) paymentTermsDays = Number(m[1])
  }

  return {
    customerId,
    sourceType: 'OUTBOUND_DISPATCH',
    sourceDocumentId: primaryDispatchId,
    salesOrderId: primarySoId,
    projectRef: so?.projectRef ?? null,
    projectNameSnapshot: so?.projectNameSnapshot ?? null,
    billingAddress: so?.billingAddress ?? null,
    shippingAddress: so?.shippingAddress ?? null,
    customerPoNumber: so?.customerPoNumber ?? null,
    paymentTermsDays,
    freightAmount: '0',
    lines,
    sourceLinks: lines.map((l) => ({
      sourceType: 'OUTBOUND_DISPATCH' as const,
      sourceDocumentId: l.outboundDispatchId,
      sourceLineId: l.outboundDispatchLineId,
      salesOrderId: l.salesOrderId,
      salesOrderLineId: l.salesOrderLineId,
      deliveryChallanId: l.deliveryChallanId,
      deliveryChallanLineId: l.deliveryChallanLineId,
      quantity: l.quantity,
      itemId: l.itemId,
    })),
  }
}

/** Convenience: sum invoice-ready across all confirmed lines for an SO. */
export async function sumInvoiceReadyForSalesOrder(
  tenantId: string,
  salesOrderId: string,
): Promise<{ dispatchedQty: string; invoicedQty: string; invoiceReadyQty: string }> {
  const { items } = await listInvoiceReadyDispatchLines(tenantId, {
    salesOrderId,
    readyOnly: false,
    limit: 500,
  })
  let dispatched = toDecimal(0)
  let invoiced = toDecimal(0)
  let ready = toDecimal(0)
  for (const item of items) {
    dispatched = add(dispatched, item.dispatchedQty)
    invoiced = add(invoiced, item.invoicedQty)
    ready = add(ready, item.invoiceReadyQty)
  }
  return {
    dispatchedQty: formatForPersistence(dispatched),
    invoicedQty: formatForPersistence(invoiced),
    invoiceReadyQty: formatForPersistence(ready),
  }
}
