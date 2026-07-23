/**
 * Phase 7C5 — backend-derived outbound posting readiness (single source of truth for UI).
 */
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getReservationPosition } from '../reservation/dispatch-reservation.service.js'
import { n, roundQty } from '../shared/dispatch-qty.js'
import {
  getDispatchPostingPolicy,
  isDispatchHardenedPostingEnabled,
  type DispatchPostingPolicy,
} from './dispatch-policy.js'
import { resolvePostingPolicyForOutbound } from './dispatch-posting.service.js'
import { classifyBlockersForEmergencyOverride } from '../../shared/emergency-override/emergency-override.catalog.js'

export type PostingBlocker = {
  code: string
  message: string
  severity: 'BLOCKER' | 'WARNING'
}

export type QuantityReconciliation = {
  requestedQty: number
  reservedQty: number
  pickedQty: number
  packedQty: number
  challanQty: number
  previouslyPostedQty: number
  postingQty: number
  salesOrderRemainingQty: number | null
  inventoryAvailableQty: number | null
  reversibleQty: number
}

export type DispatchPostingReadiness = {
  outboundDispatchId: string
  dispatchNo: string
  status: string
  planningSource: string
  hardenedPostingEnabled: boolean
  policy: DispatchPostingPolicy
  lifecycleStatus: string
  quantity: QuantityReconciliation
  hardBlockers: PostingBlocker[]
  warnings: PostingBlocker[]
  allowedActions: Array<'POST' | 'CONFIRM' | 'REVERSE' | 'CANCEL' | 'RESERVE' | 'PICK' | 'PACK' | 'CHALLAN'>
  /** Controlled emergency override eligibility (operational blockers only). */
  emergencyOverride: {
    canRequest: boolean
    requiresPermission: string
    overridableBlockers: PostingBlocker[]
    neverOverridableBlockers: PostingBlocker[]
    unknownBlockers: PostingBlocker[]
    message: string
  }
  gates: {
    reservation: { ready: boolean; detail: string }
    pick: { ready: boolean; detail: string }
    pack: { ready: boolean; detail: string }
    challan: { ready: boolean; detail: string }
    quality: { ready: boolean; detail: string }
    inventory: { ready: boolean; detail: string }
    salesOrder: { ready: boolean; detail: string }
    posting: { ready: boolean; detail: string }
    reversal: { ready: boolean; detail: string }
  }
}

function pushBlocker(list: PostingBlocker[], code: string, message: string, severity: 'BLOCKER' | 'WARNING' = 'BLOCKER') {
  list.push({ code, message, severity })
}

