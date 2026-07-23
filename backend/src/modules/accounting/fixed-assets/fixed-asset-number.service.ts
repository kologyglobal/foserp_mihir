import { prisma } from '../../../config/database.js'

export async function nextAssetNumber(tenantId: string, legalEntityId: string): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `FA-${year}-`
  const count = await prisma.fixedAsset.count({
    where: {
      tenantId,
      legalEntityId,
      assetNumber: { startsWith: prefix },
    },
  })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

export async function nextDepreciationRunNumber(
  tenantId: string,
  legalEntityId: string,
  periodKey: string,
): Promise<string> {
  const prefix = `FAD-${periodKey}-`
  const count = await prisma.fixedAssetDepreciationRun.count({
    where: {
      tenantId,
      legalEntityId,
      runNumber: { startsWith: prefix },
    },
  })
  return `${prefix}${String(count + 1).padStart(3, '0')}`
}

export function buildCapitalizeEventKey(assetId: string): string {
  return `FIXED_ASSET_CAPITALIZE:${assetId}:V1`
}

export function buildPartialDisposeEventKey(disposalId: string): string {
  return `FIXED_ASSET_PARTIAL_DISPOSE:${disposalId}:V1`
}

export async function nextTransferNumber(tenantId: string, legalEntityId: string): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `FAT-${year}-`
  const count = await prisma.fixedAssetTransfer.count({
    where: { tenantId, legalEntityId, transferNumber: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

export async function nextDisposalNumber(tenantId: string, legalEntityId: string): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `FADSP-${year}-`
  const count = await prisma.fixedAssetDisposal.count({
    where: { tenantId, legalEntityId, disposalNumber: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

/** Draft reference for a Phase FA2 disposal document — generated once at create time, kept for its lifetime. */
export async function nextDisposalDraftReference(tenantId: string, legalEntityId: string): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `FADSP-DRAFT-${year}-`
  const count = await prisma.fixedAssetDisposal.count({
    where: { tenantId, legalEntityId, draftReference: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

export function buildDepreciationEventKey(runId: string): string {
  return `FIXED_ASSET_DEPRECIATE:${runId}:V1`
}

export function buildRevalueEventKey(revaluationId: string): string {
  return `FIXED_ASSET_REVALUE:${revaluationId}:V1`
}

export function buildImpairEventKey(impairmentId: string): string {
  return `FIXED_ASSET_IMPAIR:${impairmentId}:V1`
}

export async function nextRevaluationNumber(tenantId: string, legalEntityId: string): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `FAR-${year}-`
  const count = await prisma.fixedAssetRevaluation.count({
    where: { tenantId, legalEntityId, revaluationNumber: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

export async function nextImpairmentNumber(tenantId: string, legalEntityId: string): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `FAI-${year}-`
  const count = await prisma.fixedAssetImpairment.count({
    where: { tenantId, legalEntityId, impairmentNumber: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

export async function nextMaintenanceNumber(tenantId: string, legalEntityId: string): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `FAM-${year}-`
  const count = await prisma.fixedAssetMaintenance.count({
    where: { tenantId, legalEntityId, maintenanceNumber: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}

export function parsePeriodKey(periodKey: string): { periodFrom: Date; periodTo: Date } {
  const [year, month] = periodKey.split('-').map(Number)
  const periodFrom = new Date(Date.UTC(year, month - 1, 1))
  const periodTo = new Date(Date.UTC(year, month, 0))
  return { periodFrom, periodTo }
}

export function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10)
}
