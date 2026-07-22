import type { Request } from 'express'
import type { ProductionAccountingEventType } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { post } from '../../accounting/posting/posting.service.js'
import type { PostingContext } from '../../accounting/posting/posting.types.js'
import { buildManufacturingPostingRequest } from '../accounting/manufacturing-accounting-builder.service.js'
import { recordManufacturingAccountingEvent } from '../accounting/manufacturing-accounting-event.service.js'
import {
  isManufacturingAccountingEnabled,
  resolveManufacturingLegalEntityId,
} from '../accounting/manufacturing-accounting-gate.service.js'
import { getManufacturingSettingsForTenant } from '../settings/manufacturing-settings.service.js'
import { getManufacturingAccountingReadiness } from './accounting-readiness.service.js'
import { calculateWorkOrderCost } from './work-order-cost.service.js'

function postingContext(req: Request, tenantId: string): PostingContext {
  return {
    tenantId,
    userId: req.context?.userId ?? null,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  }
}

function classifyFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/mapping|legal entity|feature|configuration/i.test(message)) return `CONFIGURATION: ${message}`
  if (/period|closed|date|state/i.test(message)) return `OPERATIONAL: ${message}`
  if (/balance|account|voucher|posting/i.test(message)) return `ACCOUNTING: ${message}`
  return `TECHNICAL: ${message}`
}

export async function validateEvent(tenantId: string, eventId: string) {
  const event = await prisma.productionAccountingEvent.findFirst({ where: { id: eventId, tenantId } })
  if (!event) throw new NotFoundError('Manufacturing accounting event not found')
  const readiness = await getManufacturingAccountingReadiness(tenantId, event.productionOrderId ?? undefined)
  const blockers = [...readiness.blockers]
  if (!['RECORDED', 'FAILED', 'POSTED'].includes(event.status)) blockers.push(`EVENT_STATUS_${event.status}`)
  if (event.amount.lessThanOrEqualTo(0)) blockers.push('ZERO_EVENT_AMOUNT')
  return { ready: blockers.length === 0 || event.status === 'POSTED', event, readiness, blockers }
}

export async function postEvent(req: Request, tenantId: string, eventId: string) {
  const event = await prisma.productionAccountingEvent.findFirst({ where: { id: eventId, tenantId } })
  if (!event) throw new NotFoundError('Manufacturing accounting event not found')
  if (event.status === 'POSTED') return event
  if (!['RECORDED', 'FAILED'].includes(event.status)) {
    throw new InvalidStateError(`Only RECORDED or FAILED events can be posted; current status is ${event.status}`)
  }
  const validation = await validateEvent(tenantId, eventId)
  if (!validation.ready) throw new ValidationError(`Accounting event is not ready: ${validation.blockers.join(', ')}`)

  try {
    const date = new Date().toISOString().slice(0, 10)
    const request = buildManufacturingPostingRequest({
      eventType: event.eventType,
      legalEntityId: event.legalEntityId,
      eventId: event.id,
      idempotencyKey: event.idempotencyKey,
      productionOrderId: event.productionOrderId,
      sourceDocumentType: event.sourceDocumentType,
      sourceDocumentId: event.sourceDocumentId,
      amount: event.amount.toString(),
      documentDate: date,
      postingDate: date,
      payloadJson: event.payloadJson,
    })
    const result = await post(request, postingContext(req, tenantId))
    return prisma.productionAccountingEvent.update({
      where: { id: event.id },
      data: {
        status: 'POSTED',
        voucherId: result.voucherId,
        postingEventId: result.postingEventId,
        postedAt: new Date(),
        failureReason: null,
      },
    })
  } catch (error) {
    await prisma.productionAccountingEvent.update({
      where: { id: event.id },
      data: { status: 'FAILED', failureReason: classifyFailure(error) },
    })
    throw error
  }
}

export const retryEvent = postEvent

export async function recordAbsorptionEvents(req: Request, tenantId: string, workOrderId: string) {
  const snapshot = await prisma.workOrderCostSnapshot.findFirst({
    where: { tenantId, productionOrderId: workOrderId },
    orderBy: { snapshotVersion: 'desc' },
  })
  if (!snapshot) throw new ValidationError('Calculate work-order cost before recording absorption events')
  const specs: Array<{ type: ProductionAccountingEventType; amount: typeof snapshot.actualLabourCost }> = [
    { type: 'LABOUR_ABSORPTION', amount: snapshot.actualLabourCost },
    { type: 'MACHINE_ABSORPTION', amount: snapshot.actualMachineCost },
    { type: 'OVERHEAD_ABSORPTION', amount: snapshot.actualOverheadCost },
    { type: 'JOB_WORK_RECEIPT_COST', amount: snapshot.actualJobWorkCost },
  ]
  const events = []
  for (const spec of specs) {
    const prior = await prisma.productionAccountingEvent.aggregate({
      where: {
        tenantId,
        productionOrderId: workOrderId,
        eventType: spec.type,
        status: { not: 'REVERSED' },
      },
      _sum: { amount: true },
    })
    const delta = spec.amount.minus(prior._sum.amount ?? 0)
    if (delta.lessThanOrEqualTo(0)) continue
    events.push(await recordManufacturingAccountingEvent(req, tenantId, {
      eventType: spec.type,
      idempotencyKey: `P7E_${spec.type}:${workOrderId}:${snapshot.snapshotVersion}`,
      sourceDocumentType: 'WORK_ORDER_COST_SNAPSHOT',
      sourceDocumentId: snapshot.id,
      productionOrderId: workOrderId,
      quantity: snapshot.goodQuantity,
      amount: delta,
      currencyCode: snapshot.currencyCode,
      payloadJson: {
        snapshotId: snapshot.id,
        snapshotVersion: snapshot.snapshotVersion,
        cumulativeCost: spec.amount.toString(),
        previouslyRecorded: String(prior._sum.amount ?? 0),
        delta: delta.toString(),
      },
      attemptPost: false,
    }))
  }
  return events
}

