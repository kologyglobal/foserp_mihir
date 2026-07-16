import { useMemo } from 'react'
import { useMasterStore } from '../store/masterStore'
import { useInventoryStore } from '../store/inventoryStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useMrpStore } from '../store/mrpStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useBomStore } from '../store/bomStore'
import { useRoutingStore } from '../store/routingStore'
import { useSalesStore } from '../store/salesStore'
import { useCrmStore } from '../store/crmStore'
import { useCostingStore } from '../store/costingStore'
import { computeBomTotalCost, flattenBomTree } from './bom'
import { formatDate } from './dates/format'
import { resolveCustomerCreditLimit } from './customerUtils'
import type { TimelineEvent } from '../components/design-system/Timeline'

const monthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const quarterStart = () => {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3) * 3
  return `${d.getFullYear()}-${String(q + 1).padStart(2, '0')}-01`
}

export function useItem360(itemId: string | undefined) {
  const items = useMasterStore((s) => s.items)
  const stockMovements = useInventoryStore((s) => s.stockMovements)
  const reservations = useInventoryStore((s) => s.reservations)
  const requisitions = usePurchaseStore((s) => s.requisitions)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const materialLines = useWorkOrderStore((s) => s.materialLines)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const mrpRuns = useMrpStore((s) => s.runs)

  return useMemo(() => {
    if (!itemId) return null
    const item = useMasterStore.getState().getItem(itemId)
    if (!item) return null

    const getCategoryName = useMasterStore.getState().getCategoryName
    const getUomName = useMasterStore.getState().getUomName
    const getVendorMapsForItem = useMasterStore.getState().getVendorMapsForItem
    const getVendor = useMasterStore.getState().getVendor
    const warehouses = useMasterStore.getState().warehouses

    const positions = useInventoryStore.getState().getStockPositions(undefined, item.itemCode).filter((p) => p.itemId === itemId)
    const onHand = positions.reduce((s, p) => s + p.onHand, 0)
    const reserved = positions.reduce((s, p) => s + p.reservedQty, 0)
    const available = positions.reduce((s, p) => s + p.freeQty, 0)
    const stockValue = positions.reduce((s, p) => s + p.stockValue, 0)

    const quarantineWh = new Set(warehouses.filter((w) => w.warehouseType === 'quarantine').map((w) => w.id))
    const quarantine = positions.filter((p) => quarantineWh.has(p.warehouseId)).reduce((s, p) => s + p.onHand, 0)

    const openPr = requisitions.filter(
      (pr) => ['draft', 'submitted', 'approved'].includes(pr.status) && pr.lines.some((l) => l.itemId === itemId),
    )
    const openPo = purchaseOrders.filter(
      (po) => !['closed', 'cancelled'].includes(po.status) && po.lines.some((l) => l.itemId === itemId),
    )
    const inTransit = openPo.reduce((s, po) => {
      const line = po.lines.find((l) => l.itemId === itemId)
      return s + (line ? line.qty - line.receivedQty : 0)
    }, 0)

    const vendorMaps = getVendorMapsForItem(itemId)
    const preferredMap = vendorMaps.find((m) => m.isPreferred) ?? vendorMaps[0]
    const lastRate = vendorMaps.reduce((max, m) => Math.max(max, m.lastRate), item.standardRate)

    const movements = useInventoryStore.getState().getItemMovements(itemId)
    const ms = monthStart()
    const qs = quarterStart()
    const consumedMonth = movements.filter((m) => m.qty < 0 && m.movementDate >= ms).reduce((s, m) => s + Math.abs(m.qty), 0)
    const consumedQuarter = movements.filter((m) => m.qty < 0 && m.movementDate >= qs).reduce((s, m) => s + Math.abs(m.qty), 0)

    const woUsage = materialLines
      .filter((l) => l.itemId === itemId && l.issuedQty > 0)
      .map((l) => {
        const wo = workOrders.find((w) => w.id === l.workOrderId)
        return { woId: l.workOrderId, woNo: wo?.woNo ?? '—', qty: l.issuedQty }
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)

    const latestRun = useMrpStore.getState().getLatestRun()
    const mrpLines = latestRun?.materialLines.filter((m) => m.itemId === itemId) ?? []
    const shortage = mrpLines.reduce((s, m) => s + m.shortageQty, 0)
    const demand = mrpLines.reduce((s, m) => s + m.requiredQty, 0)
    const supply = mrpLines.reduce((s, m) => s + m.freeStock, 0)

    const activity = movements.slice(0, 8).map((m) => ({
      id: m.id,
      title: m.movementType.replace('_', ' '),
      meta: `${m.movementNo} · ${m.qty} qty`,
      time: formatDate(m.movementDate),
    }))

    return {
      item,
      categoryName: getCategoryName(item.categoryId),
      uomName: getUomName(item.baseUomId),
      onHand,
      reserved,
      available,
      stockValue,
      quarantine,
      inTransit,
      openPr,
      openPo,
      vendorMaps,
      preferredVendor: preferredMap ? getVendor(preferredMap.vendorId)?.vendorName ?? '—' : '—',
      lastRate,
      consumedMonth,
      consumedQuarter,
      woUsage,
      shortage,
      demand,
      supply,
      mrpLines,
      movements,
      grnMovements: movements.filter((m) => m.referenceType === 'GRN'),
      issueMovements: movements.filter((m) => m.movementType === 'issue'),
      adjustmentMovements: movements.filter((m) => m.movementType === 'adjustment'),
      transferMovements: movements.filter((m) => ['WIP_TRANSFER', 'MOVE_TO_WIP', 'MOVE_FROM_WIP'].includes(m.referenceType)),
      activity,
      warehouseBreakdown: positions,
    }
  }, [itemId, items, stockMovements, reservations, requisitions, purchaseOrders, materialLines, workOrders, mrpRuns])
}

export function useVendor360(vendorId: string | undefined) {
  const vendors = useMasterStore((s) => s.vendors)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const ncrs = useQualityStore((s) => s.ncrs)
  const itemVendorMaps = useMasterStore((s) => s.itemVendorMaps)

  return useMemo(() => {
    if (!vendorId) return null
    const vendor = useMasterStore.getState().getVendor(vendorId)
    if (!vendor) return null

    const pos = purchaseOrders.filter((po) => po.vendorId === vendorId)
    const openPo = pos.filter((po) => !['closed', 'cancelled'].includes(po.status))
    const closedPo = pos.filter((po) => po.status === 'closed')
    const pendingDelivery = usePurchaseStore
      .getState()
      .getDelayedPoReport()
      .filter((d) => usePurchaseStore.getState().getPo(d.poId)?.vendorId === vendorId)

    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const yearKey = String(now.getFullYear())

    function poSpend(poList: typeof pos) {
      return poList.reduce((s, po) => s + po.lines.reduce((ls, l) => ls + l.qty * l.rate, 0), 0)
    }

    const spendMonth = poSpend(pos.filter((po) => po.createdAt.startsWith(monthKey)))
    const spendQuarter = poSpend(
      pos.filter((po) => {
        const d = new Date(po.createdAt)
        const q = Math.floor(d.getMonth() / 3)
        const cq = Math.floor(now.getMonth() / 3)
        return d.getFullYear() === now.getFullYear() && q === cq
      }),
    )
    const spendYear = poSpend(pos.filter((po) => po.createdAt.startsWith(yearKey)))

    const maps = itemVendorMaps.filter((m) => m.vendorId === vendorId)
    const vendorItemIds = new Set(maps.map((m) => m.itemId))
    const vendorNcrs = ncrs.filter((n) => n.vendorId === vendorId || vendorItemIds.has(n.itemId))

    const onTimeTotal = closedPo.length + openPo.length
    const onTimePct = onTimeTotal > 0 ? Math.round(((onTimeTotal - pendingDelivery.length) / onTimeTotal) * 100) : 100
    const qualityPct = vendorNcrs.length === 0 ? 98 : Math.max(60, 98 - vendorNcrs.length * 5)

    const activity = pos.slice(0, 8).map((po) => ({
      id: po.id,
      title: `PO ${po.poNo}`,
      meta: po.status,
      time: formatDate(po.createdAt.slice(0, 10)),
    }))

    return {
      vendor,
      openPo,
      closedPo,
      pendingDelivery,
      spendMonth,
      spendQuarter,
      spendYear,
      vendorNcrs,
      rejectedQty: vendorNcrs.length * 2,
      maps,
      onTimePct,
      qualityPct,
      activity,
    }
  }, [vendorId, vendors, purchaseOrders, ncrs, itemVendorMaps])
}

export function getCustomer360Data(customerId: string | undefined) {
  if (!customerId) return null
  const customer = useMasterStore.getState().getCustomer(customerId)
  if (!customer) return null

  const salesOrders = useMrpStore.getState().salesOrders
  const dispatches = useDispatchStore.getState().dispatches
  const invoices = useInvoiceStore.getState().invoices
  const opportunities = useCrmStore.getState().opportunities
  const quotations = useSalesStore.getState().quotations
  const workOrders = useWorkOrderStore.getState().workOrders
  const getProduct = useMasterStore.getState().getProduct

  const orders = salesOrders.filter((so) => so.customerId === customerId)
  const orderIds = new Set(orders.map((o) => o.id))
  const openSo = orders.filter((so) => !['closed', 'cancelled'].includes(so.status))
  const closedSo = orders.filter((so) => so.status === 'closed')
  const revenue = orders.reduce((s, o) => s + (o.grandTotal ?? 0), 0)

  const customerOpportunities = opportunities.filter((o) => o.customerId === customerId)
  const openOpportunities = customerOpportunities.filter((o) => o.status === 'open')
  const customerQuotations = quotations.filter((q) => q.customerId === customerId)
  const openQuotations = customerQuotations.filter(
    (q) => q.isLatestRevision && !['converted', 'cancelled', 'superseded', 'rejected'].includes(q.status),
  )

  const customerWorkOrders = workOrders.filter((w) => orderIds.has(w.salesOrderId))
  const activeWo = customerWorkOrders.filter((w) => !['closed', 'cancelled', 'completed', 'fg_received'].includes(w.status))

  const productIds = new Set(orders.map((o) => o.productId))
  const productsOrdered = [...productIds].map((pid) => getProduct(pid)).filter(Boolean)

  const customerDispatches = dispatches.filter((d) => d.customerId === customerId)
  const pendingDispatch = customerDispatches.filter((d) => !['delivered', 'pod_received', 'closed', 'cancelled'].includes(d.status))
  const lastDispatch = [...customerDispatches].sort((a, b) => b.plannedDate.localeCompare(a.plannedDate))[0]
  const podPending = customerDispatches.filter((d) => ['dispatched', 'in_transit', 'delivered'].includes(d.status))

  const customerInvoices = invoices.filter((i) => i.customerId === customerId)
  const invoiceValue = customerInvoices.reduce((s, i) => s + i.gst.grandTotal, 0)
  const received = customerInvoices.reduce((s, i) => s + i.amountPaid, 0)
  const outstanding = customerInvoices.reduce((s, i) => s + i.balanceDue, 0)

  const complaints = customerOpportunities.filter((o) => o.status === 'lost').length

  const leads = useSalesStore.getState().leads.filter((l) => l.customerId === customerId)
  const approvedQuotes = customerQuotations.filter((q) => q.isLatestRevision && q.customerApproval === 'approved')
  const lostQuotes = customerQuotations.filter(
    (q) => q.isLatestRevision && ['rejected', 'cancelled', 'superseded'].includes(q.status),
  )

  const inProductionSo = openSo.filter((so) =>
    customerWorkOrders.some(
      (w) => w.salesOrderId === so.id && !['closed', 'cancelled', 'completed', 'fg_received'].includes(w.status),
    ),
  )
  const readyToDispatchSo = openSo.filter((so) =>
    customerWorkOrders.some((w) => w.salesOrderId === so.id && ['completed', 'fg_received'].includes(w.status)),
  )

  const overdueInvoices = customerInvoices.filter((i) => i.paymentStatus === 'overdue' || i.balanceDue > 0)
  const overdueAmount = overdueInvoices.reduce((s, i) => s + i.balanceDue, 0)
  const paymentPending = customerInvoices.filter((i) => i.balanceDue > 0)

  const orderCount = orders.length || 1
  const estimatedCreditLimit = Math.round((revenue / orderCount) * 3)
  const creditLimit = resolveCustomerCreditLimit(customer, estimatedCreditLimit)

  const dispatchHistory = [...customerDispatches]
    .filter((d) => ['delivered', 'pod_received', 'closed'].includes(d.status))
    .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate))

  const dispatchedTrailers = customerDispatches.filter((d) =>
    ['dispatched', 'in_transit', 'delivered', 'pod_received'].includes(d.status),
  )

  const woIds = new Set(customerWorkOrders.map((w) => w.id))
  const inspections = useQualityStore.getState().inspections.filter((i) => i.workOrderId && woIds.has(i.workOrderId))
  const qcHolds = inspections.filter((i) => i.result === null)
  const delayedOrders = customerWorkOrders.filter((w) => {
    if (['closed', 'cancelled', 'completed', 'fg_received'].includes(w.status)) return false
    return w.plannedFinishDate < new Date().toISOString().slice(0, 10)
  })

  const finalQcIssues = inspections.filter((i) => i.category === 'final' && i.result === 'reject')
  const customerNcrs = useQualityStore.getState().ncrs.filter(
    (n) => n.source === 'customer' || (n.workOrderId && woIds.has(n.workOrderId)),
  )

  const timeline: TimelineEvent[] = [
    { id: 'created', label: 'Company registered', timestamp: formatDate(customer.createdAt.slice(0, 10)), status: 'done' },
    ...customerOpportunities.slice(0, 3).map((o, idx) => ({
      id: `opp-${o.id}`,
      label: `Opportunity ${o.opportunityNo}`,
      timestamp: formatDate(o.createdAt.slice(0, 10)),
      description: o.stage,
      status: (idx === 0 ? 'current' : 'done') as TimelineEvent['status'],
    })),
    ...orders.slice(0, 5).map((so) => ({
      id: `so-${so.id}`,
      label: `Sales Order ${so.salesOrderNo}`,
      timestamp: formatDate(so.createdAt.slice(0, 10)),
      description: so.status,
      status: 'done' as const,
    })),
    ...customerInvoices.slice(0, 3).map((inv) => ({
      id: `inv-${inv.id}`,
      label: `Invoice ${inv.invoiceNo}`,
      timestamp: formatDate(inv.invoiceDate),
      description: inv.paymentStatus,
      status: 'done' as const,
    })),
  ]

  const documents = [
    { id: 'cust-profile', name: 'Company Master Record', type: 'Master', date: customer.createdAt.slice(0, 10) },
    ...customerQuotations.slice(0, 5).map((q) => ({
      id: q.id,
      name: q.quotationNo,
      type: 'Quotation',
      date: q.createdAt.slice(0, 10),
    })),
    ...customerInvoices.slice(0, 5).map((inv) => ({
      id: inv.id,
      name: inv.invoiceNo,
      type: 'Invoice',
      date: inv.invoiceDate,
    })),
  ]

  const activity = [
    ...openSo.slice(0, 3).map((so) => ({
      id: so.id,
      title: `SO ${so.salesOrderNo}`,
      meta: so.status,
      time: formatDate(so.requiredDate),
    })),
    ...openQuotations.slice(0, 3).map((q) => ({
      id: q.id,
      title: `Quote ${q.quotationNo}`,
      meta: q.status,
      time: formatDate(q.validityDate),
    })),
    ...customerInvoices.slice(0, 3).map((inv) => ({
      id: inv.id,
      title: `Invoice ${inv.invoiceNo}`,
      meta: inv.paymentStatus,
      time: formatDate(inv.invoiceDate),
    })),
  ]

  return {
    customer,
    revenue,
    salesOrders: orders,
    openSo,
    closedSo,
    outstanding,
    pendingDispatch,
    lastDispatch,
    podPending,
    invoiceValue,
    received,
    customerInvoices,
    complaints,
    warrantyCases: 0,
    customerOpportunities,
    openOpportunities,
    /** @deprecated use customerOpportunities */
    customerInquiries: customerOpportunities,
    /** @deprecated use openOpportunities */
    openInquiries: openOpportunities,
    customerQuotations,
    openQuotations,
    customerWorkOrders,
    activeWo,
    productsOrdered,
    leads,
    approvedQuotes,
    lostQuotes,
    inProductionSo,
    readyToDispatchSo,
    overdueAmount,
    paymentPending,
    creditLimit,
    dispatchHistory,
    dispatchedTrailers,
    qcHolds,
    delayedOrders,
    finalQcIssues,
    customerNcrs,
    timeline,
    documents,
    activity,
  }
}

