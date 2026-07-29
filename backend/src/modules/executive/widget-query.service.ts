import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { permissionSetIncludes } from '../../constants/permissions.js'
import { getCashPosition } from '../accounting/treasury/liquidity/cash-position.service.js'
import {
  emptyWidgetData,
  unavailableWidgetData,
  type WidgetDataPayload,
  type WidgetQueryInput,
  type WidgetQueryResult,
} from './dashboard.types.js'
import { getWidgetDefinition, type WidgetVisualization } from './widget-registry.js'

function asNumber(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  if (value instanceof Prisma.Decimal) return Number(value.toString())
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function mergeFilters(input: WidgetQueryInput): Record<string, unknown> {
  return { ...(input.globalFilters ?? {}), ...(input.filters ?? {}) }
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function endOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999))
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function resolveDateRange(filters: Record<string, unknown>): { from: Date; to: Date } {
  const fromExplicit = parseIsoDate(asString(filters.fromDate) ?? asString(filters.dateFrom))
  const toExplicit = parseIsoDate(asString(filters.toDate) ?? asString(filters.dateTo))
  if (fromExplicit && toExplicit) {
    return { from: startOfDayUtc(fromExplicit), to: endOfDayUtc(toExplicit) }
  }

  const now = new Date()
  const preset = asString(filters.datePreset) ?? 'this_month'
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()

  switch (preset) {
    case 'today':
      return { from: startOfDayUtc(now), to: endOfDayUtc(now) }
    case 'yesterday': {
      const yest = new Date(now)
      yest.setUTCDate(yest.getUTCDate() - 1)
      return { from: startOfDayUtc(yest), to: endOfDayUtc(yest) }
    }
    case 'this_week': {
      const day = now.getUTCDay() || 7
      const monday = new Date(now)
      monday.setUTCDate(now.getUTCDate() - (day - 1))
      return { from: startOfDayUtc(monday), to: endOfDayUtc(now) }
    }
    case 'last_week': {
      const day = now.getUTCDay() || 7
      const thisMonday = new Date(now)
      thisMonday.setUTCDate(now.getUTCDate() - (day - 1))
      const lastMonday = new Date(thisMonday)
      lastMonday.setUTCDate(thisMonday.getUTCDate() - 7)
      const lastSunday = new Date(thisMonday)
      lastSunday.setUTCDate(thisMonday.getUTCDate() - 1)
      return { from: startOfDayUtc(lastMonday), to: endOfDayUtc(lastSunday) }
    }
    case 'last_month': {
      const from = new Date(Date.UTC(y, m - 1, 1))
      const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))
      return { from, to }
    }
    case 'this_quarter': {
      const q = Math.floor(m / 3) * 3
      return { from: new Date(Date.UTC(y, q, 1)), to: endOfDayUtc(now) }
    }
    case 'this_fy': {
      const fyStartMonth = 3 // April
      const fyYear = m >= fyStartMonth ? y : y - 1
      return { from: new Date(Date.UTC(fyYear, fyStartMonth, 1)), to: endOfDayUtc(now) }
    }
    case 'last_fy': {
      const fyStartMonth = 3
      const fyYear = m >= fyStartMonth ? y - 1 : y - 2
      const from = new Date(Date.UTC(fyYear, fyStartMonth, 1))
      const to = new Date(Date.UTC(fyYear + 1, fyStartMonth, 0, 23, 59, 59, 999))
      return { from, to }
    }
    case 'this_month':
    default:
      return { from: new Date(Date.UTC(y, m, 1)), to: endOfDayUtc(now) }
  }
}

function okResult(
  widgetKey: string,
  visualization: WidgetVisualization,
  title: string,
  drillDownPath: string | null,
  data: WidgetDataPayload,
): WidgetQueryResult {
  return { widgetKey, visualization, title, drillDownPath, data, ok: true, error: null }
}

function failResult(
  widgetKey: string,
  visualization: WidgetVisualization,
  title: string,
  drillDownPath: string | null,
  error: string,
): WidgetQueryResult {
  return {
    widgetKey,
    visualization,
    title,
    drillDownPath,
    data: unavailableWidgetData(error, title),
    ok: false,
    error,
  }
}

