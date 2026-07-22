import type { Request } from 'express'
import { formatForPersistence, subtract, sumDecimals, toDecimal } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import {
  BankStatementInvalidStateError,
  BankStatementStaleVersionError,
} from '../treasury.errors.js'
import { getStatementAllowedActions } from './bank-statement-allowed-actions.service.js'
import { auditStatementAction } from './bank-statement-audit.service.js'
import { buildStatementLineHash, buildStatementUniquenessKey } from './bank-statement-identity.service.js'
import * as readRepo from './bank-statement-read.repository.js'
import * as repo from './bank-statement.repository.js'
import {
  computeLineTotals,
  validateStatementOperational,
} from './bank-statement-validation.service.js'
import { getTreasuryAccountOrThrow } from './bank-statement-line.service.js'
import { maskCounterpartyAccount, normaliseDescription } from './import/bank-statement-import-security.service.js'
import type {
  BankStatementLifecycleInput,
  CreateManualStatementInput,
  ListBankStatementsQuery,
  UpdateBankStatementInput,
} from './bank-statement.schemas.js'

function mapStatement(statement: Awaited<ReturnType<typeof readRepo.getStatementById>>) {
  const actions = getStatementAllowedActions(statement.status)
  return {
    ...statement,
    openingBalance: formatForPersistence(statement.openingBalance),
    closingBalance: formatForPersistence(statement.closingBalance),
    totalCreditAmount: formatForPersistence(statement.totalCreditAmount),
    totalDebitAmount: formatForPersistence(statement.totalDebitAmount),
    balanceDifference: formatForPersistence(statement.balanceDifference),
    allowedActions: actions,
  }
}

export async function listStatements(tenantId: string, query: ListBankStatementsQuery) {
  if (query.legalEntityId) await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await readRepo.listStatements(tenantId, query)
  return {
    ...result,
    items: result.items.map((s) => ({
      ...s,
      openingBalance: formatForPersistence(s.openingBalance),
      closingBalance: formatForPersistence(s.closingBalance),
      totalCreditAmount: formatForPersistence(s.totalCreditAmount),
      totalDebitAmount: formatForPersistence(s.totalDebitAmount),
      balanceDifference: formatForPersistence(s.balanceDifference),
      allowedActions: getStatementAllowedActions(s.status),
    })),
  }
}

export async function getStatement(tenantId: string, id: string) {
  const statement = await readRepo.getStatementById(tenantId, id)
  const lines = await readRepo.getStatementLines(tenantId, id)
  return {
    statement: mapStatement(statement),
    lines: lines.map((l) => ({
      ...l,
      amount: formatForPersistence(l.amount),
      runningBalance: l.runningBalance != null ? formatForPersistence(l.runningBalance) : null,
    })),
  }
}