export function useCustomer360(customerId: string | undefined) {
  const customers = useMasterStore((s) => s.customers)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const invoices = useInvoiceStore((s) => s.invoices)
  const opportunities = useCrmStore((s) => s.opportunities)
  const quotations = useSalesStore((s) => s.quotations)
  const leads = useSalesStore((s) => s.leads)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const products = useMasterStore((s) => s.products)
  const inspections = useQualityStore((s) => s.inspections)
  const ncrs = useQualityStore((s) => s.ncrs)

  return useMemo(
    () => getCustomer360Data(customerId),
    [customerId, customers, salesOrders, dispatches, invoices, opportunities, quotations, leads, workOrders, products, inspections, ncrs],
  )
}

export function getBom360Data(bomId: string | undefined) {
  if (!bomId) return null
  const bom = useBomStore.getState().getBom(bomId)
  if (!bom) return null

  const product = useMasterStore.getState().getProduct(bom.productId)
  const tree = useBomStore.getState().getBomTree(bomId)
  const flat = flattenBomTree(tree)
  const leafLines = flat.filter((l) => l.children.length === 0)
  const materialCost = computeBomTotalCost(tree)
  const laborCost = materialCost * 0.18
  const subcontractCost = flat.filter((l) => l.sourceType === 'subcontract').reduce((s, l) => s + l.totalCost, 0)
  const revisions = useBomStore.getState().getBomsByProduct(bom.productId)
  const releasedBom = useBomStore.getState().getReleasedBomForProduct(bom.productId)

  const routings = useRoutingStore.getState().getRoutingsByProduct(bom.productId)
  const releasedRouting = useRoutingStore.getState().getReleasedRoutingForProduct(bom.productId)
  const routingOps = releasedRouting ? useRoutingStore.getState().getOperations(releasedRouting.id) : []

  const sourceCounts = {
    make: leafLines.filter((l) => l.sourceType === 'make').length,
    buy: leafLines.filter((l) => l.sourceType === 'buy').length,
    subcontract: leafLines.filter((l) => l.sourceType === 'subcontract').length,
  }

  const workOrders = useWorkOrderStore.getState().workOrders
  const salesOrders = useMrpStore.getState().salesOrders
  const wosUsing = workOrders.filter((w) => w.bomHeaderId === bomId)
  const openWosUsing = wosUsing.filter((w) => !['closed', 'cancelled'].includes(w.status))
  const sosUsing = salesOrders.filter((so) => so.productId === bom.productId)
  const openSosUsing = sosUsing.filter((so) => !['closed', 'cancelled'].includes(so.status))

  const latestRun = useMrpStore.getState().getLatestRun()
  const mrpRuns = useMrpStore.getState().runs
  const itemIds = new Set(flat.map((l) => l.itemId))
  const shortageComponents = latestRun?.materialLines.filter((m) => itemIds.has(m.itemId) && m.shortageQty > 0) ?? []
  const longLead = flat.filter((l) => useMasterStore.getState().getVendorMapsForItem(l.itemId).some((m) => m.leadTimeDays > 21))
  const singleSource = flat.filter((l) => useMasterStore.getState().getVendorMapsForItem(l.itemId).length === 1)

  const getItem = useMasterStore.getState().getItem
  const inactiveItems = leafLines.filter((l) => {
    const item = getItem(l.itemId)
    return !item?.isActive
  })
  const noCostItems = leafLines.filter((l) => l.standardCost <= 0)

  const boughtOutCost = leafLines.filter((l) => l.sourceType === 'buy').reduce((s, l) => s + l.totalCost, 0)
  const makeCost = leafLines.filter((l) => l.sourceType === 'make').reduce((s, l) => s + l.totalCost, 0)
  const scrapCost = leafLines.reduce(
    (s, l) => s + l.qtyPerProduct * l.standardCost * (l.scrapPct / 100),
    0,
  )

  const mrpRunsUsing = mrpRuns.filter((r) => r.materialLines.some((m) => itemIds.has(m.itemId))).slice(0, 10)

  const requisitions = usePurchaseStore.getState().requisitions
  const purchaseRequirements = requisitions.filter((pr) =>
    pr.lines.some((line) => itemIds.has(line.itemId)),
  )

  const costSheets = useCostingStore
    .getState()
    .getAllCostSheets()
    .filter((cs) => wosUsing.some((w) => w.id === cs.workOrderId))

  const riskItemCount =
    shortageComponents.length + longLead.length + singleSource.length + inactiveItems.length + noCostItems.length

  const timeline: TimelineEvent[] = [
    { id: 'created', label: 'BOM created', timestamp: formatDate(bom.createdAt.slice(0, 10)), status: 'done' },
    ...(bom.submittedAt
      ? [{ id: 'submitted', label: 'Submitted for approval', timestamp: formatDate(bom.submittedAt.slice(0, 10)), status: 'done' as const }]
      : []),
    ...(bom.approvedAt
      ? [{ id: 'approved', label: 'Approved', timestamp: formatDate(bom.approvedAt.slice(0, 10)), description: bom.approvedBy ?? undefined, status: 'done' as const }]
      : []),
    {
      id: 'status',
      label: `Status: ${bom.status}`,
      timestamp: formatDate(bom.updatedAt.slice(0, 10)),
      status: bom.status === 'released' ? 'done' : 'current',
    },
    ...revisions
      .filter((r) => r.id !== bom.id)
      .slice(0, 4)
      .map((r) => ({
        id: r.id,
        label: `${r.bomNo} Rev ${r.revision}`,
        timestamp: formatDate(r.updatedAt.slice(0, 10)),
        description: r.status,
        status: 'done' as const,
      })),
  ]

  const documents = [
    { id: 'bom-export', name: `${bom.bomNo} Structure Export`, type: 'BOM CSV', date: bom.updatedAt.slice(0, 10) },
    ...revisions.map((r) => ({
      id: r.id,
      name: `${r.bomNo} Rev ${r.revision}`,
      type: 'BOM Revision',
      date: r.updatedAt.slice(0, 10),
    })),
  ]

  const activity = revisions.slice(0, 8).map((r) => ({
    id: r.id,
    title: `${r.bomNo} Rev ${r.revision}`,
    meta: r.status,
    time: formatDate(r.updatedAt.slice(0, 10)),
  }))

  return {
    bom,
    product,
    tree,
    flat,
    leafLines,
    materialCost,
    boughtOutCost,
    makeCost,
    laborCost,
    subcontractCost,
    scrapCost,
    totalCost: materialCost + laborCost + subcontractCost,
    standardCost: materialCost + scrapCost,
    revisions,
    releasedBom,
    routings,
    releasedRouting,
    routingOps,
    sourceCounts,
    wosUsing,
    openWosUsing,
    sosUsing,
    openSosUsing,
    shortageComponents,
    longLead,
    singleSource,
    inactiveItems,
    noCostItems,
    mrpRunsUsing,
    purchaseRequirements,
    costSheets,
    riskItemCount,
    timeline,
    documents,
    activity,
    isReleased: releasedBom?.id === bomId,
  }
}

