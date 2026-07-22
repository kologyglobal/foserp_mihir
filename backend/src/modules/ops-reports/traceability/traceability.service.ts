import { prisma } from '../../../config/database.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { toNum } from '../executors/helpers.js'
import {
  nodeRef,
  type TraceabilityEdge,
  type TraceabilityEntityType,
  type TraceabilityLineage,
  type TraceabilityNode,
  type TraceabilitySearchResult,
} from './traceability.types.js'

const SEARCH_LIMIT = 20

export async function searchTraceability(tenantId: string, query: string): Promise<TraceabilitySearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const contains = { contains: q }

  const [salesOrders, workOrders, fgReceipts, dispatches, requirements, pickLists, packingSessions, challans, inspections, ncrs] =
    await Promise.all([
      prisma.crmSalesOrder.findMany({
        where: { tenantId, deletedAt: null, salesOrderNo: contains },
        select: { id: true, salesOrderNo: true, status: true },
        take: SEARCH_LIMIT,
      }),
      prisma.productionOrder.findMany({
        where: { tenantId, deletedAt: null, orderNumber: contains },
        select: { id: true, orderNumber: true, status: true },
        take: SEARCH_LIMIT,
      }),
      prisma.productionFinishedGoodsReceipt.findMany({
        where: { tenantId, deletedAt: null, receiptNumber: contains },
        select: { id: true, receiptNumber: true, status: true },
        take: SEARCH_LIMIT,
      }),
      prisma.outboundDispatch.findMany({
        where: { tenantId, deletedAt: null, dispatchNo: contains },
        select: { id: true, dispatchNo: true, status: true },
        take: SEARCH_LIMIT,
      }),
      prisma.dispatchRequirement.findMany({
        where: { tenantId, deletedAt: null, requirementNumber: contains },
        select: { id: true, requirementNumber: true, readinessStatus: true },
        take: SEARCH_LIMIT,
      }),
      prisma.dispatchPickList.findMany({
        where: { tenantId, pickListNumber: contains },
        select: { id: true, pickListNumber: true, status: true },
        take: SEARCH_LIMIT,
      }),
      prisma.dispatchPackingSession.findMany({
        where: { tenantId, deletedAt: null, packingSessionNumber: contains },
        select: { id: true, packingSessionNumber: true, status: true },
        take: SEARCH_LIMIT,
      }),
      prisma.deliveryChallan.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [{ challanNumber: contains }, { id: contains }],
        },
        select: { id: true, challanNumber: true, status: true, versionNumber: true },
        take: SEARCH_LIMIT,
      }),
      prisma.manufacturingQualityInspection.findMany({
        where: { tenantId, inspectionNumber: contains },
        select: { id: true, inspectionNumber: true, status: true },
        take: SEARCH_LIMIT,
      }),
      prisma.qualityNcr.findMany({
        where: { tenantId, ncrNumber: contains },
        select: { id: true, ncrNumber: true, status: true },
        take: SEARCH_LIMIT,
      }),
    ])

  return [
    ...salesOrders.map((s) => ({
      entityType: 'SALES_ORDER' as const,
      entityId: s.id,
      label: s.salesOrderNo,
      subtitle: `Sales Order — ${s.status}`,
    })),
    ...workOrders.map((w) => ({
      entityType: 'WORK_ORDER' as const,
      entityId: w.id,
      label: w.orderNumber,
      subtitle: `Work Order — ${w.status}`,
    })),
    ...fgReceipts.map((f) => ({
      entityType: 'FG_RECEIPT' as const,
      entityId: f.id,
      label: f.receiptNumber,
      subtitle: `FG Receipt — ${f.status}`,
    })),
    ...dispatches.map((d) => ({
      entityType: 'DISPATCH' as const,
      entityId: d.id,
      label: d.dispatchNo,
      subtitle: `Dispatch — ${d.status}`,
    })),
    ...requirements.map((r) => ({
      entityType: 'DISPATCH_REQUIREMENT' as const,
      entityId: r.id,
      label: r.requirementNumber,
      subtitle: `Dispatch Requirement — ${r.readinessStatus}`,
    })),
    ...pickLists.map((p) => ({
      entityType: 'PICK_LIST' as const,
      entityId: p.id,
      label: p.pickListNumber,
      subtitle: `Pick List — ${p.status}`,
    })),
    ...packingSessions.map((p) => ({
      entityType: 'PACKING_SESSION' as const,
      entityId: p.id,
      label: p.packingSessionNumber,
      subtitle: `Packing Session — ${p.status}`,
    })),
    ...challans.map((c) => ({
      entityType: 'DELIVERY_CHALLAN' as const,
      entityId: c.id,
      label: c.challanNumber ?? `Draft v${c.versionNumber}`,
      subtitle: `Delivery Challan — ${c.status}`,
    })),
    ...inspections.map((i) => ({
      entityType: 'INSPECTION' as const,
      entityId: i.id,
      label: i.inspectionNumber,
      subtitle: `Inspection — ${i.status}`,
    })),
    ...ncrs.map((n) => ({
      entityType: 'NCR' as const,
      entityId: n.id,
      label: n.ncrNumber,
      subtitle: `NCR — ${n.status}`,
    })),
  ]
}

