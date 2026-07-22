import { prisma } from '../../../config/database.js'

export interface QualityBlocker {
  code: string
  message: string
  inspectionId?: string
  ncrId?: string
  stageId?: string
}

const OPEN_NCR_STATUSES = ['OPEN', 'INVESTIGATING', 'CORRECTIVE_ACTION', 'APPROVED'] as const
const BLOCKING_INSPECTION_STATUSES = ['PENDING', 'REWORK'] as const

export async function workOrderNeedsFinalQc(tenantId: string, productionOrderId: string): Promise<boolean> {
  const order = await prisma.productionOrder.findFirst({
    where: { id: productionOrderId, tenantId, deletedAt: null },
    select: {
      productItemId: true,
      stages: { where: { isOptional: false }, select: { qualityRequired: true } },
    },
  })
  if (!order) return false

  const product = await prisma.masterItem.findFirst({
    where: { id: order.productItemId, tenantId, deletedAt: null },
    select: { qcRequired: true },
  })
  if (product?.qcRequired) return true
  return order.stages.some((s) => s.qualityRequired)
}

export async function collectQualityBlockers(tenantId: string, productionOrderId: string): Promise<QualityBlocker[]> {
  const blockers: QualityBlocker[] = []

  const pendingInspections = await prisma.manufacturingQualityInspection.findMany({
    where: {
      tenantId,
      productionOrderId,
      status: { in: [...BLOCKING_INSPECTION_STATUSES] },
    },
    select: { id: true, inspectionNumber: true, category: true, status: true, stageId: true },
  })
  for (const insp of pendingInspections) {
    blockers.push({
      code: 'OPEN_INSPECTION',
      message: `Inspection ${insp.inspectionNumber} (${insp.category}) is ${insp.status}`,
      inspectionId: insp.id,
      stageId: insp.stageId ?? undefined,
    })
  }

  const certificateMissing = await prisma.manufacturingQualityInspection.findMany({
    where: { tenantId, productionOrderId, certificateRequired: true, OR: [{ certificateStatus: null }, { certificateStatus: { not: 'VERIFIED' } }], status: { in: [...BLOCKING_INSPECTION_STATUSES] } },
    select: { id: true, inspectionNumber: true },
  })
  for (const inspection of certificateMissing) blockers.push({ code: 'CERTIFICATE_MISSING', message: `Inspection ${inspection.inspectionNumber} requires a verified certificate`, inspectionId: inspection.id })

  const openNcrs = await prisma.qualityNcr.findMany({
    where: {
      tenantId,
      productionOrderId,
      status: { in: [...OPEN_NCR_STATUSES] },
    },
    select: { id: true, ncrNumber: true, status: true },
  })
  for (const ncr of openNcrs) {
    blockers.push({
      code: 'OPEN_NCR',
      message: `NCR ${ncr.ncrNumber} is ${ncr.status}`,
      ncrId: ncr.id,
    })
  }

  const qcPendingStages = await prisma.productionOrderStage.findMany({
    where: {
      tenantId,
      productionOrderId,
      qualityRequired: true,
      isOptional: false,
      status: 'QC_PENDING',
    },
    select: { id: true, name: true },
  })
  for (const stage of qcPendingStages) {
    blockers.push({
      code: 'STAGE_QC_PENDING',
      message: `Stage "${stage.name}" is awaiting QC decision`,
      stageId: stage.id,
    })
  }

  const needsFinal = await workOrderNeedsFinalQc(tenantId, productionOrderId)
  if (needsFinal) {
    const passedFinal = await prisma.manufacturingQualityInspection.findFirst({
      where: {
        tenantId,
        productionOrderId,
        category: 'FINAL',
        status: 'PASSED',
      },
      select: { id: true },
    })
    if (!passedFinal) {
      blockers.push({
        code: 'FINAL_QC_REQUIRED',
        message: 'A passed FINAL quality inspection is required before completing this work order',
      })
    }
  }

  return blockers
}

export async function jobWorkQualityBlockers(tenantId: string, jobWorkOrderId: string): Promise<QualityBlocker[]> {
  const [inspections, ncrs] = await Promise.all([
    prisma.manufacturingQualityInspection.findMany({ where: { tenantId, jobWorkOrderId, category: 'SUBCONTRACT_RETURN', status: { in: ['PENDING', 'REWORK'] } }, select: { id: true, inspectionNumber: true, status: true } }),
    prisma.qualityNcr.findMany({ where: { tenantId, jobWorkOrderId, status: { notIn: ['CLOSED', 'CANCELLED'] } }, select: { id: true, ncrNumber: true, status: true } }),
  ])
  return [
    ...inspections.map((x) => ({ code: 'OPEN_SUBCONTRACT_RETURN_INSPECTION', message: `Inspection ${x.inspectionNumber} is ${x.status}`, inspectionId: x.id })),
    ...ncrs.map((x) => ({ code: 'OPEN_NCR', message: `NCR ${x.ncrNumber} is ${x.status}`, ncrId: x.id })),
  ]
}
