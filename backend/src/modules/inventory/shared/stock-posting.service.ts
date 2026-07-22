import type {
  InventoryMovementType,
  InventoryReferenceType,
  InventoryStockStatus,
  InventoryStockMovement,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import {
  InventoryInsufficientStockError,
  InventoryItemBlockedError,
  InventoryItemNotStockableError,
  InventoryQuantityInvalidError,
  InventoryWarehouseInactiveError,
} from './inventory.errors.js'
import {
  applyMovementInTx,
  applyReservationDeltaInTx,
  applyStatusTransferInTx,
  freeQty,
  getOrCreateBalance,
} from './balance.service.js'
import { addDec, isPositive, subDec, toDecimal, type DecimalInput } from './quantity.helpers.js'

export interface PostStockMovementInput {
  tenantId: string
  itemId: string
  warehouseId: string
  movementType: InventoryMovementType
  referenceType: InventoryReferenceType
  quantity: DecimalInput
  movementDate?: Date
  workOrderId?: string
  sourceWorkOrderId?: string
  parentWorkOrderId?: string
  reservationId?: string
  /** Soft SO id — used to consume SO reservations on FG_DISPATCH. */
  salesOrderId?: string
  /** Dispatch line id — used to consume one or more DISPATCH reservations FIFO. */
  outboundDispatchLineId?: string
  referenceNo?: string
  remarks?: string
  idempotencyKey?: string
  rate?: DecimalInput
  createdBy?: string
  allowNegativeStock?: boolean
  consumeWoReservation?: boolean
  consumeSoReservation?: boolean
  stockStatus?: InventoryStockStatus
  batchId?: string
  batchNumber?: string
  lotNumber?: string
  heatNumber?: string
  manufacturingDate?: Date
  expiryDate?: Date
  serialId?: string
  serialNumber?: string
}

export interface TransferStockStatusInput {
  tenantId: string
  itemId: string
  warehouseId: string
  fromStockStatus: InventoryStockStatus
  stockStatus: InventoryStockStatus
  quantity: DecimalInput
  referenceType?: InventoryReferenceType
  referenceNo?: string
  remarks?: string
  idempotencyKey?: string
  batchId?: string
  batchNumber?: string
  serialId?: string
  serialNumber?: string
  createdBy?: string
}

async function validateItemAndWarehouse(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  warehouseId: string,
): Promise<{ batchTracked: boolean; serialTracked: boolean }> {
  const item = await tx.masterItem.findFirst({
    where: { id: itemId, tenantId, deletedAt: null },
    select: {
      id: true,
      isStockable: true,
      isBlocked: true,
      status: true,
      batchTracked: true,
      serialTracked: true,
    },
  })
  if (!item) throw new NotFoundError('Item not found')
  if (!item.isStockable) throw new InventoryItemNotStockableError()
  if (item.isBlocked) throw new InventoryItemBlockedError()
  if (item.status !== 'ACTIVE') throw new InventoryItemBlockedError('Item is not active')

  const warehouse = await tx.masterWarehouse.findFirst({
    where: { id: warehouseId, tenantId, deletedAt: null },
    select: { id: true, status: true },
  })
  if (!warehouse) throw new NotFoundError('Warehouse not found')
  if (warehouse.status !== 'ACTIVE') throw new InventoryWarehouseInactiveError()
  return { batchTracked: item.batchTracked, serialTracked: item.serialTracked }
}

async function resolveTrackingInTx(
  tx: Prisma.TransactionClient,
  input: PostStockMovementInput,
  signedQty: Prisma.Decimal,
  flags: { batchTracked: boolean; serialTracked: boolean },
) {
  const batchNumber = input.batchNumber?.trim()
  let batch = input.batchId
    ? await tx.inventoryBatch.findFirst({
        where: { id: input.batchId, tenantId: input.tenantId, itemId: input.itemId },
      })
    : batchNumber
      ? await tx.inventoryBatch.findFirst({
          where: { tenantId: input.tenantId, itemId: input.itemId, batchNumber },
        })
      : null
  if (flags.batchTracked && !batch && !batchNumber) {
    throw new InventoryQuantityInvalidError('Batch number is required for this item')
  }
  if (!batch && batchNumber && signedQty.greaterThan(0)) {
    batch = await tx.inventoryBatch.create({
      data: {
        tenantId: input.tenantId,
        itemId: input.itemId,
        batchNumber,
        lotNumber: input.lotNumber ?? null,
        heatNumber: input.heatNumber ?? null,
        manufacturingDate: input.manufacturingDate ?? null,
        expiryDate: input.expiryDate ?? null,
      },
    })
  }
  if ((input.batchId || batchNumber) && !batch) throw new NotFoundError('Inventory batch not found')

  const serialNumber = input.serialNumber?.trim()
  let serial = input.serialId
    ? await tx.inventorySerial.findFirst({
        where: { id: input.serialId, tenantId: input.tenantId, itemId: input.itemId },
      })
    : serialNumber
      ? await tx.inventorySerial.findFirst({
          where: { tenantId: input.tenantId, itemId: input.itemId, serialNumber },
        })
      : null
  const serialExisted = Boolean(serial)
  if (flags.serialTracked && !serial && !serialNumber) {
    throw new InventoryQuantityInvalidError('Serial number is required for this item')
  }
  if ((flags.serialTracked || serialNumber || input.serialId) && !signedQty.abs().equals(1)) {
    throw new InventoryQuantityInvalidError('A serial movement quantity must equal 1')
  }
  if (!serial && serialNumber && signedQty.greaterThan(0)) {
    serial = await tx.inventorySerial.create({
      data: {
        tenantId: input.tenantId,
        itemId: input.itemId,
        serialNumber,
        batchId: batch?.id ?? null,
        warehouseId: input.warehouseId,
        stockStatus: input.stockStatus ?? 'UNRESTRICTED',
        status: input.stockStatus === 'QC_HOLD' ? 'QC_HOLD' : 'AVAILABLE',
        sourceReferenceType: input.referenceType,
        sourceReferenceNo: input.referenceNo ?? null,
      },
    })
  }
  if ((input.serialId || serialNumber) && !serial) throw new NotFoundError('Inventory serial not found')
  if (
    signedQty.greaterThan(0) &&
    serialExisted &&
    serial &&
    serial.status !== 'ISSUED' &&
    input.referenceType !== 'TRANSFER_RECEIPT'
  ) {
    throw new InventoryQuantityInvalidError('Serial number is already in stock')
  }
  if (signedQty.lessThan(0) && serial && serial.warehouseId !== input.warehouseId) {
    throw new InventoryInsufficientStockError('Serial is not available in this warehouse')
  }
  return { batch, serial }
}

async function updateTrackingPositionsInTx(
  tx: Prisma.TransactionClient,
  input: PostStockMovementInput,
  signedQty: Prisma.Decimal,
  batch: Awaited<ReturnType<typeof resolveTrackingInTx>>['batch'],
  serial: Awaited<ReturnType<typeof resolveTrackingInTx>>['serial'],
  movementId: string,
) {
  const stockStatus = input.stockStatus ?? 'UNRESTRICTED'
  if (batch) {
    const position = await tx.inventoryBatchBalance.upsert({
      where: {
        tenantId_batchId_warehouseId_stockStatus: {
          tenantId: input.tenantId,
          batchId: batch.id,
          warehouseId: input.warehouseId,
          stockStatus,
        },
      },
      create: {
        tenantId: input.tenantId,
        batchId: batch.id,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        stockStatus,
        quantity: signedQty,
      },
      update: { quantity: { increment: signedQty } },
    })
    if (position.quantity.lessThan(0)) throw new InventoryInsufficientStockError('Insufficient batch quantity')
  }
  if (serial) {
    const inward = signedQty.greaterThan(0)
    const status = !inward
      ? 'ISSUED'
      : stockStatus === 'QC_HOLD'
        ? 'QC_HOLD'
        : stockStatus === 'BLOCKED'
          ? 'BLOCKED'
          : stockStatus === 'REJECTED'
            ? 'REJECTED'
            : 'AVAILABLE'
    await tx.inventorySerial.update({
      where: { id: serial.id },
      data: {
        warehouseId: inward ? input.warehouseId : null,
        stockStatus,
        status,
        batchId: batch?.id ?? serial.batchId,
      },
    })
    await tx.inventorySerialMovement.create({
      data: {
        tenantId: input.tenantId,
        serialId: serial.id,
        movementId,
        warehouseId: input.warehouseId,
        stockStatus,
        quantity: signedQty,
      },
    })
  }
}

function resolveSignedQuantity(
  movementType: InventoryMovementType,
  quantity: Prisma.Decimal,
): Prisma.Decimal {
  if (movementType === 'ADJUSTMENT') {
    if (quantity.isZero()) throw new InventoryQuantityInvalidError('Adjustment quantity must be non-zero')
    return quantity
  }
  if (movementType === 'OPENING' || movementType === 'INWARD') {
    if (!isPositive(quantity)) throw new InventoryQuantityInvalidError('Inward quantity must be positive')
    return quantity
  }
  if (movementType === 'ISSUE') {
    if (!isPositive(quantity)) throw new InventoryQuantityInvalidError('Issue quantity must be positive')
    return quantity.negated()
  }
  throw new InventoryQuantityInvalidError(`Unsupported movement type: ${movementType}`)
}

async function findActiveWoReservation(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  warehouseId: string,
  workOrderId: string,
) {
  return tx.inventoryStockReservation.findFirst({
    where: {
      tenantId,
      itemId,
      warehouseId,
      demandType: 'WO',
      demandId: workOrderId,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'asc' },
  })
}

async function findActiveSoReservation(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  warehouseId: string,
  salesOrderId: string,
) {
  return tx.inventoryStockReservation.findFirst({
    where: {
      tenantId,
      itemId,
      warehouseId,
      demandType: 'SO',
      demandId: salesOrderId,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'asc' },
  })
}

async function findActiveDispatchReservations(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  warehouseId: string,
  outboundDispatchLineId: string,
) {
  return tx.inventoryStockReservation.findMany({
    where: {
      tenantId,
      itemId,
      warehouseId,
      demandType: 'DISPATCH',
      status: 'ACTIVE',
      OR: [
        { outboundDispatchLineId },
        { demandId: outboundDispatchLineId },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
}

function getReservationRemaining(reservation: {
  quantity: Prisma.Decimal
  fulfilledQty: Prisma.Decimal
  releasedQty: Prisma.Decimal
}): Prisma.Decimal {
  const remaining = subDec(subDec(reservation.quantity, reservation.fulfilledQty), reservation.releasedQty)
  return remaining.greaterThan(0) ? remaining : toDecimal(0)
}

function availableForNegativeMovement(
  balance: {
    onHandQty: Prisma.Decimal
    reservedQty: Prisma.Decimal
    qcHoldQty: Prisma.Decimal
    blockedQty: Prisma.Decimal
    rejectedQty: Prisma.Decimal
  },
  reservationRemaining: Prisma.Decimal,
  stockStatus: InventoryStockStatus,
): Prisma.Decimal {
  if (stockStatus === 'QC_HOLD') return balance.qcHoldQty
  if (stockStatus === 'BLOCKED') return balance.blockedQty
  if (stockStatus === 'REJECTED') return balance.rejectedQty
  return freeQty(balance).plus(reservationRemaining)
}

async function assertNegativeMovementAllowed(
  tx: Prisma.TransactionClient,
  input: PostStockMovementInput,
  balance: {
    onHandQty: Prisma.Decimal
    reservedQty: Prisma.Decimal
    qcHoldQty: Prisma.Decimal
    blockedQty: Prisma.Decimal
    rejectedQty: Prisma.Decimal
  },
  signedQty: Prisma.Decimal,
): Promise<{
  reservationId?: string
  reservationConsumptions: Array<{ reservationId: string; quantity: Prisma.Decimal }>
}> {
  if (!signedQty.lessThan(0)) return { reservationConsumptions: [] }

  const issueQty = signedQty.abs()
  let reservationRemaining = toDecimal(0)
  let reservationId: string | undefined = input.reservationId
  let reservationConsumptions: Array<{ reservationId: string; quantity: Prisma.Decimal }> = []

  if (reservationId) {
    const reservation = await tx.inventoryStockReservation.findFirst({
      where: {
        id: reservationId,
        tenantId: input.tenantId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        status: 'ACTIVE',
      },
    })
    if (reservation) {
      reservationRemaining = getReservationRemaining(reservation)
    } else {
      reservationId = undefined
    }
  } else if (input.referenceType === 'ISSUE_TO_WO' && input.workOrderId && input.consumeWoReservation !== false) {
    const reservation = await findActiveWoReservation(
      tx,
      input.tenantId,
      input.itemId,
      input.warehouseId,
      input.workOrderId,
    )
    if (reservation) {
      reservationId = reservation.id
      reservationRemaining = getReservationRemaining(reservation)
    }
  } else if (
    input.referenceType === 'FG_DISPATCH' &&
    input.outboundDispatchLineId
  ) {
    const dispatchReservations = await findActiveDispatchReservations(
      tx,
      input.tenantId,
      input.itemId,
      input.warehouseId,
      input.outboundDispatchLineId,
    )
    const soReservation = input.salesOrderId && input.consumeSoReservation !== false
      ? await findActiveSoReservation(
          tx,
          input.tenantId,
          input.itemId,
          input.warehouseId,
          input.salesOrderId,
        )
      : null
    const reservations = soReservation
      ? [...dispatchReservations, soReservation]
      : dispatchReservations
    reservationId = reservations[0]?.id
    reservationRemaining = reservations.reduce(
      (total, reservation) => addDec(total, getReservationRemaining(reservation)),
      toDecimal(0),
    )

    let quantityToConsume = issueQty
    reservationConsumptions = reservations.flatMap((reservation) => {
      if (!quantityToConsume.greaterThan(0)) return []
      const remaining = getReservationRemaining(reservation)
      const quantity = quantityToConsume.lessThanOrEqualTo(remaining)
        ? quantityToConsume
        : remaining
      quantityToConsume = subDec(quantityToConsume, quantity)
      return quantity.greaterThan(0) ? [{ reservationId: reservation.id, quantity }] : []
    })
  } else if (
    input.referenceType === 'FG_DISPATCH' &&
    input.salesOrderId &&
    input.consumeSoReservation !== false
  ) {
    const reservation = await findActiveSoReservation(
      tx,
      input.tenantId,
      input.itemId,
      input.warehouseId,
      input.salesOrderId,
    )
    if (reservation) {
      reservationId = reservation.id
      reservationRemaining = getReservationRemaining(reservation)
    }
  }

  const available = availableForNegativeMovement(
    balance,
    reservationRemaining,
    input.stockStatus ?? 'UNRESTRICTED',
  )
  if (issueQty.greaterThan(available) && !input.allowNegativeStock) {
    throw new InventoryInsufficientStockError()
  }

  if (reservationId && reservationConsumptions.length === 0) {
    reservationConsumptions = [{
      reservationId,
      quantity: issueQty.lessThanOrEqualTo(reservationRemaining)
        ? issueQty
        : reservationRemaining,
    }]
  }

  return { reservationId, reservationConsumptions }
}

async function consumeReservationInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  reservationId: string,
  consumeQty: Prisma.Decimal,
  userId?: string,
): Promise<void> {
  if (!consumeQty.greaterThan(0)) return

  const reservation = await tx.inventoryStockReservation.findFirst({
    where: { id: reservationId, tenantId, status: 'ACTIVE' },
  })
  if (!reservation) return

  const fulfilledQty = addDec(reservation.fulfilledQty, consumeQty)
  const isFulfilled = addDec(fulfilledQty, reservation.releasedQty).greaterThanOrEqualTo(reservation.quantity)

  await tx.inventoryStockReservation.update({
    where: { id: reservation.id },
    data: {
      fulfilledQty,
      status: isFulfilled ? 'FULFILLED' : 'ACTIVE',
      fulfilledAt: isFulfilled ? new Date() : null,
      updatedBy: userId ?? null,
    },
  })

  await applyReservationDeltaInTx(
    tx,
    tenantId,
    reservation.itemId,
    reservation.warehouseId,
    consumeQty.negated(),
  )
}

export async function postStockMovement(
  input: PostStockMovementInput,
  tx?: Prisma.TransactionClient,
): Promise<InventoryStockMovement> {
  const run = async (innerTx: Prisma.TransactionClient) => {
    if (input.idempotencyKey) {
      const existing = await innerTx.inventoryStockMovement.findFirst({
        where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
      })
      if (existing) return existing
    }

    const trackingFlags = await validateItemAndWarehouse(
      innerTx,
      input.tenantId,
      input.itemId,
      input.warehouseId,
    )

    const unsignedQty = toDecimal(input.quantity)
    const signedQty = resolveSignedQuantity(input.movementType, unsignedQty)
    const tracking = await resolveTrackingInTx(innerTx, input, signedQty, trackingFlags)

    const balance = await getOrCreateBalance(innerTx, input.tenantId, input.itemId, input.warehouseId)
    const { reservationId, reservationConsumptions } = await assertNegativeMovementAllowed(
      innerTx,
      input,
      balance,
      signedQty,
    )

    const movementNumber = await nextCode(input.tenantId, 'STOCK_MOVEMENT', innerTx)
    const movementDate = input.movementDate ?? new Date()
    const inputRate = toDecimal(input.rate)
    const previousAvgRate = toDecimal(balance.avgRate)
    const isReceipt = signedQty.greaterThan(0)
    const rate = inputRate.greaterThan(0) ? inputRate : previousAvgRate
    const value = rate.times(signedQty.abs()).toDecimalPlaces(2)

    const { balanceAfter } = await applyMovementInTx(
      innerTx,
      input.tenantId,
      input.itemId,
      input.warehouseId,
      signedQty,
      input.stockStatus ?? 'UNRESTRICTED',
    )
    const avgRate = balanceAfter.isZero()
      ? toDecimal(0)
      : isReceipt && balanceAfter.greaterThan(0)
        ? balance.onHandQty
            .times(previousAvgRate)
            .plus(signedQty.abs().times(rate))
            .div(balanceAfter)
            .toDecimalPlaces(4)
        : previousAvgRate
    const stockValue = balanceAfter.times(avgRate).toDecimalPlaces(2)
    await innerTx.inventoryStockBalance.update({
      where: { id: balance.id },
      data: { avgRate, stockValue },
    })

    for (const consumption of reservationConsumptions) {
      await consumeReservationInTx(
        innerTx,
        input.tenantId,
        consumption.reservationId,
        consumption.quantity,
        input.createdBy,
      )
    }

    const movement = await innerTx.inventoryStockMovement.create({
      data: {
        tenantId: input.tenantId,
        movementNumber,
        movementDate,
        movementType: input.movementType,
        referenceType: input.referenceType,
        quantity: signedQty,
        rate,
        value,
        balanceAfter,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        workOrderId: input.workOrderId ?? null,
        sourceWorkOrderId: input.sourceWorkOrderId ?? null,
        parentWorkOrderId: input.parentWorkOrderId ?? null,
        reservationId: input.reservationId ?? reservationId ?? null,
        stockStatus: input.stockStatus ?? 'UNRESTRICTED',
        batchId: tracking.batch?.id ?? null,
        serialId: tracking.serial?.id ?? null,
        batchNumberSnapshot: tracking.batch?.batchNumber ?? input.batchNumber ?? null,
        serialNumberSnapshot: tracking.serial?.serialNumber ?? input.serialNumber ?? null,
        referenceNo: input.referenceNo ?? null,
        remarks: input.remarks ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdBy: input.createdBy ?? null,
      },
    })
    await updateTrackingPositionsInTx(
      innerTx,
      input,
      signedQty,
      tracking.batch,
      tracking.serial,
      movement.id,
    )
    const lotNumber = input.lotNumber?.trim()
    if (lotNumber) {
      const lot = await innerTx.inventoryLot.upsert({
        where: {
          tenantId_itemId_lotNumber: {
            tenantId: input.tenantId,
            itemId: input.itemId,
            lotNumber,
          },
        },
        create: {
          tenantId: input.tenantId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          lotNumber,
          heatNumber: input.heatNumber ?? null,
          quantityOnHand: signedQty,
          manufacturedAt: input.manufacturingDate ?? null,
          expiryDate: input.expiryDate ?? null,
          receivedAt: signedQty.greaterThan(0) ? movementDate : null,
          sourceReferenceType: input.referenceType,
          sourceReferenceId: input.referenceNo ?? null,
          createdBy: input.createdBy ?? null,
          updatedBy: input.createdBy ?? null,
        },
        update: {
          warehouseId: input.warehouseId,
          quantityOnHand: { increment: signedQty },
          updatedBy: input.createdBy ?? null,
        },
      })
      if (lot.quantityOnHand.lessThan(0)) {
        throw new InventoryInsufficientStockError('Insufficient lot quantity')
      }
      await innerTx.inventoryLotMovement.create({
        data: {
          tenantId: input.tenantId,
          lotId: lot.id,
          stockMovementId: movement.id,
          quantity: signedQty,
        },
      })
      if (tracking.serial) {
        await innerTx.inventorySerial.update({
          where: { id: tracking.serial.id },
          data: { lotId: lot.id, updatedBy: input.createdBy ?? null },
        })
      }
    }
    return movement
  }

  if (tx) return run(tx)
  return prisma.$transaction(run)
}

export async function findMovementByIdempotencyKey(tenantId: string, idempotencyKey: string) {
  return prisma.inventoryStockMovement.findFirst({ where: { tenantId, idempotencyKey } })
}

export async function transferStockStatus(
  input: TransferStockStatusInput,
  tx?: Prisma.TransactionClient,
): Promise<InventoryStockMovement> {
  const run = async (innerTx: Prisma.TransactionClient) => {
    if (input.idempotencyKey) {
      const existing = await innerTx.inventoryStockMovement.findFirst({
        where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
      })
      if (existing) return existing
    }
    const trackingFlags = await validateItemAndWarehouse(
      innerTx,
      input.tenantId,
      input.itemId,
      input.warehouseId,
    )
    if (trackingFlags.batchTracked && !input.batchId && !input.batchNumber) {
      throw new InventoryQuantityInvalidError('Batch is required for status transfer')
    }
    if (trackingFlags.serialTracked && !input.serialId && !input.serialNumber) {
      throw new InventoryQuantityInvalidError('Serial is required for status transfer')
    }
    const quantity = toDecimal(input.quantity)
    if (!quantity.greaterThan(0)) throw new InventoryQuantityInvalidError('Transfer quantity must be positive')
    if ((trackingFlags.serialTracked || input.serialId || input.serialNumber) && !quantity.equals(1)) {
      throw new InventoryQuantityInvalidError('A serial status transfer quantity must equal 1')
    }
    const balance = await applyStatusTransferInTx(
      innerTx,
      input.tenantId,
      input.itemId,
      input.warehouseId,
      input.fromStockStatus,
      input.stockStatus,
      quantity,
    )
    const batch = input.batchId
      ? await innerTx.inventoryBatch.findFirst({
          where: { id: input.batchId, tenantId: input.tenantId, itemId: input.itemId },
        })
      : input.batchNumber
        ? await innerTx.inventoryBatch.findFirst({
            where: {
              tenantId: input.tenantId,
              itemId: input.itemId,
              batchNumber: input.batchNumber,
            },
          })
        : null
    const serial = input.serialId
      ? await innerTx.inventorySerial.findFirst({
          where: { id: input.serialId, tenantId: input.tenantId, itemId: input.itemId },
        })
      : input.serialNumber
        ? await innerTx.inventorySerial.findFirst({
            where: {
              tenantId: input.tenantId,
              itemId: input.itemId,
              serialNumber: input.serialNumber,
            },
          })
        : null
    if ((input.batchId || input.batchNumber) && !batch) throw new NotFoundError('Inventory batch not found')
    if ((input.serialId || input.serialNumber) && !serial) throw new NotFoundError('Inventory serial not found')
    if (batch) {
      const source = await innerTx.inventoryBatchBalance.findUnique({
        where: {
          tenantId_batchId_warehouseId_stockStatus: {
            tenantId: input.tenantId,
            batchId: batch.id,
            warehouseId: input.warehouseId,
            stockStatus: input.fromStockStatus,
          },
        },
      })
      if (!source || source.quantity.lessThan(quantity)) {
        throw new InventoryInsufficientStockError('Insufficient batch status quantity')
      }
      await innerTx.inventoryBatchBalance.update({
        where: { id: source.id },
        data: { quantity: { decrement: quantity } },
      })
      await innerTx.inventoryBatchBalance.upsert({
        where: {
          tenantId_batchId_warehouseId_stockStatus: {
            tenantId: input.tenantId,
            batchId: batch.id,
            warehouseId: input.warehouseId,
            stockStatus: input.stockStatus,
          },
        },
        create: {
          tenantId: input.tenantId,
          batchId: batch.id,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          stockStatus: input.stockStatus,
          quantity,
        },
        update: { quantity: { increment: quantity } },
      })
    }
    const movementNumber = await nextCode(input.tenantId, 'STOCK_MOVEMENT', innerTx)
    const movement = await innerTx.inventoryStockMovement.create({
      data: {
        tenantId: input.tenantId,
        movementNumber,
        movementDate: new Date(),
        movementType: 'ADJUSTMENT',
        referenceType: input.referenceType ?? 'QUALITY_RELEASE',
        quantity,
        rate: balance.avgRate,
        value: toDecimal(0),
        balanceAfter: balance.onHandQty,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        stockStatus: input.stockStatus,
        fromStockStatus: input.fromStockStatus,
        batchId: batch?.id ?? null,
        serialId: serial?.id ?? null,
        batchNumberSnapshot: batch?.batchNumber ?? input.batchNumber ?? null,
        serialNumberSnapshot: serial?.serialNumber ?? input.serialNumber ?? null,
        referenceNo: input.referenceNo ?? null,
        remarks: input.remarks ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdBy: input.createdBy ?? null,
      },
    })
    if (serial) {
      const serialStatus =
        input.stockStatus === 'UNRESTRICTED'
          ? 'AVAILABLE'
          : input.stockStatus === 'QC_HOLD'
            ? 'QC_HOLD'
            : input.stockStatus === 'BLOCKED'
              ? 'BLOCKED'
              : 'REJECTED'
      await innerTx.inventorySerial.update({
        where: { id: serial.id },
        data: { stockStatus: input.stockStatus, status: serialStatus },
      })
      await innerTx.inventorySerialMovement.create({
        data: {
          tenantId: input.tenantId,
          serialId: serial.id,
          movementId: movement.id,
          warehouseId: input.warehouseId,
          fromStockStatus: input.fromStockStatus,
          stockStatus: input.stockStatus,
          quantity,
        },
      })
    }
    return movement
  }
  if (tx) return run(tx)
  return prisma.$transaction(run)
}

/** FG_DISPATCH issue — callable inside an outer transaction (OutboundDispatch confirm). */
export async function postFgDispatchIssueMovement(
  input: Omit<PostStockMovementInput, 'movementType' | 'referenceType'> & {
    quantity: DecimalInput
  },
  tx?: Prisma.TransactionClient,
): Promise<InventoryStockMovement> {
  return postStockMovement(
    {
      ...input,
      movementType: 'ISSUE',
      referenceType: 'FG_DISPATCH',
    },
    tx,
  )
}

/** Shared inventory posting facade. Existing function exports remain as compatibility adapters. */
export const InventoryPostingService = {
  post: postStockMovement,
  transferStatus: transferStockStatus,
  postFgDispatchIssue: postFgDispatchIssueMovement,
  findByIdempotencyKey: findMovementByIdempotencyKey,
}
