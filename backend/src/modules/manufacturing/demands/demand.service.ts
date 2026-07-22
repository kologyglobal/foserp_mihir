import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import { assertItem, assertUom } from '../shared/manufacturing.helpers.js'
import { toDecimal } from '../shared/quantity.service.js'
import * as repo from './demand.repository.js'
import type { CancelDemandInput, CreateManualDemandInput, ListDemandsQuery } from './demand.schemas.js'

async function audit(req: Request, tenantId: string, entityId: string, action: string, oldValues: unknown, newValues: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity: 'productionDemand',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

export async function listDemands(tenantId: string, query: ListDemandsQuery) {
  return repo.listDemands(tenantId, query)
}

export async function getDemand(tenantId: string, demandId: string) {
  return repo.getDemand(tenantId, demandId)
}

export async function createManualDemand(req: Request, tenantId: string, input: CreateManualDemandInput) {
  const userId = req.context?.userId ?? ''

  if (input.idempotencyKey) {
    const existing = await repo.findDemandByIdempotencyKey(tenantId, input.idempotencyKey)
    if (existing) return existing
  }

  await assertItem(tenantId, input.productItemId)
  await assertUom(tenantId, input.uomId)

  const demandNumber = await nextCode(tenantId, 'PRODUCTION_DEMAND')
  const requestedQuantity = toDecimal(input.requestedQuantity)

  try {
    const created = await repo.createDemand({
      tenantId,
      demandNumber,
      sourceType: 'MANUAL',
      productItemId: input.productItemId,
      requestedQuantity,
      convertedQuantity: new Prisma.Decimal(0),
      remainingQuantity: requestedQuantity,
      cancelledQuantity: new Prisma.Decimal(0),
      uomId: input.uomId,
      requiredDate: input.requiredDate ? new Date(input.requiredDate) : null,
      priority: input.priority,
      plantCode: input.plantCode ?? null,
      customerId: input.customerId ?? null,
      projectRef: input.projectRef ?? null,
      status: 'OPEN',
      idempotencyKey: input.idempotencyKey ?? null,
      createdBy: userId,
      updatedBy: userId,
    })
    await audit(req, tenantId, created.id, 'CREATE', undefined, created)
    return created
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ValidationError('A production demand with this idempotency key already exists')
    }
    throw err
  }
}

export async function cancelDemand(req: Request, tenantId: string, demandId: string, input: CancelDemandInput) {
  const userId = req.context?.userId ?? ''
  const demand = await repo.getDemand(tenantId, demandId)
  if (demand.status === 'FULLY_CONVERTED' || demand.status === 'CANCELLED') {
    throw new InvalidStateError(`Cannot cancel a demand in ${demand.status} status`)
  }
  const remaining = toDecimal(demand.remainingQuantity)
  const updated = await prisma.productionDemand.update({
    where: { id: demandId, tenantId },
    data: {
      status: 'CANCELLED',
      cancelledQuantity: toDecimal(demand.cancelledQuantity).plus(remaining),
      remainingQuantity: new Prisma.Decimal(0),
      updatedBy: userId,
    },
  })
  await audit(req, tenantId, demandId, 'CANCEL', demand, { ...updated, reason: input.reason ?? null })
  return updated
}