async function queryRevenue(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const { from, to } = resolveDateRange(filters)
  const companyId = asString(filters.companyId)
  const where: Prisma.CrmTaxInvoiceWhereInput = {
    tenantId,
    deletedAt: null,
    status: { in: ['posted', 'partially_paid', 'paid'] },
    invoiceDate: { gte: from, lte: to },
    ...(companyId ? { companyId } : {}),
  }
  const agg = await prisma.crmTaxInvoice.aggregate({ where, _sum: { grandTotal: true }, _count: true })
  const value = asNumber(agg._sum.grandTotal)
  return {
    ...emptyWidgetData('Posted invoice revenue', 'INR'),
    value,
    label: `${agg._count} invoices`,
  }
}

async function queryOrderBook(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const companyId = asString(filters.companyId)
  const where: Prisma.CrmSalesOrderWhereInput = {
    tenantId,
    deletedAt: null,
    status: { in: ['open', 'confirmed', 'in_production', 'ready_dispatch', 'dispatched'] },
    ...(companyId ? { companyId } : {}),
  }
  const [agg, count] = await Promise.all([
    prisma.crmSalesOrder.aggregate({ where, _sum: { grandTotal: true } }),
    prisma.crmSalesOrder.count({ where }),
  ])
  return {
    ...emptyWidgetData('Order book', 'INR'),
    value: asNumber(agg._sum.grandTotal),
    label: `${count} open`,
  }
}

async function queryOrderIntake(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const { from, to } = resolveDateRange(filters)
  const where: Prisma.CrmSalesOrderWhereInput = {
    tenantId,
    deletedAt: null,
    orderDate: { gte: from, lte: to },
  }
  const [agg, count] = await Promise.all([
    prisma.crmSalesOrder.aggregate({ where, _sum: { grandTotal: true } }),
    prisma.crmSalesOrder.count({ where }),
  ])
  return {
    ...emptyWidgetData('Order intake', 'INR'),
    value: asNumber(agg._sum.grandTotal),
    label: `${count} orders`,
  }
}

async function queryReceivables(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const companyId = asString(filters.companyId)
  const where: Prisma.CrmTaxInvoiceWhereInput = {
    tenantId,
    deletedAt: null,
    status: { in: ['posted', 'partially_paid', 'paid'] },
    balanceDue: { gt: 0 },
    ...(companyId ? { companyId } : {}),
  }
  const [agg, count] = await Promise.all([
    prisma.crmTaxInvoice.aggregate({ where, _sum: { balanceDue: true } }),
    prisma.crmTaxInvoice.count({ where }),
  ])
  return {
    ...emptyWidgetData('Outstanding receivables', 'INR'),
    value: asNumber(agg._sum.balanceDue),
    label: `${count} open invoices`,
  }
}

async function queryOverdueReceivables(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const companyId = asString(filters.companyId)
  const today = startOfDayUtc(new Date())
  const where: Prisma.CrmTaxInvoiceWhereInput = {
    tenantId,
    deletedAt: null,
    status: { in: ['posted', 'partially_paid'] },
    balanceDue: { gt: 0 },
    dueDate: { lt: today },
    ...(companyId ? { companyId } : {}),
  }
  const [agg, count] = await Promise.all([
    prisma.crmTaxInvoice.aggregate({ where, _sum: { balanceDue: true } }),
    prisma.crmTaxInvoice.count({ where }),
  ])
  return {
    ...emptyWidgetData('Overdue receivables', 'INR'),
    value: asNumber(agg._sum.balanceDue),
    label: `${count} overdue`,
  }
}

async function queryPayables(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const legalEntityId = asString(filters.legalEntityId)
  const where: Prisma.PayableOpenItemWhereInput = {
    tenantId,
    side: 'CREDIT',
    status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
    outstandingAmount: { gt: 0 },
    ...(legalEntityId ? { legalEntityId } : {}),
  }
  const [agg, count] = await Promise.all([
    prisma.payableOpenItem.aggregate({ where, _sum: { outstandingAmount: true } }),
    prisma.payableOpenItem.count({ where }),
  ])
  return {
    ...emptyWidgetData('Open payables', 'INR'),
    value: asNumber(agg._sum.outstandingAmount),
    label: `${count} open items`,
  }
}

