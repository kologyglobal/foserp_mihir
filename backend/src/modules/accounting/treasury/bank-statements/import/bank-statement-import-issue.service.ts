import type { Prisma } from '@prisma/client'
import type { ImportIssueInput } from '../bank-statement.types.js'
import * as repo from '../bank-statement.repository.js'

export async function persistBatchIssues(
  tenantId: string,
  legalEntityId: string,
  importBatchId: string,
  issues: ImportIssueInput[],
  bankStatementId?: string | null,
) {
  await repo.createImportIssues(
    tenantId,
    legalEntityId,
    importBatchId,
    issues.map((issue) => {
      const { metadata, ...rest } = issue
      return {
        ...rest,
        bankStatementId: bankStatementId ?? null,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      }
    }),
  )
}

export function mergeIssues(...groups: ImportIssueInput[][]): ImportIssueInput[] {
  return groups.flat()
}
