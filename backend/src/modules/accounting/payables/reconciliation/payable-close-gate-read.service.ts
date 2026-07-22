import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { formatDateOnly } from '../reporting/payable-ageing.service.js'
import { PayableCloseGateRunNotFoundError } from './payable-reconciliation.errors.js'
import type { LatestCloseGateQueryInput } from './payable-reconciliation.schemas.js'
import type { CloseGateCheckDto, CloseGateRunDto, ListCloseGateRunsQuery } from './payable-reconciliation.types.js'

function toCloseGateRunDto(run: Prisma.PayableCloseGateRunGetPayload<Record<string, never>>): CloseGateRunDto {
  return {
    id: run.id,
    tenantId: run.tenantId,
    legalEntityId: run.legalEntityId,
    periodId: run.periodId,
    asOfDate: formatDateOnly(run.asOfDate),
    status: run.status,
    reconciliationRunId: run.reconciliationRunId,
    checksTotal: run.checksTotal,
    checksPassed: run.checksPassed,
    checksWarning: run.checksWarning,
    checksBlocked: run.checksBlocked,
    checksFailed: run.checksFailed,
    summary: (run.summary as Record<string, unknown> | null) ?? null,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    createdBy: run.createdBy,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }
}

function toCloseGateCheckDto(row: Prisma.PayableCloseGateCheckGetPayload<Record<string, never>>): CloseGateCheckDto {
  return {
    id: row.id,
    runId: row.runId,
    checkCode: row.checkCode,
    checkName: row.checkName,
    status: row.status,
    message: row.message,
    details: (row.details as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listCloseGateRuns(
  tenantId: string,
  query: ListCloseGateRunsQuery,
): Promise<{ items: CloseGateRunDto[]; total: number; page: number; pageSize: number }> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20
  const [total, rows] = await Promise.all([
    prisma.payableCloseGateRun.count({ where: { tenantId, legalEntityId: query.legalEntityId } }),
    prisma.payableCloseGateRun.findMany({
      where: { tenantId, legalEntityId: query.legalEntityId },
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return { items: rows.map(toCloseGateRunDto), total, page, pageSize }
}

export async function getCloseGateRunDetail(
  tenantId: string,
  runId: string,
): Promise<{ run: CloseGateRunDto; checks: CloseGateCheckDto[] }> {
  const run = await prisma.payableCloseGateRun.findFirst({ where: { id: runId, tenantId } })
  if (!run) throw new PayableCloseGateRunNotFoundError()
  const checks = await prisma.payableCloseGateCheck.findMany({ where: { runId, tenantId }, orderBy: { createdAt: 'asc' } })
  return { run: toCloseGateRunDto(run), checks: checks.map(toCloseGateCheckDto) }
}

export async function getLatestCloseGateRun(
  tenantId: string,
  query: LatestCloseGateQueryInput,
): Promise<{ run: CloseGateRunDto; checks: CloseGateCheckDto[] } | null> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const run = await prisma.payableCloseGateRun.findFirst({
    where: { tenantId, legalEntityId: query.legalEntityId, periodId: query.periodId },
    orderBy: { createdAt: 'desc' },
  })
  if (!run) return null
  const checks = await prisma.payableCloseGateCheck.findMany({ where: { runId: run.id, tenantId }, orderBy: { createdAt: 'asc' } })
  return { run: toCloseGateRunDto(run), checks: checks.map(toCloseGateCheckDto) }
}
