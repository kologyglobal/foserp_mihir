/**
 * Phase 3 — match GSTR-2B rows to POSTED VendorInvoices only.
 * Suggests ITC claim class; never auto-claims / never posts ITC.
 */
import { randomUUID } from 'node:crypto'
import type { Gstr2bMatchStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import {
  Gstr2bBatchNotFoundError,
  Gstr2bBatchStateError,
  Gstr2bFollowUpNotFoundError,
} from './tax-compliance.errors.js'
import {
  assertBatchMutableForReconcile,
  loadBatchOrThrow,
  num,
  serializeBatch,
  serializeRow,
} from './gstr2b-import.service.js'
import {
  pickBestBooksMatch,
  suggestItcClaimClass,
  taxTotal,
  type BooksCandidate,
} from './gstr2b-match.util.js'
import type {
  Gstr2bListFollowUpsQueryInput,
  Gstr2bUpdateFollowUpInput,
} from './tax-compliance.schemas.js'

const MISMATCH_STATUSES: Gstr2bMatchStatus[] = [
  'PARTIAL_MATCH',
  'VALUE_MISMATCH',
  'TAX_MISMATCH',
  'GSTIN_MISMATCH',
  'REVIEW_REQUIRED',
  'DUPLICATE',
]

function periodDateBounds(returnPeriod: string): { from: Date; to: Date } {
  const [ys, ms] = returnPeriod.split('-')
  const year = Number(ys)
  const month = Number(ms)
  // Window: start of previous month → end of next month (catch late books vs 2B lag)
  const from = new Date(Date.UTC(year, month - 2, 1))
  const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))
  return { from, to }
}

function reasonFromMatch(status: Gstr2bMatchStatus): string {
  switch (status) {
    case 'MISSING_IN_BOOKS':
      return 'MISSING_IN_BOOKS'
    case 'VALUE_MISMATCH':
      return 'VALUE_MISMATCH'
    case 'TAX_MISMATCH':
      return 'TAX_MISMATCH'
    case 'GSTIN_MISMATCH':
      return 'GSTIN_MISMATCH'
    case 'PARTIAL_MATCH':
      return 'PARTIAL_MATCH'
    case 'DUPLICATE':
      return 'DUPLICATE_2B'
    case 'REVIEW_REQUIRED':
      return 'MATCH_REVIEW_REQUIRED'
    default:
      return 'MATCH_EXCEPTION'
  }
}

/**
 * Reconcile all rows in a batch against posted vendor invoices.
 * Opens vendor follow-ups for mismatches / missing-in-books.
 */
