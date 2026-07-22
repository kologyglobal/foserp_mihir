/**
 * Phase 5D2 — ingest a fetched statement file into BankStatement via existing parsers.
 * sourceType = BANK_API. Reuses MT940 / CAMT.053 structured parse + duplicate guards.
 */
import type { Request } from 'express'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { prisma } from '../../../../config/database.js'
import { saveTreasuryStatementFile } from '../../../../services/fileStorage.service.js'
import {
  assertNoDuplicateFile,
  computeFileChecksum,
  isDuplicateLine,
} from '../bank-statements/bank-statement-duplicate.service.js'
import { buildStatementLineHash, buildStatementUniquenessKey } from '../bank-statements/bank-statement-identity.service.js'
import * as stmtRepo from '../bank-statements/bank-statement.repository.js'
import { nextBatchReference } from '../bank-statements/import/bank-statement-import-batch.repository.js'
import { sanitiseFileName } from '../bank-statements/import/bank-statement-import-security.service.js'
import { parseStructuredStatementFile } from '../bank-statements/import/bank-statement-structured-parse.service.js'
import { BankStatementDuplicateFileError, BankStatementDuplicateStatementError } from '../treasury.errors.js'
import type { BankConnectorFetchedFile } from './bank-connector.interface.js'
import { BankConnectorValidationError } from './bank-connector.errors.js'

function toImportFormat(hint: BankConnectorFetchedFile['formatHint']): 'MT940' | 'CAMT_053' {
  if (hint === 'CAMT053') return 'CAMT_053'
  if (hint === 'MT940') return 'MT940'
  throw new BankConnectorValidationError(
    'Connector sync currently supports MT940 and CAMT.053 only. Set expectedFormat accordingly.',
  )
}

function extensionFor(format: 'MT940' | 'CAMT_053', fileName: string): string {
  const fromName = path.extname(fileName)
  if (fromName) return fromName
  return format === 'CAMT_053' ? '.xml' : '.sta'
}

