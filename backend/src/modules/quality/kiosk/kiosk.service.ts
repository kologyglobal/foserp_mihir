import { Prisma } from '@prisma/client'
import { listInspections, getInspection } from '../inspections/inspection.service.js'
import type { ListInspectionsQuery } from '../inspections/inspection.schemas.js'

export type KioskInspectionCard = {
  id: string
  inspectionNumber: string
  category: string
  status: string
  title: string
  productionOrderId: string | null
  stageId: string | null
  itemId: string | null
  inspectedQty: string | null
  requestedAt: string
  planCode: string | null
  planName: string | null
}

function isMissingTableError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021'
}

const EMPTY_QUEUE = {
  items: [] as KioskInspectionCard[],
  summary: { openCount: 0, pendingCount: 0, reworkCount: 0 },
}

/** Pending + rework manufacturing QC for kiosk queue. */
export async function listQcKioskQueue(
  tenantId: string,
  query?: { limit?: number; category?: ListInspectionsQuery['category']; productionOrderId?: string },
) {
  try {
    const limit = query?.limit ?? 100
    const base = {
      page: 1,
      limit,
      sortOrder: 'desc' as const,
      ...(query?.category ? { category: query.category } : {}),
      ...(query?.productionOrderId ? { productionOrderId: query.productionOrderId } : {}),
    }
    const [pending, rework] = await Promise.all([
      listInspections(tenantId, { ...base, status: 'PENDING' }),
      listInspections(tenantId, { ...base, status: 'REWORK', limit: Math.min(50, limit) }),
    ])

    const merged = [...pending.items, ...rework.items].filter(
      (i) => i.category === 'IN_PROCESS' || i.category === 'FINAL' || i.category === 'INCOMING',
    )

    const items: KioskInspectionCard[] = merged.map((insp) => ({
      id: insp.id,
      inspectionNumber: insp.inspectionNumber,
      category: insp.category,
      status: insp.status,
      title: insp.title,
      productionOrderId: insp.productionOrderId,
      stageId: insp.stageId,
      itemId: insp.itemId,
      inspectedQty: insp.inspectedQty ?? null,
      requestedAt: insp.requestedAt,
      planCode: insp.inspectionPlan?.planCode ?? null,
      planName: insp.inspectionPlan?.planName ?? null,
    }))

    return {
      items,
      summary: {
        openCount: items.length,
        pendingCount: items.filter((i) => i.status === 'PENDING').length,
        reworkCount: items.filter((i) => i.status === 'REWORK').length,
      },
    }
  } catch (err) {
    if (isMissingTableError(err)) return EMPTY_QUEUE
    throw err
  }
}

export async function getQcKioskInspection(tenantId: string, id: string) {
  return getInspection(tenantId, id)
}