export async function createManualStatement(req: Request, tenantId: string, input: CreateManualStatementInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const treasuryAccount = await getTreasuryAccountOrThrow(tenantId, input.legalEntityId, input.treasuryAccountId)

  const lineInputs = input.lines ?? []
  const computedTotals =
    lineInputs.length > 0
      ? computeLineTotals({
          lines: lineInputs.map((line) => ({ direction: line.direction, amount: line.amount })),
        })
      : null

  const totalCreditAmount = computedTotals?.creditTotal ?? formatForPersistence(input.totalCreditAmount)
  const totalDebitAmount = computedTotals?.debitTotal ?? formatForPersistence(input.totalDebitAmount)
  const openingBalance = formatForPersistence(input.openingBalance)
  const closingBalance = formatForPersistence(input.closingBalance)
  const balanceDifference = formatForPersistence(
    subtract(toDecimal(closingBalance), subtract(sumDecimals([openingBalance, totalCreditAmount]), totalDebitAmount)),
  )

  const uniquenessKey = buildStatementUniquenessKey({
    tenantId,
    legalEntityId: input.legalEntityId,
    treasuryAccountId: input.treasuryAccountId,
    statementReference: input.statementReference,
    periodStartDate: new Date(input.periodStartDate),
    periodEndDate: new Date(input.periodEndDate),
  })

  const statement = await repo.createStatement({
    tenantId,
    legalEntityId: input.legalEntityId,
    treasuryAccountId: input.treasuryAccountId,
    statementReference: input.statementReference,
    statementDate: new Date(input.statementDate),
    periodStartDate: new Date(input.periodStartDate),
    periodEndDate: new Date(input.periodEndDate),
    currencyCode: input.currencyCode ?? treasuryAccount.currencyCode,
    openingBalance,
    closingBalance,
    totalCreditAmount,
    totalDebitAmount,
    balanceDifference,
    statementUniquenessKey: uniquenessKey,
    importFormat: 'MANUAL',
    sourceType: 'MANUAL',
    createdBy: req.context?.userId ?? null,
  })

  if (lineInputs.length > 0) {
    let lineNumber = 0
    for (const line of lineInputs) {
      lineNumber += 1
      const transactionDate = new Date(line.transactionDate)
      const lineHash = buildStatementLineHash({
        treasuryAccountId: input.treasuryAccountId,
        transactionDate,
        direction: line.direction,
        amount: line.amount,
        referenceNumber: line.referenceNumber,
        description: line.description,
      })
      await repo.createStatementLine({
        tenantId,
        legalEntityId: input.legalEntityId,
        bankStatementId: statement.id,
        lineNumber,
        transactionDate,
        valueDate: line.valueDate ? new Date(line.valueDate) : null,
        direction: line.direction,
        amount: formatForPersistence(line.amount),
        description: line.description ?? null,
        normalizedDescription: line.description ? normaliseDescription(line.description) : null,
        referenceNumber: line.referenceNumber ?? null,
        utrReference: line.utrReference ?? null,
        chequeNumber: line.chequeNumber ?? null,
        transactionCode: line.transactionCode ?? null,
        counterpartyName: line.counterpartyName ?? null,
        counterpartyAccountMasked:
          line.counterpartyAccount != null ? maskCounterpartyAccount(line.counterpartyAccount) : null,
        lineHash,
      })
    }
    await repo.updateStatement(tenantId, statement.id, { lineCount: lineInputs.length, status: 'IMPORTED' })
  }

  await auditStatementAction(req, 'ManualCreate', statement.id, null, { statementReference: statement.statementReference })
  return mapStatement(await readRepo.getStatementById(tenantId, statement.id))
}

export async function updateStatement(req: Request, tenantId: string, id: string, input: UpdateBankStatementInput) {
  const existing = await readRepo.getStatementById(tenantId, id)
  const actions = getStatementAllowedActions(existing.status)
  if (!actions.canEdit) throw new BankStatementInvalidStateError('Statement cannot be edited in current status')

  try {
    const updated = await repo.updateStatement(
      tenantId,
      id,
      {
        statementReference: input.statementReference,
        statementDate: input.statementDate ? new Date(input.statementDate) : undefined,
        periodStartDate: input.periodStartDate ? new Date(input.periodStartDate) : undefined,
        periodEndDate: input.periodEndDate ? new Date(input.periodEndDate) : undefined,
        openingBalance: input.openingBalance != null ? formatForPersistence(input.openingBalance) : undefined,
        closingBalance: input.closingBalance != null ? formatForPersistence(input.closingBalance) : undefined,
        totalCreditAmount: input.totalCreditAmount != null ? formatForPersistence(input.totalCreditAmount) : undefined,
        totalDebitAmount: input.totalDebitAmount != null ? formatForPersistence(input.totalDebitAmount) : undefined,
        updatedBy: req.context?.userId ?? null,
      },
      input.expectedUpdatedAt,
    )
    await auditStatementAction(req, 'Update', id, existing, updated)
    return mapStatement(await readRepo.getStatementById(tenantId, id))
  } catch (err) {
    if ((err as { code?: string }).code === 'BANK_STATEMENT_STALE_VERSION') throw err
    throw new BankStatementStaleVersionError()
  }
}

