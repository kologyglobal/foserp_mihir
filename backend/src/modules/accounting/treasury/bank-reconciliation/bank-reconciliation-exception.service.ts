import { prisma } from '../../../../config/database.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import { auditBankReconciliation } from './bank-reconciliation-audit.service.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import * as repo from './bank-reconciliation.repository.js'
import { BankReconciliationExceptionAlreadyResolvedError } from './bank-reconciliation.errors.js'
import type { CreateExceptionBodyInput, ResolveExceptionBodyInput } from './bank-reconciliation.schemas.js'
import type { ExceptionDto, ReconciliationContext } from './bank-reconciliation.types.js'

function toExceptionDto(row: Awaited<ReturnType<typeof repo.createException>>): ExceptionDto {
  return {
    id: row.id,
    reconciliationSessionId: row.reconciliationSessionId,
    bankStatementLineId: row.bankStatementLineId,
    reason: row.reason,
    comment: row.comment,
    status: row.status,
    assignedToId: row.assignedToId,
    createdById: row.createdById,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolvedById: row.resolvedById,
    resolutionReference: row.resolutionReference,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createExceptionForStatement(
  tenantId: string,
  statementId: string,
  input: CreateExceptionBodyInput,
  context: ReconciliationContext,
): Promise<ExceptionDto> {
  const session = await repo.getSessionByStatementIdOrThrow(tenantId, statementId)
  const line = await readRepo.getStatementLineOrThrow(tenantId, statementId, input.bankStatementLineId)

  const created = await repo.createException({
    tenantId,
    legalEntityId: session.legalEntityId,
    reconciliationSessionId: session.id,
    bankStatementLineId: line.id,
    reason: input.reason,
    comment: input.comment,
    assignedToId: input.assignedToId,
    createdById: context.userId,
  })

  if (line.matchStatus === 'UNMATCHED' || line.matchStatus === 'PARTIALLY_MATCHED') {
    await prisma.bankStatementLine.update({ where: { id: line.id }, data: { matchStatus: 'EXCEPTION' } })
  }

  await auditBankReconciliation(context, 'bank_reconciliation_exception', created.id, 'BANK_RECON_EXCEPTION_CREATED', {
    statementId,
    lineId: line.id,
    reason: input.reason,
  })

  return toExceptionDto(created)
}

export async function resolveException(
  tenantId: string,
  exceptionId: string,
  input: ResolveExceptionBodyInput,
  context: ReconciliationContext,
): Promise<ExceptionDto> {
  const exception = await repo.getExceptionOrThrow(tenantId, exceptionId)
  if (exception.status === 'RESOLVED') throw new BankReconciliationExceptionAlreadyResolvedError()

  const resolved = await repo.resolveExceptionRecord(tenantId, exceptionId, {
    resolvedById: context.userId,
    resolutionReference: input.resolutionReference,
    comment: input.comment,
  })

  const line = await prisma.bankStatementLine.findFirst({ where: { id: exception.bankStatementLineId, tenantId } })
  if (line && line.matchStatus === 'EXCEPTION') {
    const nextStatus = toDecimal(line.matchedAmount).lte(0) ? 'UNMATCHED' : 'PARTIALLY_MATCHED'
    await prisma.bankStatementLine.update({ where: { id: line.id }, data: { matchStatus: nextStatus } })
  }

  await auditBankReconciliation(context, 'bank_reconciliation_exception', exceptionId, 'BANK_RECON_EXCEPTION_RESOLVED', {
    resolutionReference: input.resolutionReference,
  })

  return toExceptionDto(resolved)
}

export async function listExceptionsForStatement(tenantId: string, statementId: string): Promise<ExceptionDto[]> {
  const session = await repo.getSessionByStatementIdOrThrow(tenantId, statementId)
  const rows = await repo.listExceptionsForSession(tenantId, session.id)
  return rows.map(toExceptionDto)
}

export { toExceptionDto }
