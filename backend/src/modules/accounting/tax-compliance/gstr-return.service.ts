/**
 * Phase 5 — GSTR-1 / GSTR-3B period preparation states (DRAFT → LOCKED; mark filed externally).
 * Does **not** submit to the GST portal.
 */
import type { GstrReturnPeriodStatus, GstrReturnType, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AppError, InvalidStateError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import {
  canLockReturn,
  canMarkFiledExternal,
  canPrepareReturn,
  canUnlockReturn,
  isPeriodSourceImmutable,
  type ReturnPeriodStatus,
} from './gstr-registers.util.js'
import { getGstr1Preparation, getGstr3bPreparation } from './gst-registers.service.js'

function asStatus(s: GstrReturnPeriodStatus): ReturnPeriodStatus {
  return s as ReturnPeriodStatus
}

function mapPeriod(row: {
  id: string
  legalEntityId: string
  companyGstin: string
  returnPeriod: string
  returnType: GstrReturnType
  status: GstrReturnPeriodStatus
  preparedAt: Date | null
  preparedBy: string | null
  lockedAt: Date | null
  lockedBy: string | null
  unlockedAt: Date | null
  unlockedBy: string | null
  unlockReason: string | null
  markedFiledAt: Date | null
  markedFiledBy: string | null
  acknowledgmentRef: string | null
  filedOnPortalDate: Date | null
  remarks: string | null
  snapshotJson: Prisma.JsonValue | null
  draftVersion: number
  updatedAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    returnPeriod: row.returnPeriod,
    returnType: row.returnType === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B',
    status: row.status,
    preparedAt: row.preparedAt?.toISOString() ?? null,
    preparedBy: row.preparedBy,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockedBy: row.lockedBy,
    unlockedAt: row.unlockedAt?.toISOString() ?? null,
    unlockedBy: row.unlockedBy,
    unlockReason: row.unlockReason,
    markedFiledAt: row.markedFiledAt?.toISOString() ?? null,
    markedFiledBy: row.markedFiledBy,
    acknowledgmentRef: row.acknowledgmentRef,
    filedOnPortalDate: row.filedOnPortalDate?.toISOString().slice(0, 10) ?? null,
    remarks: row.remarks,
    snapshot: row.snapshotJson,
    draftVersion: row.draftVersion,
    sourceImmutable: isPeriodSourceImmutable(asStatus(row.status)),
    updatedAt: row.updatedAt.toISOString(),
    readinessLabel: 'GST_RETURNS_PREPARATION',
    disclaimer:
      'Return preparation workspace only. Mark Filed Externally updates FOS status after you file on the GST portal outside FOS. FOS does not file returns.',
  }
}

async function resolveCompanyGstin(
  tenantId: string,
  legalEntityId: string,
  companyGstin?: string | null,
): Promise<string> {
  const le = await getLegalEntityOrThrow(tenantId, legalEntityId)
  const g = (companyGstin ?? le.gstin ?? '').trim().toUpperCase()
  if (!g) {
    throw new AppError(422, 'Legal entity has no GSTIN — set GSTIN before GSTIN-specific returns', 'GSTIN_REQUIRED')
  }
  return g
}

export async function getOrCreateReturnPeriod(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  returnType: GstrReturnType
  companyGstin?: string | null
}) {
  const gstin = await resolveCompanyGstin(params.tenantId, params.legalEntityId, params.companyGstin)
  const existing = await prisma.gstrReturnPeriod.findFirst({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      companyGstin: gstin,
      returnPeriod: params.returnPeriod,
      returnType: params.returnType,
    },
  })
  if (existing) return existing

  return prisma.gstrReturnPeriod.create({
    data: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      companyGstin: gstin,
      returnPeriod: params.returnPeriod,
      returnType: params.returnType,
      status: 'OPEN',
    },
  })
}

export async function listReturnPeriods(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod?: string
  companyGstin?: string | null
}) {
  const gstin = params.companyGstin
    ? params.companyGstin.trim().toUpperCase()
    : (await getLegalEntityOrThrow(params.tenantId, params.legalEntityId)).gstin?.toUpperCase() ?? undefined

  const rows = await prisma.gstrReturnPeriod.findMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      ...(params.returnPeriod ? { returnPeriod: params.returnPeriod } : {}),
      ...(gstin ? { companyGstin: gstin } : {}),
    },
    orderBy: [{ returnPeriod: 'desc' }, { returnType: 'asc' }],
  })
  return rows.map(mapPeriod)
}