export async function getOutboundPostingReadiness(
  tenantId: string,
  dispatchId: string,
  mode: 'confirm' | 'post' = 'post',
): Promise<DispatchPostingReadiness> {
  const dispatch = await prisma.outboundDispatch.findFirst({
    where: { id: dispatchId, tenantId, deletedAt: null },
    include: { lines: { orderBy: { lineNo: 'asc' } } },
  })
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')

  const policy = resolvePostingPolicyForOutbound(dispatch, mode)
  const hardBlockers: PostingBlocker[] = []
  const warnings: PostingBlocker[] = []

  const requestedQty = roundQty(dispatch.lines.reduce((s, l) => s + n(l.quantity), 0))

  let reservedQty = 0
  let reservationReady = !policy.requireReservationBeforePosting
  let reservationDetail = policy.requireReservationBeforePosting
    ? 'Reservation required'
    : 'Reservation not required by policy'
  try {
    const position = await getReservationPosition(tenantId, dispatchId)
    reservedQty = roundQty(position.lines.reduce((s, l) => s + n(l.netReservedQty), 0))
    const unreserved = roundQty(position.lines.reduce((s, l) => s + n(l.unreservedQty), 0))
    if (policy.requireReservationBeforePosting) {
      reservationReady = unreserved <= 0 && reservedQty + 1e-9 >= requestedQty
      reservationDetail = reservationReady
        ? `Reserved ${reservedQty}`
        : `${unreserved} unreserved of ${requestedQty}`
      if (!reservationReady) {
        pushBlocker(hardBlockers, 'RESERVATION_SHORTAGE', reservationDetail)
      }
    } else if (unreserved > 0) {
      pushBlocker(warnings, 'RESERVATION_PARTIAL', reservationDetail, 'WARNING')
    }
  } catch {
    if (policy.requireReservationBeforePosting) {
      pushBlocker(hardBlockers, 'RESERVATION_UNAVAILABLE', 'Could not load reservation position')
      reservationReady = false
    }
  }

  const pickLists = await prisma.dispatchPickList.findMany({
    where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null, status: { not: 'CANCELLED' } },
    include: { lines: true },
  })
  const pickedQty = roundQty(
    pickLists.reduce(
      (s, pl) => s + pl.lines.reduce((ls, line) => ls + n(line.pickedQuantity), 0),
      0,
    ),
  )
  const pickComplete =
    pickLists.length > 0 && pickLists.every((pl) => pl.status === 'PICKED')
  let pickReady = !policy.requirePickBeforePosting
  let pickDetail = policy.requirePickBeforePosting ? 'Pick required' : 'Pick not required by policy'
  if (policy.requirePickBeforePosting) {
    pickReady = pickComplete && roundQty(pickedQty) === requestedQty
    pickDetail = pickReady
      ? `Picked ${pickedQty}`
      : !pickLists.length
        ? 'No Pick List'
        : `Picked ${pickedQty} of ${requestedQty} (status incomplete)`
    if (!pickReady) pushBlocker(hardBlockers, 'PICK_INCOMPLETE', pickDetail)
  } else if (pickLists.length && !pickComplete) {
    pushBlocker(hardBlockers, 'PICK_INCOMPLETE', 'Existing Pick List must be completed before post')
    pickReady = false
    pickDetail = 'Existing pick incomplete'
  }

  const sessions = await prisma.dispatchPackingSession.findMany({
    where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null, status: { not: 'CANCELLED' } },
    include: { packages: { include: { lines: true } } },
  })
  const packedQty = roundQty(
    sessions.reduce(
      (s, sess) =>
        s +
        sess.packages
          .filter((p) => p.status !== 'CANCELLED')
          .reduce((ps, pkg) => ps + pkg.lines.reduce((ls, line) => ls + n(line.packedQuantity), 0), 0),
      0,
    ),
  )
  const packComplete =
    sessions.length > 0 &&
    sessions.every((s) => s.status === 'PACKED' || s.status === 'VERIFIED')
  let packReady = !policy.requirePackBeforePosting
  let packDetail = policy.requirePackBeforePosting ? 'Pack required' : 'Pack not required by policy'
  if (policy.requirePackBeforePosting) {
    packReady = packComplete && roundQty(packedQty) === requestedQty
    packDetail = packReady
      ? `Packed ${packedQty}`
      : !sessions.length
        ? 'No Packing Session'
        : `Packed ${packedQty} of ${requestedQty}`
    if (!packReady) pushBlocker(hardBlockers, 'PACK_INCOMPLETE', packDetail)
  } else if (sessions.length && !packComplete) {
    pushBlocker(hardBlockers, 'PACK_INCOMPLETE', 'Existing Packing Session must be completed before post')
    packReady = false
  }

  const challans = await prisma.deliveryChallan.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      deletedAt: null,
      status: { not: 'CANCELLED' },
    },
  })
  const activeIssued = challans.filter((c) => c.status === 'ISSUED')
  const challanQty = activeIssued.length === 1 ? n(activeIssued[0]!.totalQuantity) : 0
  let challanReady = !policy.requireIssuedChallanBeforePosting
  let challanDetail = policy.requireIssuedChallanBeforePosting
    ? 'Issued Challan required'
    : 'Issued Challan not required by policy'
  if (policy.requireIssuedChallanBeforePosting) {
    challanReady =
      activeIssued.length === 1 && roundQty(challanQty) === requestedQty
    challanDetail = challanReady
      ? `Issued ${activeIssued[0]!.challanNumber ?? activeIssued[0]!.id}`
      : !challans.length
        ? 'No Delivery Challan'
        : activeIssued.length !== 1
          ? `Challan status must be ISSUED (found ${challans.map((c) => c.status).join(', ')})`
          : `Challan qty ${challanQty} ≠ dispatch ${requestedQty}`
    if (!challanReady) pushBlocker(hardBlockers, 'CHALLAN_NOT_READY', challanDetail)
  } else if (challans.length && activeIssued.length !== 1) {
    pushBlocker(hardBlockers, 'CHALLAN_NOT_READY', 'Active Challan must be ISSUED before post')
    challanReady = false
  }

  let inventoryReady = true
  let inventoryDetail = 'Stock check deferred to posting transaction'
  let inventoryAvailableQty: number | null = null
  if (dispatch.lines.length) {
    const line = dispatch.lines[0]!
    const bal = await prisma.inventoryStockBalance.findFirst({
      where: { tenantId, itemId: line.itemId, warehouseId: line.warehouseId },
    })
    inventoryAvailableQty = bal ? n(bal.onHandQty) - n(bal.reservedQty ?? 0) : 0
    if (!policy.allowNegativeStock && inventoryAvailableQty + 1e-9 < requestedQty) {
      inventoryReady = false
      inventoryDetail = `Available ${inventoryAvailableQty} < posting ${requestedQty}`
      pushBlocker(hardBlockers, 'INSUFFICIENT_STOCK', inventoryDetail)
    } else {
      inventoryDetail = `Available ${inventoryAvailableQty ?? 0}`
    }
  }

  let salesOrderReady = true
  let salesOrderDetail = 'No Sales Order linkage'
  let soRemaining: number | null = null
  if (dispatch.salesOrderId) {
    salesOrderDetail = 'Sales Order linked'
    // Remaining computed at post via assertDispatchQtyAllowed; surface soft note only.
  }

  const isDraft = dispatch.status === 'DRAFT'
  const isConfirmed = dispatch.status === 'CONFIRMED'
  const postingReady =
    isDraft &&
    hardBlockers.filter((b) => b.severity === 'BLOCKER').length === 0 &&
    inventoryReady &&
    (mode === 'post' ? pickReady && packReady && challanReady && reservationReady : true)

  if (!isDraft) {
    pushBlocker(hardBlockers, 'NOT_DRAFT', `Status is ${dispatch.status}`)
  }

  const allowedActions: DispatchPostingReadiness['allowedActions'] = []
  if (isDraft && dispatch.planningSource === 'BASIC_7C0') allowedActions.push('CONFIRM')
  if (isDraft && postingReady && (dispatch.planningSource === 'WORKBENCH_7C1' || mode === 'post')) {
    allowedActions.push('POST')
  }
  if (isDraft && dispatch.planningSource === 'WORKBENCH_7C1' && postingReady) {
    if (!allowedActions.includes('POST')) allowedActions.push('POST')
  }
  // Soft BASIC confirm always allowed when draft unless hard blockers from existing docs
  if (isDraft && dispatch.planningSource === 'BASIC_7C0' && hardBlockers.every((b) => b.code !== 'CHALLAN_NOT_READY' && b.code !== 'PICK_INCOMPLETE' && b.code !== 'PACK_INCOMPLETE')) {
    if (!allowedActions.includes('CONFIRM')) allowedActions.push('CONFIRM')
  }
  if (isDraft) {
    allowedActions.push('CANCEL', 'RESERVE', 'PICK', 'PACK', 'CHALLAN')
  }
  if (isConfirmed) allowedActions.push('REVERSE')

  let lifecycleStatus: string = dispatch.status
  if (isDraft) {
    if (postingReady) lifecycleStatus = 'READY_TO_POST'
    else if (!challanReady && packReady) lifecycleStatus = 'CHALLAN_PENDING'
    else if (!packReady && pickReady) lifecycleStatus = 'PACK_IN_PROGRESS'
    else if (!pickReady && reservationReady) lifecycleStatus = 'PICK_IN_PROGRESS'
    else if (!reservationReady) lifecycleStatus = 'READY_TO_RESERVE'
    else lifecycleStatus = 'DRAFT'
  }

  const classified = classifyBlockersForEmergencyOverride(
    hardBlockers.filter((b) => b.severity === 'BLOCKER'),
  )
  let emergencyMessage =
    'No operational blockers — use normal Post Dispatch when ready.'
  if (classified.neverOverridable.length) {
    emergencyMessage =
      'Emergency override blocked — never-overridable integrity/policy issue(s) must be fixed first.'
  } else if (classified.unknown.length) {
    emergencyMessage =
      'Emergency override blocked — unclassified blockers are fail-closed until catalogued.'
  } else if (classified.canEmergencyOverride) {
    emergencyMessage =
      'Authorised users may open Emergency Dispatch Override for operational document gates only.'
  } else if (!hardBlockers.filter((b) => b.severity === 'BLOCKER').length) {
    emergencyMessage = 'Dispatch is ready to post without override.'
  }

  return {
    outboundDispatchId: dispatch.id,
    dispatchNo: dispatch.dispatchNo,
    status: dispatch.status,
    planningSource: dispatch.planningSource,
    hardenedPostingEnabled: isDispatchHardenedPostingEnabled(),
    policy,
    lifecycleStatus,
    quantity: {
      requestedQty,
      reservedQty,
      pickedQty,
      packedQty,
      challanQty: roundQty(challanQty),
      previouslyPostedQty: isConfirmed ? requestedQty : 0,
      postingQty: isDraft ? requestedQty : 0,
      salesOrderRemainingQty: soRemaining,
      inventoryAvailableQty,
      reversibleQty: isConfirmed ? requestedQty : 0,
    },
    hardBlockers,
    warnings,
    allowedActions: [...new Set(allowedActions)],
    emergencyOverride: {
      canRequest: isDraft && classified.canEmergencyOverride,
      requiresPermission: 'dispatch.override',
      overridableBlockers: classified.overridable as PostingBlocker[],
      neverOverridableBlockers: classified.neverOverridable as PostingBlocker[],
      unknownBlockers: classified.unknown as PostingBlocker[],
      message: emergencyMessage,
    },
    gates: {
      reservation: { ready: reservationReady, detail: reservationDetail },
      pick: { ready: pickReady, detail: pickDetail },
      pack: { ready: packReady, detail: packDetail },
      challan: { ready: challanReady, detail: challanDetail },
      quality: { ready: true, detail: policy.requireQualityClearance ? 'Quality gate uses stock hold at post' : 'Not required' },
      inventory: { ready: inventoryReady, detail: inventoryDetail },
      salesOrder: { ready: salesOrderReady, detail: salesOrderDetail },
      posting: {
        ready: postingReady,
        detail: postingReady ? 'Ready to post' : 'Dispatch cannot be posted',
      },
      reversal: {
        ready: isConfirmed,
        detail: isConfirmed ? 'Full header reverse available' : 'Only CONFIRMED outbound can be reversed',
      },
    },
  }
}

/** Alias for docs / imports. */
export const DispatchReadinessService = {
  getOutboundPostingReadiness,
  getDispatchPostingPolicy,
}