function pushEdge(edges: TraceabilityEdge[], from: TraceabilityNode, to: TraceabilityNode, relationship: string): void {
  edges.push({ from: nodeRef(from), to: nodeRef(to), relationship })
}

async function buildSalesOrderLineage(tenantId: string, id: string): Promise<TraceabilityLineage> {
  const so = await prisma.crmSalesOrder.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!so) throw new NotFoundError('Sales order not found')

  const root: TraceabilityNode = {
    entityType: 'SALES_ORDER',
    entityId: so.id,
    label: so.salesOrderNo,
    status: so.status,
    detail: { orderDate: so.orderDate.toISOString(), requiredDate: so.requiredDate?.toISOString() ?? null },
  }
  const nodes: TraceabilityNode[] = [root]
  const edges: TraceabilityEdge[] = []

  const workOrders = await prisma.productionOrder.findMany({
    where: { tenantId, salesOrderId: id, deletedAt: null },
    select: { id: true, orderNumber: true, status: true, plannedQuantity: true, completedGoodQuantity: true },
  })
  for (const wo of workOrders) {
    const node: TraceabilityNode = {
      entityType: 'WORK_ORDER',
      entityId: wo.id,
      label: wo.orderNumber,
      status: wo.status,
      detail: { plannedQuantity: toNum(wo.plannedQuantity), completedGoodQuantity: toNum(wo.completedGoodQuantity) },
    }
    nodes.push(node)
    pushEdge(edges, root, node, 'CONVERTED_TO_WORK_ORDER')
  }

  const requirements = await prisma.dispatchRequirement.findMany({
    where: { tenantId, salesOrderId: id, deletedAt: null },
    select: { id: true, requirementNumber: true, readinessStatus: true, remainingQuantitySnapshot: true },
  })
  for (const r of requirements) {
    const node: TraceabilityNode = {
      entityType: 'DISPATCH_REQUIREMENT',
      entityId: r.id,
      label: r.requirementNumber,
      status: r.readinessStatus,
      detail: { remainingQty: toNum(r.remainingQuantitySnapshot) },
    }
    nodes.push(node)
    pushEdge(edges, root, node, 'HAS_DISPATCH_REQUIREMENT')
  }

  const dispatches = await prisma.outboundDispatch.findMany({
    where: { tenantId, salesOrderId: id, deletedAt: null },
    select: { id: true, dispatchNo: true, status: true, confirmedAt: true },
  })
  for (const d of dispatches) {
    const node: TraceabilityNode = {
      entityType: 'DISPATCH',
      entityId: d.id,
      label: d.dispatchNo,
      status: d.status,
      detail: { confirmedAt: d.confirmedAt?.toISOString() ?? null },
    }
    nodes.push(node)
    pushEdge(edges, root, node, 'FULFILLED_BY_DISPATCH')
  }

  return { root, nodes, edges, warnings: [] }
}

