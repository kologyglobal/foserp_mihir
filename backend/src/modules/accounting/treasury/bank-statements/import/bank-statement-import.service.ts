import type { Request } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../../../../config/database.js'
import {
  getAttachmentExtension,
  readTreasuryStatementFile,
  saveTreasuryStatementFile,
} from '../../../../../services/fileStorage.service.js'
import { getLegalEntityOrThrow } from '../../../shared/finance.helpers.js'
import {
  BankStatementImportBatchInvalidStateError,
  BankStatementImportBatchNotFoundError,
  BankStatementImportStrictErrorsError,
  BankStatementMappingTemplateNotFoundError,
} from '../../treasury.errors.js'
import { getImportBatchAllowedActions } from '../bank-statement-allowed-actions.service.js'
import { auditImportBatchAction } from '../bank-statement-audit.service.js'
import {
  assertNoDuplicateFile,
  assertNoDuplicateStatement,
  computeFileChecksum,
  isDuplicateLine,
} from '../bank-statement-duplicate.service.js'
import { buildStatementLineHash, buildStatementUniquenessKey } from '../bank-statement-identity.service.js'
import * as readRepo from '../bank-statement-read.repository.js'
import * as repo from '../bank-statement.repository.js'
import { getTreasuryAccountOrThrow } from '../bank-statement-line.service.js'
import type { BankStatementMappingConfig, BankStatementParsingConfig } from '../bank-statement.types.js'
import type {
  ExecuteImportBatchInput,
  InspectImportBatchInput,
  PreviewImportBatchInput,
} from './bank-statement-import.schemas.js'
import { deleteBatchIssues, nextBatchReference } from './bank-statement-import-batch.repository.js'
import { detectBankStatementFormat } from './bank-statement-format-detect.service.js'
import { inspectStatementFile, parseStatementFile } from './bank-statement-file-inspection.service.js'
import { persistBatchIssues } from './bank-statement-import-issue.service.js'
import {
  formatNeedsColumnMapping,
  sanitiseFileName,
  validateUploadBasics,
  type UploadImportFormat,
} from './bank-statement-import-security.service.js'
import { inferDefaultMapping, mergeMappingConfig } from './bank-statement-mapping.service.js'
import { applyHeaderOverrides } from './bank-statement-normalisation.service.js'
import { isStructuredImportFormat } from './bank-statement-native.types.js'
import {
  buildImportPreview,
  buildNativeImportPreview,
  countIssueSeverities,
} from './bank-statement-preview.service.js'
import { parseStructuredStatementFile } from './bank-statement-structured-parse.service.js'

function mapBatch(batch: NonNullable<Awaited<ReturnType<typeof readRepo.getImportBatchById>>>) {
  return {
    ...batch,
    storageKey: undefined,
    allowedActions: getImportBatchAllowedActions(batch.status),
  }
}

async function loadTemplateMapping(
  tenantId: string,
  legalEntityId: string,
  mappingTemplateId?: string | null,
): Promise<BankStatementMappingConfig | null> {
  if (!mappingTemplateId) return null
  const template = await prisma.bankStatementColumnMappingTemplate.findFirst({
    where: { id: mappingTemplateId, tenantId, legalEntityId, isActive: true },
  })
  if (!template) throw new BankStatementMappingTemplateNotFoundError()
  return template.mappingConfig as unknown as BankStatementMappingConfig
}

async function readBatchFile(batch: { storageKey?: string | null }) {
  if (!batch.storageKey) throw new BankStatementImportBatchInvalidStateError('Import batch has no stored file')
  return readTreasuryStatementFile(batch.storageKey)
}

function extensionForResolved(format: 'CSV' | 'XLSX' | 'MT940' | 'CAMT_053'): string {
  switch (format) {
    case 'CSV':
      return '.csv'
    case 'XLSX':
      return '.xlsx'
    case 'MT940':
      return '.sta'
    case 'CAMT_053':
      return '.xml'
  }
}

