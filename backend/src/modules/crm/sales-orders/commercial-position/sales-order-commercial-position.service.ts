import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { NotFoundError } from '../../../../utils/errors.js'
import type { SalesOrderLineDto } from '../sales-order.types.js'
import {
  getSalesOrderFulfilment,
  type SalesOrderFulfilmentDto,
} from '../fulfilment/sales-order-fulfilment.service.js'

function d(value: Prisma.Decimal | number | string | null | undefined): number {
  return value == null ? 0 : Number(value)
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function parseLines(value: unknown): SalesOrderLineDto[] {
  return Array.isArray(value) ? (value as SalesOrderLineDto[]) : []
}

function resolveOrderedAmount(order: { grandTotal: Prisma.Decimal | null }, lines: SalesOrderLineDto[]): number {
  if (order.grandTotal != null) return d(order.grandTotal)
  return roundMoney(lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0))
}

function computeDispatchedAmount(fulfilment: SalesOrderFulfilmentDto, lines: SalesOrderLineDto[]): number {
  let total = 0
  for (const fLine of fulfilment.lines) {
    if (fLine.netOrderedQty <= 0) continue
    const soLine = lines.find((l) => l.id === fLine.salesOrderLineId)
    if (!soLine) continue
    const lineValue = soLine.lineTotal ?? 0
    total += lineValue * (fLine.dispatchedQty / fLine.netOrderedQty)
  }
  return roundMoney(total)
}

export interface SalesOrderCommercialOpsDto {
  orderedQty: number
  cancelledQty: number
  netOrderedQty: number
  dispatchedQty: number
  remainingQty: number
  orderedAmount: number
  dispatchedAmount: number
}

export interface SalesOrderCommercialMoneyDto {
  orderedAmount: number
  dispatchedAmount: number
  invoicedAmount: number
  collectedAmount: number
  outstandingAmount: number
  nextPaymentDueDate: string | null
  nextPaymentDueAmount: number | null
  postedInvoiceCount: number
  draftInvoiceCount: number
  activeDisputeCount: number
  disputedAmount: number
}

export interface SalesOrderCommercialPositionDto {
  salesOrderId: string
  salesOrderNo: string
  companyId: string
  status: string
  currencyCode: string
  ops: SalesOrderCommercialOpsDto
  money: SalesOrderCommercialMoneyDto | null
  moneyVisible: boolean
  fulfilment: SalesOrderFulfilmentDto
}

export interface CompanyCommercialPositionDto {
  companyId: string
  salesOrderCount: number
  ops: Omit<SalesOrderCommercialOpsDto, never>
  money: SalesOrderCommercialMoneyDto | null
  moneyVisible: boolean
}

