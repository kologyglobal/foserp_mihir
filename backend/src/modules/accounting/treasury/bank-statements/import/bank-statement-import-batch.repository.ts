import { prisma } from '../../../../../config/database.js'

export async function nextBatchReference(tenantId: string, legalEntityId: string): Promise<string> {
  const count = await prisma.bankStatementImportBatch.count({ where: { tenantId, legalEntityId } })
  const seq = String(count + 1).padStart(6, '0')
  return `BSB-${Date.now().toString(36).toUpperCase()}-${seq}`
}

export async function deleteBatchIssues(tenantId: string, importBatchId: string) {
  await prisma.bankStatementImportIssue.deleteMany({ where: { tenantId, importBatchId } })
}