async function buildWorkOrderLineage(tenantId: string, id: string): Promise<TraceabilityLineage> {
  const wo = await prisma.productionOrder.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      salesOrderId: true,
      plannedQuantity: true,
      completedGoodQuantity: true,
      salesOrder: { select: { id: true, salesOrderNo: true, status: true } },
    },
  })
  if (!wo) throw new NotFoundError('Work order not found')

  const root: TraceabilityNode = {
    entityType: 'WORK_ORDER',
    entityId: wo.id,
    label: wo.orderNumber,
    status: wo.status,
    detail: { plannedQuantity: toNum(wo.plannedQuantity), completedGoodQuantity: toNum(wo.completedGoodQuantity) },
  }
  const nodes: TraceabilityNode[] = [root]
  const edges: TraceabilityEdge[] = []

  if (wo.salesOrder) {
    const soNode: TraceabilityNode = {
      entityType: 'SALES_ORDER',
      entityId: wo.salesOrder.id,
      label: wo.salesOrder.salesOrderNo,
      status: wo.salesOrder.status,
      detail: {},
    }
    nodes.push(soNode)
    pushEdge(edges, soNode, root, 'CONVERTED_TO_WORK_ORDER')
  }

  const [fgReceipts, inspections, ncrs, jobWorks] = await Promise.all([
    prisma.productionFinishedGoodsReceipt.findMany({
      where: { tenantId, productionOrderId: id, deletedAt: null },
      select: { id: true, receiptNumber: true, status: true, receiptQuantity: true, qualityInspectionId: true },
    }),
    prisma.manufacturingQualityInspection.findMany({
      where: { tenantId, productionOrderId: id },
      select: { id: true, inspectionNumber: true, status: true },
    }),
    prisma.qualityNcr.findMany({
      where: { tenantId, productionOrderId: id },
      select: { id: true, ncrNumber: true, status: true },
    }),
    prisma.jobWorkOrder.findMany({
      where: { tenantId, productionOrderId: id, deletedAt: null },
      select: { id: true, jwNumber: true, status: true },
    }),
  ])

  for (const fg of fgReceipts) {
    const node: TraceabilityNode = {
      entityType: 'FG_RECEIPT',
      entityId: fg.id,
      label: fg.receiptNumber,
      status: fg.status,
      detail: { receiptQuantity: toNum(fg.receiptQuantity) },
    }
    nodes.push(node)
    pushEdge(edges, root, node, 'PRODUCED_FG_RECEIPT')
  }
  for (const insp of inspections) {
    const node: TraceabilityNode = {
      entityType: 'INSPECTION',
      entityId: insp.id,
      label: insp.inspectionNumber,
      status: insp.status,
      detail: {},
    }
    nodes.push(node)
    pushEdge(edges, root, node, 'INSPECTED_BY')
  }
  for (const ncr of ncrs) {
    const node: TraceabilityNode = {
      entityType: 'NCR',
      entityId: ncr.id,
      label: ncr.ncrNumber,
      status: ncr.status,
      detail: {},
    }
    nodes.push(node)
    pushEdge(edges, root, node, 'HAS_NCR')
  }

  const warnings: string[] = []
  if (jobWorks.length > 0) {
    warnings.push(
      `${jobWorks.length} linked job work order(s) exist for this work order (${jobWorks.map((j) => j.jwNumber).join(', ')}) — job work is not yet rendered as a lineage node type.`,
    )
  }

  return { root, nodes, edges, warnings }
}

async function buildFgReceiptLineage(tenantId: string, id: string): Promise<TraceabilityLineage> {
  const fg = await prisma.productionFinishedGoodsReceipt.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: {
      id: true,
      receiptNumber: true,
      status: true,
      receiptQuantity: true,
      qualityInspectionId: true,
      productionOrder: { select: { id: true, orderNumber: true, status: true } },
    },
  })
  if (!fg) throw new NotFoundError('FG receipt not found')

  const root: TraceabilityNode = {
    entityType: 'FG_RECEIPT',
    entityId: fg.id,
    label: fg.receiptNumber,
    status: fg.status,
    detail: { receiptQuantity: toNum(fg.receiptQuantity) },
  }
  const nodes: TraceabilityNode[] = [root]
  const edges: TraceabilityEdge[] = []

  const woNode: TraceabilityNode = {
    entityType: 'WORK_ORDER',
    entityId: fg.productionOrder.id,
    label: fg.productionOrder.orderNumber,
    status: fg.productionOrder.status,
    detail: {},
  }
  nodes.push(woNode)
  pushEdge(edges, woNode, root, 'PRODUCED_FG_RECEIPT')

  if (fg.qualityInspectionId) {
    const insp = await prisma.manufacturingQualityInspection.findFirst({
      where: { id: fg.qualityInspectionId, tenantId },
      select: { id: true, inspectionNumber: true, status: true },
    })
    if (insp) {
      const inspNode: TraceabilityNode = {
        entityType: 'INSPECTION',
        entityId: insp.id,
        label: insp.inspectionNumber,
        status: insp.status,
        detail: {},
      }
      nodes.push(inspNode)
      pushEdge(edges, inspNode, root, 'INSPECTED_BY')
    }
  }

  return { root, nodes, edges, warnings: [] }
}