async function loadPostedInvoiceTotalsForSalesOrder(
  tenantId: string,
  salesOrderId: string,
): Promise<{
  invoicedAmount: number
  outstandingAmount: number
  collectedAmount: number
  nextPaymentDueDate: string | null
  nextPaymentDueAmount: number | null
  postedInvoiceCount: number
  draftInvoiceCount: number
  activeDisputeCount: number
  disputedAmount: number
}> {
  const links = await prisma.salesInvoiceSourceLink.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      OR: [{ salesOrderId }, { sourceType: 'SALES_ORDER', sourceDocumentId: salesOrderId }],
      salesInvoice: { tenantId },
    },
    select: {
      salesInvoiceId: true,
      salesInvoice: {
        select: {
          status: true,
          totalAmount: true,
        },
      },
    },
  })

  const postedInvoiceIds = new Set<string>()
  const draftInvoiceIds = new Set<string>()
  let invoicedAmount = 0

  for (const link of links) {
    const inv = link.salesInvoice
    if (inv.status === 'POSTED') {
      if (!postedInvoiceIds.has(link.salesInvoiceId)) {
        postedInvoiceIds.add(link.salesInvoiceId)
        invoicedAmount += d(inv.totalAmount)
      }
    } else if (inv.status === 'DRAFT' || inv.status === 'READY_TO_POST') {
      draftInvoiceIds.add(link.salesInvoiceId)
    }
  }

  invoicedAmount = roundMoney(invoicedAmount)

  if (postedInvoiceIds.size === 0) {
    return {
      invoicedAmount: 0,
      outstandingAmount: 0,
      collectedAmount: 0,
      nextPaymentDueDate: null,
      nextPaymentDueAmount: null,
      postedInvoiceCount: 0,
      draftInvoiceCount: draftInvoiceIds.size,
      activeDisputeCount: 0,
      disputedAmount: 0,
    }
  }

  const openItems = await prisma.receivableOpenItem.findMany({
    where: {
      tenantId,
      side: 'DEBIT',
      salesInvoiceId: { in: [...postedInvoiceIds] },
    },
    select: {
      openAmount: true,
      originalAmount: true,
      dueDate: true,
    },
  })

  let outstandingAmount = 0
  let nextPaymentDueDate: string | null = null
  let nextPaymentDueAmount: number | null = null

  const dueCandidates: Array<{ dueDate: string; amount: number }> = []
  for (const item of openItems) {
    const open = d(item.openAmount)
    outstandingAmount += open
    if (open > 0 && item.dueDate) {
      dueCandidates.push({ dueDate: item.dueDate.toISOString().slice(0, 10), amount: open })
    }
  }
  outstandingAmount = roundMoney(outstandingAmount)
  dueCandidates.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.amount - a.amount)
  if (dueCandidates[0]) {
    nextPaymentDueDate = dueCandidates[0].dueDate
    nextPaymentDueAmount = roundMoney(dueCandidates[0].amount)
  }

  const collectedAmount = roundMoney(Math.max(0, invoicedAmount - outstandingAmount))

  const disputes = await prisma.arDispute.findMany({
    where: {
      tenantId,
      salesInvoiceId: { in: [...postedInvoiceIds] },
      deletedAt: null,
      status: { notIn: ['RESOLVED', 'REJECTED', 'CLOSED'] },
    },
    select: { disputedAmount: true },
  })
  const disputedAmount = roundMoney(disputes.reduce((sum, row) => sum + d(row.disputedAmount), 0))

  return {
    invoicedAmount,
    outstandingAmount,
    collectedAmount,
    nextPaymentDueDate,
    nextPaymentDueAmount,
    postedInvoiceCount: postedInvoiceIds.size,
    draftInvoiceCount: draftInvoiceIds.size,
    activeDisputeCount: disputes.length,
    disputedAmount,
  }
}

export function canViewCommercialMoney(permissions: string[] | undefined): boolean {
  const perms = permissions ?? []
  return (
    perms.includes('tenant.manage') ||
    perms.includes('finance.ar.view') ||
    perms.includes('finance.ar.invoice.view')
  )
}

export async function getSalesOrderCommercialPosition(
  tenantId: string,
  salesOrderId: string,
  moneyVisible: boolean,
): Promise<SalesOrderCommercialPositionDto> {
  const order = await prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, tenantId, deletedAt: null },
  })
  if (!order) throw new NotFoundError('Sales order not found')

  const lines = parseLines(order.lines)
  const fulfilment = await getSalesOrderFulfilment(tenantId, salesOrderId)
  const orderedAmount = resolveOrderedAmount(order, lines)
  const dispatchedAmount = computeDispatchedAmount(fulfilment, lines)

  const ops: SalesOrderCommercialOpsDto = {
    orderedQty: fulfilment.totals.orderedQty,
    cancelledQty: fulfilment.totals.cancelledQty,
    netOrderedQty: fulfilment.totals.netOrderedQty,
    dispatchedQty: fulfilment.totals.dispatchedQty,
    remainingQty: fulfilment.totals.remainingQty,
    orderedAmount,
    dispatchedAmount,
  }

  let money: SalesOrderCommercialMoneyDto | null = null
  if (moneyVisible) {
    const invoiceTotals = await loadPostedInvoiceTotalsForSalesOrder(tenantId, salesOrderId)
    money = {
      orderedAmount,
      dispatchedAmount,
      ...invoiceTotals,
    }
  }

  return {
    salesOrderId: order.id,
    salesOrderNo: order.salesOrderNo,
    companyId: order.companyId,
    status: order.status,
    currencyCode: 'INR',
    ops,
    money,
    moneyVisible,
    fulfilment,
  }
}

