import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import {
  BankStatementInvalidStateError,
  BankStatementTreasuryAccountInvalidError,
} from '../treasury.errors.js'
import { getStatementAllowedActions } from './bank-statement-allowed-actions.service.js'
import { auditStatementAction } from './bank-statement-audit.service.js'
import { buildStatementLineHash } from './bank-statement-identity.service.js'
import * as readRepo from './bank-statement-read.repository.js'
import * as repo from './bank-statement.repository.js'
import { maskCounterpartyAccount, normaliseDescription } from './import/bank-statement-import-security.service.js'
import type { CreateStatementLineInput, UpdateStatementLineInput } from './bank-statement.schemas.js'
import { incrementStatementLineCount } from './bank-statement.repository.js'

async function getTreasuryAccountOrThrow(tenantId: string, legalEntityId: string, treasuryAccountId: string) {
  const account = await prisma.treasuryAccount.findFirst({
    where: { id: treasuryAccountId, tenantId, legalEntityId, accountType: 'BANK', status: 'ACTIVE' },
  })
  if (!account) throw new BankStatementTreasuryAccountInvalidError('Active BANK treasury account not found')
  return account
}

function mapLine(line: Awaited<ReturnType<typeof readRepo.getStatementLines>>[number]) {
  return {
    ...line,
    amount: formatForPersistence(line.amount),
    runningBalance: line.runningBalance != null ? formatForPersistence(line.runningBalance) : null,
  }
}

export async function listStatementLines(tenantId: string, statementId: string) {
  await readRepo.getStatementById(tenantId, statementId)
  const lines = await readRepo.getStatementLines(tenantId, statementId)
  return lines.map(mapLine)
}

export async function addLine(
  req: Request,
  tenantId: string,
  statementId: string,
  input: CreateStatementLineInput,
) {
  const statement = await readRepo.getStatementById(tenantId, statementId)
  const actions = getStatementAllowedActions(statement.status)
  if (!actions.canAddLine) throw new BankStatementInvalidStateError('Cannot add lines in current status')

  if (statement.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    throw new BankStatementInvalidStateError()
  }

  const lineNumber =
    (await prisma.bankStatementLine.count({ where: { bankStatementId: statementId } })) + 1
  const lineHash = buildStatementLineHash({
    treasuryAccountId: statement.treasuryAccountId,
    transactionDate: new Date(input.transactionDate),
    direction: input.direction,
    amount: input.amount,
    referenceNumber: input.referenceNumber,
    description: input.description,
  })

  const line = await repo.createStatementLine({
    tenantId,
    legalEntityId: statement.legalEntityId,
    bankStatementId: statementId,
    lineNumber,
    transactionDate: new Date(input.transactionDate),
    valueDate: input.valueDate ? new Date(input.valueDate) : null,
    direction: input.direction,
    amount: formatForPersistence(input.amount),
    description: input.description ?? null,
    normalizedDescription: normaliseDescription(input.description),
    referenceNumber: input.referenceNumber ?? null,
    utrReference: input.utrReference ?? null,
    chequeNumber: input.chequeNumber ?? null,
    transactionCode: input.transactionCode ?? null,
    counterpartyName: input.counterpartyName ?? null,
    counterpartyAccountMasked: maskCounterpartyAccount(input.counterpartyAccount),
    lineHash,
  })

  await incrementStatementLineCount(tenantId, statementId, 1)
  await auditStatementAction(req, 'AddLine', statementId, null, { lineId: line.id, lineNumber })
  return mapLine(line)
}

export async function updateLine(
  req: Request,
  tenantId: string,
  statementId: string,
  lineId: string,
  input: UpdateStatementLineInput,
) {
  const statement = await readRepo.getStatementById(tenantId, statementId)
  const actions = getStatementAllowedActions(statement.status)
  if (!actions.canEditLine) throw new BankStatementInvalidStateError('Cannot edit lines in current status')
  if (statement.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    throw new BankStatementInvalidStateError()
  }

  const existing = await prisma.bankStatementLine.findFirst({
    where: { id: lineId, tenantId, bankStatementId: statementId },
  })
  if (!existing) throw new BankStatementInvalidStateError('Line not found')

  const direction = input.direction ?? existing.direction
  const amount = input.amount ?? Number(existing.amount)
  const transactionDate = input.transactionDate ? new Date(input.transactionDate) : existing.transactionDate
  const lineHash = buildStatementLineHash({
    treasuryAccountId: statement.treasuryAccountId,
    transactionDate,
    direction,
    amount,
    referenceNumber: input.referenceNumber ?? existing.referenceNumber,
    description: input.description ?? existing.description,
  })

  const line = await repo.updateStatementLine(tenantId, statementId, lineId, {
    transactionDate,
    valueDate: input.valueDate === null ? null : input.valueDate ? new Date(input.valueDate) : undefined,
    direction: input.direction,
    amount: input.amount != null ? formatForPersistence(input.amount) : undefined,
    description: input.description,
    normalizedDescription: input.description != null ? normaliseDescription(input.description) : undefined,
    referenceNumber: input.referenceNumber,
    utrReference: input.utrReference,
    chequeNumber: input.chequeNumber,
    transactionCode: input.transactionCode,
    counterpartyName: input.counterpartyName,
    counterpartyAccountMasked:
      input.counterpartyAccount != null ? maskCounterpartyAccount(input.counterpartyAccount) : undefined,
    lineHash,
  })

  await auditStatementAction(req, 'UpdateLine', statementId, { lineId }, { lineId, lineNumber: line.lineNumber })
  return mapLine(line)
}

export async function removeLine(
  req: Request,
  tenantId: string,
  statementId: string,
  lineId: string,
  expectedUpdatedAt: string,
) {
  const statement = await readRepo.getStatementById(tenantId, statementId)
  const actions = getStatementAllowedActions(statement.status)
  if (!actions.canDeleteLine) throw new BankStatementInvalidStateError('Cannot delete lines in current status')
  if (statement.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new BankStatementInvalidStateError()
  }

  const deleted = await repo.deleteStatementLine(tenantId, statementId, lineId)
  await repo.updateStatement(tenantId, statementId, { lineCount: { decrement: 1 } })
  await auditStatementAction(req, 'DeleteLine', statementId, { lineId }, null)
  return mapLine(deleted)
}

export { getTreasuryAccountOrThrow, getLegalEntityOrThrow }
