import type { Prisma, ProductionOrder } from '@prisma/client'

/** Decimal → string for API responses (never leak Prisma.Decimal / lose precision as number). */
export function dec(value: Prisma.Decimal | number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value.toString()
}

export function isoDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString()
}

export function dateOnly(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

/**
 * Shared ProductionOrder (Work Order) response mapper. Exposes both `orderNumber` (Prisma field)
 * and `workOrderNo` (UI label alias) per Phase 2A API contract.
 */
export function mapProductionOrder(row: ProductionOrder) {
  return {
    ...row,
    workOrderNo: row.orderNumber,
    plannedQuantity: dec(row.plannedQuantity),
    completedGoodQuantity: dec(row.completedGoodQuantity),
    reworkQuantity: dec(row.reworkQuantity),
    rejectedQuantity: dec(row.rejectedQuantity),
    scrapQuantity: dec(row.scrapQuantity),
    completionPercent: dec(row.completionPercent),
    plannedStartDate: isoDate(row.plannedStartDate),
    requiredCompletionDate: isoDate(row.requiredCompletionDate),
    actualStartAt: isoDate(row.actualStartAt),
    actualCompletedAt: isoDate(row.actualCompletedAt),
    holdExpectedResumeAt: isoDate(row.holdExpectedResumeAt),
    releasedAt: isoDate(row.releasedAt),
  }
}

type ProductionOrderListRow = ProductionOrder & {
  productItem?: { code: string; name: string } | null
  salesOrder?: {
    salesOrderNo: string
    customerCode: string | null
    company?: { name: string; companyCode: string | null } | null
  } | null
  stages?: Array<{ id: string; name: string; code: string; status: string }>
}

/** List/register payload — includes human-readable product, customer, and stage labels. */
export function mapProductionOrderListItem(row: ProductionOrderListRow, supervisorName?: string | null) {
  const { productItem, salesOrder, stages, ...order } = row
  const currentStage =
    (row.currentStageId ? stages?.find((s) => s.id === row.currentStageId) : null) ??
    stages?.find((s) => s.status === 'IN_PROGRESS') ??
    null

  return {
    ...mapProductionOrder(order),
    productItemCode: productItem?.code ?? null,
    productItemName: productItem?.name ?? null,
    salesOrderNo: salesOrder?.salesOrderNo ?? null,
    customerName: salesOrder?.company?.name ?? null,
    customerCode: salesOrder?.company?.companyCode ?? salesOrder?.customerCode ?? null,
    currentStageName: currentStage?.name ?? null,
    currentStageCode: currentStage?.code ?? null,
    supervisorName: supervisorName ?? null,
  }
}