export async function reconcileGstr2bBatch(params: {
  tenantId: string
  userId: string
  batchId: string
  openFollowUps?: boolean
}) {
  const openFollowUps = params.openFollowUps !== false
  const batch = await assertBatchMutableForReconcile(params.tenantId, params.batchId)

  await prisma.gstr2bImportBatch.update({
    where: { id: batch.id },
    data: { status: 'RECONCILING' },
  })

  try {
    const { from, to } = periodDateBounds(batch.returnPeriod)
    const rows = await prisma.gstr2bImportRow.findMany({
      where: { tenantId: params.tenantId, batchId: batch.id },
      orderBy: [{ lineNo: 'asc' }],
    })

    const postedVis = await prisma.vendorInvoice.findMany({
      where: {
        tenantId: params.tenantId,
        legalEntityId: batch.legalEntityId,
        status: 'POSTED',
        supplierInvoiceDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        vendorId: true,
        vendorGstinSnapshot: true,
        vendorNameSnapshot: true,
        supplierInvoiceNumber: true,
        supplierInvoiceDate: true,
        taxableAmount: true,
        inputCgstAmount: true,
        inputSgstAmount: true,
        inputIgstAmount: true,
        inputCessAmount: true,
        taxTreatment: true,
        itcEligibility: true,
      },
    })

    const candidates: BooksCandidate[] = postedVis.map((v) => ({
      id: v.id,
      vendorGstin: v.vendorGstinSnapshot,
      supplierInvoiceNumber: v.supplierInvoiceNumber,
      supplierInvoiceDate: v.supplierInvoiceDate,
      taxableAmount: num(v.taxableAmount),
      cgstAmount: num(v.inputCgstAmount),
      sgstAmount: num(v.inputSgstAmount),
      igstAmount: num(v.inputIgstAmount),
      cessAmount: num(v.inputCessAmount),
      isRcm: v.taxTreatment === 'REVERSE_CHARGE',
      itcEligibility: v.itcEligibility,
    }))

    const usedBookIds = new Set<string>()
    let matchedCount = 0
    let mismatchCount = 0
    let missingInBooks = 0

    // Close open follow-ups for this batch so re-reconcile is idempotent
    if (openFollowUps) {
      await prisma.gstr2bVendorFollowUp.updateMany({
        where: {
          tenantId: params.tenantId,
          batchId: batch.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        data: {
          status: 'WAIVED',
          notes: 'Superseded by re-reconcile',
          resolvedAt: new Date(),
          resolvedBy: params.userId,
        },
      })
    }

    const followUpCreates: Prisma.Gstr2bVendorFollowUpCreateManyInput[] = []

    for (const row of rows) {
      const available = candidates.filter((c) => !usedBookIds.has(c.id))
      const best = pickBestBooksMatch(
        {
          supplierGstin: row.supplierGstin,
          invoiceNumber: row.invoiceNumber,
          invoiceDate: row.invoiceDate,
          taxableValue: num(row.taxableValue),
          cgstAmount: num(row.cgstAmount),
          sgstAmount: num(row.sgstAmount),
          igstAmount: num(row.igstAmount),
          cessAmount: num(row.cessAmount),
        },
        available,
      )

      let matchStatus: Gstr2bMatchStatus = 'MISSING_IN_BOOKS'
      let matchScore = 0
      let matchedVendorInvoiceId: string | null = null
      let matchNotes = 'No posted vendor invoice candidate above match threshold'
      let booksItc: string | null = null
      let isRcm = false

      if (best) {
        matchStatus = best.result.status
        matchScore = best.result.score
        matchedVendorInvoiceId = best.books.id
        matchNotes = best.result.notes.join('; ') || null
        booksItc = best.books.itcEligibility ?? null
        isRcm = Boolean(best.books.isRcm)
        usedBookIds.add(best.books.id)
        // High score with residual UNMATCHED → treat as partial for counters
        if (matchStatus === 'UNMATCHED' && best.result.score >= 140) {
          matchStatus = 'PARTIAL_MATCH'
        }
        if (matchStatus === 'MATCHED') matchedCount += 1
        else if (MISMATCH_STATUSES.includes(matchStatus) || matchStatus === 'UNMATCHED') {
          mismatchCount += 1
        }
      } else {
        missingInBooks += 1
        matchStatus = 'MISSING_IN_BOOKS'
      }

      const itc = suggestItcClaimClass({
        matchStatus,
        booksItcEligibility: booksItc,
        isRcm,
        hasTaxInvoiceDetails: Boolean(row.supplierGstin && row.invoiceNumber && row.invoiceDate),
      })
      // autoClaimBlocked is always true — surface reasons in matchNotes
      if (itc.reasons.length) {
        matchNotes = [matchNotes, `ITC: ${itc.reasons.join('; ')}`].filter(Boolean).join(' | ')
      }

      await prisma.gstr2bImportRow.update({
        where: { id: row.id },
        data: {
          matchStatus,
          matchScore,
          matchedVendorInvoiceId,
          matchNotes: matchNotes?.slice(0, 1000) ?? null,
          itcClaimClass: itc.claimClass,
        },
      })

      if (
        openFollowUps &&
        (matchStatus === 'MISSING_IN_BOOKS' ||
          MISMATCH_STATUSES.includes(matchStatus) ||
          matchStatus === 'UNMATCHED')
      ) {
        const books = best ? postedVis.find((v) => v.id === best.books.id) : null
        followUpCreates.push({
          id: randomUUID(),
          tenantId: params.tenantId,
          legalEntityId: batch.legalEntityId,
          batchId: batch.id,
          rowId: row.id,
          vendorInvoiceId: matchedVendorInvoiceId,
          vendorId: books?.vendorId ?? null,
          vendorGstin: row.supplierGstin || books?.vendorGstinSnapshot || null,
          vendorName: row.supplierName || books?.vendorNameSnapshot || null,
          reasonCode: reasonFromMatch(matchStatus),
          status: 'OPEN',
          notes: matchNotes?.slice(0, 2000) ?? null,
        })
      }
    }

    const missingIn2b = postedVis.filter((v) => !usedBookIds.has(v.id)).length

    // Optional follow-ups for books-only (posted VI not found in 2B)
    if (openFollowUps) {
      for (const v of postedVis) {
        if (usedBookIds.has(v.id)) continue
        followUpCreates.push({
          id: randomUUID(),
          tenantId: params.tenantId,
          legalEntityId: batch.legalEntityId,
          batchId: batch.id,
          rowId: null,
          vendorInvoiceId: v.id,
          vendorId: v.vendorId,
          vendorGstin: v.vendorGstinSnapshot,
          vendorName: v.vendorNameSnapshot,
          reasonCode: 'MISSING_IN_2B',
          status: 'OPEN',
          notes: `Posted VI ${v.supplierInvoiceNumber} not matched to any GSTR-2B line in this batch`,
        })
      }

      if (followUpCreates.length) {
        await prisma.gstr2bVendorFollowUp.createMany({ data: followUpCreates })
      }
    }

    const updated = await prisma.gstr2bImportBatch.update({
      where: { id: batch.id },
      data: {
        status: 'RECONCILED',
        matchedCount,
        mismatchCount,
        missingInBooks,
        missingIn2b,
        reconciledAt: new Date(),
        reconciledBy: params.userId,
      },
    })

    return {
      batch: serializeBatch(updated),
      followUpsOpened: followUpCreates.length,
      autoClaimBlocked: true as const,
      disclaimer:
        'Reconciliation complete. ITC claim class is a suggestion only — no auto-claim / no GL ITC posting from this workbench.',
    }
  } catch (err) {
    // Best-effort restore status if reconcile crashed mid-way
    await prisma.gstr2bImportBatch
      .update({
        where: { id: batch.id },
        data: { status: batch.status === 'RECONCILED' ? 'RECONCILED' : 'IMPORTED' },
      })
      .catch(() => undefined)
    throw err
  }
}

export async function getGstr2bReconSummary(params: {
  tenantId: string
  batchId: string
}) {
  const batch = await loadBatchOrThrow(params.tenantId, params.batchId)
  const rows = await prisma.gstr2bImportRow.findMany({
    where: { tenantId: params.tenantId, batchId: batch.id },
  })

  const byStatus: Record<string, number> = {}
  const byClaim: Record<string, number> = {}
  let matchedTax = 0
  let mismatchTax = 0
  let gstr2bOnlyTax = 0
  let pendingReview = 0

  for (const r of rows) {
    byStatus[r.matchStatus] = (byStatus[r.matchStatus] ?? 0) + 1
    byClaim[r.itcClaimClass] = (byClaim[r.itcClaimClass] ?? 0) + 1
    const tax =
      num(r.cgstAmount) + num(r.sgstAmount) + num(r.igstAmount) + num(r.cessAmount)
    if (r.matchStatus === 'MATCHED') matchedTax += tax
    else if (
      r.matchStatus === 'MISSING_IN_BOOKS' ||
      r.matchStatus === 'UNMATCHED'
    ) {
      gstr2bOnlyTax += tax
    } else if (MISMATCH_STATUSES.includes(r.matchStatus)) {
      mismatchTax += tax
    }
    if (
      r.itcClaimClass === 'REVIEW_REQUIRED' ||
      r.matchStatus === 'REVIEW_REQUIRED' ||
      r.matchStatus === 'PARTIAL_MATCH'
    ) {
      pendingReview += 1
    }
  }

  const openFollowUps = await prisma.gstr2bVendorFollowUp.count({
    where: {
      tenantId: params.tenantId,
      batchId: batch.id,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
  })

  return {
    batch: serializeBatch(batch),
    byMatchStatus: byStatus,
    byItcClaimClass: byClaim,
    taxTotals: {
      matchedTax: formatForPersistence(matchedTax),
      mismatchTax: formatForPersistence(mismatchTax),
      gstr2bOnlyTax: formatForPersistence(gstr2bOnlyTax),
      booksOnlyEstimated: String(batch.missingIn2b),
    },
    pendingReviewCount: pendingReview,
    openFollowUpCount: openFollowUps,
    autoClaimBlocked: true as const,
  }
}

export async function listGstr2bFollowUps(params: {
  tenantId: string
  query: Gstr2bListFollowUpsQueryInput
}) {
  await getLegalEntityOrThrow(params.tenantId, params.query.legalEntityId)
  const where: Prisma.Gstr2bVendorFollowUpWhereInput = {
    tenantId: params.tenantId,
    legalEntityId: params.query.legalEntityId,
  }
  if (params.query.batchId) where.batchId = params.query.batchId
  if (params.query.status) where.status = params.query.status

  const [total, rows] = await Promise.all([
    prisma.gstr2bVendorFollowUp.count({ where }),
    prisma.gstr2bVendorFollowUp.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (params.query.page - 1) * params.query.pageSize,
      take: params.query.pageSize,
    }),
  ])

  return {
    items: rows.map((f) => ({
      id: f.id,
      legalEntityId: f.legalEntityId,
      batchId: f.batchId,
      rowId: f.rowId,
      vendorInvoiceId: f.vendorInvoiceId,
      vendorId: f.vendorId,
      vendorGstin: f.vendorGstin,
      vendorName: f.vendorName,
      reasonCode: f.reasonCode,
      status: f.status,
      notes: f.notes,
      assignedToUserId: f.assignedToUserId,
      resolvedAt: f.resolvedAt?.toISOString() ?? null,
      resolvedBy: f.resolvedBy,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
    total,
    page: params.query.page,
    pageSize: params.query.pageSize,
  }
}

export async function updateGstr2bFollowUp(params: {
  tenantId: string
  userId: string
  followUpId: string
  input: Gstr2bUpdateFollowUpInput
}) {
  const existing = await prisma.gstr2bVendorFollowUp.findFirst({
    where: { id: params.followUpId, tenantId: params.tenantId },
  })
  if (!existing) throw new Gstr2bFollowUpNotFoundError()

  const terminal = params.input.status === 'RESOLVED' || params.input.status === 'WAIVED'
  const updated = await prisma.gstr2bVendorFollowUp.update({
    where: { id: existing.id },
    data: {
      status: params.input.status ?? existing.status,
      notes: params.input.notes !== undefined ? params.input.notes?.trim().slice(0, 2000) ?? null : existing.notes,
      assignedToUserId:
        params.input.assignedToUserId !== undefined
          ? params.input.assignedToUserId
          : existing.assignedToUserId,
      resolvedAt: terminal ? new Date() : existing.resolvedAt,
      resolvedBy: terminal ? params.userId : existing.resolvedBy,
    },
  })

  return {
    id: updated.id,
    legalEntityId: updated.legalEntityId,
    batchId: updated.batchId,
    rowId: updated.rowId,
    vendorInvoiceId: updated.vendorInvoiceId,
    vendorId: updated.vendorId,
    vendorGstin: updated.vendorGstin,
    vendorName: updated.vendorName,
    reasonCode: updated.reasonCode,
    status: updated.status,
    notes: updated.notes,
    assignedToUserId: updated.assignedToUserId,
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    resolvedBy: updated.resolvedBy,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
}

/** Re-export for controller convenience */
export { loadBatchOrThrow, Gstr2bBatchNotFoundError, Gstr2bBatchStateError, taxTotal }