export async function getCompanyCommercialPosition(
  tenantId: string,
  companyId: string,
  moneyVisible: boolean,
): Promise<CompanyCommercialPositionDto> {
  const company = await prisma.crmCompany.findFirst({
    where: { id: companyId, tenantId, deletedAt: null },
    select: { id: true },
  })
  if (!company) throw new NotFoundError('Company not found')

  const orders = await prisma.crmSalesOrder.findMany({
    where: { tenantId, companyId, deletedAt: null },
    select: { id: true },
  })

  const ops: SalesOrderCommercialOpsDto = {
    orderedQty: 0,
    cancelledQty: 0,
    netOrderedQty: 0,
    dispatchedQty: 0,
    remainingQty: 0,
    orderedAmount: 0,
    dispatchedAmount: 0,
  }
  const money: SalesOrderCommercialMoneyDto = {
    orderedAmount: 0,
    dispatchedAmount: 0,
    invoicedAmount: 0,
    collectedAmount: 0,
    outstandingAmount: 0,
    nextPaymentDueDate: null,
    nextPaymentDueAmount: null,
    postedInvoiceCount: 0,
    draftInvoiceCount: 0,
    activeDisputeCount: 0,
    disputedAmount: 0,
  }
  const dueCandidates: Array<{ dueDate: string; amount: number }> = []

  for (const order of orders) {
    const position = await getSalesOrderCommercialPosition(tenantId, order.id, moneyVisible)
    ops.orderedQty += position.ops.orderedQty
    ops.cancelledQty += position.ops.cancelledQty
    ops.netOrderedQty += position.ops.netOrderedQty
    ops.dispatchedQty += position.ops.dispatchedQty
    ops.remainingQty += position.ops.remainingQty
    ops.orderedAmount = roundMoney(ops.orderedAmount + position.ops.orderedAmount)
    ops.dispatchedAmount = roundMoney(ops.dispatchedAmount + position.ops.dispatchedAmount)

    if (position.money) {
      money.orderedAmount = roundMoney(money.orderedAmount + position.money.orderedAmount)
      money.dispatchedAmount = roundMoney(money.dispatchedAmount + position.money.dispatchedAmount)
      money.invoicedAmount = roundMoney(money.invoicedAmount + position.money.invoicedAmount)
      money.collectedAmount = roundMoney(money.collectedAmount + position.money.collectedAmount)
      money.outstandingAmount = roundMoney(money.outstandingAmount + position.money.outstandingAmount)
      money.postedInvoiceCount += position.money.postedInvoiceCount
      money.draftInvoiceCount += position.money.draftInvoiceCount
      money.activeDisputeCount += position.money.activeDisputeCount
      money.disputedAmount = roundMoney(money.disputedAmount + position.money.disputedAmount)
      if (position.money.nextPaymentDueDate && position.money.nextPaymentDueAmount != null) {
        dueCandidates.push({
          dueDate: position.money.nextPaymentDueDate,
          amount: position.money.nextPaymentDueAmount,
        })
      }
    }
  }

  dueCandidates.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.amount - a.amount)
  if (dueCandidates[0]) {
    money.nextPaymentDueDate = dueCandidates[0].dueDate
    money.nextPaymentDueAmount = roundMoney(dueCandidates[0].amount)
  }

  return {
    companyId,
    salesOrderCount: orders.length,
    ops,
    money: moneyVisible ? money : null,
    moneyVisible,
  }
}