export async function ingestConnectorFetchedFile(args: {
  req: Request
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  connectorId: string
  file: BankConnectorFetchedFile
}): Promise<{
  statementId: string
  importBatchId: string
  lineCount: number
  skippedDuplicate: boolean
}> {
  const { req, tenantId, legalEntityId, treasuryAccountId, file } = args
  const importFormat = toImportFormat(file.formatHint)
  const fileChecksum = computeFileChecksum(file.buffer)

  try {
    await assertNoDuplicateFile(tenantId, legalEntityId, treasuryAccountId, fileChecksum, 'BLOCK')
  } catch (e) {
    if (e instanceof BankStatementDuplicateFileError) {
      const existing = await stmtRepo.findImportBatchByChecksum(
        tenantId,
        legalEntityId,
        treasuryAccountId,
        fileChecksum,
      )
      const linked = existing
        ? await prisma.bankStatement.findFirst({
            where: { tenantId, importBatchId: existing.id },
          })
        : null
      return {
        statementId: linked?.id ?? '',
        importBatchId: existing?.id ?? '',
        lineCount: linked?.lineCount ?? 0,
        skippedDuplicate: true,
      }
    }
    throw e
  }

  const treasuryAccount = await prisma.treasuryAccount.findFirstOrThrow({
    where: { id: treasuryAccountId, tenantId, legalEntityId },
  })

  const parsed = parseStructuredStatementFile(file.buffer, importFormat)
  const header = parsed.header

  const uniquenessKey = buildStatementUniquenessKey({
    tenantId,
    legalEntityId,
    treasuryAccountId,
    statementReference: header.statementReference,
    periodStartDate: header.periodStartDate,
    periodEndDate: header.periodEndDate,
  })

  try {
    await assertNoDuplicateStatementViaKey(tenantId, uniquenessKey)
  } catch (e) {
    if (e instanceof BankStatementDuplicateStatementError) {
      const existing = await prisma.bankStatement.findFirst({
        where: { tenantId, statementUniquenessKey: uniquenessKey },
      })
      return {
        statementId: existing?.id ?? '',
        importBatchId: existing?.importBatchId ?? '',
        lineCount: existing?.lineCount ?? 0,
        skippedDuplicate: true,
      }
    }
    throw e
  }

  const fileId = randomUUID()
  const ext = extensionFor(importFormat, file.fileName)
  const storageKey = await saveTreasuryStatementFile(tenantId, fileId, file.buffer, ext)

  const batchReference = await nextBatchReference(tenantId, legalEntityId)
  const batch = await stmtRepo.createImportBatch({
    tenantId,
    legalEntityId,
    treasuryAccountId,
    batchReference,
    sourceType: 'BANK_API',
    importFormat,
    uploadedBy: req.context?.userId ?? null,
    originalFileName: file.fileName,
    sanitisedFileName: sanitiseFileName(file.fileName),
    fileSizeBytes: file.buffer.length,
    fileChecksum,
    storageKey,
    mimeType: importFormat === 'CAMT_053' ? 'application/xml' : 'text/plain',
  })

  const statement = await stmtRepo.createStatement({
    tenantId,
    legalEntityId,
    treasuryAccountId,
    importBatchId: batch.id,
    statementReference: header.statementReference,
    statementDate: header.statementDate,
    periodStartDate: header.periodStartDate,
    periodEndDate: header.periodEndDate,
    currencyCode: treasuryAccount.currencyCode,
    openingBalance: header.openingBalance,
    closingBalance: header.closingBalance,
    totalCreditAmount: header.totalCreditAmount,
    totalDebitAmount: header.totalDebitAmount,
    balanceDifference: header.balanceDifference,
    statementUniquenessKey: uniquenessKey,
    importFormat,
    sourceType: 'BANK_API',
    createdBy: req.context?.userId ?? null,
  })

  let lineNumber = 0
  let importedLineCount = 0
  for (const row of parsed.lines) {
    const lineHash = buildStatementLineHash({
      treasuryAccountId,
      transactionDate: row.transactionDate,
      direction: row.direction,
      amount: row.amount,
      referenceNumber: row.referenceNumber,
      description: row.description,
      externalTransactionId: row.externalTransactionId,
    })
    const dup = await isDuplicateLine(tenantId, legalEntityId, lineHash)
    if (dup.isDuplicate) continue

    lineNumber += 1
    await stmtRepo.createStatementLine({
      tenantId,
      legalEntityId,
      bankStatementId: statement.id,
      lineNumber,
      sourceRowNumber: row.sourceRowNumber ?? lineNumber,
      transactionDate: row.transactionDate,
      valueDate: row.valueDate ?? null,
      direction: row.direction,
      amount: row.amount,
      description: row.description ?? null,
      normalizedDescription: row.normalizedDescription ?? null,
      referenceNumber: row.referenceNumber ?? null,
      utrReference: row.utrReference ?? null,
      chequeNumber: row.chequeNumber ?? null,
      transactionCode: row.transactionCode ?? null,
      counterpartyName: row.counterpartyName ?? null,
      counterpartyAccountMasked: row.counterpartyAccountMasked ?? null,
      externalLineId: row.externalLineId ?? null,
      externalTransactionId: row.externalTransactionId ?? null,
      runningBalance: row.runningBalance ?? null,
      lineHash,
      rawPayload: (row.rawPayload ?? undefined) as never,
    })
    importedLineCount += 1
  }

  await stmtRepo.updateStatement(tenantId, statement.id, {
    lineCount: importedLineCount,
    status: 'IMPORTED',
  })

  await stmtRepo.updateImportBatch(tenantId, batch.id, {
    status: 'IMPORTED',
    completedAt: new Date(),
    importedLineCount,
    totalLineCount: parsed.lines.length,
  })

  return {
    statementId: statement.id,
    importBatchId: batch.id,
    lineCount: importedLineCount,
    skippedDuplicate: false,
  }
}

async function assertNoDuplicateStatementViaKey(tenantId: string, uniquenessKey: string) {
  const existing = await prisma.bankStatement.findFirst({
    where: { tenantId, statementUniquenessKey: uniquenessKey, status: { not: 'CANCELLED' } },
  })
  if (existing) {
    throw new BankStatementDuplicateStatementError(
      `Duplicate statement matches existing statement ${existing.statementReference}`,
    )
  }
}
