/**
 * Phase 4 — RCM register: create on posted VI, list, liability paid, ITC recognize.
 * Extends AP path only — no separate purchase tax engine.
 */
import type { GstRcmLifecycleStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AppError } from '../../../utils/errors.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { toReturnPeriod } from './gst-ledger.service.js'
import {
  canTransitionRcmStatus,
  isRcmItcClaimableEligibility,
  nextRcmStatus,
  rcmItcGateNote,
} from './rcm-lifecycle.util.js'

type Tx = Prisma.TransactionClient

function num(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function mapEntry(row: {
  id: string
  legalEntityId: string
  vendorInvoiceId: string
  returnPeriod: string
  documentNumber: string
  documentDate: Date
  vendorId: string
  vendorName: string
  vendorGstin: string | null
  placeOfSupply: string | null
  taxableValue: Prisma.Decimal
  cgstAmount: Prisma.Decimal
  sgstAmount: Prisma.Decimal
  igstAmount: Prisma.Decimal
  cessAmount: Prisma.Decimal
  totalTaxAmount: Prisma.Decimal
  recoverableTaxAmount: Prisma.Decimal
  itcEligibility: string | null
  status: GstRcmLifecycleStatus
  glInputTaxBookedAtPost: boolean
  liabilityPaidAt: Date | null
  liabilityPaidBy: string | null
  liabilityPaidDate: Date | null
  liabilityPaymentRef: string | null
  liabilityPaidNotes: string | null
  itcRecognizedAt: Date | null
  itcRecognizedBy: string | null
  itcClaimNotes: string | null
  accountingVoucherId: string | null
  postingEventId: string | null
  notes: string | null
}) {
  const gate = rcmItcGateNote({
    status: row.status,
    itcEligibility: row.itcEligibility,
    glInputTaxBookedAtPost: row.glInputTaxBookedAtPost,
  })
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    vendorInvoiceId: row.vendorInvoiceId,
    returnPeriod: row.returnPeriod,
    documentNumber: row.documentNumber,
    documentDate: row.documentDate.toISOString().slice(0, 10),
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    vendorGstin: row.vendorGstin,
    placeOfSupply: row.placeOfSupply,
    taxableValue: formatForPersistence(row.taxableValue),
    cgstAmount: formatForPersistence(row.cgstAmount),
    sgstAmount: formatForPersistence(row.sgstAmount),
    igstAmount: formatForPersistence(row.igstAmount),
    cessAmount: formatForPersistence(row.cessAmount),
    totalTaxAmount: formatForPersistence(row.totalTaxAmount),
    recoverableTaxAmount: formatForPersistence(row.recoverableTaxAmount),
    itcEligibility: row.itcEligibility,
    status: row.status,
    glInputTaxBookedAtPost: row.glInputTaxBookedAtPost,
    liabilityPaidAt: row.liabilityPaidAt?.toISOString() ?? null,
    liabilityPaidBy: row.liabilityPaidBy,
    liabilityPaidDate: row.liabilityPaidDate?.toISOString().slice(0, 10) ?? null,
    liabilityPaymentRef: row.liabilityPaymentRef,
    liabilityPaidNotes: row.liabilityPaidNotes,
    itcRecognizedAt: row.itcRecognizedAt?.toISOString() ?? null,
    itcRecognizedBy: row.itcRecognizedBy,
    itcClaimNotes: row.itcClaimNotes,
    accountingVoucherId: row.accountingVoucherId,
    postingEventId: row.postingEventId,
    notes: row.notes,
    itcGate: gate,
  }
}

/**
 * Upsert RCM register row after vendor invoice post (idempotent for replay).
 */
export async function recordRcmRegisterFromVendorInvoice(
  tx: Tx,
  params: {
    tenantId: string
    vendorInvoiceId: string
    accountingVoucherId: string
    postingEventId: string
    documentNumber: string
  },
): Promise<boolean> {
  const inv = await tx.vendorInvoice.findFirst({
    where: { id: params.vendorInvoiceId, tenantId: params.tenantId },
  })
  if (!inv || inv.status !== 'POSTED') return false
  if (inv.taxTreatment !== 'REVERSE_CHARGE') return false

  const documentDate = inv.postingDate ?? inv.documentDate
  const returnPeriod = toReturnPeriod(documentDate)
  const cgst = num(inv.inputCgstAmount)
  const sgst = num(inv.inputSgstAmount)
  const igst = num(inv.inputIgstAmount)
  const cess = num(inv.inputCessAmount)
  const totalTax = cgst + sgst + igst + cess
  if (totalTax <= 0) return false

  const recoverable = Math.max(0, totalTax - num(inv.nonRecoverableTaxAmount))
  const status: GstRcmLifecycleStatus =
    inv.itcEligibility === 'INELIGIBLE' ? 'ITC_NOT_CLAIMABLE' : 'LIABILITY_POSTED'

  await tx.gstRcmRegisterEntry.upsert({
    where: { vendorInvoiceId: inv.id },
    create: {
      tenantId: params.tenantId,
      legalEntityId: inv.legalEntityId,
      vendorInvoiceId: inv.id,
      returnPeriod,
      documentNumber: params.documentNumber || inv.vendorInvoiceNumber || inv.draftReference,
      documentDate,
      vendorId: inv.vendorId,
      vendorName: inv.vendorNameSnapshot,
      vendorGstin: inv.vendorGstinSnapshot,
      placeOfSupply: inv.placeOfSupplyStateCode,
      taxableValue: inv.taxableAmount,
      cgstAmount: inv.inputCgstAmount,
      sgstAmount: inv.inputSgstAmount,
      igstAmount: inv.inputIgstAmount,
      cessAmount: inv.inputCessAmount,
      totalTaxAmount: totalTax,
      recoverableTaxAmount: recoverable,
      itcEligibility: inv.itcEligibility,
      status,
      glInputTaxBookedAtPost: true,
      accountingVoucherId: params.accountingVoucherId,
      postingEventId: params.postingEventId,
    },
    update: {
      // Idempotent post replay — keep lifecycle if already advanced
      documentNumber: params.documentNumber || inv.vendorInvoiceNumber || inv.draftReference,
      accountingVoucherId: params.accountingVoucherId,
      postingEventId: params.postingEventId,
    },
  })
  return true
}

