import type { ManufacturingRoute, WorkOrderOperation } from '../../types/manufacturingRoute'

const iso = () => new Date().toISOString()

/** Tank Assembly Route — Cutting → Welding → Coating → Assembly → Final QC */
export const seedManufacturingRoutes: ManufacturingRoute[] = [
  {
    id: 'mfg-route-tank-01',
    routeNo: 'RT-TANK-01',
    routeName: 'Tank Assembly Route',
    finishedItemId: 'item-fg-tank',
    finishedItemCode: 'FG-TANK-ISO',
    finishedItemName: 'ISO Tanker Shell',
    version: 'v1',
    status: 'active',
    defaultBomId: 'mfg-bom-003',
    defaultBomNumber: 'BOM-MFG-0003',
    remarks: 'Simple in-house route folded into Work Orders — not a MES.',
    createdAt: iso(),
    updatedAt: iso(),
    createdBy: 'Demo User',
    operations: [
      {
        id: 'rt-op-1',
        sequenceNo: 10,
        operationName: 'Cutting',
        workCenter: 'Cutting Bay',
        plannedTimeMinutes: 120,
        qcRequired: false,
        jobWorkRequired: false,
        inputQtyBasis: 'wo_planned',
        outputQtyBasis: 'wo_planned',
        allowScrap: true,
        allowRework: true,
        allowReject: true,
      },
      {
        id: 'rt-op-2',
        sequenceNo: 20,
        operationName: 'Welding',
        workCenter: 'Welding Line',
        plannedTimeMinutes: 240,
        qcRequired: false,
        jobWorkRequired: false,
        inputQtyBasis: 'previous_output',
        outputQtyBasis: 'previous_output',
        allowScrap: true,
        allowRework: true,
        allowReject: true,
      },
      {
        id: 'rt-op-3',
        sequenceNo: 30,
        operationName: 'Coating',
        workCenter: 'Paint Booth',
        plannedTimeMinutes: 180,
        qcRequired: false,
        jobWorkRequired: true,
        defaultVendorName: 'PrimeCoat Vendors',
        inputQtyBasis: 'previous_output',
        outputQtyBasis: 'previous_output',
        allowScrap: false,
        allowRework: true,
        allowReject: true,
        remarks: 'Optional outside coating',
      },
      {
        id: 'rt-op-4',
        sequenceNo: 40,
        operationName: 'Assembly',
        workCenter: 'Assembly Floor',
        plannedTimeMinutes: 300,
        qcRequired: false,
        jobWorkRequired: false,
        inputQtyBasis: 'previous_output',
        outputQtyBasis: 'previous_output',
        allowScrap: true,
        allowRework: true,
        allowReject: true,
      },
      {
        id: 'rt-op-5',
        sequenceNo: 50,
        operationName: 'Final QC',
        workCenter: 'QC Bay',
        plannedTimeMinutes: 60,
        qcRequired: true,
        jobWorkRequired: false,
        inputQtyBasis: 'previous_output',
        outputQtyBasis: 'previous_output',
        allowScrap: false,
        allowRework: true,
        allowReject: true,
      },
    ],
  },
  {
    id: 'mfg-route-axle-01',
    routeNo: 'RT-AXLE-01',
    routeName: 'Axle Assembly Route',
    finishedItemId: 'item-fg-trailer-axle',
    finishedItemCode: 'FG-AXLE-01',
    finishedItemName: 'Trailer Axle Assembly',
    version: 'v1',
    status: 'active',
    defaultBomId: 'mfg-bom-001',
    defaultBomNumber: 'BOM-MFG-0001',
    remarks: 'Short route for axle assembly',
    createdAt: iso(),
    updatedAt: iso(),
    createdBy: 'Demo User',
    operations: [
      {
        id: 'rt-ax-1',
        sequenceNo: 10,
        operationName: 'Fabrication',
        workCenter: 'Fab Cell',
        plannedTimeMinutes: 90,
        qcRequired: false,
        jobWorkRequired: false,
        inputQtyBasis: 'wo_planned',
        outputQtyBasis: 'wo_planned',
        allowScrap: true,
        allowRework: true,
        allowReject: true,
      },
      {
        id: 'rt-ax-2',
        sequenceNo: 20,
        operationName: 'Assembly',
        workCenter: 'Axle Line',
        plannedTimeMinutes: 120,
        qcRequired: false,
        jobWorkRequired: false,
        inputQtyBasis: 'previous_output',
        outputQtyBasis: 'previous_output',
        allowScrap: true,
        allowRework: true,
        allowReject: true,
      },
      {
        id: 'rt-ax-3',
        sequenceNo: 30,
        operationName: 'Final QC',
        workCenter: 'QC Bay',
        plannedTimeMinutes: 30,
        qcRequired: true,
        jobWorkRequired: false,
        inputQtyBasis: 'previous_output',
        outputQtyBasis: 'previous_output',
        allowScrap: false,
        allowRework: true,
        allowReject: true,
      },
    ],
  },
]

/** Demo operations for an in-progress tank WO (if present in seed). */
export function buildSeedOperationsForWo(
  workOrderId: string,
  plannedQty: number,
  route: ManufacturingRoute,
  progress: 'ready' | 'mid' = 'ready',
): WorkOrderOperation[] {
  const lines = [...route.operations].sort((a, b) => a.sequenceNo - b.sequenceNo)
  return lines.map((op, idx) => {
    let status: WorkOrderOperation['status'] = idx === 0 ? 'ready' : 'pending'
    let completedQty = 0
    let startedAt: string | undefined
    let endedAt: string | undefined
    let operator: string | undefined
    if (progress === 'mid') {
      if (idx === 0) {
        status = 'accepted'
        completedQty = plannedQty
        startedAt = new Date(Date.now() - 86400000).toISOString()
        endedAt = new Date(Date.now() - 80000000).toISOString()
        operator = 'R. Patil'
      } else if (idx === 1) {
        status = 'in_progress'
        completedQty = Math.floor(plannedQty / 2)
        startedAt = new Date(Date.now() - 3600000).toISOString()
        operator = 'S. Khan'
      }
    }
    return {
      id: `wo-op-${workOrderId}-${op.sequenceNo}`,
      workOrderId,
      routeId: route.id,
      routeOperationId: op.id,
      routeVersion: route.version,
      sequenceNo: op.sequenceNo,
      operationName: op.operationName,
      workCenter: op.workCenter,
      plannedQty,
      completedQty,
      pendingQty: Math.max(0, plannedQty - completedQty),
      scrapQty: 0,
      reworkQty: 0,
      rejectedQty: 0,
      operator,
      startedAt,
      endedAt,
      qcRequired: op.qcRequired,
      jobWorkRequired: op.jobWorkRequired,
      defaultVendorName: op.defaultVendorName,
      status,
      allowScrap: op.allowScrap,
      allowRework: op.allowRework,
      allowReject: op.allowReject,
      plannedTimeMinutes: op.plannedTimeMinutes,
      remarks: op.remarks,
    }
  })
}
