import { useMemo } from 'react'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useMasterStore } from '../store/masterStore'
import { useQualityStore } from '../store/qualityStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useMrpStore } from '../store/mrpStore'
import { useJobWorkExecutionStore } from '../store/jobWorkExecutionStore'
import { toJobWorkOrderView } from './jobWorkAdapter'
import { formatDate } from './dates/format'
export function useWorkOrder360(workOrderId: string | undefined) {
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const materialLines = useWorkOrderStore((s) => s.materialLines)
  const productionOperations = useWorkOrderStore((s) => s.productionOperations)
  const jobCards = useWorkOrderStore((s) => s.jobCards)
  const subcontractShipments = useWorkOrderStore((s) => s.subcontractShipments)
  const activities = useWorkOrderStore((s) => s.activities)
  const fgReceipts = useWorkOrderStore((s) => s.fgReceipts)
  const saReceipts = useWorkOrderStore((s) => s.saReceipts)
  const inspections = useQualityStore((s) => s.inspections)
  const reworks = useQualityStore((s) => s.reworks)
  const ncrs = useQualityStore((s) => s.ncrs)
  const metaByWoId = useJobWorkExecutionStore((s) => s.metaByWoId)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)

  return useMemo(() => {
    if (!workOrderId) return null
    const wo = useWorkOrderStore.getState().getWorkOrder(workOrderId)
    if (!wo) return null

    const getCustomer = useMasterStore.getState().getCustomer
    const getProduct = useMasterStore.getState().getProduct
    const getItem = useMasterStore.getState().getItem
    const getVendor = useMasterStore.getState().getVendor

    const mats = materialLines.filter((l) => l.workOrderId === workOrderId)
    const ops = productionOperations.filter((o) => o.workOrderId === workOrderId)
    const cards = jobCards.filter((j) => j.workOrderId === workOrderId)
    const shipments = subcontractShipments.filter((s) => s.workOrderId === workOrderId)
    const woInspections = inspections.filter((i) => i.workOrderId === workOrderId)
    const woReworks = reworks.filter((r) => r.workOrderId === workOrderId)
    const woNcrs = ncrs.filter((n) => n.workOrderId === workOrderId)
    const woActivities = activities.filter((a) => a.workOrderId === workOrderId)

    const product = getProduct(wo.productId)
    const so = useMrpStore.getState().salesOrders.find((s) => s.id === wo.salesOrderId)
    const customer = so ? getCustomer(so.customerId) : undefined

    const totalRequired = mats.reduce((s, l) => s + l.requiredQty, 0)
    const totalIssued = mats.reduce((s, l) => s + l.issuedQty, 0)
    const totalReserved = mats.reduce((s, l) => s + l.reservedQty, 0)
    const materialReadinessPct =
      totalRequired > 0 ? Math.round(((totalReserved + totalIssued) / (totalRequired * 2)) * 100) : 100

    const completedOps = ops.filter((o) => o.status === 'completed').length
    const operationsCompletedPct = ops.length > 0 ? Math.round((completedOps / ops.length) * 100) : 0

    const qcHolds = woInspections.filter((i) => i.status === 'pending').length + cards.filter((c) => c.status === 'qc_hold').length
    const reworkCount = woReworks.filter((r) => !['closed', 'reinspected'].includes(r.status)).length

    const issuedMaterialValue = mats.reduce((s, l) => {
      const rate = getItem(l.itemId)?.standardRate ?? 0
      return s + l.issuedQty * rate
    }, 0)

    const actualCost = issuedMaterialValue + shipments.reduce((s, sh) => {
      const rate = getItem(sh.itemId)?.standardRate ?? 0
      return s + sh.receivedQty * rate
    }, 0)

    const plannedCost = mats.reduce((s, l) => s + l.requiredQty * (getItem(l.itemId)?.standardRate ?? 0), 0)
    const variancePct = plannedCost > 0 ? Math.round(((actualCost - plannedCost) / plannedCost) * 100) : 0

    const daysDelayed =
      wo.plannedFinishDate && !['closed', 'completed', 'cancelled', 'fg_received'].includes(wo.status)
        ? Math.max(0, Math.floor((Date.now() - new Date(wo.plannedFinishDate).getTime()) / 86400000))
        : 0

    const currentOp = ops.find((o) => ['in_progress', 'qc_hold'].includes(o.status))
      ?? ops.find((o) => o.status === 'pending')
    const nextOp = ops.find((o) => o.status === 'pending' && o.sequenceNo > (currentOp?.sequenceNo ?? 0))

    const blockers: string[] = []
    if (mats.some((l) => l.balanceQty > 0 && l.issuedQty < l.requiredQty)) {
      blockers.push('Material not fully issued')
    }
    if (qcHolds > 0) blockers.push(`${qcHolds} QC hold(s)`)
    if (woNcrs.some((n) => n.status !== 'closed')) blockers.push('Open NCR')
    if (daysDelayed > 0) blockers.push(`${daysDelayed} day(s) behind schedule`)

    let nextAction = 'Review work order status'
    if (wo.status === 'draft') nextAction = 'Plan and release work order'
    else if (mats.some((l) => l.reservedQty < l.requiredQty)) nextAction = 'Reserve material'
    else if (mats.some((l) => l.issuedQty < l.requiredQty)) nextAction = 'Issue material'
    else if (currentOp?.status === 'pending') nextAction = `Start ${currentOp.operationName}`
    else if (qcHolds > 0) nextAction = 'Clear QC holds'
    else if (wo.status === 'completed') nextAction = 'Post FG receipt'
    else if (wo.status === 'in_production') nextAction = 'Continue shop floor operations'

    const progressPct = Math.round((operationsCompletedPct + materialReadinessPct) / 2)

    const meta = metaByWoId[workOrderId]
    const jwo =
      wo.woType === 'subcontract'
        ? toJobWorkOrderView(
            wo,
            shipments,
            meta,
            wo.vendorId ? getVendor(wo.vendorId)?.vendorName ?? '—' : '—',
            woInspections,
            mats[0]?.itemCode ?? null,
            meta?.rate ?? 0,
          )
        : null

    const movements = useInventoryStore
      .getState()
      .stockMovements.filter((m) => m.workOrderId === workOrderId)
      .slice(0, 20)

    return {
      wo,
      customer,
      product,
      mats,
      ops,
      cards,
      shipments,
      woInspections,
      woReworks,
      woNcrs,
      woActivities,
      fgReceipts: fgReceipts.filter((r) => r.workOrderId === workOrderId),
      saReceipts: saReceipts.filter((r) => r.parentWoId === workOrderId || r.sourceWoId === workOrderId),
      jwo,
      kpis: {
        materialReadinessPct,
        operationsCompletedPct,
        qcHolds,
        reworkCount,
        issuedMaterialValue,
        actualCost,
        variancePct,
        daysDelayed,
        progressPct,
      },
      currentOp,
      nextOp,
      nextAction,
      blockers,
      movements,
      activityFeed: woActivities.slice(0, 12).map((a) => ({
        id: a.id,
        title: a.action,
        meta: a.details,
        time: formatDate(a.createdAt.slice(0, 10)),
      })),
    }
  }, [
    workOrderId,
    workOrders,
    materialLines,
    productionOperations,
    jobCards,
    subcontractShipments,
    activities,
    fgReceipts,
    saReceipts,
    inspections,
    reworks,
    ncrs,
    metaByWoId,
    customers,
    products,
  ])
}