export async function listRcmRegister(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod?: string
  fromDate?: string
  toDate?: string
  status?: GstRcmLifecycleStatus
  page?: number
  pageSize?: number
}): Promise<{ items: ReturnType<typeof mapEntry>[]; total: number }> {
  const page = params.page ?? 1
  const pageSize = Math.min(params.pageSize ?? 50, 200)
  const where: Prisma.GstRcmRegisterEntryWhereInput = {
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
  }
  if (params.returnPeriod) where.returnPeriod = params.returnPeriod
  if (params.status) where.status = params.status
  if (params.fromDate || params.toDate) {
    where.documentDate = {}
    if (params.fromDate) where.documentDate.gte = new Date(`${params.fromDate}T00:00:00.000Z`)
    if (params.toDate) where.documentDate.lte = new Date(`${params.toDate}T23:59:59.999Z`)
  }

  const [total, rows] = await Promise.all([
    prisma.gstRcmRegisterEntry.count({ where }),
    prisma.gstRcmRegisterEntry.findMany({
      where,
      orderBy: [{ documentDate: 'desc' }, { documentNumber: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return { items: rows.map(mapEntry), total }
}

export async function markRcmLiabilityPaid(params: {
  tenantId: string
  id: string
  userId: string
  liabilityPaidDate: string
  liabilityPaymentRef?: string | null
  notes?: string | null
}) {
  const row = await prisma.gstRcmRegisterEntry.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!row) throw new AppError(404, 'RCM register entry not found', 'RCM_REGISTER_NOT_FOUND')
  if (!canTransitionRcmStatus(row.status, 'MARK_LIABILITY_PAID')) {
    throw new AppError(
      422,
      `Cannot mark liability paid from status ${row.status}`,
      'RCM_INVALID_TRANSITION',
    )
  }

  const updated = await prisma.gstRcmRegisterEntry.update({
    where: { id: row.id },
    data: {
      status: nextRcmStatus('MARK_LIABILITY_PAID'),
      liabilityPaidAt: new Date(),
      liabilityPaidBy: params.userId,
      liabilityPaidDate: new Date(`${params.liabilityPaidDate}T00:00:00.000Z`),
      liabilityPaymentRef: params.liabilityPaymentRef?.trim() || null,
      liabilityPaidNotes: params.notes?.trim() || null,
    },
  })
  return mapEntry(updated)
}

export async function recognizeRcmItc(params: {
  tenantId: string
  id: string
  userId: string
  notes?: string | null
}) {
  const row = await prisma.gstRcmRegisterEntry.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!row) throw new AppError(404, 'RCM register entry not found', 'RCM_REGISTER_NOT_FOUND')
  if (!canTransitionRcmStatus(row.status, 'RECOGNIZE_ITC')) {
    throw new AppError(
      422,
      `Cannot recognize ITC from status ${row.status} — confirm liability payment first`,
      'RCM_INVALID_TRANSITION',
    )
  }
  if (!isRcmItcClaimableEligibility(row.itcEligibility)) {
    throw new AppError(422, 'RCM ITC is not claimable for INELIGIBLE lines', 'RCM_ITC_INELIGIBLE')
  }

  const updated = await prisma.gstRcmRegisterEntry.update({
    where: { id: row.id },
    data: {
      status: nextRcmStatus('RECOGNIZE_ITC'),
      itcRecognizedAt: new Date(),
      itcRecognizedBy: params.userId,
      itcClaimNotes: params.notes?.trim() || null,
    },
  })
  return mapEntry(updated)
}

export async function markRcmItcNotClaimable(params: {
  tenantId: string
  id: string
  userId: string
  notes?: string | null
}) {
  const row = await prisma.gstRcmRegisterEntry.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
  })
  if (!row) throw new AppError(404, 'RCM register entry not found', 'RCM_REGISTER_NOT_FOUND')
  if (!canTransitionRcmStatus(row.status, 'MARK_NOT_CLAIMABLE')) {
    throw new AppError(
      422,
      `Cannot mark not claimable from status ${row.status}`,
      'RCM_INVALID_TRANSITION',
    )
  }

  const updated = await prisma.gstRcmRegisterEntry.update({
    where: { id: row.id },
    data: {
      status: nextRcmStatus('MARK_NOT_CLAIMABLE'),
      itcRecognizedBy: params.userId,
      itcClaimNotes: params.notes?.trim() || null,
    },
  })
  return mapEntry(updated)
}
