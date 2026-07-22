import type { QualityInspectionPlan, QualityInspectionPlanLine, QualityParameter } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import * as paramRepo from '../parameters/parameter.repository.js'
import * as repo from './inspection-plan.repository.js'
import type {
  CreatePlanInput,
  ListPlansQuery,
  ReplacePlanLinesInput,
  UpdatePlanInput,
} from './inspection-plan.schemas.js'

type PlanWithLines = QualityInspectionPlan & {
  lines: Array<QualityInspectionPlanLine & { parameter: QualityParameter }>
}

function dec(value: unknown): number | null {
  if (value == null) return null
  return Number(value)
}

export function mapPlan(row: PlanWithLines) {
  return {
    id: row.id,
    planCode: row.planCode,
    planName: row.planName,
    category: row.category,
    status: row.status,
    itemId: row.itemId,
    itemCategoryId: row.itemCategoryId,
    operationName: row.operationName,
    workCenterId: row.workCenterId,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    revision: row.revision,
    samplingMethod: row.samplingMethod,
    sampleSizeMode: row.sampleSizeMode,
    fixedSampleSize: dec(row.fixedSampleSize),
    samplePercentage: dec(row.samplePercentage),
    certificateRequired: row.certificateRequired,
    acceptanceRule: row.acceptanceRule,
    lines: row.lines.map((line) => ({
      id: line.id,
      parameterId: line.parameterId,
      sortOrder: line.sortOrder,
      mandatoryOverride: line.mandatoryOverride,
      minValueOverride: dec(line.minValueOverride),
      maxValueOverride: dec(line.maxValueOverride),
      targetValueOverride: dec(line.targetValueOverride),
      severityOverride: line.severityOverride,
      photoRequiredOverride: line.photoRequiredOverride,
      remarksRequired: line.remarksRequired,
      parameter: {
        id: line.parameter.id,
        parameterCode: line.parameter.parameterCode,
        parameterName: line.parameter.parameterName,
        parameterType: line.parameter.parameterType,
        uomCode: line.parameter.uomCode,
        minValue: dec(line.parameter.minValue),
        maxValue: dec(line.parameter.maxValue),
        targetValue: dec(line.parameter.targetValue),
        mandatory: line.parameter.mandatory,
        severity: line.parameter.severity,
        passFailRule: line.parameter.passFailRule,
        dropdownOptions: Array.isArray(line.parameter.dropdownOptions)
          ? (line.parameter.dropdownOptions as string[])
          : null,
        active: line.parameter.active,
      },
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function assertParametersExist(tenantId: string, parameterIds: string[]) {
  const unique = [...new Set(parameterIds)]
  for (const parameterId of unique) {
    const param = await paramRepo.getParameter(tenantId, parameterId)
    if (!param || !param.active) {
      throw new ValidationError(`Parameter ${parameterId} not found or inactive`)
    }
  }
}

export async function listPlans(tenantId: string, query: ListPlansQuery) {
  const result = await repo.listPlans(tenantId, query)
  return { ...result, items: result.items.map((row) => mapPlan(row as PlanWithLines)) }
}

export async function getPlan(tenantId: string, id: string) {
  const row = await repo.getPlan(tenantId, id)
  if (!row) throw new NotFoundError('Inspection plan not found')
  return mapPlan(row as PlanWithLines)
}

export async function createPlan(req: Request, tenantId: string, input: CreatePlanInput) {
  const userId = req.context?.userId ?? ''
  const code = input.planCode.trim().toUpperCase()
  const existing = await repo.findByCode(tenantId, code)
  if (existing) throw new ConflictError(`Plan code ${code} already exists`)
  await assertParametersExist(
    tenantId,
    input.lines.map((l) => l.parameterId),
  )

  if (input.itemId) {
    const item = await prisma.masterItem.findFirst({ where: { id: input.itemId, tenantId, deletedAt: null } })
    if (!item) throw new NotFoundError('Item not found')
  }

  const row = await prisma.$transaction((tx) =>
    repo.createPlan(tx, {
      tenantId,
      planCode: code,
      planName: input.planName.trim(),
      category: input.category,
      status: input.status ?? 'DRAFT',
      itemId: input.itemId ?? null,
      itemCategoryId: input.itemCategoryId ?? null,
      operationName: input.operationName ?? null,
      workCenterId: input.workCenterId ?? null,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      revision: input.revision ?? null,
      samplingMethod: input.samplingMethod,
      sampleSizeMode: input.sampleSizeMode ?? null,
      fixedSampleSize: input.fixedSampleSize ?? null,
      samplePercentage: input.samplePercentage ?? null,
      certificateRequired: input.certificateRequired ?? false,
      acceptanceRule: input.acceptanceRule ?? null,
      createdBy: userId,
      lines: input.lines.map((line) => ({ ...line, tenantId })),
    }),
  )
  return mapPlan(row as PlanWithLines)
}

export async function updatePlan(req: Request, tenantId: string, id: string, input: UpdatePlanInput) {
  const userId = req.context?.userId ?? ''
  const current = await repo.getPlan(tenantId, id)
  if (!current) throw new NotFoundError('Inspection plan not found')

  if (input.planCode) {
    const code = input.planCode.trim().toUpperCase()
    const clash = await repo.findByCode(tenantId, code, id)
    if (clash) throw new ConflictError(`Plan code ${code} already exists`)
  }

  if (input.lines) {
    await assertParametersExist(
      tenantId,
      input.lines.map((l) => l.parameterId),
    )
  }

  const row = await prisma.$transaction(async (tx) => {
    await repo.updatePlanHeader(tx, tenantId, id, {
      ...(input.planCode !== undefined ? { planCode: input.planCode.trim().toUpperCase() } : {}),
      ...(input.planName !== undefined ? { planName: input.planName.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.itemId !== undefined ? { itemId: input.itemId } : {}),
      ...(input.itemCategoryId !== undefined ? { itemCategoryId: input.itemCategoryId } : {}),
      ...(input.operationName !== undefined ? { operationName: input.operationName } : {}),
      ...(input.workCenterId !== undefined ? { workCenterId: input.workCenterId } : {}),
      ...(input.effectiveFrom !== undefined ? { effectiveFrom: new Date(input.effectiveFrom) } : {}),
      ...(input.effectiveTo !== undefined
        ? { effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null }
        : {}),
      ...(input.revision !== undefined ? { revision: input.revision } : {}),
      ...(input.samplingMethod !== undefined ? { samplingMethod: input.samplingMethod } : {}),
      ...(input.sampleSizeMode !== undefined ? { sampleSizeMode: input.sampleSizeMode } : {}),
      ...(input.fixedSampleSize !== undefined ? { fixedSampleSize: input.fixedSampleSize } : {}),
      ...(input.samplePercentage !== undefined ? { samplePercentage: input.samplePercentage } : {}),
      ...(input.certificateRequired !== undefined ? { certificateRequired: input.certificateRequired } : {}),
      ...(input.acceptanceRule !== undefined ? { acceptanceRule: input.acceptanceRule } : {}),
      updatedBy: userId,
    })
    if (input.lines) {
      return (await repo.replaceLines(tx, tenantId, id, input.lines)) as PlanWithLines
    }
    return (await repo.getPlan(tenantId, id)) as PlanWithLines
  })

  return mapPlan(row)
}

export async function replacePlanLines(req: Request, tenantId: string, id: string, input: ReplacePlanLinesInput) {
  const userId = req.context?.userId ?? ''
  const current = await repo.getPlan(tenantId, id)
  if (!current) throw new NotFoundError('Inspection plan not found')
  await assertParametersExist(
    tenantId,
    input.lines.map((l) => l.parameterId),
  )

  const row = await prisma.$transaction(async (tx) => {
    await repo.updatePlanHeader(tx, tenantId, id, { updatedBy: userId })
    return (await repo.replaceLines(tx, tenantId, id, input.lines)) as PlanWithLines
  })
  return mapPlan(row)
}

export async function deactivatePlan(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const current = await repo.getPlan(tenantId, id)
  if (!current) throw new NotFoundError('Inspection plan not found')
  const row = await prisma.$transaction((tx) => repo.softDeletePlan(tx, tenantId, id, userId))
  return mapPlan(row as PlanWithLines)
}

export async function revisePlan(req: Request, tenantId: string, id: string, input: { changeReason?: string; activate?: boolean }) {
  const userId = req.context?.userId ?? ''
  const plan = await repo.getPlan(tenantId, id)
  if (!plan) throw new NotFoundError('Inspection plan not found')
  const snapshot = (plan as PlanWithLines).lines.map(({ parameter, ...line }) => ({ ...line, parameter }))
  return prisma.$transaction(async (tx) => {
    const last = await tx.qualityInspectionPlanRevision.aggregate({ where: { tenantId, inspectionPlanId: id }, _max: { revisionNumber: true } })
    const revisionNumber = (last._max.revisionNumber ?? 0) + 1
    if (input.activate) {
      await tx.qualityInspectionPlanRevision.updateMany({ where: { tenantId, inspectionPlanId: id, status: 'ACTIVE' }, data: { status: 'SUPERSEDED', effectiveTo: new Date(), updatedBy: userId } })
    }
    const revision = await tx.qualityInspectionPlanRevision.create({
      data: { tenantId, inspectionPlanId: id, revisionNumber, revisionCode: `REV-${revisionNumber}`, status: input.activate ? 'ACTIVE' : 'DRAFT',
        effectiveFrom: new Date(), changeReason: input.changeReason ?? null, approvedBy: input.activate ? userId : null, approvedAt: input.activate ? new Date() : null,
        linesSnapshotJson: snapshot as unknown as import('@prisma/client').Prisma.InputJsonValue, createdBy: userId, updatedBy: userId },
    })
    await tx.qualityInspectionPlan.update({ where: { id }, data: { revision: revision.revisionCode, currentRevisionId: input.activate ? revision.id : plan.currentRevisionId, status: input.activate ? 'ACTIVE' : plan.status, updatedBy: userId } })
    return revision
  })
}

export async function activatePlan(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const plan = await repo.getPlan(tenantId, id)
  if (!plan) throw new NotFoundError('Inspection plan not found')
  if (!plan.currentRevisionId) return revisePlan(req, tenantId, id, { activate: true })
  return prisma.$transaction(async (tx) => {
    let revision = await tx.qualityInspectionPlanRevision.findFirst({ where: { id: plan.currentRevisionId!, tenantId } })
    if (!revision) throw new NotFoundError('Current inspection plan revision not found')
    await tx.qualityInspectionPlanRevision.updateMany({ where: { tenantId, inspectionPlanId: id, status: 'ACTIVE', id: { not: revision.id } }, data: { status: 'SUPERSEDED', effectiveTo: new Date(), updatedBy: userId } })
    revision = await tx.qualityInspectionPlanRevision.update({ where: { id: revision.id }, data: { status: 'ACTIVE', approvedBy: userId, approvedAt: new Date(), updatedBy: userId } })
    await tx.qualityInspectionPlan.update({ where: { id }, data: { status: 'ACTIVE', currentRevisionId: revision.id, revision: revision.revisionCode, updatedBy: userId } })
    return revision
  })
}

export async function listRevisions(tenantId: string, id: string) {
  const plan = await repo.getPlan(tenantId, id)
  if (!plan) throw new NotFoundError('Inspection plan not found')
  return prisma.qualityInspectionPlanRevision.findMany({ where: { tenantId, inspectionPlanId: id }, orderBy: { revisionNumber: 'desc' } })
}