async function buildLivePrep(
  returnType: GstrReturnType,
  params: { tenantId: string; legalEntityId: string; returnPeriod: string; companyGstin: string },
) {
  if (returnType === 'GSTR1') {
    return getGstr1Preparation(params)
  }
  return getGstr3bPreparation(params)
}

export async function getReturnPrep(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  returnType: GstrReturnType
  companyGstin?: string | null
}) {
  const period = await getOrCreateReturnPeriod(params)
  const live = await buildLivePrep(params.returnType, {
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: period.companyGstin,
  })

  // Locked / filed: prefer frozen snapshot totals when present, still expose live read as `livePreview`.
  const mapped = mapPeriod(period)
  const useSnapshot =
    isPeriodSourceImmutable(asStatus(period.status)) && period.snapshotJson && typeof period.snapshotJson === 'object'

  return {
    period: mapped,
    preparation: useSnapshot
      ? {
          ...(period.snapshotJson as object),
          frozen: true,
          livePreview: live,
        }
      : { ...live, frozen: false },
  }
}

async function markLedgerIncludedInDraft(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin: string
}) {
  await prisma.gstLedgerEntry.updateMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      filingStatus: 'NOT_FILED',
      OR: [{ companyGstin: params.companyGstin }, { companyGstin: null }],
    },
    data: { filingStatus: 'INCLUDED_IN_DRAFT' },
  })
}

async function markLedgerFiled(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin: string
}) {
  await prisma.gstLedgerEntry.updateMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      filingStatus: { in: ['NOT_FILED', 'INCLUDED_IN_DRAFT'] },
      OR: [{ companyGstin: params.companyGstin }, { companyGstin: null }],
    },
    data: { filingStatus: 'FILED' },
  })
}

export async function prepareReturn(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  returnType: GstrReturnType
  companyGstin?: string | null
  actorUserId?: string | null
}) {
  const period = await getOrCreateReturnPeriod(params)
  if (!canPrepareReturn(asStatus(period.status))) {
    throw new InvalidStateError(
      `Cannot prepare ${params.returnType} in status ${period.status}. Unlock first if LOCKED; filed periods are immutable.`,
    )
  }

  const prep = await buildLivePrep(params.returnType, {
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: period.companyGstin,
  })

  await markLedgerIncludedInDraft({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: period.companyGstin,
  })

  const updated = await prisma.gstrReturnPeriod.update({
    where: { id: period.id },
    data: {
      status: 'DRAFT',
      preparedAt: new Date(),
      preparedBy: params.actorUserId ?? null,
      snapshotJson: prep as object,
      draftVersion: { increment: 1 },
    },
  })

  return getReturnPrep({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    returnType: params.returnType,
    companyGstin: updated.companyGstin,
  })
}

export async function lockReturn(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  returnType: GstrReturnType
  companyGstin?: string | null
  actorUserId?: string | null
}) {
  const period = await getOrCreateReturnPeriod(params)
  if (!canLockReturn(asStatus(period.status))) {
    throw new InvalidStateError(`Can only lock a DRAFT return (current: ${period.status}). Run prepare first.`)
  }

  const prep = await buildLivePrep(params.returnType, {
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: period.companyGstin,
  })

  await prisma.gstrReturnPeriod.update({
    where: { id: period.id },
    data: {
      status: 'LOCKED',
      lockedAt: new Date(),
      lockedBy: params.actorUserId ?? null,
      snapshotJson: prep as object,
    },
  })

  return getReturnPrep({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    returnType: params.returnType,
    companyGstin: period.companyGstin,
  })
}

