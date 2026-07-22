import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { postStockMovement } from '../../inventory/shared/stock-posting.service.js'
import { jobWorkQualityBlockers } from '../../quality/shared/blockers.service.js'
import * as repo from './job-work.repository.js'
import type { CreateJobWorkInput, DispatchJobWorkInput, ReceiveJobWorkInput, ReconcileInput, ReturnMaterialInput, UpdateJobWorkInput } from './job-work.schemas.js'

const d = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value)
const n = (value: Prisma.Decimal) => value.toString()
const user = (req: Request) => req.context?.userId ?? ''

function map(order: NonNullable<Awaited<ReturnType<typeof repo.find>>>) {
  return {
    ...order, orderedQty: n(order.orderedQty), sentQty: n(order.sentQty), receivedQty: n(order.receivedQty), acceptedQty: n(order.acceptedQty),
    rejectedQty: n(order.rejectedQty), reworkQty: n(order.reworkQty), rate: n(order.rate), expectedCost: n(order.expectedCost), invoiceAmount: order.invoiceAmount ? n(order.invoiceAmount) : null,
    materialLines: order.materialLines.map((line) => ({ ...line, requiredQty: n(line.requiredQty), sentQty: n(line.sentQty), additionalSentQty: n(line.additionalSentQty), consumedQty: n(line.consumedQty), returnedQty: n(line.returnedQty), scrapReturnedQty: n(line.scrapReturnedQty), balanceWithVendor: n(line.sentQty.plus(line.additionalSentQty).minus(line.consumedQty).minus(line.returnedQty).minus(line.scrapReturnedQty)) })),
    receipts: order.receipts.map((r) => ({ ...r, receivedQty: n(r.receivedQty), acceptedQty: n(r.acceptedQty), rejectedQty: n(r.rejectedQty), reworkQty: n(r.reworkQty), scrapReturned: n(r.scrapReturned), unusedReturned: n(r.unusedReturned) })),
  }
}
async function orderOrThrow(tenantId: string, id: string) {
  const row = await repo.find(tenantId, id); if (!row) throw new NotFoundError('Job work order not found'); return row
}
async function assertRefs(tenantId: string, input: Pick<CreateJobWorkInput, 'vendorId' | 'itemId' | 'productionOrderId' | 'materialWarehouseId' | 'receiptWarehouseId' | 'materialLines'>) {
  const [vendor, item, materialWh, receiptWh, productionOrder, lineItems] = await Promise.all([
    prisma.masterVendor.findFirst({ where: { id: input.vendorId, tenantId, deletedAt: null } }),
    prisma.masterItem.findFirst({ where: { id: input.itemId, tenantId, deletedAt: null } }),
    prisma.masterWarehouse.findFirst({ where: { id: input.materialWarehouseId, tenantId, deletedAt: null } }),
    prisma.masterWarehouse.findFirst({ where: { id: input.receiptWarehouseId, tenantId, deletedAt: null } }),
    input.productionOrderId ? prisma.productionOrder.findFirst({ where: { id: input.productionOrderId, tenantId, deletedAt: null } }) : Promise.resolve(true),
    prisma.masterItem.count({ where: { tenantId, deletedAt: null, id: { in: input.materialLines.map((x) => x.itemId) } } }),
  ])
  if (!vendor || !item || !materialWh || !receiptWh || !productionOrder || lineItems !== new Set(input.materialLines.map((x) => x.itemId)).size) throw new ValidationError('One or more job work references are invalid for this tenant')
}

export async function list(tenantId: string, query: Parameters<typeof repo.list>[1]) {
  const result = await repo.list(tenantId, query)
  return { ...result, items: result.items.map(map) }
}
export async function get(tenantId: string, id: string) { return map(await orderOrThrow(tenantId, id)) }

