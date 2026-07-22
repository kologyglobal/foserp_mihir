import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { logProductionActivity } from '../../manufacturing/shared/activity.service.js'
import { mapNcr } from '../shared/mappers.js'
import * as repo from './ncr.repository.js'
import type { CloseNcrInput, ListNcrsQuery } from './ncr.schemas.js'

const OPEN_STATUSES = ['OPEN', 'INVESTIGATING', 'CORRECTIVE_ACTION', 'APPROVED'] as const

export async function listNcrs(tenantId: string, query: ListNcrsQuery) {
  const result = await repo.listNcrs(tenantId, query)
  return { ...result, items: result.items.map(mapNcr) }
}

export async function getNcr(tenantId: string, id: string) {
  const row = await repo.getNcr(tenantId, id)
  if (!row) throw new NotFoundError('NCR not found')
  return mapNcr(row)
}

export async function closeNcr(req: Request, tenantId: string, id: string, input: CloseNcrInput) {
  const userId = req.context?.userId ?? ''
  const ncr = await repo.getNcr(tenantId, id)
  if (!ncr) throw new NotFoundError('NCR not found')
  if (!OPEN_STATUSES.includes(ncr.status as (typeof OPEN_STATUSES)[number])) {
    throw new InvalidStateError(`NCR cannot be closed from ${ncr.status} status`)
  }

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.qualityNcr.update({
      where: { id, tenantId },
      data: {
        status: 'CLOSED',
        closedByUserId: userId,
        closedAt: now,
        closureNotes: input.closureNotes ?? null,
        updatedBy: userId,
      },
    })

    if (ncr.productionOrderId) {
      const openNcrs = await tx.qualityNcr.count({
        where: {
          tenantId,
          productionOrderId: ncr.productionOrderId,
          status: { in: [...OPEN_STATUSES] },
          id: { not: id },
        },
      })
      const order = await tx.productionOrder.findFirst({ where: { id: ncr.productionOrderId, tenantId } })
      if (order && openNcrs === 0 && order.qualityStatus === 'HOLD') {
        const passedFinal = await tx.manufacturingQualityInspection.findFirst({
          where: { tenantId, productionOrderId: ncr.productionOrderId, category: 'FINAL', status: 'PASSED' },
        })
        await tx.productionOrder.update({
          where: { id: ncr.productionOrderId, tenantId },
          data: { qualityStatus: passedFinal ? 'PASSED' : order.qualityStatus === 'HOLD' ? 'IN_QC' : order.qualityStatus },
        })
      }

      await logProductionActivity(
        {
          tenantId,
          productionOrderId: ncr.productionOrderId,
          activityType: 'NCR_CLOSED',
          userId,
          message: `NCR ${ncr.ncrNumber} closed`,
          reason: input.closureNotes ?? null,
        },
        tx,
      )
    }

    return row
  })

  return mapNcr(updated)
}

async function updateNcr(req: Request, tenantId: string, id: string, data: Prisma.QualityNcrUpdateInput) {
  const ncr = await repo.getNcr(tenantId, id)
  if (!ncr) throw new NotFoundError('NCR not found')
  return mapNcr(await prisma.qualityNcr.update({ where: { id }, data: { ...data, updatedBy: req.context?.userId ?? '' } }))
}
export function dispositionNcr(req: Request, tenantId: string, id: string, input: Record<string, unknown>) {
  return updateNcr(req, tenantId, id, { ...(input as Prisma.QualityNcrUpdateInput), targetDate: input.targetDate ? new Date(String(input.targetDate)) : undefined, status: 'ACTION_IN_PROGRESS' })
}
export function submitAction(req: Request, tenantId: string, id: string, input: Record<string, unknown>) {
  return updateNcr(req, tenantId, id, { ...(input as Prisma.QualityNcrUpdateInput), status: 'VERIFICATION_PENDING' })
}
export function verifyNcr(req: Request, tenantId: string, id: string, input: Record<string, unknown>) {
  return updateNcr(req, tenantId, id, { ...(input as Prisma.QualityNcrUpdateInput), status: 'APPROVED' })
}