/** Record absorption deltas from the latest snapshot, then immediately attempt to post each event. */
export async function recordAndPostAbsorptionEvents(req: Request, tenantId: string, workOrderId: string) {
  const events = await recordAbsorptionEvents(req, tenantId, workOrderId)
  const posted = []
  const failed: Array<{ eventId: string; error: string }> = []
  for (const event of events) {
    try {
      posted.push(await postEvent(req, tenantId, event.id))
    } catch (error) {
      failed.push({ eventId: event.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return { recorded: events.length, posted, failed }
}

/**
 * Stage 4 hook — when ManufacturingSettings.autoPostAbsorption is on and the
 * MANUFACTURING_ACCOUNTING flag is enabled, recalculate cost and record + post
 * absorption events after production is confirmed. Never throws: shop-floor
 * confirmation must not fail because of GL problems (events stay RECORDED/FAILED
 * and remain visible in the accounting workspace).
 */
export async function autoPostAbsorptionAfterProduction(
  req: Request,
  tenantId: string,
  workOrderIds: string[],
) {
  const results: Array<{ workOrderId: string; recorded: number; postedCount: number; error?: string }> = []
  try {
    const settings = await getManufacturingSettingsForTenant(tenantId)
    if (!settings.autoPostAbsorption) return results
    const legalEntityId = await resolveManufacturingLegalEntityId(tenantId)
    if (!legalEntityId || !(await isManufacturingAccountingEnabled(tenantId, legalEntityId))) return results

    for (const workOrderId of [...new Set(workOrderIds)]) {
      try {
        await calculateWorkOrderCost(tenantId, workOrderId, { persist: true, req })
        const outcome = await recordAndPostAbsorptionEvents(req, tenantId, workOrderId)
        results.push({ workOrderId, recorded: outcome.recorded, postedCount: outcome.posted.length })
      } catch (error) {
        results.push({
          workOrderId,
          recorded: 0,
          postedCount: 0,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } catch (error) {
    console.warn('[manufacturing] auto-post absorption skipped:', error instanceof Error ? error.message : error)
  }
  return results
}

export async function financialClosePreview(tenantId: string, workOrderId: string) {
  const [order, snapshot, readiness] = await Promise.all([
    prisma.productionOrder.findFirst({ where: { id: workOrderId, tenantId, deletedAt: null } }),
    prisma.workOrderCostSnapshot.findFirst({
      where: { tenantId, productionOrderId: workOrderId },
      orderBy: { snapshotVersion: 'desc' },
    }),
    getManufacturingAccountingReadiness(tenantId, workOrderId),
  ])
  if (!order) throw new NotFoundError('Work order not found')
  const blockers = [...readiness.blockers]
  if (!['COMPLETED', 'CLOSED'].includes(order.status)) blockers.push('WORK_ORDER_NOT_COMPLETED')
  if (!snapshot) blockers.push('COST_NOT_CALCULATED')
  const posted = await prisma.productionAccountingEvent.aggregate({
    where: { tenantId, productionOrderId: workOrderId, status: 'POSTED' },
    _sum: { amount: true },
  })
  const residualVariance = snapshot
    ? snapshot.totalActualCost.minus(posted._sum.amount ?? 0)
    : null
  return { ready: blockers.length === 0, blockers, readiness, orderStatus: order.status, snapshot, residualVariance }
}

export async function financialClose(req: Request, tenantId: string, workOrderId: string) {
  const idempotencyKey = `P7E_CLOSE:${workOrderId}:V1`
  const duplicate = await prisma.productionAccountingEvent.findFirst({ where: { tenantId, idempotencyKey } })
  if (duplicate) throw new InvalidStateError('Financial close has already been recorded for this work order')
  const preview = await financialClosePreview(tenantId, workOrderId)
  if (!preview.ready || !preview.snapshot) {
    throw new ValidationError(`Work order is not ready for financial close: ${preview.blockers.join(', ')}`)
  }
  const variance = preview.residualVariance!
  return recordManufacturingAccountingEvent(req, tenantId, {
    eventType: 'PRODUCTION_VARIANCE',
    idempotencyKey,
    sourceDocumentType: 'WORK_ORDER_FINANCIAL_CLOSE',
    sourceDocumentId: workOrderId,
    productionOrderId: workOrderId,
    quantity: preview.snapshot.goodQuantity,
    amount: variance.abs(),
    currencyCode: preview.snapshot.currencyCode,
    payloadJson: {
      snapshotId: preview.snapshot.id,
      snapshotVersion: preview.snapshot.snapshotVersion,
      varianceAmount: variance.toString(),
    },
    attemptPost: false,
  })
}