export async function create(req: Request, tenantId: string, input: CreateJobWorkInput) {
  if (input.idempotencyKey) { const existing = await prisma.jobWorkOrder.findFirst({ where: { tenantId, idempotencyKey: input.idempotencyKey } }); if (existing) return get(tenantId, existing.id) }
  await assertRefs(tenantId, input)
  const created = await prisma.$transaction(async (tx) => {
    const jwNumber = await nextCode(tenantId, 'JOB_WORK_ORDER', tx)
    const expectedCost = input.rateBasis === 'FIXED' ? d(input.rate) : d(input.rate).mul(input.orderedQty)
    return tx.jobWorkOrder.create({ data: { tenantId, jwNumber, vendorId: input.vendorId, productionOrderId: input.productionOrderId, processName: input.processName, itemId: input.itemId, uomId: input.uomId, orderedQty: d(input.orderedQty), rate: d(input.rate), rateBasis: input.rateBasis, expectedCost, expectedReturnDate: input.expectedReturnDate, materialWarehouseId: input.materialWarehouseId, receiptWarehouseId: input.receiptWarehouseId, plantId: input.plantId, qualityRequired: input.qualityRequired ?? false, materialToSend: input.materialToSend, deliveryAddress: input.deliveryAddress, drawingRevision: input.drawingRevision, qualityInstructions: input.qualityInstructions, remarks: input.remarks, idempotencyKey: input.idempotencyKey, createdBy: user(req), updatedBy: user(req), materialLines: { create: input.materialLines.map((line, i) => ({ tenantId, lineNo: i + 1, itemId: line.itemId, uomId: line.uomId, requiredQty: d(line.requiredQty), remarks: line.remarks })) } } })
  })
  return get(tenantId, created.id)
}
export async function update(req: Request, tenantId: string, id: string, input: UpdateJobWorkInput) {
  const order = await orderOrThrow(tenantId, id); if (order.status !== 'DRAFT') throw new InvalidStateError('Only DRAFT job work orders can be edited')
  const { materialLines, ...header } = input
  await prisma.$transaction(async (tx) => {
    await tx.jobWorkOrder.update({ where: { id }, data: { ...header, ...(header.rate !== undefined ? { rate: d(header.rate), expectedCost: (header.rateBasis ?? order.rateBasis) === 'FIXED' ? d(header.rate) : d(header.rate).mul(header.orderedQty ?? order.orderedQty) } : {}), updatedBy: user(req) } })
    if (materialLines) { await tx.jobWorkMaterialLine.deleteMany({ where: { tenantId, jobWorkOrderId: id } }); await tx.jobWorkMaterialLine.createMany({ data: materialLines.map((line, i) => ({ tenantId, jobWorkOrderId: id, lineNo: i + 1, itemId: line.itemId, uomId: line.uomId, requiredQty: d(line.requiredQty), remarks: line.remarks })) }) }
  }); return get(tenantId, id)
}

export async function dispatch(req: Request, tenantId: string, id: string, input: DispatchJobWorkInput) {
  const order = await orderOrThrow(tenantId, id); if (!['DRAFT', 'MATERIAL_SENT', 'PARTIALLY_RECEIVED'].includes(order.status)) throw new InvalidStateError('Job work order cannot be dispatched in its current state')
  const selected = new Map(order.materialLines.map((line) => [line.id, line]))
  for (const x of input.lines) { const line = selected.get(x.materialLineId); if (!line) throw new ValidationError('Material line does not belong to this job work order'); const item = line.item; if (item.isStockable) await postStockMovement({ tenantId, itemId: line.itemId, warehouseId: order.materialWarehouseId, movementType: 'ISSUE', referenceType: 'SUBCON_OUT', quantity: x.quantity, movementDate: input.dispatchedAt, referenceNo: order.jwNumber, remarks: input.remarks, idempotencyKey: `jw-out:${id}:${x.materialLineId}:${x.quantity}`, createdBy: user(req) }) }
  await prisma.$transaction(async (tx) => {
    await tx.jobWorkDispatch.create({ data: { tenantId, jobWorkOrderId: id, dispatchedAt: input.dispatchedAt ?? new Date(), vendorChallan: input.vendorChallan, vehicle: input.vehicle, transporter: input.transporter, remarks: input.remarks, createdBy: user(req), lines: { create: input.lines.map((x) => ({ tenantId, materialLineId: x.materialLineId, quantity: d(x.quantity), batchOrSerial: x.batchOrSerial })) } } })
    for (const x of input.lines) { const line = selected.get(x.materialLineId)!; const total = line.sentQty.plus(line.additionalSentQty); await tx.jobWorkMaterialLine.update({ where: { id: line.id }, data: total.greaterThanOrEqualTo(line.requiredQty) ? { additionalSentQty: { increment: d(x.quantity) }, status: 'SENT' } : { sentQty: { increment: d(x.quantity) }, status: 'SENT' } }) }
    await tx.jobWorkOrder.update({ where: { id }, data: { status: 'MATERIAL_SENT', materialSentAt: order.materialSentAt ?? new Date(), sentQty: { increment: input.lines.reduce((sum, x) => sum + x.quantity, 0) }, vendorChallan: input.vendorChallan ?? order.vendorChallan, transporter: input.transporter ?? order.transporter, vehicle: input.vehicle ?? order.vehicle, updatedBy: user(req) } })
  }); return get(tenantId, id)
}