async function buildDispatchLineage(tenantId: string, id: string): Promise<TraceabilityLineage> {
  const dispatch = await prisma.outboundDispatch.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: {
      id: true,
      dispatchNo: true,
      status: true,
      confirmedAt: true,
      salesOrderId: true,
      salesOrder: { select: { id: true, salesOrderNo: true, status: true } },
      lines: {
        select: {
          id: true,
          lineNo: true,
          quantity: true,
          dispatchRequirementId: true,
          item: { select: { code: true, name: true } },
          dispatchRequirement: { select: { id: true, requirementNumber: true, readinessStatus: true } },
        },
      },
    },
  })
  if (!dispatch) throw new NotFoundError('Dispatch not found')

  const root: TraceabilityNode = {
    entityType: 'DISPATCH',
    entityId: dispatch.id,
    label: dispatch.dispatchNo,
    status: dispatch.status,
    detail: {
      confirmedAt: dispatch.confirmedAt?.toISOString() ?? null,
      lines: dispatch.lines.map((l) => ({ lineNo: l.lineNo, itemCode: l.item.code, quantity: toNum(l.quantity) })),
    },
  }
  const nodes: TraceabilityNode[] = [root]
  const edges: TraceabilityEdge[] = []

  if (dispatch.salesOrder) {
    const soNode: TraceabilityNode = {
      entityType: 'SALES_ORDER',
      entityId: dispatch.salesOrder.id,
      label: dispatch.salesOrder.salesOrderNo,
      status: dispatch.salesOrder.status,
      detail: {},
    }
    nodes.push(soNode)
    pushEdge(edges, soNode, root, 'FULFILLED_BY_DISPATCH')
  }

  for (const line of dispatch.lines) {
    if (!line.dispatchRequirement) continue
    const reqNode: TraceabilityNode = {
      entityType: 'DISPATCH_REQUIREMENT',
      entityId: line.dispatchRequirement.id,
      label: line.dispatchRequirement.requirementNumber,
      status: line.dispatchRequirement.readinessStatus,
      detail: {},
    }
    if (!nodes.some((n) => n.entityType === reqNode.entityType && n.entityId === reqNode.entityId)) {
      nodes.push(reqNode)
      pushEdge(edges, reqNode, root, 'PLANNED_INTO_DISPATCH')
    }
  }

  const pickLists = await prisma.dispatchPickList.findMany({
    where: { tenantId, outboundDispatchId: id },
    select: { id: true, pickListNumber: true, status: true },
  })
  for (const p of pickLists) {
    const pNode: TraceabilityNode = {
      entityType: 'PICK_LIST',
      entityId: p.id,
      label: p.pickListNumber,
      status: p.status,
      detail: {},
    }
    nodes.push(pNode)
    pushEdge(edges, root, pNode, 'HAS_PICK_LIST')
  }

  const packingSessions = await prisma.dispatchPackingSession.findMany({
    where: { tenantId, outboundDispatchId: id, deletedAt: null },
    select: { id: true, packingSessionNumber: true, status: true },
  })
  for (const s of packingSessions) {
    const sNode: TraceabilityNode = {
      entityType: 'PACKING_SESSION',
      entityId: s.id,
      label: s.packingSessionNumber,
      status: s.status,
      detail: { note: 'PACKING_AS_OPERATIONAL_ALLOCATION — on-hand unchanged' },
    }
    nodes.push(sNode)
    pushEdge(edges, root, sNode, 'HAS_PACKING_SESSION')
  }

  return {
    root,
    nodes,
    edges,
    warnings: [
      packingSessions.length
        ? 'Packed ≠ Dispatched. Delivery Challan / Posted Dispatch nodes are Phase 7C4–7C5.'
        : 'Delivery Challan / Posted Dispatch nodes are Phase 7C4–7C5.',
    ],
  }
}