export async function uploadImportBatch(
  req: Request,
  tenantId: string,
  input: {
    treasuryAccountId: string
    importFormat: UploadImportFormat
    mappingTemplateId?: string
  },
  file: Express.Multer.File,
) {
  const treasuryAccount = await prisma.treasuryAccount.findFirstOrThrow({
    where: { id: input.treasuryAccountId, tenantId },
  })
  await getLegalEntityOrThrow(tenantId, treasuryAccount.legalEntityId)
  await getTreasuryAccountOrThrow(tenantId, treasuryAccount.legalEntityId, input.treasuryAccountId)

  const { ext, mimeType } = validateUploadBasics(file.buffer, file.originalname, input.importFormat)
  const resolvedFormat = detectBankStatementFormat(file.buffer, file.originalname, input.importFormat)
  if (input.importFormat === 'AUTO_DETECT') {
    // Extension already accepted; re-check content signatures only for the resolved format.
    validateUploadBasics(file.buffer, `detected${extensionForResolved(resolvedFormat)}`, resolvedFormat)
  }

  const fileChecksum = computeFileChecksum(file.buffer)
  const duplicatePolicy =
    (
      await prisma.bankReconciliationProfile.findUnique({
        where: { treasuryAccountId: input.treasuryAccountId },
      })
    )?.duplicatePolicy ?? 'BLOCK'

  await assertNoDuplicateFile(
    tenantId,
    treasuryAccount.legalEntityId,
    input.treasuryAccountId,
    fileChecksum,
    duplicatePolicy,
  )

  const batchReference = await nextBatchReference(tenantId, treasuryAccount.legalEntityId)
  const fileId = randomUUID()
  const storageKey = await saveTreasuryStatementFile(tenantId, fileId, file.buffer, ext || getAttachmentExtension(file.originalname))

  const batch = await repo.createImportBatch({
    tenantId,
    legalEntityId: treasuryAccount.legalEntityId,
    treasuryAccountId: input.treasuryAccountId,
    batchReference,
    sourceType: 'FILE_UPLOAD',
    importFormat: resolvedFormat,
    uploadedBy: req.context?.userId ?? null,
    originalFileName: file.originalname,
    sanitisedFileName: sanitiseFileName(file.originalname),
    fileSizeBytes: file.buffer.length,
    fileChecksum,
    storageKey,
    mimeType,
    mappingTemplateId: isStructuredImportFormat(resolvedFormat) ? null : (input.mappingTemplateId ?? null),
  })

  await auditImportBatchAction(req, 'Upload', batch.id, null, {
    batchReference,
    importFormat: resolvedFormat,
    requestedImportFormat: input.importFormat,
    fileChecksum,
  })

  const loaded = await readRepo.getImportBatchById(tenantId, batch.id)
  if (!loaded) throw new BankStatementImportBatchNotFoundError()
  return mapBatch(loaded)
}

export async function getImportBatch(tenantId: string, id: string) {
  const batch = await readRepo.getImportBatchById(tenantId, id)
  if (!batch) throw new BankStatementImportBatchNotFoundError()
  return mapBatch(batch)
}

export async function inspectBatch(
  req: Request,
  tenantId: string,
  id: string,
  input: InspectImportBatchInput,
) {
  const batch = await repo.getImportBatchOrThrow(tenantId, id)
  const actions = getImportBatchAllowedActions(batch.status)
  if (!actions.canInspect) throw new BankStatementImportBatchInvalidStateError()

  const buffer = await readBatchFile(batch)
  const parsingConfig = (input.parsingConfig ?? batch.parsingConfig ?? undefined) as BankStatementParsingConfig | undefined
  const inspectResult = await inspectStatementFile(buffer, batch.importFormat, parsingConfig)

  const structured = isStructuredImportFormat(batch.importFormat)
  const templateMapping = structured
    ? null
    : await loadTemplateMapping(tenantId, batch.legalEntityId, batch.mappingTemplateId)
  const mappingConfig = structured
    ? null
    : mergeMappingConfig(templateMapping, input.mappingConfig ?? null) ??
      inferDefaultMapping(inspectResult.headers ?? [])

  const updated = await repo.updateImportBatch(
    tenantId,
    id,
    {
      inspectConfig: inspectResult as never,
      parsingConfig: parsingConfig as never,
      mappingConfig: mappingConfig as never,
    },
    input.expectedUpdatedAt,
  )

  await auditImportBatchAction(req, 'Inspect', id, null, inspectResult)
  return {
    batch: mapBatch({ ...(await readRepo.getImportBatchById(tenantId, id))!, ...updated }),
    inspect: inspectResult,
    suggestedMapping: mappingConfig,
    requiresColumnMapping: formatNeedsColumnMapping(batch.importFormat),
  }
}