export async function unlockReturn(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  returnType: GstrReturnType
  companyGstin?: string | null
  actorUserId?: string | null
  reason: string
}) {
  const period = await getOrCreateReturnPeriod(params)
  if (!canUnlockReturn(asStatus(period.status))) {
    throw new InvalidStateError(
      period.status === 'MARKED_FILED_EXTERNAL'
        ? 'Cannot unlock a period marked filed externally — source remains immutable.'
        : `Can only unlock a LOCKED return (current: ${period.status}).`,
    )
  }

  await prisma.gstrReturnPeriod.update({
    where: { id: period.id },
    data: {
      status: 'DRAFT',
      unlockedAt: new Date(),
      unlockedBy: params.actorUserId ?? null,
      unlockReason: params.reason,
      lockedAt: null,
      lockedBy: null,
    },
  })

  return getReturnPrep({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    returnType: params.returnType,
    companyGstin: period.companyGstin,
  })
}

export async function markFiledExternally(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  returnType: GstrReturnType
  companyGstin?: string | null
  actorUserId?: string | null
  acknowledgmentRef: string
  filedOnPortalDate: string
  remarks?: string | null
}) {
  const period = await getOrCreateReturnPeriod(params)
  if (!canMarkFiledExternal(asStatus(period.status))) {
    throw new InvalidStateError(
      period.status === 'MARKED_FILED_EXTERNAL'
        ? 'Return already marked filed externally.'
        : `Cannot mark filed from status ${period.status}. Prepare (and preferably lock) first.`,
    )
  }

  // Freeze latest prep if locking path skipped
  const prep =
    period.snapshotJson ??
    (await buildLivePrep(params.returnType, {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: period.companyGstin,
    }))

  await markLedgerFiled({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: period.companyGstin,
  })

  await prisma.gstrReturnPeriod.update({
    where: { id: period.id },
    data: {
      status: 'MARKED_FILED_EXTERNAL',
      markedFiledAt: new Date(),
      markedFiledBy: params.actorUserId ?? null,
      acknowledgmentRef: params.acknowledgmentRef.trim(),
      filedOnPortalDate: new Date(`${params.filedOnPortalDate}T00:00:00.000Z`),
      remarks: params.remarks?.trim() || null,
      snapshotJson: prep as object,
      lockedAt: period.lockedAt ?? new Date(),
      lockedBy: period.lockedBy ?? params.actorUserId ?? null,
    },
  })

  return getReturnPrep({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    returnType: params.returnType,
    companyGstin: period.companyGstin,
  })
}

/**
 * Block silent rewrite of ledger rows when the return period is LOCKED/FILED
 * for the document's return period + LE (any return type).
 */
export async function assertLedgerPeriodMutable(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
}): Promise<void> {
  const gstinFilter = params.companyGstin?.trim().toUpperCase()
  const locked = await prisma.gstrReturnPeriod.findFirst({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      status: { in: ['LOCKED', 'MARKED_FILED_EXTERNAL'] },
      ...(gstinFilter ? { companyGstin: gstinFilter } : {}),
    },
    select: { id: true, status: true, returnType: true },
  })
  if (locked) {
    throw new InvalidStateError(
      `GST ledger for period ${params.returnPeriod} is immutable (${locked.returnType} is ${locked.status}). Unlock draft before reposting, or use amended workflow (not yet available).`,
    )
  }

  const filedRows = await prisma.gstLedgerEntry.count({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      filingStatus: 'FILED',
    },
  })
  if (filedRows > 0) {
    throw new InvalidStateError(
      `GST ledger period ${params.returnPeriod} has FILED entries — source documents cannot be silently re-taxed.`,
    )
  }
}

export async function assertDocumentLedgerMutable(tx: Prisma.TransactionClient, params: {
  tenantId: string
  documentId: string
  documentType: 'SALES_INVOICE' | 'VENDOR_INVOICE' | 'CUSTOMER_CREDIT_NOTE' | 'VENDOR_ADJUSTMENT'
}): Promise<void> {
  const filed = await tx.gstLedgerEntry.findFirst({
    where: {
      tenantId: params.tenantId,
      documentId: params.documentId,
      documentType: params.documentType,
      filingStatus: 'FILED',
    },
    select: { id: true, returnPeriod: true },
  })
  if (filed) {
    throw new InvalidStateError(
      `Cannot rewrite GST ledger for document in period ${filed.returnPeriod} — filing status is FILED.`,
    )
  }
}
