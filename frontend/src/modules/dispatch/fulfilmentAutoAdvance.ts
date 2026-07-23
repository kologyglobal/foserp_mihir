/**
 * Guided Fulfilment Auto Mode — open the next dispatch screen after each success
 * (same preference as WO: getFulfilmentAutoMode). User still confirms posting.
 */
import type { NavigateFunction } from 'react-router-dom'
import { getFulfilmentAutoMode } from '@/modules/manufacturing/ui'
import { notify } from '@/store/toastStore'
import {
  createDeliveryChallan,
  createDispatchPackingSessions,
  createDispatchPickLists,
  listDeliveryChallans,
  listDispatchPackingSessions,
  listDispatchPickLists,
} from '@/services/api/dispatchApi'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Auto-advance failed'
}

/** After reserve → open/create pick list pick mode. */
export async function advanceAfterReserve(
  dispatchId: string,
  navigate: NavigateFunction,
): Promise<void> {
  if (!getFulfilmentAutoMode()) return
  try {
    const existing = await listDispatchPickLists({ outboundDispatchId: dispatchId, limit: 10 })
    const open = existing.items?.find((p) => p.status !== 'CANCELLED' && p.status !== 'PICKED')
    if (open?.id) {
      notify.success('Reserved — continue picking')
      navigate(`/dispatch/pick-lists/${open.id}/pick`)
      return
    }
    const done = existing.items?.find((p) => p.status === 'PICKED')
    if (done?.id) {
      notify.info('Already picked — opening packing')
      await advanceAfterPickComplete(dispatchId, navigate)
      return
    }
    const created = await createDispatchPickLists(dispatchId, {
      idempotencyKey: `auto-pick-${dispatchId}-${Date.now()}`,
    })
    const pickId = created[0]?.id
    if (!pickId) {
      notify.warning('Reserved — create a pick list from the coach')
      return
    }
    notify.success('Reserved — pick list opened')
    navigate(`/dispatch/pick-lists/${pickId}/pick`)
  } catch (e) {
    notify.warning(`Reserved — open pick manually (${errMsg(e)})`)
  }
}

/** After pick list complete → open/create packing session. */
export async function advanceAfterPickComplete(
  dispatchId: string,
  navigate: NavigateFunction,
): Promise<void> {
  if (!getFulfilmentAutoMode()) return
  try {
    const existing = await listDispatchPackingSessions({ outboundDispatchId: dispatchId, limit: 10 })
    const open = existing.items?.find(
      (s) => !['CANCELLED', 'PACKED', 'VERIFIED'].includes(s.status),
    )
    if (open?.id) {
      notify.success('Pick complete — continue packing')
      navigate(`/dispatch/packing-sessions/${open.id}/pack`)
      return
    }
    const ready = existing.items?.find((s) => s.status === 'PACKED' || s.status === 'VERIFIED')
    if (ready?.id) {
      notify.info('Already packed — opening challan')
      await advanceAfterPackReady(dispatchId, navigate)
      return
    }
    const created = await createDispatchPackingSessions(dispatchId, {
      idempotencyKey: `auto-pack-${dispatchId}-${Date.now()}`,
    })
    const sessionId = created[0]?.id
    if (!sessionId) {
      notify.warning('Pick complete — start packing from the coach')
      return
    }
    notify.success('Pick complete — packing opened')
    navigate(`/dispatch/packing-sessions/${sessionId}/pack`)
  } catch (e) {
    notify.warning(`Pick complete — open packing manually (${errMsg(e)})`)
  }
}

/** After packing complete/verify → open/create delivery challan. */
export async function advanceAfterPackReady(
  dispatchId: string,
  navigate: NavigateFunction,
): Promise<void> {
  if (!getFulfilmentAutoMode()) return
  try {
    const existing = await listDeliveryChallans({ outboundDispatchId: dispatchId, limit: 10 })
    const active = existing.items?.find((c) => c.status !== 'CANCELLED' && c.status !== 'SUPERSEDED')
    if (active?.id) {
      if (active.status === 'ISSUED') {
        notify.success('Packed — challan issued; open Post on outbound')
        navigate(`/dispatch/${dispatchId}?focus=post`)
        return
      }
      notify.success('Packed — continue challan (issue to clear 7C5 gate)')
      navigate(`/dispatch/delivery-challans/${active.id}`)
      return
    }
    const created = await createDeliveryChallan(dispatchId, {
      idempotencyKey: `auto-dc-${dispatchId}-${Date.now()}`,
    })
    notify.success('Packed — challan draft opened (issue next)')
    navigate(`/dispatch/delivery-challans/${created.id}`)
  } catch (e) {
    notify.warning(`Packed — open challan manually (${errMsg(e)})`)
  }
}

/** After challan issued → outbound detail for Post Dispatch. */
export function advanceAfterChallanIssued(
  dispatchId: string,
  navigate: NavigateFunction,
): void {
  if (!getFulfilmentAutoMode()) return
  notify.success('Challan issued — post dispatch when gates are clear')
  navigate(`/dispatch/${dispatchId}?focus=post`)
}