export function useJobWorkOrders() {
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const subcontractShipments = useWorkOrderStore((s) => s.subcontractShipments)
  const materialLines = useWorkOrderStore((s) => s.materialLines)
  const inspections = useQualityStore((s) => s.inspections)
  const metaByWoId = useJobWorkExecutionStore((s) => s.metaByWoId)
  const vendors = useMasterStore((s) => s.vendors)
  const items = useMasterStore((s) => s.items)

  return useMemo(() => {
    const getVendor = useMasterStore.getState().getVendor
    const getItem = useMasterStore.getState().getItem

    return workOrders
      .filter((w) => w.woType === 'subcontract')
      .map((wo) => {
        const shipments = subcontractShipments.filter((s) => s.workOrderId === wo.id)
        const meta = metaByWoId[wo.id]
        const matLine = materialLines.find((l) => l.workOrderId === wo.id)
        const rate = matLine ? getItem(matLine.itemId)?.standardRate ?? 0 : 0
        return toJobWorkOrderView(
          wo,
          shipments,
          meta,
          wo.vendorId ? getVendor(wo.vendorId)?.vendorName ?? '—' : '—',
          inspections,
          matLine?.itemCode ?? null,
          rate,
        )
      })
      .sort((a, b) => b.jwoNo.localeCompare(a.jwoNo))
  }, [workOrders, subcontractShipments, materialLines, inspections, metaByWoId, vendors, items])
}

