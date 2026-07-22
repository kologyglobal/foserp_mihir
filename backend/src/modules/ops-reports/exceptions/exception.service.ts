import { prisma } from '../../../config/database.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { deriveOpenExceptions } from './exception-derivation.service.js'
import type { ExceptionResolutionStatus, ExceptionRow } from './exception.types.js'

export interface ExceptionListFilters {
  category?: string
  severity?: string
  resolutionStatus?: string
}

function toRow(derived: Awaited<ReturnType<typeof deriveOpenExceptions>>[number], action?: {
  assignedTo: string | null
  acknowledgedBy: string | null
  acknowledgedAt: Date | null
  resolutionStatus: string
  resolutionNote: string | null
  resolvedBy: string | null
  resolvedAt: Date | null
}): ExceptionRow {
  return {
    ...derived,
    assignedTo: action?.assignedTo ?? null,
    acknowledgedBy: action?.acknowledgedBy ?? null,
    acknowledgedAt: action?.acknowledgedAt?.toISOString() ?? null,
    resolutionStatus: (action?.resolutionStatus as ExceptionResolutionStatus) ?? 'OPEN',
    resolutionNote: action?.resolutionNote ?? null,
    resolvedBy: action?.resolvedBy ?? null,
    resolvedAt: action?.resolvedAt?.toISOString() ?? null,
  }
}

async function loadActionsMap(tenantId: string, exceptionKeys: string[]) {
  if (exceptionKeys.length === 0) return new Map()
  const actions = await prisma.operationalExceptionAction.findMany({
    where: { tenantId, exceptionKey: { in: exceptionKeys } },
  })
  return new Map(actions.map((a) => [a.exceptionKey, a]))
}

export async function listExceptions(tenantId: string, filters: ExceptionListFilters = {}): Promise<ExceptionRow[]> {
  const derived = await deriveOpenExceptions(tenantId)
  const actionsMap = await loadActionsMap(tenantId, derived.map((d) => d.exceptionKey))
  let rows = derived.map((d) => toRow(d, actionsMap.get(d.exceptionKey)))

  if (filters.category) rows = rows.filter((r) => r.category === filters.category)
  if (filters.severity) rows = rows.filter((r) => r.severity === filters.severity)
  if (filters.resolutionStatus) rows = rows.filter((r) => r.resolutionStatus === filters.resolutionStatus)

  return rows.sort((a, b) => b.ageDays - a.ageDays)
}

export async function getExceptionsSummary(tenantId: string) {
  const rows = await listExceptions(tenantId)
  const byCategory: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  const byResolutionStatus: Record<string, number> = {}
  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1
    bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1
    byResolutionStatus[r.resolutionStatus] = (byResolutionStatus[r.resolutionStatus] ?? 0) + 1
  }
  return {
    totalOpen: rows.length,
    unacknowledgedCount: rows.filter((r) => r.resolutionStatus === 'OPEN').length,
    criticalCount: rows.filter((r) => r.severity === 'CRITICAL').length,
    byCategory,
    bySeverity,
    byResolutionStatus,
    generatedAt: new Date().toISOString(),
  }
}

async function findDerivedByKey(tenantId: string, exceptionKey: string) {
  const derived = await deriveOpenExceptions(tenantId)
  return derived.find((d) => d.exceptionKey === exceptionKey)
}

async function upsertAction(
  tenantId: string,
  exceptionKey: string,
  derived: Awaited<ReturnType<typeof deriveOpenExceptions>>[number],
  data: Record<string, unknown>,
) {
  return prisma.operationalExceptionAction.upsert({
    where: { tenantId_exceptionKey: { tenantId, exceptionKey } },
    create: {
      tenantId,
      exceptionKey,
      sourceType: derived.sourceType,
      sourceId: derived.sourceId,
      ...data,
    },
    update: data,
  })
}

export async function acknowledgeException(tenantId: string, userId: string, exceptionKey: string): Promise<ExceptionRow> {
  const derived = await findDerivedByKey(tenantId, exceptionKey)
  if (!derived) throw new NotFoundError('Exception not found or is no longer open')

  const action = await upsertAction(tenantId, exceptionKey, derived, {
    acknowledgedBy: userId,
    acknowledgedAt: new Date(),
    resolutionStatus: 'ACKNOWLEDGED',
  })
  return toRow(derived, action)
}

export async function assignException(
  tenantId: string,
  exceptionKey: string,
  assignedTo: string,
): Promise<ExceptionRow> {
  const derived = await findDerivedByKey(tenantId, exceptionKey)
  if (!derived) throw new NotFoundError('Exception not found or is no longer open')

  const existing = await prisma.operationalExceptionAction.findUnique({
    where: { tenantId_exceptionKey: { tenantId, exceptionKey } },
  })
  const action = await upsertAction(tenantId, exceptionKey, derived, {
    assignedTo,
    resolutionStatus: existing?.resolutionStatus === 'OPEN' || !existing ? 'IN_PROGRESS' : existing.resolutionStatus,
  })
  return toRow(derived, action)
}

export async function resolveException(
  tenantId: string,
  userId: string,
  exceptionKey: string,
  resolutionNote: string | undefined,
  dismiss = false,
): Promise<ExceptionRow> {
  const derived = await findDerivedByKey(tenantId, exceptionKey)
  if (derived && !dismiss) {
    throw new ConflictError(
      'This exception is still open at the source (e.g. the work order is still overdue or the NCR is still open). Resolve the underlying record first, or use dismiss instead.',
    )
  }
  const existingAction = await prisma.operationalExceptionAction.findUnique({
    where: { tenantId_exceptionKey: { tenantId, exceptionKey } },
  })
  if (!derived && !existingAction) {
    throw new NotFoundError('Exception not found')
  }
  // If !derived and not dismissing, the source condition has already cleared naturally — safe to mark resolved.

  const sourceType = derived?.sourceType ?? existingAction?.sourceType
  const sourceId = derived?.sourceId ?? existingAction?.sourceId
  if (!sourceType || !sourceId) throw new ValidationError('Unable to resolve — missing source reference')

  const action = await prisma.operationalExceptionAction.upsert({
    where: { tenantId_exceptionKey: { tenantId, exceptionKey } },
    create: {
      tenantId,
      exceptionKey,
      sourceType,
      sourceId,
      resolutionStatus: dismiss ? 'DISMISSED' : 'RESOLVED',
      resolutionNote: resolutionNote ?? null,
      resolvedBy: userId,
      resolvedAt: new Date(),
    },
    update: {
      resolutionStatus: dismiss ? 'DISMISSED' : 'RESOLVED',
      resolutionNote: resolutionNote ?? null,
      resolvedBy: userId,
      resolvedAt: new Date(),
    },
  })

  if (derived) return toRow(derived, action)
  return {
    exceptionKey,
    category: 'WORK_ORDER_OVERDUE',
    severity: 'LOW',
    sourceType,
    sourceId,
    title: 'Exception resolved',
    detail: 'Source condition is no longer open.',
    ageDays: 0,
    referenceDate: new Date().toISOString(),
    assignedTo: action.assignedTo,
    acknowledgedBy: action.acknowledgedBy,
    acknowledgedAt: action.acknowledgedAt?.toISOString() ?? null,
    resolutionStatus: action.resolutionStatus as ExceptionResolutionStatus,
    resolutionNote: action.resolutionNote,
    resolvedBy: action.resolvedBy,
    resolvedAt: action.resolvedAt?.toISOString() ?? null,
  }
}
