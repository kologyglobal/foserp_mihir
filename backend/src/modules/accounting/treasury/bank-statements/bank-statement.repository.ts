import { prisma } from '../../../../config/database.js'
import type { Prisma } from '@prisma/client'
import {
  BankStatementImportBatchNotFoundError,
  BankStatementImportBatchStaleVersionError,
  BankStatementInvalidStateError,
  BankStatementLineNotFoundError,
  BankStatementNotFoundError,
  BankStatementStaleVersionError,
} from '../treasury.errors.js'

function assertUpdatedAt(current: Date, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  if (current.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new BankStatementStaleVersionError()
  }
}

function assertBatchUpdatedAt(current: Date, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  if (current.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new BankStatementImportBatchStaleVersionError()
  }
}

export interface CreateImportBatchInput {
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  batchReference: string
  sourceType?: 'FILE_UPLOAD' | 'MANUAL' | 'BANK_API' | 'SYSTEM_GENERATED' | 'OTHER'
  importFormat?: 'CSV' | 'XLSX' | 'MT940' | 'CAMT_053' | 'MANUAL' | 'AUTO_DETECT' | 'OTHER'
  uploadedBy?: string | null
  originalFileName?: string | null
  sanitisedFileName?: string | null
  fileSizeBytes?: number | null
  fileChecksum?: string | null
  storageKey?: string | null
  mimeType?: string | null
  mappingTemplateId?: string | null
}

export async function createImportBatch(input: CreateImportBatchInput) {
  return prisma.bankStatementImportBatch.create({
    data: {
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      treasuryAccountId: input.treasuryAccountId,
      batchReference: input.batchReference,
      sourceType: input.sourceType ?? 'MANUAL',
      importFormat: input.importFormat ?? 'MANUAL',
      status: 'UPLOADED',
      uploadedBy: input.uploadedBy ?? null,
      originalFileName: input.originalFileName ?? null,
      sanitisedFileName: input.sanitisedFileName ?? null,
      fileName: input.sanitisedFileName ?? input.originalFileName ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      fileChecksum: input.fileChecksum ?? null,
      storageKey: input.storageKey ?? null,
      mimeType: input.mimeType ?? null,
      mappingTemplateId: input.mappingTemplateId ?? null,
    },
  })
}

export async function updateImportBatch(
  tenantId: string,
  id: string,
  data: Prisma.BankStatementImportBatchUpdateInput,
  expectedUpdatedAt?: string,
) {
  const existing = await prisma.bankStatementImportBatch.findFirst({ where: { id, tenantId } })
  if (!existing) throw new BankStatementImportBatchNotFoundError()
  assertBatchUpdatedAt(existing.updatedAt, expectedUpdatedAt)
  return prisma.bankStatementImportBatch.update({ where: { id }, data })
}

export async function getImportBatchOrThrow(tenantId: string, id: string) {
  const batch = await prisma.bankStatementImportBatch.findFirst({ where: { id, tenantId } })
  if (!batch) throw new BankStatementImportBatchNotFoundError()
  return batch
}

export async function findImportBatchByChecksum(
  tenantId: string,
  legalEntityId: string,
  treasuryAccountId: string,
  fileChecksum: string,
) {
  return prisma.bankStatementImportBatch.findFirst({
    where: {
      tenantId,
      legalEntityId,
      treasuryAccountId,
      fileChecksum,
      status: { not: 'CANCELLED' },
    },
  })
}

export interface CreateStatementInput {
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  importBatchId?: string | null
  statementReference: string
  statementDate: Date
  periodStartDate: Date
  periodEndDate: Date
  currencyCode: string
  openingBalance: string | number
  closingBalance: string | number
  totalCreditAmount: string | number
  totalDebitAmount: string | number
  balanceDifference?: string | number
  statementUniquenessKey: string
  importFormat?: 'CSV' | 'XLSX' | 'MANUAL' | 'MT940' | 'CAMT_053' | 'AUTO_DETECT' | 'OTHER'
  sourceType?: 'FILE_UPLOAD' | 'MANUAL' | 'BANK_API' | 'SYSTEM_GENERATED' | 'OTHER'
  createdBy?: string | null
}

export async function createStatement(input: CreateStatementInput) {
  return prisma.bankStatement.create({
    data: {
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      treasuryAccountId: input.treasuryAccountId,
      importBatchId: input.importBatchId ?? null,
      statementReference: input.statementReference,
      statementDate: input.statementDate,
      periodStartDate: input.periodStartDate,
      periodEndDate: input.periodEndDate,
      currencyCode: input.currencyCode,
      openingBalance: input.openingBalance,
      closingBalance: input.closingBalance,
      totalCreditAmount: input.totalCreditAmount,
      totalDebitAmount: input.totalDebitAmount,
      balanceDifference: input.balanceDifference ?? 0,
      lineCount: 0,
      status: 'DRAFT',
      sourceType: input.sourceType ?? 'FILE_UPLOAD',
      importFormat: input.importFormat ?? null,
      statementUniquenessKey: input.statementUniquenessKey,
      createdBy: input.createdBy ?? null,
    },
  })
}

export async function updateStatement(
  tenantId: string,
  id: string,
  data: Prisma.BankStatementUpdateInput,
  expectedUpdatedAt?: string,
) {
  const existing = await prisma.bankStatement.findFirst({ where: { id, tenantId } })
  if (!existing) throw new BankStatementNotFoundError()
  assertUpdatedAt(existing.updatedAt, expectedUpdatedAt)
  return prisma.bankStatement.update({ where: { id }, data })
}

