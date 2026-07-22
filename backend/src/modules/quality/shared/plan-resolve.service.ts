import type { Prisma, QualityInspectionCategory, QualityParameter } from '@prisma/client'
import { Prisma as PrismaNS } from '@prisma/client'
import { findActivePlanForResolve } from '../inspection-plans/inspection-plan.repository.js'

export type ParameterSnapshotEntry = {
  parameterId: string
  parameterCode: string
  parameterName: string
  parameterType: string
  uomCode: string | null
  minValue: number | null
  maxValue: number | null
  targetValue: number | null
  mandatory: boolean
  severity: string
  passFailRule: string
  dropdownOptions: string[] | null
  sortOrder: number
  remarksRequired: boolean
}

function num(value: unknown): number | null {
  if (value == null) return null
  return Number(value)
}

function buildSnapshotFromPlan(lines: Array<{
  parameterId: string
  sortOrder: number
  mandatoryOverride: boolean | null
  minValueOverride: unknown
  maxValueOverride: unknown
  targetValueOverride: unknown
  severityOverride: string | null
  photoRequiredOverride: boolean | null
  remarksRequired: boolean
  parameter: QualityParameter
}>): ParameterSnapshotEntry[] {
  return lines.map((line) => ({
    parameterId: line.parameterId,
    parameterCode: line.parameter.parameterCode,
    parameterName: line.parameter.parameterName,
    parameterType: line.parameter.parameterType,
    uomCode: line.parameter.uomCode,
    minValue: num(line.minValueOverride ?? line.parameter.minValue),
    maxValue: num(line.maxValueOverride ?? line.parameter.maxValue),
    targetValue: num(line.targetValueOverride ?? line.parameter.targetValue),
    mandatory: line.mandatoryOverride ?? line.parameter.mandatory,
    severity: line.severityOverride ?? line.parameter.severity,
    passFailRule: line.parameter.passFailRule,
    dropdownOptions: Array.isArray(line.parameter.dropdownOptions)
      ? (line.parameter.dropdownOptions as string[])
      : null,
    sortOrder: line.sortOrder,
    remarksRequired: line.remarksRequired || line.photoRequiredOverride === true,
  }))
}

export async function resolveInspectionPlan(
  tenantId: string,
  opts: {
    category: QualityInspectionCategory
    inspectionPlanId?: string | null
    itemId?: string | null
    planCodeHint?: string | null
  },
) {
  if (opts.inspectionPlanId) {
    const { prisma } = await import('../../../config/database.js')
    const plan = await prisma.qualityInspectionPlan.findFirst({
      where: { id: opts.inspectionPlanId, tenantId, deletedAt: null, status: 'ACTIVE' },
      include: {
        lines: { include: { parameter: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!plan) return null
    return { plan, snapshot: buildSnapshotFromPlan(plan.lines) }
  }

  const plan = await findActivePlanForResolve(tenantId, opts.category, {
    itemId: opts.itemId,
    planCode: opts.planCodeHint,
  })
  if (!plan) return null
  return { plan, snapshot: buildSnapshotFromPlan(plan.lines) }
}

export function evaluateParameterResult(
  snap: ParameterSnapshotEntry,
  input: { measuredValue?: string | null; measuredNumeric?: number | null; passed?: boolean | null },
): boolean | null {
  if (snap.passFailRule === 'MANUAL') {
    return input.passed ?? null
  }
  if (snap.passFailRule === 'BOOLEAN_TRUE') {
    const v = (input.measuredValue ?? '').toLowerCase()
    return v === 'true' || v === '1' || v === 'yes' || v === 'pass'
  }
  if (snap.passFailRule === 'BOOLEAN_FALSE') {
    const v = (input.measuredValue ?? '').toLowerCase()
    return v === 'false' || v === '0' || v === 'no'
  }
  if (snap.passFailRule === 'NUMERIC_TOLERANCE') {
    const n = input.measuredNumeric
    if (n == null || Number.isNaN(n)) return false
    if (snap.minValue != null && n < snap.minValue) return false
    if (snap.maxValue != null && n > snap.maxValue) return false
    return true
  }
  return input.passed ?? null
}

export async function persistParameterResults(
  tx: Prisma.TransactionClient,
  tenantId: string,
  inspectionId: string,
  snapshot: ParameterSnapshotEntry[],
  results: Array<{
    parameterId: string
    measuredValue?: string | null
    measuredNumeric?: number | null
    passed?: boolean | null
    remarks?: string | null
  }>,
) {
  await tx.qualityInspectionParameterResult.deleteMany({ where: { tenantId, inspectionId } })
  const byId = new Map(results.map((r) => [r.parameterId, r]))

  for (const snap of snapshot) {
    const result = byId.get(snap.parameterId)
    const passed = result
      ? evaluateParameterResult(snap, result)
      : snap.mandatory
        ? false
        : null

    await tx.qualityInspectionParameterResult.create({
      data: {
        tenantId,
        inspectionId,
        parameterId: snap.parameterId,
        parameterCode: snap.parameterCode,
        parameterName: snap.parameterName,
        parameterType: snap.parameterType as 'BOOLEAN' | 'NUMERIC' | 'TEXT' | 'DROPDOWN' | 'PHOTO_REQUIRED',
        mandatory: snap.mandatory,
        severity: snap.severity as 'MINOR' | 'MAJOR' | 'CRITICAL',
        passFailRule: snap.passFailRule as 'BOOLEAN_TRUE' | 'BOOLEAN_FALSE' | 'NUMERIC_TOLERANCE' | 'MANUAL',
        uomCode: snap.uomCode,
        minValue: snap.minValue != null ? new PrismaNS.Decimal(snap.minValue) : null,
        maxValue: snap.maxValue != null ? new PrismaNS.Decimal(snap.maxValue) : null,
        targetValue: snap.targetValue != null ? new PrismaNS.Decimal(snap.targetValue) : null,
        sortOrder: snap.sortOrder,
        measuredValue: result?.measuredValue ?? null,
        measuredNumeric: result?.measuredNumeric != null ? new PrismaNS.Decimal(result.measuredNumeric) : null,
        passed,
        remarks: result?.remarks ?? null,
      },
    })
  }
}

export function validatePassAgainstSnapshot(
  snapshot: ParameterSnapshotEntry[],
  results: Array<{
    parameterId: string
    measuredValue?: string | null
    measuredNumeric?: number | null
    passed?: boolean | null
  }>,
): string | null {
  if (!snapshot.length) return null
  const byId = new Map(results.map((r) => [r.parameterId, r]))
  for (const snap of snapshot) {
    if (!snap.mandatory) continue
    const result = byId.get(snap.parameterId)
    if (!result) return `Missing mandatory parameter result: ${snap.parameterCode}`
    const passed = evaluateParameterResult(snap, result)
    if (passed !== true) return `Mandatory parameter failed or incomplete: ${snap.parameterCode}`
  }
  return null
}
