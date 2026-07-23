import { useEffect, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import type { LiveActivityEvent } from '../components/live-erp/types'

const MOCK_EVENTS: Omit<LiveActivityEvent, 'id' | 'timestamp'>[] = [
  { icon: 'qc', action: 'WO-0003 moved to QC Pending', user: 'System', documentRef: 'WO-0003', href: '/manufacturing/work-orders', simulated: true },
  { icon: 'general', action: 'PO-0021 expected delivery tomorrow', user: 'Purchase', documentRef: 'PO-0021', href: '/purchase/orders', simulated: true },
  { icon: 'material', action: 'Material shortage detected for Axle ABS-6620', user: 'MRP', documentRef: 'Item ABS-6620', href: '/manufacturing/today', simulated: true },
  { icon: 'dispatch', action: 'Dispatch POD pending for ABC Cement', user: 'Dispatch', documentRef: 'DSP-0042', href: '/dispatch/register', simulated: true },
  { icon: 'approval', action: 'PR awaiting Purchase Head approval', user: 'Store', documentRef: 'PR-0018', href: '/purchase/requisitions', simulated: true },
  { icon: 'approval', action: 'Gate pass awaiting security sign-off', user: 'Dispatch', documentRef: 'DSP-0051', href: '/dispatch/register', simulated: true },
  { icon: 'qc', action: 'Final QC passed on WO-0008 — dispatch candidate', user: 'QC', documentRef: 'WO-0008', href: '/quality/queue', simulated: true },
  { icon: 'material', action: 'Steel plate stock below reorder for chassis line', user: 'MRP', documentRef: 'Item STL-12', href: '/manufacturing/production-plan', simulated: true },
]

function pickMockEvents(count: number): LiveActivityEvent[] {
  const now = Date.now()
  const shuffled = [...MOCK_EVENTS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map((e, i) => ({
    ...e,
    id: `live-mock-${i}-${now}`,
    timestamp: new Date(now - i * 120_000).toISOString(),
  }))
}

/**
 * Simulated live activity layer — does not modify business stores.
 * Rotates display events every 45s for a live manufacturing feel.
 *
 * Phase 8C Wave 1 (8B-R-010): hard-disabled in API mode. Simulated ticker
 * events must never render alongside live operational data.
 */
export function useLiveActivityMock(enabled = true, maxEvents = 3) {
  const active = enabled && !isApiMode()
  const [events, setEvents] = useState<LiveActivityEvent[]>(() => (active ? pickMockEvents(maxEvents) : []))

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      setEvents(pickMockEvents(maxEvents))
    }, 45_000)
    return () => clearInterval(interval)
  }, [active, maxEvents])

  return active ? events : []
}
