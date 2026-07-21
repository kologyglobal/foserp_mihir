import { createHash } from 'node:crypto'
import {
  BankStatementDuplicateFileError,
  BankStatementDuplicateStatementError,
} from '../treasury.errors.js'
import * as repo from './bank-statement.repository.js'
import { buildStatementUniquenessKey } from './bank-statement-identity.service.js'

export function computeFileChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function assertNoDuplicateFile(
  tenantId: string,
  legalEntityId: string,
  treasuryAccountId: string,
  fileChecksum: string,
  duplicatePolicy: 'BLOCK' | 'WARN' | 'ALLOW_WITH_REVIEW' = 'BLOCK',
): Promise<{ isDuplicate: boolean; existingBatchId?: string }> {
  const existing = await repo.findImportBatchByChecksum(tenantId, legalEntityId, treasuryAccountId, fileChecksum)
  if (!existing) return { isDuplicate: false }
  if (duplicatePolicy === 'BLOCK') {
    throw new BankStatementDuplicateFileError(
      `Duplicate file checksum matches import batch ${existing.batchReference}`,
    )
  }
  return { isDuplicate: true, existingBatchId: existing.id }
}

export async function assertNoDuplicateStatement(input: {
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  statementReference: string
  periodStartDate: Date
  periodEndDate: Date
  duplicatePolicy?: 'BLOCK' | 'WARN' | 'ALLOW_WITH_REVIEW'
}): Promise<{ isDuplicate: boolean; existingStatementId?: string }> {
  const key = buildStatementUniquenessKey(input)
  const existing = await repo.findStatementByUniquenessKey(input.tenantId, key)
  if (!existing || existing.status === 'CANCELLED') return { isDuplicate: false, existingStatementId: undefined }
  if ((input.duplicatePolicy ?? 'BLOCK') === 'BLOCK') {
    throw new BankStatementDuplicateStatementError(
      `Duplicate statement matches existing statement ${existing.statementReference}`,
    )
  }
  return { isDuplicate: true, existingStatementId: existing.id }
}

export async function isDuplicateLine(
  tenantId: string,
  legalEntityId: string,
  lineHash: string,
): Promise<{ isDuplicate: boolean; existingLineId?: string; existingStatementId?: string }> {
  const existing = await repo.findExistingLineHash(tenantId, legalEntityId, lineHash)
  if (!existing) return { isDuplicate: false }
  return {
    isDuplicate: true,
    existingLineId: existing.id,
    existingStatementId: existing.bankStatementId,
  }
}