export async function validateStatement(req: Request, tenantId: string, id: string, input: BankStatementLifecycleInput) {
  const existing = await readRepo.getStatementById(tenantId, id)
  const actions = getStatementAllowedActions(existing.status)
  if (!actions.canValidate) throw new BankStatementInvalidStateError('Statement cannot be validated in current status')
  if (existing.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new BankStatementStaleVersionError()

  const lines = await readRepo.getStatementLines(tenantId, id)
  const lineTotals = computeLineTotals({
    lines: lines.map((l) => ({ direction: l.direction, amount: formatForPersistence(l.amount) })),
  })
  const openingBalance = formatForPersistence(existing.openingBalance)
  const closingBalance = formatForPersistence(existing.closingBalance)
  const balanceDifference = formatForPersistence(
    subtract(
      toDecimal(closingBalance),
      subtract(sumDecimals([openingBalance, lineTotals.creditTotal]), lineTotals.debitTotal),
    ),
  )

  await repo.updateStatement(tenantId, id, {
    totalCreditAmount: lineTotals.creditTotal,
    totalDebitAmount: lineTotals.debitTotal,
    balanceDifference,
  })

  const refreshed = await readRepo.getStatementById(tenantId, id)
  const result = validateStatementOperational({
    header: {
      openingBalance: formatForPersistence(refreshed.openingBalance),
      closingBalance: formatForPersistence(refreshed.closingBalance),
      totalCreditAmount: lineTotals.creditTotal,
      totalDebitAmount: lineTotals.debitTotal,
      periodStartDate: refreshed.periodStartDate,
      periodEndDate: refreshed.periodEndDate,
      statementDate: refreshed.statementDate,
      currencyCode: refreshed.currencyCode,
      treasuryAccountCurrencyCode: refreshed.treasuryAccount.currencyCode,
    },
    lines: lines.map((l) => ({ direction: l.direction, amount: formatForPersistence(l.amount) })),
  })

  const updated = await repo.markStatementValidated(
    tenantId,
    id,
    result.valid,
    result.errors,
    req.context?.userId ?? null,
  )
  await auditStatementAction(req, 'Validate', id, { status: existing.status }, { status: updated.status, errors: result.errors })
  return mapStatement(await readRepo.getStatementById(tenantId, id))
}

export async function reopenDraft(req: Request, tenantId: string, id: string, input: BankStatementLifecycleInput) {
  const existing = await readRepo.getStatementById(tenantId, id)
  const actions = getStatementAllowedActions(existing.status)
  if (!actions.canReopenDraft) throw new BankStatementInvalidStateError('Statement cannot be reopened in current status')
  if (existing.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new BankStatementStaleVersionError()

  await repo.updateStatement(tenantId, id, {
    status: 'DRAFT',
    reopenReason: input.reason ?? null,
    reopenedAt: new Date(),
    reopenedBy: req.context?.userId ?? null,
    validatedAt: null,
    validatedBy: null,
    validationErrors: undefined,
  })
  await auditStatementAction(req, 'ReopenDraft', id, { status: existing.status }, { status: 'DRAFT' })
  return mapStatement(await readRepo.getStatementById(tenantId, id))
}

export async function cancelStatement(req: Request, tenantId: string, id: string, input: BankStatementLifecycleInput) {
  const existing = await readRepo.getStatementById(tenantId, id)
  const actions = getStatementAllowedActions(existing.status)
  if (!actions.canCancel) throw new BankStatementInvalidStateError('Statement cannot be cancelled in current status')
  if (existing.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new BankStatementStaleVersionError()

  await repo.updateStatement(tenantId, id, {
    status: 'CANCELLED',
    cancelledAt: new Date(),
    cancelledBy: req.context?.userId ?? null,
    cancellationReason: input.reason ?? null,
  })
  await auditStatementAction(req, 'Cancel', id, { status: existing.status }, { status: 'CANCELLED' })
  return mapStatement(await readRepo.getStatementById(tenantId, id))
}