export async function receive(req: Request, tenantId: string, id: string, input: ReceiveJobWorkInput) {
  const order = await orderOrThrow(tenantId, id); if (!['MATERIAL_SENT', 'PARTIALLY_RECEIVED'].includes(order.status)) throw new InvalidStateError('Receive requires sent material')
  const total = order.receivedQty.plus(input.receivedQty); if (total.greaterThan(order.orderedQty)) throw new ValidationError('Receipt exceeds ordered quantity')
  const inspection = order.qualityRequired ? await prisma.$transaction(async (tx) => { const inspectionNumber = await nextCode(tenantId, 'QUALITY_INSPECTION', tx); return tx.manufacturingQualityInspection.create({ data: { tenantId, inspectionNumber, category: 'SUBCONTRACT_RETURN', productionOrderId: order.productionOrderId, jobWorkOrderId: id, itemId: order.itemId, inspectedQty: d(input.receivedQty), title: `Subcontract return QC — ${order.jwNumber}`, idempotencyKey: `jw-qc:${id}:${total}`, requestedByUserId: user(req), createdBy: user(req) } }) }) : null
  const output = order.item
  if (output.isStockable && input.acceptedQty > 0) await postStockMovement({ tenantId, itemId: order.itemId, warehouseId: order.receiptWarehouseId, movementType: 'INWARD', referenceType: 'SUBCON_IN', quantity: input.acceptedQty, movementDate: input.receivedAt, referenceNo: order.jwNumber, remarks: input.remarks, idempotencyKey: `jw-in:${id}:${total}`, createdBy: user(req) })
  await prisma.$transaction(async (tx) => { await tx.jobWorkReceipt.create({ data: { tenantId, jobWorkOrderId: id, receivedAt: input.receivedAt ?? new Date(), receivedQty: d(input.receivedQty), acceptedQty: d(input.acceptedQty), rejectedQty: d(input.rejectedQty), reworkQty: d(input.reworkQty), scrapReturned: d(input.scrapReturned), unusedReturned: d(input.unusedReturned), vendorChallan: input.vendorChallan, batchOrSerial: input.batchOrSerial, remarks: input.remarks, qualityInspectionId: inspection?.id, createdBy: user(req) } }); await tx.jobWorkOrder.update({ where: { id }, data: { receivedQty: total, acceptedQty: { increment: d(input.acceptedQty) }, rejectedQty: { increment: d(input.rejectedQty) }, reworkQty: { increment: d(input.reworkQty) }, status: total.equals(order.orderedQty) ? 'RECEIVED' : 'PARTIALLY_RECEIVED', updatedBy: user(req) } }) }); return get(tenantId, id)
}

export async function returnMaterial(req: Request, tenantId: string, id: string, input: ReturnMaterialInput) {
  const order = await orderOrThrow(tenantId, id)
  const lines = new Map(order.materialLines.map((x) => [x.id, x]))
  for (const inputLine of input.lines) {
    const line = lines.get(inputLine.materialLineId)
    if (!line) throw new ValidationError('Material line does not belong to this job work order')
    const balance = line.sentQty.plus(line.additionalSentQty).minus(line.consumedQty).minus(line.returnedQty).minus(line.scrapReturnedQty)
    if (d(inputLine.quantity).greaterThan(balance)) throw new ValidationError('Returned quantity exceeds material held by vendor')
    if (line.item.isStockable) await postStockMovement({ tenantId, itemId: line.itemId, warehouseId: order.materialWarehouseId, movementType: 'INWARD', referenceType: 'SUBCON_IN', quantity: inputLine.quantity, referenceNo: order.jwNumber, remarks: input.remarks, idempotencyKey: `jw-return:${id}:${line.id}:${inputLine.quantity}:${inputLine.scrap ? 'scrap' : 'unused'}`, createdBy: user(req) })
  }
  await prisma.$transaction(async (tx) => { for (const x of input.lines) await tx.jobWorkMaterialLine.update({ where: { id: x.materialLineId }, data: x.scrap ? { scrapReturnedQty: { increment: d(x.quantity) } } : { returnedQty: { increment: d(x.quantity) } } }) })
  return get(tenantId, id)
}

