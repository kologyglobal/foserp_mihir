/**
 * Live factory pulse — UI simulation layer for activity feed (does not mutate business data).
 */
import { useMemo, useState, useEffect } from 'react'
import { isApiMode } from '../config/apiConfig'
import { useLiveActivityMock } from './useLiveActivityMock'
import { activityFromNotifications } from '../utils/liveErpMetrics'
import { getErpNotifications } from '../services/erpAnalyticsService'
import { useWorkOrderStore } from '../store/workOrderStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useEcoStore } from '../store/ecoStore'
import { useQrStore } from '../store/qrStore'
import { useSerialStore } from '../store/serialStore'
import type { LiveActivityEvent } from '../components/live-erp/types'

function storeLinkedEvents(): LiveActivityEvent[] {
  const events: LiveActivityEvent[] = []
  const now = new Date().toISOString()

  const running = useWorkOrderStore.getState().workOrders.find((w) => w.status === 'in_production')
  if (running) {
    events.push({
      id: `store-wo-${running.id}`,
      icon: 'general',
      action: `WO ${running.woNo} in production`,
      timestamp: now,
      href: `/work-orders/${running.id}/360`,
      documentRef: running.woNo,
    })
  }

  const grn = usePurchaseStore.getState().grns.at(-1)
  if (grn) {
    events.push({
      id: `store-grn-${grn.id}`,
      icon: 'material',
      action: `GRN ${grn.grnNo} posted`,
      timestamp: grn.grnDate ?? now,
      documentRef: grn.grnNo,
    })
  }

  const failedQc = useQualityStore.getState().inspections.find((i) => i.result === 'reject' || i.status === 'reject')
  if (failedQc) {
    events.push({
      id: `store-qc-${failedQc.id}`,
      icon: 'qc',
      action: `QC ${failedQc.inspectionNo} recorded`,
      timestamp: failedQc.inspectionDate ?? now,
      documentRef: failedQc.inspectionNo,
    })
  }

  const ncr = useQualityStore.getState().ncrs.at(-1)
  if (ncr) {
    events.push({
      id: `store-ncr-${ncr.id}`,
      icon: 'qc',
      action: `NCR ${ncr.ncrNo} raised`,
      timestamp: ncr.reportedDate ?? now,
      documentRef: ncr.ncrNo,
    })
  }

  const dsp = useDispatchStore.getState().dispatches.find((d) => d.status === 'dispatched')
  if (dsp) {
    events.push({
      id: `store-dsp-${dsp.id}`,
      icon: 'dispatch',
      action: `Dispatch ${dsp.dispatchNo} confirmed`,
      timestamp: dsp.dispatchedAt ?? now,
      documentRef: dsp.dispatchNo,
    })
  }

  const inv = useInvoiceStore.getState().invoices.find((i) => i.status === 'posted')
  if (inv) {
    events.push({
      id: `store-inv-${inv.id}`,
      icon: 'payment',
      action: `Invoice ${inv.invoiceNo} posted`,
      timestamp: inv.invoiceDate ?? now,
      documentRef: inv.invoiceNo,
    })
  }

  const pay = useInvoiceStore.getState().invoices.flatMap((i) => i.payments).at(-1)
  if (pay) {
    events.push({
      id: `store-pay-${pay.id}`,
      icon: 'payment',
      action: `Payment ${pay.referenceNo} received`,
      timestamp: pay.paymentDate ?? now,
      documentRef: pay.referenceNo,
    })
  }

  const eco = useEcoStore.getState().ecos.find((e) => e.approvalStatus === 'released')
  if (eco) {
    events.push({
      id: `store-eco-${eco.id}`,
      icon: 'approval',
      action: `ECO ${eco.ecoNo} released`,
      timestamp: eco.releasedAt ?? now,
      documentRef: eco.ecoNo,
    })
  }

  const qr = useQrStore.getState().records.at(-1)
  if (qr) {
    events.push({
      id: `store-qr-${qr.qrId}`,
      icon: 'qr',
      action: `QR generated for ${qr.displayCode}`,
      timestamp: qr.createdAt ?? now,
      documentRef: qr.displayCode,
    })
  }

  const serial = useSerialStore.getState().serials.at(-1)
  if (serial) {
    events.push({
      id: `store-serial-${serial.id}`,
      icon: 'general',
      action: `Serial ${serial.serialNo} assigned`,
      timestamp: serial.createdAt ?? now,
      documentRef: serial.serialNo,
    })
  }

  return events
}

/**
 * Phase 8C Wave 1 (8B-R-010): in API mode this pulse is fully disabled —
 * no mock events, no demo-notification synthesis, no reads from persisted
 * demo Zustand slices. Callers receive an empty, non-live feed.
 */
export function useLiveFactoryPulse(minEvents = 10) {
  const demoMode = !isApiMode()
  const mock = useLiveActivityMock(demoMode, Math.max(minEvents, 10))
  const [lastUpdated, setLastUpdated] = useState(() => Date.now())

  useEffect(() => {
    if (!demoMode) return
    const t = window.setInterval(() => setLastUpdated(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [demoMode])

  const notifications = useMemo(() => (demoMode ? getErpNotifications() : []), [lastUpdated, demoMode])
  const linked = useMemo(() => (demoMode ? storeLinkedEvents() : []), [lastUpdated, demoMode])

  const events = useMemo(() => {
    const merged = [
      ...linked,
      ...activityFromNotifications(notifications),
      ...mock,
    ]
    const seen = new Set<string>()
    const unique: LiveActivityEvent[] = []
    for (const e of merged) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      unique.push(e)
    }
    return unique.slice(0, Math.max(minEvents, 10))
  }, [linked, notifications, mock, minEvents])

  return {
    events,
    lastUpdated,
    live: demoMode,
    eventCount: events.length,
  }
}
