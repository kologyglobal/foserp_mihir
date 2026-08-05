/**
 * Phase 3 — GSTR-2B import batches (immutable after import).
 * Never mutates row tax amounts; void + re-import to correct source data.
 */
import { createHash, randomUUID } from 'node:crypto'
import type { Gstr2bImportBatch, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { getLegalEntityOrThrow, parseDateOnly, toDateOnlyString } from '../shared/finance.helpers.js'
import {
  Gstr2bBatchImmutableError,
  Gstr2bBatchNotFoundError,
  Gstr2bBatchStateError,
} from './tax-compliance.errors.js'
import { normalizeGstin, normalizeInvoiceNumber } from './gstr2b-match.util.js'
import type {
  Gstr2bImportBatchInput,
  Gstr2bListBatchesQueryInput,
  Gstr2bListRowsQueryInput,
  Gstr2bVoidBatchInput,
} from './tax-compliance.schemas.js'

function num(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function checksumRows(rows: Gstr2bImportBatchInput['rows']): string {
  const canonical = JSON.stringify(
    rows.map((r) => ({
      gstin: normalizeGstin(r.supplierGstin),
      inv: r.invoiceNumber.trim(),
      dt: r.invoiceDate,
      tv: r.taxableValue,
      c: r.cgstAmount,
      s: r.sgstAmount,
      i: r.igstAmount,
      ce: r.cessAmount,
    })),
  )
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

function serializeBatch(b: Gstr2bImportBatch) {
  return {
    id: b.id,
    legalEntityId: b.legalEntityId,
    returnPeriod: b.returnPeriod,
    source: b.source,
    fileName: b.fileName,
    providerMode: b.providerMode,
    status: b.status,
    rowCount: b.rowCount,
    matchedCount: b.matchedCount,
    mismatchCount: b.mismatchCount,
    missingInBooks: b.missingInBooks,
    missingIn2b: b.missingIn2b,
    payloadChecksum: b.payloadChecksum,
    importNotes: b.importNotes,
    importedAt: b.importedAt.toISOString(),
    importedBy: b.importedBy,
    reconciledAt: b.reconciledAt?.toISOString() ?? null,
    reconciledBy: b.reconciledBy,
    voidedAt: b.voidedAt?.toISOString() ?? null,
    voidReason: b.voidReason,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }
}

function serializeRow(r: {
  id: string
  batchId: string
  lineNo: number
  supplierGstin: string
  supplierName: string | null
  invoiceNumber: string
  invoiceNumberNorm: string
  invoiceDate: Date
  taxableValue: Prisma.Decimal
  cgstAmount: Prisma.Decimal
  sgstAmount: Prisma.Decimal
  igstAmount: Prisma.Decimal
  cessAmount: Prisma.Decimal
  placeOfSupply: string | null
  documentTypeHint: string | null
  matchStatus: string
  matchScore: number
  matchedVendorInvoiceId: string | null
  matchNotes: string | null
  itcClaimClass: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: r.id,
    batchId: r.batchId,
    lineNo: r.lineNo,
    supplierGstin: r.supplierGstin,
    supplierName: r.supplierName,
    invoiceNumber: r.invoiceNumber,
    invoiceNumberNorm: r.invoiceNumberNorm,
    invoiceDate: toDateOnlyString(r.invoiceDate),
    taxableValue: formatForPersistence(r.taxableValue),
    cgstAmount: formatForPersistence(r.cgstAmount),
    sgstAmount: formatForPersistence(r.sgstAmount),
    igstAmount: formatForPersistence(r.igstAmount),
    cessAmount: formatForPersistence(r.cessAmount),
    placeOfSupply: r.placeOfSupply,
    documentTypeHint: r.documentTypeHint,
    matchStatus: r.matchStatus,
    matchScore: r.matchScore,
    matchedVendorInvoiceId: r.matchedVendorInvoiceId,
    matchNotes: r.matchNotes,
    itcClaimClass: r.itcClaimClass,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

/**
 * Create an immutable import batch from JSON rows. Amounts are frozen at import.
 */
export async function importGstr2bBatch(params: {
  tenantId: string
  userId: string
  input: Gstr2bImportBatchInput
}) {
  const { tenantId, userId, input } = params
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  const payloadChecksum = checksumRows(input.rows)
  const batchId = randomUUID()

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.gstr2bImportBatch.create({
      data: {
        id: batchId,
        tenantId,
        legalEntityId: input.legalEntityId,
        returnPeriod: input.returnPeriod,
        source: input.source ?? 'FILE',
        fileName: input.fileName?.trim() || null,
        providerMode: input.providerMode ?? 'SIMULATED',
        status: 'IMPORTED',
        rowCount: input.rows.length,
        payloadChecksum,
        importNotes: input.importNotes?.trim() || null,
        importedBy: userId,
      },
    })

    if (input.rows.length) {
      await tx.gstr2bImportRow.createMany({
        data: input.rows.map((row, idx) => ({
          id: randomUUID(),
          tenantId,
          batchId: batch.id,
          lineNo: idx + 1,
          supplierGstin: normalizeGstin(row.supplierGstin),
          supplierName: row.supplierName?.trim() || null,
          invoiceNumber: row.invoiceNumber.trim(),
          invoiceNumberNorm: normalizeInvoiceNumber(row.invoiceNumber),
          invoiceDate: parseDateOnly(row.invoiceDate),
          taxableValue: row.taxableValue,
          cgstAmount: row.cgstAmount,
          sgstAmount: row.sgstAmount,
          igstAmount: row.igstAmount,
          cessAmount: row.cessAmount,
          placeOfSupply: row.placeOfSupply?.trim() || null,
          documentTypeHint: row.documentTypeHint?.trim() || null,
          matchStatus: 'UNMATCHED',
          matchScore: 0,
          itcClaimClass: 'REVIEW_REQUIRED',
        })),
      })
    }

    return batch
  })

  return {
    batch: serializeBatch(result),
    disclaimer:
      'GSTR-2B batch imported offline. Not a GST portal download. No ITC is auto-claimed.',
  }
}

export async function listGstr2bBatches(params: {
  tenantId: string
  query: Gstr2bListBatchesQueryInput
}) {
  const { tenantId, query } = params
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const where: Prisma.Gstr2bImportBatchWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
  }
  if (query.returnPeriod) where.returnPeriod = query.returnPeriod
  if (query.status) where.status = query.status

  const [total, rows] = await Promise.all([
    prisma.gstr2bImportBatch.count({ where }),
    prisma.gstr2bImportBatch.findMany({
      where,
      orderBy: [{ importedAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])

  return { items: rows.map(serializeBatch), total, page: query.page, pageSize: query.pageSize }
}

export async function getGstr2bBatch(params: { tenantId: string; batchId: string }) {
  const batch = await prisma.gstr2bImportBatch.findFirst({
    where: { id: params.batchId, tenantId: params.tenantId },
  })
  if (!batch) throw new Gstr2bBatchNotFoundError()
  return serializeBatch(batch)
}

export async function listGstr2bRows(params: {
  tenantId: string
  batchId: string
  query: Gstr2bListRowsQueryInput
}) {
  const batch = await prisma.gstr2bImportBatch.findFirst({
    where: { id: params.batchId, tenantId: params.tenantId },
  })
  if (!batch) throw new Gstr2bBatchNotFoundError()

  const where: Prisma.Gstr2bImportRowWhereInput = {
    tenantId: params.tenantId,
    batchId: params.batchId,
  }
  if (params.query.matchStatus) where.matchStatus = params.query.matchStatus
  if (params.query.search) {
    const q = params.query.search
    where.OR = [
      { supplierGstin: { contains: q } },
      { supplierName: { contains: q } },
      { invoiceNumber: { contains: q } },
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.gstr2bImportRow.count({ where }),
    prisma.gstr2bImportRow.findMany({
      where,
      orderBy: [{ lineNo: 'asc' }],
      skip: (params.query.page - 1) * params.query.pageSize,
      take: params.query.pageSize,
    }),
  ])

  return {
    batchId: batch.id,
    status: batch.status,
    items: rows.map(serializeRow),
    total,
    page: params.query.page,
    pageSize: params.query.pageSize,
  }
}

/**
 * Void a batch (does not delete rows for audit). Re-import is required for corrections.
 * Never mutates frozen tax amounts on rows.
 */
export async function voidGstr2bBatch(params: {
  tenantId: string
  userId: string
  batchId: string
  input: Gstr2bVoidBatchInput
}) {
  const batch = await prisma.gstr2bImportBatch.findFirst({
    where: { id: params.batchId, tenantId: params.tenantId },
  })
  if (!batch) throw new Gstr2bBatchNotFoundError()
  if (batch.status === 'VOID') {
    throw new Gstr2bBatchStateError('Batch is already void')
  }
  if (batch.status === 'RECONCILING') {
    throw new Gstr2bBatchImmutableError('Cannot void a batch while reconciliation is running')
  }

  const updated = await prisma.gstr2bImportBatch.update({
    where: { id: batch.id },
    data: {
      status: 'VOID',
      voidedAt: new Date(),
      voidReason: params.input.reason.trim().slice(0, 500),
    },
  })

  return serializeBatch(updated)
}

/** Load batch for tenant or throw (shared by reconcile). */
export async function loadBatchOrThrow(tenantId: string, batchId: string) {
  const batch = await prisma.gstr2bImportBatch.findFirst({
    where: { id: batchId, tenantId },
  })
  if (!batch) throw new Gstr2bBatchNotFoundError()
  return batch
}

export async function assertBatchMutableForReconcile(tenantId: string, batchId: string) {
  const batch = await loadBatchOrThrow(tenantId, batchId)
  if (batch.status === 'VOID') {
    throw new Gstr2bBatchStateError('Cannot reconcile a voided batch — re-import instead')
  }
  return batch
}

/** Escape hatch only used by reconcile to update match metadata (not tax amounts). */
export { serializeBatch, serializeRow, num }