export async function reconcile(req: Request, tenantId: string, id: string, input: ReconcileInput) {
  const order = await orderOrThrow(tenantId, id)
  if (!['RECEIVED', 'PARTIALLY_RECEIVED'].includes(order.status)) throw new InvalidStateError('Reconciliation requires a receipt')
  const lines = new Map(order.materialLines.map((x) => [x.id, x]))
  let hasDifference = false
  await prisma.$transaction(async (tx) => {
    for (const x of input.lines) {
      const line = lines.get(x.materialLineId); if (!line) throw new ValidationError('Material line does not belong to this job work order')
      const sent = line.sentQty.plus(line.additionalSentQty)
      const balance = sent.minus(x.consumedQty).minus(x.returnedQty).minus(x.scrapReturnedQty)
      const status = balance.isZero() ? 'RECONCILED' : 'DIFFERENCE'; if (!balance.isZero()) hasDifference = true
      await tx.jobWorkMaterialLine.update({ where: { id: line.id }, data: { consumedQty: d(x.consumedQty), returnedQty: d(x.returnedQty), scrapReturnedQty: d(x.scrapReturnedQty), status } })
    }
    await tx.jobWorkOrder.update({ where: { id }, data: { status: hasDifference ? 'RECONCILIATION_PENDING' : order.receivedQty.greaterThanOrEqualTo(order.orderedQty) ? 'RECEIVED' : 'PARTIALLY_RECEIVED', invoiceStatus: hasDifference ? 'PENDING' : order.invoiceStatus, updatedBy: user(req) } })
  })
  return get(tenantId, id)
}
export async function approveDifference(req: Request, tenantId: string, id: string, reason: string) {
  const order = await orderOrThrow(tenantId, id); if (order.status !== 'RECONCILIATION_PENDING') throw new InvalidStateError('No reconciliation difference is pending')
  await prisma.jobWorkOrder.update({ where: { id }, data: { differenceApproved: true, differenceReason: reason, updatedBy: user(req) } }); return get(tenantId, id)
}
export async function linkInvoice(req: Request, tenantId: string, id: string, input: { invoiceId?: string; invoiceNo: string; invoiceAmount: number }) {
  await orderOrThrow(tenantId, id); await prisma.jobWorkOrder.update({ where: { id }, data: { ...input, invoiceAmount: d(input.invoiceAmount), invoiceStatus: 'LINKED', updatedBy: user(req) } }); return get(tenantId, id)
}
export async function close(req: Request, tenantId: string, id: string) {
  const order = await orderOrThrow(tenantId, id)
  if (order.status !== 'RECEIVED' && !(order.status === 'RECONCILIATION_PENDING' && order.differenceApproved)) throw new InvalidStateError('Close requires received material or an approved reconciliation difference')
  const qualityBlockers = await jobWorkQualityBlockers(tenantId, id)
  if (qualityBlockers.length) throw new InvalidStateError(qualityBlockers.map((b) => b.message).join('; '))
  await prisma.jobWorkOrder.update({ where: { id }, data: { status: 'CLOSED', updatedBy: user(req) } }); return get(tenantId, id)
}
export async function cancel(req: Request, tenantId: string, id: string, reason: string) {
  const order = await orderOrThrow(tenantId, id)
  if (!['DRAFT', 'MATERIAL_SENT'].includes(order.status) || order.receivedQty.greaterThan(0)) throw new InvalidStateError('Only draft or pre-receipt job work orders can be cancelled')
  await prisma.jobWorkOrder.update({ where: { id }, data: { status: 'CANCELLED', remarks: [order.remarks, `Cancelled: ${reason}`].filter(Boolean).join('\n'), updatedBy: user(req) } }); return get(tenantId, id)
}