async function buildPickListLineage(tenantId: string, id: string): Promise<TraceabilityLineage> {
  const pickList = await prisma.dispatchPickList.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      pickListNumber: true,
      status: true,
      outboundDispatch: { select: { id: true, dispatchNo: true, status: true } },
      lines: { select: { id: true, pickedQuantity: true, reservedQuantity: true, shortageQuantity: true } },
    },
  })
  if (!pickList) throw new NotFoundError('Pick list not found')

  const root: TraceabilityNode = {
    entityType: 'PICK_LIST',
    entityId: pickList.id,
    label: pickList.pickListNumber,
    status: pickList.status,
    detail: {
      lineCount: pickList.lines.length,
      pickedQty: pickList.lines.reduce((s, l) => s + toNum(l.pickedQuantity), 0),
      note: 'ALLOCATION_ONLY_PICKING — on-hand unchanged',
    },
  }
  const nodes: TraceabilityNode[] = [root]
  const edges: TraceabilityEdge[] = []
  const dNode: TraceabilityNode = {
    entityType: 'DISPATCH',
    entityId: pickList.outboundDispatch.id,
    label: pickList.outboundDispatch.dispatchNo,
    status: pickList.outboundDispatch.status,
    detail: {},
  }
  nodes.push(dNode)
  pushEdge(edges, dNode, root, 'HAS_PICK_LIST')
  return {
    root,
    nodes,
    edges,
    warnings: ['Packing Session / Delivery Challan / Posted Dispatch may follow this Pick List.'],
  }
}

async function buildPackingSessionLineage(tenantId: string, id: string): Promise<TraceabilityLineage> {
  const session = await prisma.dispatchPackingSession.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: {
      id: true,
      packingSessionNumber: true,
      status: true,
      totalPackedQuantity: true,
      outboundDispatch: { select: { id: true, dispatchNo: true, status: true } },
      packages: { select: { id: true, packageNumber: true, status: true } },
    },
  })
  if (!session) throw new NotFoundError('Packing session not found')

  const root: TraceabilityNode = {
    entityType: 'PACKING_SESSION',
    entityId: session.id,
    label: session.packingSessionNumber,
    status: session.status,
    detail: {
      totalPackedQuantity: toNum(session.totalPackedQuantity),
      note: 'PACKING_AS_OPERATIONAL_ALLOCATION — on-hand unchanged',
    },
  }
  const nodes: TraceabilityNode[] = [root]
  const edges: TraceabilityEdge[] = []
  const dNode: TraceabilityNode = {
    entityType: 'DISPATCH',
    entityId: session.outboundDispatch.id,
    label: session.outboundDispatch.dispatchNo,
    status: session.outboundDispatch.status,
    detail: {},
  }
  nodes.push(dNode)
  pushEdge(edges, dNode, root, 'HAS_PACKING_SESSION')
  return {
    root,
    nodes,
    edges,
    warnings: [
      `Packages: ${session.packages.map((p) => p.packageNumber).join(', ') || 'none'}`,
      'Future Delivery Challan / Posted Dispatch nodes are not created yet.',
    ],
  }
}