export async function previewBatch(
  req: Request,
  tenantId: string,
  id: string,
  input: PreviewImportBatchInput,
) {
  const batch = await repo.getImportBatchOrThrow(tenantId, id)
  const actions = getImportBatchAllowedActions(batch.status)
  if (!actions.canPreview) throw new BankStatementImportBatchInvalidStateError()

  const treasuryAccount = await getTreasuryAccountOrThrow(tenantId, batch.legalEntityId, batch.treasuryAccountId)
  const buffer = await readBatchFile(batch)
  const parsingConfig = (input.parsingConfig ?? batch.parsingConfig ?? undefined) as BankStatementParsingConfig | undefined

  let preview
  let mappingConfig: BankStatementMappingConfig | null = null

  if (isStructuredImportFormat(batch.importFormat)) {
    const native = parseStructuredStatementFile(buffer, batch.importFormat)
    preview = await buildNativeImportPreview({
      tenantId,
      legalEntityId: batch.legalEntityId,
      treasuryAccountId: batch.treasuryAccountId,
      lines: native.lines,
      header: native.header,
      issues: native.issues,
      statementReference: input.statementReference,
    })
  } else {
    const templateMapping = await loadTemplateMapping(tenantId, batch.legalEntityId, batch.mappingTemplateId)
    mappingConfig =
      mergeMappingConfig(templateMapping, input.mappingConfig ?? (batch.mappingConfig as BankStatementMappingConfig | null)) ??
      inferDefaultMapping([])

    const { sheet, formulaWarnings } = await parseStatementFile(buffer, batch.importFormat, parsingConfig, true)
    if (sheet.headers.length === 0 && mappingConfig) {
      const inspect = await inspectStatementFile(buffer, batch.importFormat, parsingConfig)
      const inferred = inferDefaultMapping(inspect.headers ?? [])
      Object.assign(mappingConfig, inferred)
    }

    preview = await buildImportPreview({
      tenantId,
      legalEntityId: batch.legalEntityId,
      treasuryAccountId: batch.treasuryAccountId,
      currencyCode: treasuryAccount.currencyCode,
      sheet,
      mapping: mappingConfig,
      formulaWarnings,
      statementReference: input.statementReference,
    })
  }

  if (preview.header && input.headerOverrides) {
    preview.header = applyHeaderOverrides(preview.header, {
      statementReference: input.headerOverrides.statementReference,
      openingBalance:
        input.headerOverrides.openingBalance != null ? String(input.headerOverrides.openingBalance) : undefined,
      closingBalance:
        input.headerOverrides.closingBalance != null ? String(input.headerOverrides.closingBalance) : undefined,
    })
  }

  await repo.updateImportBatch(
    tenantId,
    id,
    {
      mappingConfig: mappingConfig as never,
      parsingConfig: parsingConfig as never,
      warningCount: preview.warningRowCount,
      errorCount: preview.errorRowCount,
      totalLineCount: preview.totalRowCount,
    },
    input.expectedUpdatedAt,
  )

  await auditImportBatchAction(req, 'Preview', id, null, {
    validRowCount: preview.validRowCount,
    errorRowCount: preview.errorRowCount,
  })

  return { preview, mappingConfig, requiresColumnMapping: formatNeedsColumnMapping(batch.importFormat) }
}