async function queryCashPosition(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  let legalEntityId = asString(filters.legalEntityId)
  if (!legalEntityId) {
    const le = await prisma.legalEntity.findFirst({
      where: { tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    legalEntityId = le?.id
  }
  if (!legalEntityId) {
    return unavailableWidgetData('No legal entity configured for cash position', 'Cash position', 'INR')
  }
  try {
    const position = await getCashPosition(tenantId, { legalEntityId })
    return {
      ...emptyWidgetData('Cash position', 'INR'),
      value: asNumber(position.totalBookBalance),
      label: 'Book bank + cash',
      items: [
        { label: 'Bank', value: asNumber(position.totalBankBalance) },
        { label: 'Cash', value: asNumber(position.totalCashBalance) },
      ],
    }
  } catch {
    return unavailableWidgetData('Treasury cash position unavailable', 'Cash position', 'INR')
  }
}

async function queryInventoryValue(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const warehouseId = asString(filters.warehouseId)
  const where: Prisma.InventoryStockBalanceWhereInput = {
    tenantId,
    ...(warehouseId ? { warehouseId } : {}),
  }
  const agg = await prisma.inventoryStockBalance.aggregate({ where, _sum: { stockValue: true } })
  return {
    ...emptyWidgetData('Inventory value', 'INR'),
    value: asNumber(agg._sum.stockValue),
  }
}

async function queryLowStock(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const warehouseId = asString(filters.warehouseId)
  const balances = await prisma.inventoryStockBalance.findMany({
    where: {
      tenantId,
      ...(warehouseId ? { warehouseId } : {}),
      item: { deletedAt: null, reorderLevel: { gt: 0 } },
    },
    select: {
      onHandQty: true,
      itemId: true,
      item: { select: { id: true, code: true, name: true, reorderLevel: true } },
    },
    take: 500,
  })
  const low = balances.filter((b) => asNumber(b.onHandQty) <= asNumber(b.item.reorderLevel))
  const items = low.slice(0, 20).map((b) => ({
    label: `${b.item.code} — ${b.item.name}`,
    value: asNumber(b.onHandQty),
    href: `/inventory/stock?itemId=${b.itemId}`,
  }))
  return {
    ...emptyWidgetData('Low stock', null),
    value: low.length,
    label: `${low.length} items at/below reorder`,
    items,
  }
}

async function queryActiveWo(tenantId: string): Promise<WidgetDataPayload> {
  const where: Prisma.ProductionOrderWhereInput = {
    tenantId,
    deletedAt: null,
    status: { in: ['READY', 'IN_PROGRESS', 'ON_HOLD'] },
  }
  const [count, grouped] = await Promise.all([
    prisma.productionOrder.count({ where }),
    prisma.productionOrder.groupBy({ by: ['status'], where, _count: true }),
  ])
  const statusCounts: Record<string, number> = {}
  for (const g of grouped) statusCounts[g.status] = g._count
  return {
    ...emptyWidgetData('Active work orders', null),
    value: count,
    statusCounts,
  }
}

async function queryDelayedWo(tenantId: string): Promise<WidgetDataPayload> {
  const today = startOfDayUtc(new Date())
  const where: Prisma.ProductionOrderWhereInput = {
    tenantId,
    deletedAt: null,
    status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] },
    OR: [{ healthStatus: 'DELAYED' }, { requiredCompletionDate: { lt: today } }],
  }
  const rows = await prisma.productionOrder.findMany({
    where,
    select: { id: true, orderNumber: true, requiredCompletionDate: true, healthStatus: true },
    orderBy: { requiredCompletionDate: 'asc' },
    take: 20,
  })
  return {
    ...emptyWidgetData('Delayed work orders', null),
    value: rows.length,
    label: `${rows.length} delayed`,
    items: rows.map((r) => ({
      label: r.orderNumber,
      value: r.healthStatus,
      href: `/manufacturing/work-orders/${r.id}`,
    })),
  }
}

async function queryProductionToday(tenantId: string): Promise<WidgetDataPayload> {
  const today = startOfDayUtc(new Date())
  const tomorrow = new Date(today)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const agg = await prisma.dailyProductionLine.aggregate({
    where: {
      tenantId,
      batch: { productionDate: { gte: today, lt: tomorrow } },
    },
    _sum: { goodQuantity: true, rejectedQuantity: true },
  })
  const good = asNumber(agg._sum.goodQuantity)
  return {
    ...emptyWidgetData('Production today', null),
    value: good,
    label: 'Good qty',
    progress: { current: good, target: good || 1, pct: good > 0 ? 100 : 0 },
  }
}

async function queryMaterialShortages(tenantId: string): Promise<WidgetDataPayload> {
  const where: Prisma.ProductionOrderMaterialWhereInput = {
    tenantId,
    OR: [{ status: 'SHORT' }, { shortageQty: { gt: 0 } }],
  }
  const [count, rows] = await Promise.all([
    prisma.productionOrderMaterial.count({ where }),
    prisma.productionOrderMaterial.findMany({
      where,
      select: {
        shortageQty: true,
        item: { select: { code: true, name: true } },
        productionOrder: { select: { id: true, orderNumber: true } },
      },
      take: 20,
      orderBy: { shortageQty: 'desc' },
    }),
  ])
  return {
    ...emptyWidgetData('Material shortages', null),
    value: count,
    items: rows.map((r) => ({
      label: `${r.item.code} (${r.productionOrder.orderNumber})`,
      value: asNumber(r.shortageQty),
      href: `/manufacturing/work-orders/${r.productionOrder.id}`,
    })),
  }
}

async function queryOpenNcr(tenantId: string): Promise<WidgetDataPayload> {
  const where: Prisma.QualityNcrWhereInput = {
    tenantId,
    status: { notIn: ['CLOSED', 'CANCELLED'] },
  }
  const [count, grouped] = await Promise.all([
    prisma.qualityNcr.count({ where }),
    prisma.qualityNcr.groupBy({ by: ['status'], where, _count: true }),
  ])
  const statusCounts: Record<string, number> = {}
  for (const g of grouped) statusCounts[g.status] = g._count
  return {
    ...emptyWidgetData('Open NCRs', null),
    value: count,
    statusCounts,
  }
}

async function queryRejections(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const { from, to } = resolveDateRange(filters)
  const agg = await prisma.dailyProductionLine.aggregate({
    where: {
      tenantId,
      batch: { productionDate: { gte: from, lte: to } },
    },
    _sum: { rejectedQuantity: true },
  })
  return {
    ...emptyWidgetData('Rejections', null),
    value: asNumber(agg._sum.rejectedQuantity),
    label: 'Rejected qty in period',
  }
}

async function queryPendingDispatch(tenantId: string): Promise<WidgetDataPayload> {
  const where: Prisma.DispatchRequirementWhereInput = {
    tenantId,
    deletedAt: null,
    status: 'ACTIVE',
    remainingQuantitySnapshot: { gt: 0 },
  }
  const [count, agg] = await Promise.all([
    prisma.dispatchRequirement.count({ where }),
    prisma.dispatchRequirement.aggregate({ where, _sum: { remainingQuantitySnapshot: true } }),
  ])
  return {
    ...emptyWidgetData('Pending dispatch', null),
    value: count,
    label: `${asNumber(agg._sum.remainingQuantitySnapshot)} qty remaining`,
  }
}

async function queryPurchaseCommitments(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const vendorId = asString(filters.vendorId)
  const where: Prisma.PurchaseOrderWhereInput = {
    tenantId,
    deletedAt: null,
    status: {
      notIn: ['DRAFT', 'CANCELLED', 'CLOSED', 'REJECTED', 'SENT_BACK'],
    },
    ...(vendorId ? { vendorId } : {}),
  }
  const [agg, count] = await Promise.all([
    prisma.purchaseOrder.aggregate({ where, _sum: { totalAmount: true } }),
    prisma.purchaseOrder.count({ where }),
  ])
  return {
    ...emptyWidgetData('Purchase commitments', 'INR'),
    value: asNumber(agg._sum.totalAmount),
    label: `${count} open POs`,
  }
}

async function queryTopCustomers(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const { from, to } = resolveDateRange(filters)
  const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 50)
  const rows = await prisma.crmTaxInvoice.groupBy({
    by: ['companyId'],
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['posted', 'partially_paid', 'paid'] },
      invoiceDate: { gte: from, lte: to },
    },
    _sum: { grandTotal: true },
    orderBy: { _sum: { grandTotal: 'desc' } },
    take: limit,
  })
  const companyIds = rows.map((r) => r.companyId)
  const companies = companyIds.length
    ? await prisma.crmCompany.findMany({
        where: { tenantId, id: { in: companyIds } },
        select: { id: true, name: true },
      })
    : []
  const nameById = new Map(companies.map((c) => [c.id, c.name]))
  return {
    ...emptyWidgetData('Top customers', 'INR'),
    value: rows.length,
    items: rows.map((r) => ({
      label: nameById.get(r.companyId) ?? r.companyId,
      value: asNumber(r._sum.grandTotal),
      href: `/crm/companies/${r.companyId}`,
    })),
  }
}