async function buildDeliveryChallanLineage(tenantId: string, id: string): Promise<TraceabilityLineage> {
  const challan = await prisma.deliveryChallan.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: {
      id: true,
      challanNumber: true,
      status: true,
      versionNumber: true,
      totalQuantity: true,
      outboundDispatch: { select: { id: true, dispatchNo: true, status: true } },
    },
  })
  if (!challan) throw new NotFoundError('Delivery challan not found')

  const root: TraceabilityNode = {
    entityType: 'DELIVERY_CHALLAN',
    entityId: challan.id,
    label: challan.challanNumber ?? `Draft v${challan.versionNumber}`,
    status: challan.status,
    detail: {
      totalQuantity: toNum(challan.totalQuantity),
      note: 'DELIVERY_CHALLAN_AS_DOCUMENT_ONLY — on-hand unchanged',
    },
  }
  const nodes: TraceabilityNode[] = [root]
  const edges: TraceabilityEdge[] = []
  const dNode: TraceabilityNode = {
    entityType: 'DISPATCH',
    entityId: challan.outboundDispatch.id,
    label: challan.outboundDispatch.dispatchNo,
    status: challan.outboundDispatch.status,
    detail: {},
  }
  nodes.push(dNode)
  pushEdge(edges, dNode, root, 'HAS_DELIVERY_CHALLAN')
  return {
    root,
    nodes,
    edges,
    warnings: ['Future Posted Dispatch / Invoice nodes are not created yet.'],
  }
}

async function buildDispatchRequirementLineage(tenantId: string, id: string): Promise<TraceabilityLineage> {
  const requirement = await prisma.dispatchRequirement.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: {
      id: true,
      requirementNumber: true,
      readinessStatus: true,
      remainingQuantitySnapshot: true,
      salesOrder: { select: { id: true, salesOrderNo: true, status: true } },
      outboundDispatchLines: {
        where: { outboundDispatch: { deletedAt: null } },
        select: {
          outboundDispatch: { select: { id: true, dispatchNo: true, status: true } },
        },
      },
    },
  })
  if (!requirement) throw new NotFoundError('Dispatch requirement not found')

  const root: TraceabilityNode = {
    entityType: 'DISPATCH_REQUIREMENT',
    entityId: requirement.id,
    label: requirement.requirementNumber,
    status: requirement.readinessStatus,
    detail: { remainingQty: toNum(requirement.remainingQuantitySnapshot) },
  }
  const nodes: TraceabilityNode[] = [root]
  const edges: TraceabilityEdge[] = []

  const soNode: TraceabilityNode = {
    entityType: 'SALES_ORDER',
    entityId: requirement.salesOrder.id,
    label: requirement.salesOrder.salesOrderNo,
    status: requirement.salesOrder.status,
    detail: {},
  }
  nodes.push(soNode)
  pushEdge(edges, soNode, root, 'HAS_DISPATCH_REQUIREMENT')

  for (const line of requirement.outboundDispatchLines) {
    const d = line.outboundDispatch
    const dNode: TraceabilityNode = {
      entityType: 'DISPATCH',
      entityId: d.id,
      label: d.dispatchNo,
      status: d.status,
      detail: {},
    }
    if (!nodes.some((n) => n.entityType === dNode.entityType && n.entityId === dNode.entityId)) {
      nodes.push(dNode)
      pushEdge(edges, root, dNode, 'PLANNED_INTO_DISPATCH')
    }
  }

  return { root, nodes, edges, warnings: [] }
}

async function buildInspectionLineage(tenantId: string, id: string): Promise<TraceabilityLineage> {
  const insp = await prisma.manufacturingQualityInspection.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      inspectionNumber: true,
      status: true,
      productionOrderId: true,
      jobWorkOrderId: true,
      productionOrder: { select: { id: true, orderNumber: true, status: true } },
    },
  })
  if (!insp) throw new NotFoundError('Inspection not found')

  const root: TraceabilityNode = {
    entityType: 'INSPECTION',
    entityId: insp.id,
    label: insp.inspectionNumber,
    status: insp.status,
    detail: {},
  }
  const nodes: TraceabilityNode[] = [root]
  const edges: TraceabilityEdge[] = []
  const warnings: string[] = []

  if (insp.productionOrder) {
    const woNode: TraceabilityNode = {
      entityType: 'WORK_ORDER',
      entityId: insp.productionOrder.id,
      label: insp.productionOrder.orderNumber,
      status: insp.productionOrder.status,
      detail: {},
    }
    nodes.push(woNode)
    pushEdge(edges, woNode, root, 'INSPECTED_BY')
  } else if (insp.jobWorkOrderId) {
    warnings.push('This inspection is linked to a job work order, not a work order — job work is not yet rendered as a lineage node type.')
  }

  const [ncrs, fgReceipts] = await Promise.all([
    prisma.qualityNcr.findMany({
      where: { tenantId, inspectionId: id },
      select: { id: true, ncrNumber: true, status: true },
    }),
    prisma.productionFinishedGoodsReceipt.findMany({
      where: { tenantId, qualityInspectionId: id, deletedAt: null },
      select: { id: true, receiptNumber: true, status: true },
    }),
  ])
  for (const ncr of ncrs) {
    const node: TraceabilityNode = { entityType: 'NCR', entityId: ncr.id, label: ncr.ncrNumber, status: ncr.status, detail: {} }
    nodes.push(node)
    pushEdge(edges, root, node, 'RAISED_NCR')
  }
  for (const fg of fgReceipts) {
    const node: TraceabilityNode = { entityType: 'FG_RECEIPT', entityId: fg.id, label: fg.receiptNumber, status: fg.status, detail: {} }
    nodes.push(node)
    pushEdge(edges, node, root, 'INSPECTED_BY')
  }

  return { root, nodes, edges, warnings }
}