export async function executeImport(
  req: Request,
  tenantId: string,
  id: string,
  input: ExecuteImportBatchInput,
) {
  const batch = await repo.getImportBatchOrThrow(tenantId, id)
  const actions = getImportBatchAllowedActions(batch.status)
  if (!actions.canImport && !actions.canRetry) throw new BankStatementImportBatchInvalidStateError()

  if (input.allowPartial && !input.confirmPartialImport) {
    throw new BankStatementImportStrictErrorsError(
      'Partial import requires allowPartial=true and confirmPartialImport=true',
    )
  }

  const treasuryAccount = await getTreasuryAccountOrThrow(tenantId, batch.legalEntityId, batch.treasuryAccountId)
  const duplicatePolicy = input.duplicatePolicy ?? batch.duplicatePolicy

  await repo.updateImportBatch(tenantId, id, { status: 'PROCESSING', processedAt: new Date() }, input.expectedUpdatedAt)
  await deleteBatchIssues(tenantId, id)

  const buffer = await readBatchFile(batch)
  const parsingConfig = (input.parsingConfig ?? batch.parsingConfig ?? undefined) as BankStatementParsingConfig | undefined

  let preview
  let mappingConfig: BankStatementMappingConfig | null = null

  if (isStructuredImportFormat(batch.importFormat)) {
    const native = parseStructuredStatementFile(buffer, batch.importFormat)
    preview = await buildNativeImportPreview({
      tenantId,
      legalEntityId: batch.legalEntityId,
      treasuryAccountId: batch.treasuryAccountId,
      lines: native.lines,
      header: native.header,
      issues: native.issues,
      statementReference: input.statementReference,
    })
  } else {
    const templateMapping = await loadTemplateMapping(tenantId, batch.legalEntityId, batch.mappingTemplateId)
    mappingConfig =
      mergeMappingConfig(templateMapping, input.mappingConfig ?? (batch.mappingConfig as BankStatementMappingConfig | null)) ??
      inferDefaultMapping([])

    const { sheet, formulaWarnings } = await parseStatementFile(buffer, batch.importFormat, parsingConfig, false)
    preview = await buildImportPreview({
      tenantId,
      legalEntityId: batch.legalEntityId,
      treasuryAccountId: batch.treasuryAccountId,
      currencyCode: treasuryAccount.currencyCode,
      sheet,
      mapping: mappingConfig,
      formulaWarnings,
      statementReference: input.statementReference,
    })
  }

  if (!input.allowPartial && !preview.canImportStrict) {
    await persistBatchIssues(tenantId, batch.legalEntityId, id, preview.issues)
    await repo.updateImportBatch(tenantId, id, {
      status: 'FAILED',
      completedAt: new Date(),
      warningCount: preview.warningRowCount,
      errorCount: preview.errorRowCount,
      failedLineCount: preview.errorRowCount,
      totalLineCount: preview.totalRowCount,
      errorSummary: { message: 'Strict import blocked by validation errors' } as never,
    })
    throw new BankStatementImportStrictErrorsError()
  }

  const importableRows = preview.rows.filter((r) => r.status === 'VALID' || r.status === 'WARNING')
  if (importableRows.length === 0) {
    await persistBatchIssues(tenantId, batch.legalEntityId, id, preview.issues)
    await repo.updateImportBatch(tenantId, id, {
      status: 'FAILED',
      completedAt: new Date(),
      totalLineCount: preview.totalRowCount,
      failedLineCount: preview.totalRowCount,
      errorCount: preview.errorRowCount,
    })
    throw new BankStatementImportStrictErrorsError('No importable rows found')
  }

  const header = preview.header!
  if (input.headerOverrides) {
    Object.assign(
      header,
      applyHeaderOverrides(header, {
        statementReference: input.headerOverrides.statementReference,
        openingBalance:
          input.headerOverrides.openingBalance != null ? String(input.headerOverrides.openingBalance) : undefined,
        closingBalance:
          input.headerOverrides.closingBalance != null ? String(input.headerOverrides.closingBalance) : undefined,
      }),
    )
  }

  const uniquenessKey = buildStatementUniquenessKey({
    tenantId,
    legalEntityId: batch.legalEntityId,
    treasuryAccountId: batch.treasuryAccountId,
    statementReference: header.statementReference,
    periodStartDate: header.periodStartDate,
    periodEndDate: header.periodEndDate,
  })

  await assertNoDuplicateStatement({
    tenantId,
    legalEntityId: batch.legalEntityId,
    treasuryAccountId: batch.treasuryAccountId,
    statementReference: header.statementReference,
    periodStartDate: header.periodStartDate,
    periodEndDate: header.periodEndDate,
    duplicatePolicy,
  })

  const statement = await repo.createStatement({
    tenantId,
    legalEntityId: batch.legalEntityId,
    treasuryAccountId: batch.treasuryAccountId,
    importBatchId: id,
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
    importFormat: batch.importFormat,
    sourceType: 'FILE_UPLOAD',
    createdBy: req.context?.userId ?? null,
  })

  let lineNumber = 0
  let importedLineCount = 0
  let duplicateLineCount = 0
  let failedLineCount = 0

  for (const row of importableRows) {
    const lineHash = buildStatementLineHash({
      treasuryAccountId: batch.treasuryAccountId,
      transactionDate: row.transactionDate,
      direction: row.direction,
      amount: row.amount,
      referenceNumber: row.referenceNumber,
      description: row.description,
      externalTransactionId: row.externalTransactionId,
    })

    const dup = await isDuplicateLine(tenantId, batch.legalEntityId, lineHash)
    if (dup.isDuplicate) {
      duplicateLineCount += 1
      preview.issues.push({
        rowNumber: row.sourceRowNumber,
        severity: 'WARNING',
        category: 'DUPLICATE_LINE',
        code: 'BANK_STATEMENT_DUPLICATE_LINE',
        message: 'Skipped duplicate line',
      })
      continue
    }

    lineNumber += 1
    await repo.createStatementLine({
      tenantId,
      legalEntityId: batch.legalEntityId,
      bankStatementId: statement.id,
      lineNumber,
      sourceRowNumber: row.sourceRowNumber,
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
      rawPayload: row.rawPayload as never,
    })
    importedLineCount += 1
  }

  failedLineCount = preview.errorRowCount

  await repo.updateStatement(tenantId, statement.id, {
    lineCount: importedLineCount,
    status: 'IMPORTED',
  })

  const counts = countIssueSeverities(preview.issues)
  const finalStatus =
    failedLineCount > 0 || (input.allowPartial && preview.errorRowCount > 0)
      ? 'PARTIALLY_IMPORTED'
      : 'IMPORTED'

  await persistBatchIssues(tenantId, batch.legalEntityId, id, preview.issues, statement.id)
  await repo.updateImportBatch(tenantId, id, {
    status: finalStatus,
    completedAt: new Date(),
    importedLineCount,
    duplicateLineCount,
    failedLineCount,
    totalLineCount: preview.totalRowCount,
    warningCount: counts.warningCount,
    errorCount: counts.errorCount,
    mappingConfig: mappingConfig as never,
    parsingConfig: parsingConfig as never,
  })

  await auditImportBatchAction(req, 'Import', id, null, {
    statementId: statement.id,
    importedLineCount,
    status: finalStatus,
  })

  return {
    batch: mapBatch((await readRepo.getImportBatchById(tenantId, id))!),
    statementId: statement.id,
  }
}