async function queryTopProducts(tenantId: string, filters: Record<string, unknown>): Promise<WidgetDataPayload> {
  const { from, to } = resolveDateRange(filters)
  const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 50)
  const lines = await prisma.crmTaxInvoiceLine.findMany({
    where: {
      tenantId,
      deletedAt: null,
      invoice: {
        tenantId,
        deletedAt: null,
        status: { in: ['posted', 'partially_paid', 'paid'] },
        invoiceDate: { gte: from, lte: to },
      },
    },
    select: { itemCode: true, description: true, qty: true, lineTotal: true },
    take: 5000,
  })
  const map = new Map<string, { label: string; qty: number; value: number }>()
  for (const line of lines) {
    const key = line.itemCode || line.description
    const cur = map.get(key) ?? { label: line.description || line.itemCode, qty: 0, value: 0 }
    cur.qty += asNumber(line.qty)
    cur.value += asNumber(line.lineTotal)
    map.set(key, cur)
  }
  const ranked = [...map.values()].sort((a, b) => b.value - a.value).slice(0, limit)
  return {
    ...emptyWidgetData('Top products', 'INR'),
    value: ranked.length,
    items: ranked.map((r) => ({ label: r.label, value: r.value })),
  }
}

async function queryExecutiveAlerts(tenantId: string): Promise<WidgetDataPayload> {
  const today = startOfDayUtc(new Date())
  const [overdueAr, delayedWo, lowStockBalances, openNcr, shortages, pendingDispatch] = await Promise.all([
    prisma.crmTaxInvoice.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['posted', 'partially_paid'] },
        balanceDue: { gt: 0 },
        dueDate: { lt: today },
      },
    }),
    prisma.productionOrder.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] },
        OR: [{ healthStatus: 'DELAYED' }, { requiredCompletionDate: { lt: today } }],
      },
    }),
    prisma.inventoryStockBalance.findMany({
      where: { tenantId, item: { deletedAt: null, reorderLevel: { gt: 0 } } },
      select: { onHandQty: true, item: { select: { reorderLevel: true } } },
      take: 2000,
    }),
    prisma.qualityNcr.count({ where: { tenantId, status: { notIn: ['CLOSED', 'CANCELLED'] } } }),
    prisma.productionOrderMaterial.count({
      where: { tenantId, OR: [{ status: 'SHORT' }, { shortageQty: { gt: 0 } }] },
    }),
    prisma.dispatchRequirement.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        remainingQuantitySnapshot: { gt: 0 },
      },
    }),
  ])
  const lowStock = lowStockBalances.filter(
    (b) => asNumber(b.onHandQty) <= asNumber(b.item.reorderLevel),
  ).length

  const alerts = [
    overdueAr > 0
      ? {
          severity: 'critical' as const,
          message: `${overdueAr} overdue receivable invoice(s)`,
          href: '/crm/commercial/invoices',
          count: overdueAr,
        }
      : null,
    delayedWo > 0
      ? {
          severity: 'warning' as const,
          message: `${delayedWo} delayed work order(s)`,
          href: '/manufacturing/work-orders',
          count: delayedWo,
        }
      : null,
    lowStock > 0
      ? {
          severity: 'warning' as const,
          message: `${lowStock} low-stock item(s)`,
          href: '/inventory/stock',
          count: lowStock,
        }
      : null,
    openNcr > 0
      ? {
          severity: 'warning' as const,
          message: `${openNcr} open NCR(s)`,
          href: '/quality/ncr',
          count: openNcr,
        }
      : null,
    shortages > 0
      ? {
          severity: 'critical' as const,
          message: `${shortages} material shortage line(s)`,
          href: '/manufacturing/materials',
          count: shortages,
        }
      : null,
    pendingDispatch > 0
      ? {
          severity: 'info' as const,
          message: `${pendingDispatch} pending dispatch requirement(s)`,
          href: '/dispatch/requirements',
          count: pendingDispatch,
        }
      : null,
  ].filter(Boolean) as WidgetDataPayload['alerts']

  return {
    ...emptyWidgetData('Executive alerts', null),
    value: alerts.length,
    alerts,
  }
}