async function buildNcrLineage(tenantId: string, id: string): Promise<TraceabilityLineage> {
  const ncr = await prisma.qualityNcr.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      ncrNumber: true,
      status: true,
      severity: true,
      productionOrderId: true,
      inspectionId: true,
      jobWorkOrderId: true,
      productionOrder: { select: { id: true, orderNumber: true, status: true } },
      inspection: { select: { id: true, inspectionNumber: true, status: true } },
    },
  })
  if (!ncr) throw new NotFoundError('NCR not found')

  const root: TraceabilityNode = {
    entityType: 'NCR',
    entityId: ncr.id,
    label: ncr.ncrNumber,
    status: ncr.status,
    detail: { severity: ncr.severity },
  }
  const nodes: TraceabilityNode[] = [root]
  const edges: TraceabilityEdge[] = []
  const warnings: string[] = []

  if (ncr.productionOrder) {
    const woNode: TraceabilityNode = {
      entityType: 'WORK_ORDER',
      entityId: ncr.productionOrder.id,
      label: ncr.productionOrder.orderNumber,
      status: ncr.productionOrder.status,
      detail: {},
    }
    nodes.push(woNode)
    pushEdge(edges, woNode, root, 'HAS_NCR')
  }
  if (ncr.inspection) {
    const inspNode: TraceabilityNode = {
      entityType: 'INSPECTION',
      entityId: ncr.inspection.id,
      label: ncr.inspection.inspectionNumber,
      status: ncr.inspection.status,
      detail: {},
    }
    nodes.push(inspNode)
    pushEdge(edges, inspNode, root, 'RAISED_NCR')
  }
  if (ncr.jobWorkOrderId && !ncr.productionOrder) {
    warnings.push('This NCR is linked to a job work order — job work is not yet rendered as a lineage node type.')
  }

  return { root, nodes, edges, warnings }
}

export async function getTraceabilityLineage(
  tenantId: string,
  entityType: string,
  entityId: string,
): Promise<TraceabilityLineage> {
  switch (entityType as TraceabilityEntityType) {
    case 'SALES_ORDER':
      return buildSalesOrderLineage(tenantId, entityId)
    case 'WORK_ORDER':
      return buildWorkOrderLineage(tenantId, entityId)
    case 'FG_RECEIPT':
      return buildFgReceiptLineage(tenantId, entityId)
    case 'DISPATCH':
      return buildDispatchLineage(tenantId, entityId)
    case 'DISPATCH_REQUIREMENT':
      return buildDispatchRequirementLineage(tenantId, entityId)
    case 'PICK_LIST':
      return buildPickListLineage(tenantId, entityId)
    case 'PACKING_SESSION':
      return buildPackingSessionLineage(tenantId, entityId)
    case 'DELIVERY_CHALLAN':
      return buildDeliveryChallanLineage(tenantId, entityId)
    case 'INSPECTION':
      return buildInspectionLineage(tenantId, entityId)
    case 'NCR':
      return buildNcrLineage(tenantId, entityId)
    default:
      throw new ValidationError(`Unknown traceability entity type: ${entityType}`)
  }
}