export function useBom360(bomId: string | undefined) {
  const bomHeaders = useBomStore((s) => s.bomHeaders)
  const bomLines = useBomStore((s) => s.bomLines)
  const items = useMasterStore((s) => s.items)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const mrpRuns = useMrpStore((s) => s.runs)
  const routingHeaders = useRoutingStore((s) => s.routingHeaders)
  const requisitions = usePurchaseStore((s) => s.requisitions)

  return useMemo(
    () => getBom360Data(bomId),
    [bomId, bomHeaders, bomLines, items, workOrders, salesOrders, mrpRuns, routingHeaders, requisitions],
  )
}

export function useProduct360(productId: string | undefined) {
  const products = useMasterStore((s) => s.products)
  const bomHeaders = useBomStore((s) => s.bomHeaders)
  const routingHeaders = useRoutingStore((s) => s.routingHeaders)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const stockMovements = useInventoryStore((s) => s.stockMovements)

  return useMemo(() => {
    if (!productId) return null
    const product = useMasterStore.getState().getProduct(productId)
    if (!product) return null

    const releasedBom = useBomStore.getState().getReleasedBomForProduct(productId)
    const allBoms = bomHeaders.filter((b) => b.productId === productId)
    const routings = routingHeaders.filter((r) => r.productId === productId)
    const fgItem = useMasterStore.getState().getItem(product.fgItemId)
    const fgOnHand = fgItem ? useInventoryStore.getState().getOnHand(fgItem.id, 'wh-fg-yard') : 0

    const orders = salesOrders.filter((so) => so.productId === productId)
    const wos = workOrders.filter((w) => w.productId === productId)
    const productDispatches = dispatches.filter((d) => d.productId === productId)

    const sc = product.standardCost
    const standardCost = sc.totalCost

    const activity = [
      ...orders.slice(0, 4).map((so) => ({
        id: so.id,
        title: `SO ${so.salesOrderNo}`,
        meta: so.status,
        time: formatDate(so.requiredDate),
      })),
      ...wos.slice(0, 4).map((wo) => ({
        id: wo.id,
        title: `WO ${wo.woNo}`,
        meta: wo.status,
        time: formatDate(wo.plannedFinishDate),
      })),
    ]

    return {
      product,
      fgItem,
      fgOnHand,
      releasedBom,
      allBoms,
      routings,
      orders,
      wos,
      productDispatches,
      standardCost,
      costBreakdown: sc,
      revisions: product.revisions,
      activity,
    }
  }, [productId, products, bomHeaders, routingHeaders, salesOrders, workOrders, dispatches, stockMovements])
}