async function resolveWidgetData(
  tenantId: string,
  widgetKey: string,
  filters: Record<string, unknown>,
): Promise<WidgetDataPayload> {
  switch (widgetKey) {
    case 'finance.revenue':
      return queryRevenue(tenantId, filters)
    case 'sales.order_book':
      return queryOrderBook(tenantId, filters)
    case 'sales.order_intake':
      return queryOrderIntake(tenantId, filters)
    case 'finance.receivables':
      return queryReceivables(tenantId, filters)
    case 'finance.overdue_receivables':
      return queryOverdueReceivables(tenantId, filters)
    case 'finance.payables':
      return queryPayables(tenantId, filters)
    case 'finance.cash_position':
      return queryCashPosition(tenantId, filters)
    case 'inventory.value':
      return queryInventoryValue(tenantId, filters)
    case 'inventory.low_stock':
      return queryLowStock(tenantId, filters)
    case 'manufacturing.active_wo':
      return queryActiveWo(tenantId)
    case 'manufacturing.delayed_wo':
      return queryDelayedWo(tenantId)
    case 'manufacturing.production_today':
      return queryProductionToday(tenantId)
    case 'manufacturing.material_shortages':
      return queryMaterialShortages(tenantId)
    case 'quality.ncr_open':
      return queryOpenNcr(tenantId)
    case 'quality.rejections':
      return queryRejections(tenantId, filters)
    case 'dispatch.pending':
      return queryPendingDispatch(tenantId)
    case 'purchase.commitments':
      return queryPurchaseCommitments(tenantId, filters)
    case 'crm.top_customers':
      return queryTopCustomers(tenantId, filters)
    case 'sales.top_products':
      return queryTopProducts(tenantId, filters)
    case 'executive.alerts':
      return queryExecutiveAlerts(tenantId)
    default:
      return unavailableWidgetData(`Unknown widget: ${widgetKey}`)
  }
}