export async function retryImport(req: Request, tenantId: string, id: string, input: ExecuteImportBatchInput) {
  const batch = await repo.getImportBatchOrThrow(tenantId, id)
  const actions = getImportBatchAllowedActions(batch.status)
  if (!actions.canRetry) throw new BankStatementImportBatchInvalidStateError('Batch cannot be retried in current status')
  return executeImport(req, tenantId, id, input)
}

export async function cancelImportBatch(
  req: Request,
  tenantId: string,
  id: string,
  input: { expectedUpdatedAt: string; reason?: string },
) {
  const batch = await repo.getImportBatchOrThrow(tenantId, id)
  const actions = getImportBatchAllowedActions(batch.status)
  if (!actions.canCancel) throw new BankStatementImportBatchInvalidStateError('Only UPLOADED batches can be cancelled')

  const updated = await repo.updateImportBatch(
    tenantId,
    id,
    { status: 'CANCELLED', errorSummary: input.reason ? ({ reason: input.reason } as never) : undefined },
    input.expectedUpdatedAt,
  )
  await auditImportBatchAction(req, 'Cancel', id, { status: batch.status }, { status: 'CANCELLED' })
  return mapBatch({ ...(await readRepo.getImportBatchById(tenantId, id))!, ...updated })
}

export async function downloadBatchFile(tenantId: string, id: string) {
  const batch = await repo.getImportBatchOrThrow(tenantId, id)
  const actions = getImportBatchAllowedActions(batch.status)
  if (!actions.canDownloadFile) throw new BankStatementImportBatchInvalidStateError()
  const buffer = await readBatchFile(batch)
  return {
    buffer,
    fileName: batch.sanitisedFileName ?? batch.originalFileName ?? 'statement-file',
    mimeType: batch.mimeType ?? 'application/octet-stream',
  }
}