export function useVendorJobWorkMetrics(vendorId: string | undefined) {
  const jwos = useJobWorkOrders()
  const ncrs = useQualityStore((s) => s.ncrs)
  const subcontractShipments = useWorkOrderStore((s) => s.subcontractShipments)

  return useMemo(() => {
    if (!vendorId) return null
    const vendorJwos = jwos.filter((j) => j.vendorId === vendorId)
    const openJwo = vendorJwos.filter((j) => !['closed', 'received'].includes(j.status))
    const materialWithVendor = subcontractShipments
      .filter((s) => s.vendorId === vendorId && s.sentQty > s.receivedQty + s.rejectedQty)
      .reduce((sum, s) => sum + s.sentQty - s.receivedQty - s.rejectedQty, 0)
    const pendingReturn = vendorJwos.filter((j) => j.balanceQty > 0).length
    const jobWorkSpend = vendorJwos.reduce((s, j) => s + j.amount, 0)
    const vendorNcrs = ncrs.filter((n) => n.vendorId === vendorId && n.source === 'subcontract_return')
    const totalReceived = vendorJwos.reduce((s, j) => s + j.receivedQty, 0)
    const totalRejected = vendorJwos.reduce((s, j) => s + j.rejectedQty, 0)
    const rejectionPct = totalReceived + totalRejected > 0 ? Math.round((totalRejected / (totalReceived + totalRejected)) * 100) : 0

    const onTime = vendorJwos.filter((j) => {
      if (!j.expectedReturnDate || !j.actualReturnDate) return false
      return j.actualReturnDate <= j.expectedReturnDate
    }).length
    const withDates = vendorJwos.filter((j) => j.expectedReturnDate && j.actualReturnDate).length
    const onTimeReturnPct = withDates > 0 ? Math.round((onTime / withDates) * 100) : 100

    const turnaroundDays = vendorJwos
      .filter((j) => j.actualReturnDate)
      .map((j) => {
        const sent = subcontractShipments.find((s) => s.workOrderId === j.workOrderId)
        if (!sent?.sentAt || !j.actualReturnDate) return 0
        return Math.max(0, Math.floor((new Date(j.actualReturnDate).getTime() - new Date(sent.sentAt).getTime()) / 86400000))
      })
    const avgTurnaroundDays = turnaroundDays.length > 0 ? Math.round(turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length) : 0

    return {
      openJwo,
      materialWithVendor,
      pendingReturn,
      jobWorkSpend,
      rejectionPct,
      onTimeReturnPct,
      avgTurnaroundDays,
      vendorJwos,
      vendorNcrs,
    }
  }, [vendorId, jwos, ncrs, subcontractShipments])
}

export type JobCardWorkbenchView =
  | 'my_jobs'
  | 'all_open'
  | 'waiting_material'
  | 'in_progress'
  | 'qc_pending'
  | 'rework'
  | 'completed'

export function useJobCardWorkbench(view: JobCardWorkbenchView, teamFilter?: string) {
  const jobCards = useWorkOrderStore((s) => s.jobCards)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const productionOperations = useWorkOrderStore((s) => s.productionOperations)
  const materialLines = useWorkOrderStore((s) => s.materialLines)
  const reworks = useQualityStore((s) => s.reworks)
  const inspections = useQualityStore((s) => s.inspections)

  return useMemo(() => {
    const openWoIds = new Set(
      workOrders.filter((w) => !['closed', 'cancelled', 'completed', 'fg_received'].includes(w.status)).map((w) => w.id),
    )

    let rows = jobCards.filter((j) => {
      if (view === 'completed') return j.status === 'completed'
      if (view === 'all_open') return openWoIds.has(j.workOrderId) && j.status !== 'completed'
      return openWoIds.has(j.workOrderId) || j.status === 'completed'
    })

    if (teamFilter && view === 'my_jobs') {
      rows = rows.filter((j) => !j.assignedTeam || j.assignedTeam === teamFilter)
    }

    if (view === 'waiting_material') {
      const shortWoIds = new Set(
        materialLines
          .filter((l) => {
            const wo = workOrders.find((w) => w.id === l.workOrderId)
            return wo && l.issuedQty < l.requiredQty
          })
          .map((l) => l.workOrderId),
      )
      rows = rows.filter((j) => shortWoIds.has(j.workOrderId) && j.status !== 'completed')
    } else if (view === 'in_progress') {
      rows = rows.filter((j) => j.status === 'in_progress')
    } else if (view === 'qc_pending') {
      rows = rows.filter((j) => j.status === 'qc_hold' || j.requiresQc)
    } else if (view === 'rework') {
      const reworkWoIds = new Set(reworks.filter((r) => !['closed', 'reinspected'].includes(r.status)).map((r) => r.workOrderId))
      rows = rows.filter((j) => reworkWoIds.has(j.workOrderId))
    } else if (view === 'my_jobs') {
      rows = rows.filter((j) => j.status !== 'completed')
    } else if (view === 'all_open') {
      rows = rows.filter((j) => j.status !== 'completed')
    }

    rows = [...rows].sort((a, b) => {
      const order = { in_progress: 0, qc_hold: 1, assigned: 2, pending: 3, completed: 4 }
      return (order[a.status] ?? 5) - (order[b.status] ?? 5) || a.sequenceNo - b.sequenceNo
    })

    return {
      rows,
      getOperation: (id: string) => productionOperations.find((o) => o.id === id),
      getWo: (id: string) => workOrders.find((w) => w.id === id),
      pendingQcCount: inspections.filter((i) => i.status === 'pending').length,
    }
  }, [view, teamFilter, jobCards, workOrders, productionOperations, materialLines, reworks, inspections])
}
