/**
 * Service-level: WO complete must honour hard close-readiness blockers.
 * Avoids full BOM/routing fixture (operations now require workCentreId).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { Request } from 'express'
import { prisma } from '../src/config/database.js'
import {
  assertCompleteAllowed,
  getCloseReadiness,
} from '../src/modules/manufacturing/work-orders/close-readiness.service.js'
import { completeWorkOrder } from '../src/modules/manufacturing/work-orders/work-order-lifecycle.service.js'
import { AppError } from '../src/utils/errors.js'

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

function fakeReq(userId: string): Request {
  return { context: { userId } } as unknown as Request
}

describe.skipIf(!dbAvailable)('WO complete close-readiness hard gate (service)', () => {
  const tenantId = randomUUID()
  const userId = randomUUID()
  const stageGroupId = randomUUID()
  let itemId = ''
  let warehouseId = ''
  let uomId = ''
  let categoryId = ''
  let profileId = ''
  let bomId = ''
  let bomVersionId = ''
  let orderId = ''

  beforeAll(async () => {
    const stamp = Date.now()
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'WO Close Gate',
        slug: `wo-close-gate-${stamp}`,
        email: `wo-close-gate-${stamp}@test.com`,
        status: 'ACTIVE',
      },
    })
    await prisma.user.create({
      data: {
        id: userId,
        tenantId,
        email: `admin-${stamp}@wo-close-gate.test`,
        passwordHash: 'x',
        firstName: 'Gate',
        lastName: 'Tester',
        status: 'ACTIVE',
      },
    })

    categoryId = (
      await prisma.masterItemCategory.create({
        data: { tenantId, code: `CAT${stamp}`.slice(-16), name: 'Gate Category' },
      })
    ).id
    uomId = (
      await prisma.masterUom.create({
        data: { tenantId, code: `EA${stamp}`.slice(-16), name: 'Each', uomType: 'integer', isBaseUnit: true },
      })
    ).id
    warehouseId = (
      await prisma.masterWarehouse.create({
        data: { tenantId, code: `WH${stamp}`.slice(-16), name: 'Gate WH' },
      })
    ).id
    itemId = (
      await prisma.masterItem.create({
        data: {
          tenantId,
          code: `FG${stamp}`.slice(-24),
          name: 'Gate FG',
          categoryId,
          baseUomId: uomId,
          itemType: 'finished_good',
        },
      })
    ).id

    bomId = (
      await prisma.manufacturingBom.create({
        data: {
          tenantId,
          code: `BOM${stamp}`.slice(-24),
          name: 'Gate BOM',
          productItemId: itemId,
          createdBy: userId,
        },
      })
    ).id
    bomVersionId = (
      await prisma.manufacturingBomVersion.create({
        data: {
          tenantId,
          bomId,
          versionNumber: 1,
          revisionCode: 'A',
          status: 'ACTIVE',
          effectiveFrom: new Date(),
          baseQuantity: 1,
          baseUomId: uomId,
          createdBy: userId,
        },
      })
    ).id
    profileId = (
      await prisma.manufacturingProfile.create({
        data: {
          tenantId,
          code: `PROF${stamp}`.slice(-24),
          name: 'Gate Profile',
          productItemId: itemId,
          productionType: 'ASSEMBLY',
          defaultBomVersionId: bomVersionId,
          finishedGoodsWarehouseId: warehouseId,
          isActive: true,
          createdBy: userId,
        },
      })
    ).id

    await prisma.manufacturingSettings.create({
      data: {
        tenantId,
        allowCloseWithoutQc: false,
        payloadJson: {
          general: { flexibleExecution: false, allowCloseWithoutQc: false },
        },
      },
    })

    orderId = (
      await prisma.productionOrder.create({
        data: {
          tenantId,
          orderNumber: `WO-GATE-${stamp}`,
          sourceType: 'MANUAL',
          productItemId: itemId,
          manufacturingProfileId: profileId,
          bomVersionId,
          plannedQuantity: 1,
          completedGoodQuantity: 1,
          uomId,
          requiredCompletionDate: new Date(Date.now() + 86400000),
          status: 'IN_PROGRESS',
          qualityStatus: 'NOT_APPLICABLE',
          createdBy: userId,
        },
      })
    ).id

    await prisma.productionOrderStage.create({
      data: {
        tenantId,
        productionOrderId: orderId,
        sourceStageGroupId: stageGroupId,
        name: 'Final',
        code: 'ST-FINAL',
        displayOrder: 1,
        status: 'COMPLETED',
        plannedQuantity: 1,
        goodQuantity: 1,
        isOptional: false,
        completedAt: new Date(),
      },
    })
  }, 60_000)

  afterAll(async () => {
    await prisma.inventoryStockReservation.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.productionFinishedGoodsReceipt.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.inventoryStockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.inventoryStockBalance.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.productionActivity.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.productionOrderStage.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.productionOrder.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.manufacturingSettings.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.manufacturingProfile.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.manufacturingBomVersion.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.manufacturingBom.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.masterItem.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.masterWarehouse.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.masterUom.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.masterItemCategory.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {})
  })

  it('exposes hard vs soft in readiness; blocks complete on OPEN_RESERVATIONS; succeeds when cleared', async () => {
    const closeMode = await getCloseReadiness(tenantId, orderId)
    expect(closeMode.purpose).toBe('CLOSE')
    expect(closeMode.blockers.some((b) => b.code === 'OPERATIONAL_STATUS')).toBe(true)

    const completeMode = await getCloseReadiness(tenantId, orderId, { allowInProgress: true })
    expect(completeMode.purpose).toBe('COMPLETE')
    expect(completeMode.blockers.some((b) => b.code === 'OPERATIONAL_STATUS')).toBe(false)
    expect(Array.isArray(completeMode.warnings)).toBe(true)

    const forced = await prisma.inventoryStockReservation.create({
      data: {
        tenantId,
        reservationNumber: `RES-GATE-${Date.now()}`,
        itemId,
        warehouseId,
        quantity: 1,
        demandType: 'WO',
        demandId: orderId,
        status: 'ACTIVE',
        remarks: 'forced hard blocker',
        idempotencyKey: `gate-${orderId}`,
        createdBy: userId,
      },
    })

    const blockedReadiness = await getCloseReadiness(tenantId, orderId, { allowInProgress: true })
    expect(blockedReadiness.readyToClose).toBe(false)
    expect(blockedReadiness.blockers.some((b) => b.code === 'OPEN_RESERVATIONS')).toBe(true)

    await expect(assertCompleteAllowed(tenantId, orderId)).rejects.toMatchObject({
      code: 'WO_COMPLETE_BLOCKED',
      statusCode: 409,
    })

    try {
      await completeWorkOrder(fakeReq(userId), tenantId, orderId, { remarks: 'should fail' })
      expect.unreachable('complete should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).code).toBe('WO_COMPLETE_BLOCKED')
      expect((err as AppError).details?.blockers).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'OPEN_RESERVATIONS' })]),
      )
    }

    await prisma.inventoryStockReservation.update({
      where: { id: forced.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: userId },
    })

    await prisma.manufacturingSettings.update({
      where: { tenantId },
      data: {
        allowCloseWithoutQc: true,
        payloadJson: { general: { flexibleExecution: true, allowCloseWithoutQc: true } },
      },
    })

    const ready = await assertCompleteAllowed(tenantId, orderId)
    expect(ready.readyToClose).toBe(true)
    expect(ready.blockers).toHaveLength(0)

    const result = await completeWorkOrder(fakeReq(userId), tenantId, orderId, { remarks: 'ok' })
    expect(result.order.status).toBe('COMPLETED')
  }, 60_000)
})
