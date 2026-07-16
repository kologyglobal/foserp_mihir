import { useMrpStore } from '../../store/mrpStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { SATURATION_TARGETS } from './demoSeedCatalog'

function subcontractCount() {
  return useWorkOrderStore.getState().workOrders.filter((w) => w.woType === 'subcontract').length
}

/** Ensure subcontract (job work) WOs meet saturation target */
export function seedDemoJobWorkOrders(): void {
  const mrp = useMrpStore.getState()
  const eligibleSos = mrp.salesOrders.filter((s) => !['closed', 'cancelled'].includes(s.status))

  for (const so of eligibleSos) {
    if (subcontractCount() >= SATURATION_TARGETS.jobWorkOrders) break

    const hasSub = useWorkOrderStore.getState().workOrders.some(
      (w) => w.salesOrderId === so.id && w.woType === 'subcontract',
    )
    if (hasSub) continue

    let run = mrp.runs.find((r) => r.salesOrderIds.includes(so.id))
    if (!run) {
      if (so.status === 'open') useMrpStore.getState().confirmSalesOrder(so.id)
      const mrpRes = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
      if (mrpRes.ok && mrpRes.runId) run = useMrpStore.getState().getRun(mrpRes.runId)
    }
    if (!run) continue

    if (useWorkOrderStore.getState().workOrders.some((w) => w.salesOrderId === so.id)) continue

    useWorkOrderStore.getState().createFromMrpRun(run.id, so.id)
  }
}