export interface CreateStatementLineInput {
  tenantId: string
  legalEntityId: string
  bankStatementId: string
  lineNumber: number
  transactionDate: Date
  valueDate?: Date | null
  direction: 'CREDIT' | 'DEBIT'
  amount: string | number
  description?: string | null
  normalizedDescription?: string | null
  referenceNumber?: string | null
  utrReference?: string | null
  chequeNumber?: string | null
  transactionCode?: string | null
  counterpartyName?: string | null
  counterpartyAccountMasked?: string | null
  counterpartyBankCode?: string | null
  externalLineId?: string | null
  externalTransactionId?: string | null
  runningBalance?: string | number | null
  sourceRowNumber?: number | null
  lineHash: string
  rawPayload?: Prisma.InputJsonValue
}

export async function createStatementLine(input: CreateStatementLineInput) {
  return prisma.bankStatementLine.create({
    data: {
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      bankStatementId: input.bankStatementId,
      lineNumber: input.lineNumber,
      sourceRowNumber: input.sourceRowNumber ?? null,
      transactionDate: input.transactionDate,
      valueDate: input.valueDate ?? null,
      direction: input.direction,
      amount: input.amount,
      description: input.description ?? null,
      normalizedDescription: input.normalizedDescription ?? null,
      referenceNumber: input.referenceNumber ?? null,
      utrReference: input.utrReference ?? null,
      chequeNumber: input.chequeNumber ?? null,
      transactionCode: input.transactionCode ?? null,
      counterpartyName: input.counterpartyName ?? null,
      counterpartyAccountMasked: input.counterpartyAccountMasked ?? null,
      counterpartyBankCode: input.counterpartyBankCode ?? null,
      externalLineId: input.externalLineId ?? null,
      externalTransactionId: input.externalTransactionId ?? null,
      runningBalance: input.runningBalance ?? null,
      matchStatus: 'UNMATCHED',
      lineHash: input.lineHash,
      rawPayload: input.rawPayload,
    },
  })
}

export async function updateStatementLine(
  tenantId: string,
  statementId: string,
  lineId: string,
  data: Prisma.BankStatementLineUpdateInput,
) {
  const line = await prisma.bankStatementLine.findFirst({
    where: { id: lineId, tenantId, bankStatementId: statementId },
  })
  if (!line) throw new BankStatementLineNotFoundError()
  return prisma.bankStatementLine.update({ where: { id: lineId }, data })
}

export async function deleteStatementLine(tenantId: string, statementId: string, lineId: string) {
  const line = await prisma.bankStatementLine.findFirst({
    where: { id: lineId, tenantId, bankStatementId: statementId },
  })
  if (!line) throw new BankStatementLineNotFoundError()
  await prisma.bankStatementLine.delete({ where: { id: lineId } })
  return line
}

export async function markStatementValidated(
  tenantId: string,
  id: string,
  valid: boolean,
  errors: string[] | null,
  validatedBy?: string | null,
) {
  const existing = await prisma.bankStatement.findFirst({ where: { id, tenantId } })
  if (!existing) throw new BankStatementNotFoundError()
  if (existing.status !== 'DRAFT' && existing.status !== 'IMPORTED' && existing.status !== 'VALIDATION_FAILED') {
    throw new BankStatementInvalidStateError('Only DRAFT, IMPORTED or VALIDATION_FAILED statements can be validated')
  }
  return prisma.bankStatement.update({
    where: { id },
    data: {
      status: valid ? 'VALIDATED' : 'VALIDATION_FAILED',
      validationErrors: errors && errors.length > 0 ? errors : undefined,
      validatedAt: new Date(),
      validatedBy: validatedBy ?? null,
    },
  })
}

export async function findStatementByUniquenessKey(tenantId: string, statementUniquenessKey: string) {
  return prisma.bankStatement.findFirst({ where: { tenantId, statementUniquenessKey } })
}

export async function findExistingLineHash(tenantId: string, legalEntityId: string, lineHash: string) {
  return prisma.bankStatementLine.findFirst({
    where: { tenantId, legalEntityId, lineHash },
    select: { id: true, bankStatementId: true, lineNumber: true },
  })
}

export async function createImportIssues(
  tenantId: string,
  legalEntityId: string,
  importBatchId: string,
  issues: Array<{
    rowNumber?: number | null
    columnName?: string | null
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKER'
    category: string
    code: string
    message: string
    rawValue?: string | null
    normalizedValue?: string | null
    metadata?: Prisma.InputJsonValue
    bankStatementId?: string | null
    bankStatementLineId?: string | null
  }>,
) {
  if (issues.length === 0) return []
  await prisma.bankStatementImportIssue.createMany({
    data: issues.map((issue) => ({
      tenantId,
      legalEntityId,
      importBatchId,
      bankStatementId: issue.bankStatementId ?? null,
      bankStatementLineId: issue.bankStatementLineId ?? null,
      rowNumber: issue.rowNumber ?? null,
      columnName: issue.columnName ?? null,
      severity: issue.severity,
      category: issue.category as never,
      code: issue.code,
      message: issue.message.slice(0, 1000),
      rawValue: issue.rawValue ?? null,
      normalizedValue: issue.normalizedValue ?? null,
      metadata: issue.metadata,
    })),
  })
  return issues
}

export async function incrementStatementLineCount(tenantId: string, statementId: string, count: number) {
  return prisma.bankStatement.update({
    where: { id: statementId, tenantId },
    data: { lineCount: { increment: count } },
  })
}