export async function queryWidget(
  tenantId: string,
  permissions: readonly string[],
  input: WidgetQueryInput,
): Promise<WidgetQueryResult> {
  const def = getWidgetDefinition(input.widgetKey)
  const visualization: WidgetVisualization =
    input.visualization ?? def?.defaultVisualization ?? 'KPI'
  const title = def?.name ?? input.widgetKey
  const drillDownPath = def?.drillDownPath ?? null

  if (!def) {
    return failResult(input.widgetKey, visualization, title, null, `Unknown widget: ${input.widgetKey}`)
  }

  if (!permissionSetIncludes(permissions, def.permission)) {
    return failResult(
      input.widgetKey,
      visualization,
      title,
      drillDownPath,
      `Missing permission: ${def.permission}`,
    )
  }

  try {
    const filters = mergeFilters(input)
    const data = await resolveWidgetData(tenantId, input.widgetKey, filters)
    return okResult(input.widgetKey, visualization, title, drillDownPath, data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Widget query failed'
    // Per-widget failure: do not throw; return empty payload with ok:true
    return {
      widgetKey: input.widgetKey,
      visualization,
      title,
      drillDownPath,
      data: unavailableWidgetData(message, title),
      ok: true,
      error: message,
    }
  }
}

export async function queryWidgetsBatch(
  tenantId: string,
  permissions: readonly string[],
  queries: WidgetQueryInput[],
): Promise<WidgetQueryResult[]> {
  const results: WidgetQueryResult[] = []
  for (const q of queries) {
    results.push(await queryWidget(tenantId, permissions, q))
  }
  return results
}
