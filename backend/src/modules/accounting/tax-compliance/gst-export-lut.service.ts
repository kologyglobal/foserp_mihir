/**
 * Phase 10 — LUT master, export validate, refund claim foundation (books only).
 */
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import { prisma } from '../../../config/prisma.js'
import { AuthorizationError, NotFoundError, AppError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../shared/finance.helpers.js'
import {
  assessLutRequirement,
  evaluateLutValidity,
  isExportOrSezDocument,
  partitionExportSezDocs,
  paymentModeFromTreatment,
  proposeIgstRefundFromExport,
  type LutLike,
} from './export-sez-lut.util.js'
import { loadLedgerRowsForPeriod } from './gst-registers.service.js'
import { resolveCompanyGstinScope } from './gst-registration-scope.util.js'
import { formatForPersistence } from '../shared/finance-decimal.js'

function hasPerm(req: Request, ...codes: string[]): boolean {
  const perms = req.context?.permissions ?? []
  if (perms.includes('tenant.manage')) return true
  return codes.some((c) => perms.includes(c))
}

function assertAny(req: Request, ...codes: string[]): void {
  if (!hasPerm(req, ...codes)) throw new AuthorizationError(`Missing permission: ${codes.join(' | ')}`)
}

function toDateStr(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

function asLutLike(row: {
  lutNumber: string
  companyGstin: string | null
  validFrom: Date
  validTo: Date | null
  isActive: boolean
  status: string
}): LutLike {
  return {
    lutNumber: row.lutNumber,
    companyGstin: row.companyGstin,
    validFrom: toDateStr(row.validFrom)!,
    validTo: toDateStr(row.validTo),
    isActive: row.isActive && row.status === 'ACTIVE',
    status: row.status,
  }
}

export async function listLuts(req: Request, tenantId: string, legalEntityId: string) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.setup.manage', 'tax.gst.export.view')
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  const items = await prisma.gstLut.findMany({
    where: { tenantId, legalEntityId },
    orderBy: [{ isActive: 'desc' }, { validFrom: 'desc' }],
  })
  return {
    legalEntityId,
    items: items.map((r) => ({
      id: r.id,
      lutNumber: r.lutNumber,
      companyGstin: r.companyGstin,
      financialYearLabel: r.financialYearLabel,
      validFrom: toDateStr(r.validFrom),
      validTo: toDateStr(r.validTo),
      status: r.status,
      isActive: r.isActive,
      notes: r.notes,
    })),
    note: 'Phase 10: books LUT master — not GST portal LUT bond filing.',
  }
}

export async function upsertLut(
  req: Request,
  tenantId: string,
  input: {
    id?: string | null
    legalEntityId: string
    companyGstin?: string | null
    lutNumber: string
    financialYearLabel?: string | null
    validFrom: string
    validTo?: string | null
    status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
    isActive?: boolean
    notes?: string | null
  },
) {
  assertAny(req, 'tax.gst.setup.manage', 'tax.gst.lut.manage')
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const lutNumber = input.lutNumber.trim()
  if (!lutNumber) throw new AppError(422, 'LUT number is required', 'LUT_NUMBER_REQUIRED')
  const validFrom = parseDateOnly(input.validFrom)
  const validTo = input.validTo ? parseDateOnly(input.validTo) : null
  if (validTo && validTo < validFrom) {
    throw new AppError(422, 'validTo must be on or after validFrom', 'LUT_DATE_RANGE')
  }
  const userId = req.context?.userId ?? null
  const status = input.status ?? 'ACTIVE'
  const isActive = input.isActive ?? status === 'ACTIVE'
  const companyGstin = input.companyGstin?.trim().toUpperCase() || null

  if (input.id) {
    const existing = await prisma.gstLut.findFirst({
      where: { id: input.id, tenantId, legalEntityId: input.legalEntityId },
    })
    if (!existing) throw new NotFoundError('LUT not found')
    const row = await prisma.gstLut.update({
      where: { id: existing.id },
      data: {
        companyGstin,
        lutNumber,
        financialYearLabel: input.financialYearLabel?.trim() || null,
        validFrom,
        validTo,
        status,
        isActive,
        notes: input.notes?.trim() || null,
        updatedBy: userId,
      },
    })
    return row
  }

  try {
    return await prisma.gstLut.create({
      data: {
        id: randomUUID(),
        tenantId,
        legalEntityId: input.legalEntityId,
        companyGstin,
        lutNumber,
        financialYearLabel: input.financialYearLabel?.trim() || null,
        validFrom,
        validTo,
        status,
        isActive,
        notes: input.notes?.trim() || null,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'P2002') {
      throw new AppError(409, 'LUT number already exists for this legal entity', 'LUT_DUPLICATE')
    }
    throw e
  }
}

/** Find best active LUT covering asOfDate for LE (+ optional GSTIN). */
export async function findCoveringLut(
  tenantId: string,
  legalEntityId: string,
  asOfDate: string,
  companyGstin?: string | null,
): Promise<LutLike | null> {
  const asOf = parseDateOnly(asOfDate)
  const candidates = await prisma.gstLut.findMany({
    where: {
      tenantId,
      legalEntityId,
      isActive: true,
      status: 'ACTIVE',
      validFrom: { lte: asOf },
      OR: [{ validTo: null }, { validTo: { gte: asOf } }],
    },
    orderBy: [{ validFrom: 'desc' }],
  })
  const want = companyGstin?.trim().toUpperCase() || null
  const ranked = want
    ? [
        ...candidates.filter((c) => (c.companyGstin ?? '').toUpperCase() === want),
        ...candidates.filter((c) => !c.companyGstin),
        ...candidates.filter(
          (c) => c.companyGstin && (c.companyGstin ?? '').toUpperCase() !== want,
        ),
      ]
    : candidates
  const best = ranked[0]
  return best ? asLutLike(best) : null
}

export async function validateExportSupply(
  req: Request,
  tenantId: string,
  input: {
    legalEntityId: string
    branchId?: string | null
    taxTreatment: string
    documentDate: string
    companyGstin?: string | null
    lutId?: string | null
    hardBlock?: boolean
  },
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.setup.manage', 'tax.gst.export.view')
  const le = await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  let companyGstin = input.companyGstin?.trim().toUpperCase() || null
  if (!companyGstin) {
    let branchGstin: string | null = null
    if (input.branchId) {
      const b = await prisma.branch.findFirst({
        where: { id: input.branchId, tenantId, legalEntityId: input.legalEntityId },
        select: { gstin: true, stateCode: true },
      })
      branchGstin = b?.gstin ?? null
    }
    const scope = resolveCompanyGstinScope({
      legalEntityId: le.id,
      legalEntityGstin: le.gstin,
      branchId: input.branchId,
      branchGstin,
    })
    companyGstin = 'ok' in scope ? null : scope.gstin
  }

  let lut: LutLike | null = null
  if (input.lutId) {
    const row = await prisma.gstLut.findFirst({
      where: { id: input.lutId, tenantId, legalEntityId: input.legalEntityId },
    })
    if (!row) throw new NotFoundError('LUT not found')
    lut = asLutLike(row)
  } else {
    lut = await findCoveringLut(tenantId, input.legalEntityId, input.documentDate, companyGstin)
  }

  const assessment = assessLutRequirement({
    taxTreatment: input.taxTreatment,
    lut,
    asOfDate: input.documentDate,
    companyGstin,
    hardBlock: input.hardBlock,
  })

  return {
    taxTreatment: input.taxTreatment,
    companyGstin,
    lut,
    lutValidity: lut
      ? evaluateLutValidity(lut, { asOfDate: input.documentDate, companyGstin })
      : { status: 'MISSING' as const, ok: false, message: 'No LUT on file' },
    ...assessment,
    readinessLabel: 'EXPORT_SEZ_BOOKS_READY',
    disclaimer:
      'Books classification only. Not GST portal export filing, not shipping bill e-Sanchit, not RFD refund submit.',
  }
}

export async function listExportSezRegister(
  req: Request,
  tenantId: string,
  params: { legalEntityId: string; returnPeriod: string; companyGstin?: string | null },
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.export.view')
  await getLegalEntityOrThrow(tenantId, params.legalEntityId)
  const rows = await loadLedgerRowsForPeriod({
    tenantId,
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: params.companyGstin,
  })
  const outward = rows.filter((r) => r.direction === 'OUTWARD')
  // Collapse-ish document keys for listing
  type Acc = {
    documentId: string
    documentNumber: string
    documentDate: string
    taxTreatment: string | null
    supplyType: string | null
    placeOfSupply: string | null
    zeroRatedMode: string | null
    partyGstin: string | null
    taxableValue: number
    totalTax: number
    _lines: Set<string>
  }
  const map = new Map<string, Acc>()
  for (const r of outward) {
    const meta = {
      taxTreatment: r.taxTreatment,
      supplyType: r.supplyType,
      placeOfSupply: r.placeOfSupply,
    }
    if (!isExportOrSezDocument(meta)) continue
    let acc = map.get(r.documentId)
    if (!acc) {
      acc = {
        documentId: r.documentId,
        documentNumber: r.documentNumber,
        documentDate: r.documentDate,
        taxTreatment: r.taxTreatment ?? null,
        supplyType: r.supplyType ?? null,
        placeOfSupply: r.placeOfSupply,
        zeroRatedMode: r.zeroRatedMode ?? paymentModeFromTreatment(r.taxTreatment),
        partyGstin: r.partyGstin,
        taxableValue: 0,
        totalTax: 0,
        _lines: new Set(),
      }
      map.set(r.documentId, acc)
    }
    const lk = r.documentLineId || `${r.taxableValue}`
    if (!acc._lines.has(lk)) {
      acc._lines.add(lk)
      acc.taxableValue += r.taxableValue
    }
    acc.totalTax += r.taxAmount
  }
  const docs = [...map.values()].map(({ _lines: _, ...rest }) => ({
    ...rest,
    taxableValue: Math.round((rest.taxableValue + Number.EPSILON) * 100) / 100,
    totalTax: Math.round((rest.totalTax + Number.EPSILON) * 100) / 100,
  }))
  const parts = partitionExportSezDocs(docs)
  return {
    legalEntityId: params.legalEntityId,
    returnPeriod: params.returnPeriod,
    companyGstin: params.companyGstin ?? null,
    items: docs,
    partition: {
      wpayCount: parts.wpay.length,
      wopayCount: parts.wopay.length,
      otherCount: parts.other.length,
    },
    source: 'GST_LEDGER',
    readinessLabel: 'EXPORT_SEZ_REGISTER_PREP',
    disclaimer:
      'Export/SEZ register from GST ledger snapshots. Zero-rated WOPAY lines require Phase 10 SI ledger zero-tax stamps. Not portal filing.',
  }
}

export async function listRefundClaims(
  req: Request,
  tenantId: string,
  legalEntityId: string,
  returnPeriod?: string,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.export.view')
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  const items = await prisma.gstExportRefundClaim.findMany({
    where: {
      tenantId,
      legalEntityId,
      ...(returnPeriod ? { returnPeriod } : {}),
    },
    orderBy: [{ returnPeriod: 'desc' }, { createdAt: 'desc' }],
  })
  return {
    legalEntityId,
    items: items.map((r) => ({
      id: r.id,
      returnPeriod: r.returnPeriod,
      claimType: r.claimType,
      status: r.status,
      taxableValue: formatForPersistence(r.taxableValue),
      igstAmount: formatForPersistence(r.igstAmount),
      currencyCode: r.currencyCode,
      externalArn: r.externalArn,
      notes: r.notes,
      companyGstin: r.companyGstin,
    })),
    note: 'Books refund foundation only — not RFD portal submit.',
  }
}

export async function proposeRefundClaim(
  req: Request,
  tenantId: string,
  input: { legalEntityId: string; returnPeriod: string; companyGstin?: string | null; notes?: string | null },
) {
  assertAny(req, 'tax.gst.setup.manage', 'tax.gst.lut.manage', 'tax.gst.returns.prepare')
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const rows = await loadLedgerRowsForPeriod({
    tenantId,
    legalEntityId: input.legalEntityId,
    returnPeriod: input.returnPeriod,
    companyGstin: input.companyGstin,
  })
  let exportWpayTaxable = 0
  let exportWpayIgst = 0
  const lineKeys = new Set<string>()
  for (const r of rows) {
    if (r.direction !== 'OUTWARD') continue
    if (paymentModeFromTreatment(r.taxTreatment) !== 'WPAY' && r.zeroRatedMode !== 'WPAY') continue
    const lk = `${r.documentId}:${r.documentLineId ?? ''}`
    if (!lineKeys.has(lk)) {
      lineKeys.add(lk)
      exportWpayTaxable += r.taxableValue
    }
    if (r.taxType.includes('IGST')) exportWpayIgst += r.taxAmount
  }
  const proposal = proposeIgstRefundFromExport({
    returnPeriod: input.returnPeriod,
    exportWpayTaxable,
    exportWpayIgst,
  })
  if (!proposal) {
    throw new AppError(422, 'No export WPAY IGST amounts found for period', 'EXPORT_REFUND_EMPTY')
  }
  const userId = req.context?.userId ?? null
  const row = await prisma.gstExportRefundClaim.create({
    data: {
      id: randomUUID(),
      tenantId,
      legalEntityId: input.legalEntityId,
      companyGstin: input.companyGstin?.trim().toUpperCase() || null,
      returnPeriod: input.returnPeriod,
      claimType: 'IGST_REFUND',
      status: 'DRAFT',
      taxableValue: proposal.taxableValue,
      igstAmount: proposal.igstAmount,
      notes: input.notes?.trim() || null,
      snapshotJson: { source: 'GST_LEDGER', lineCount: lineKeys.size },
      createdBy: userId,
      updatedBy: userId,
    },
  })
  return {
    id: row.id,
    returnPeriod: row.returnPeriod,
    taxableValue: formatForPersistence(row.taxableValue),
    igstAmount: formatForPersistence(row.igstAmount),
    status: row.status,
    disclaimer: 'Draft books claim — record external ARN only after portal RFD; no portal submit from FOS.',
  }
}

export async function markRefundClaimSubmitted(
  req: Request,
  tenantId: string,
  id: string,
  input: { externalArn?: string | null; notes?: string | null },
) {
  assertAny(req, 'tax.gst.setup.manage', 'tax.gst.lut.manage', 'tax.gst.returns.mark_filed')
  const row = await prisma.gstExportRefundClaim.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('Refund claim not found')
  if (row.status === 'VOID') throw new AppError(422, 'Claim is void', 'EXPORT_REFUND_VOID')
  const updated = await prisma.gstExportRefundClaim.update({
    where: { id: row.id },
    data: {
      status: 'SUBMITTED_EXTERNAL',
      externalArn: input.externalArn?.trim() || row.externalArn,
      notes: input.notes?.trim() || row.notes,
      updatedBy: req.context?.userId ?? null,
    },
  })
  return updated
}

/**
 * Used by SI post validation — resolve covering LUT (tenant-scoped).
 */
export async function resolveLutForSalesInvoice(params: {
  tenantId: string
  legalEntityId: string
  taxTreatment: string
  invoiceDate: Date | string
  companyGstin?: string | null
  lutId?: string | null
}): Promise<{ lut: LutLike | null; assessment: ReturnType<typeof assessLutRequirement> }> {
  const asOf =
    typeof params.invoiceDate === 'string'
      ? params.invoiceDate.slice(0, 10)
      : params.invoiceDate.toISOString().slice(0, 10)
  let lut: LutLike | null = null
  if (params.lutId) {
    const row = await prisma.gstLut.findFirst({
      where: { id: params.lutId, tenantId: params.tenantId, legalEntityId: params.legalEntityId },
    })
    lut = row ? asLutLike(row) : null
  } else {
    lut = await findCoveringLut(params.tenantId, params.legalEntityId, asOf, params.companyGstin)
  }
  const assessment = assessLutRequirement({
    taxTreatment: params.taxTreatment,
    lut,
    asOfDate: asOf,
    companyGstin: params.companyGstin,
    hardBlock: process.env.GST_EXPORT_LUT_HARD_BLOCK === 'true',
  })
  return { lut, assessment }
}
