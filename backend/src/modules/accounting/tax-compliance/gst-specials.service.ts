/**
 * Phase 11 — GST special schemes / specials service (books-side).
 * Feature-flag: GST_PHASE11_SPECIALS_ENABLED (default true).
 */
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import type { GstAdvanceStatus, GstWithholdingKind, GstWithholdingStatus } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AuthorizationError, NotFoundError, AppError } from '../../../utils/errors.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { getLegalEntityOrThrow, parseDateOnly, toDateOnlyString } from '../shared/finance.helpers.js'
import { toReturnPeriod } from './gst-ledger.service.js'
import {
  allocateAdvanceAgainstInvoice,
  buildPhase11CapabilityMatrix,
  classifyGstSupply,
  computeGstTdsLiability,
  evaluateJobWorkGstTreatment,
  isNilExemptOrNonGstClass,
  isPhase11SpecialsEnabled,
  type JobWorkMovement,
} from './gst-specials.util.js'
import type {
  GstAdvanceAdjustInput,
  GstAdvanceCreateInput,
  GstAdvanceListQueryInput,
  GstClassifyBodyInput,
  GstJobWorkEvalBodyInput,
  GstSpecialsNilRegisterQueryInput,
  GstWithholdingCreateInput,
  GstWithholdingListQueryInput,
  GstWithholdingMarkPaidInput,
  GstWithholdingVoidInput,
} from './tax-compliance.schemas.js'

function hasPerm(req: Request, ...codes: string[]): boolean {
  const perms = req.context?.permissions ?? []
  if (perms.includes('tenant.manage')) return true
  return codes.some((c) => perms.includes(c))
}

function assertAny(req: Request, ...codes: string[]): void {
  if (!hasPerm(req, ...codes)) throw new AuthorizationError(`Missing permission: ${codes.join(' | ')}`)
}

function assertFeatureOn(): void {
  if (!isPhase11SpecialsEnabled()) {
    throw new AppError(503, 'GST Phase 11 specials are disabled (GST_PHASE11_SPECIALS_ENABLED=false)', 'GST_PHASE11_DISABLED')
  }
}

function money(v: { toString(): string } | string | number): string {
  return formatForPersistence(v.toString(), 4)
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function getCapabilityMatrix(req: Request) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view')
  return {
    ...buildPhase11CapabilityMatrix(),
    featureEnabled: isPhase11SpecialsEnabled(),
  }
}

export async function getCompositionGates(req: Request, tenantId: string, legalEntityId: string) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view', 'tax.gst.setup.manage')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, legalEntityId)

  const regs = await prisma.gstRegistration.findMany({
    where: { tenantId, legalEntityId, isActive: true },
    select: {
      id: true,
      gstin: true,
      registrationType: true,
      branchId: true,
      isPrimary: true,
    },
  })

  const compositionRegs = regs.filter((r) => (r.registrationType ?? '').toUpperCase().includes('COMPOSITION') || (r.registrationType ?? '').toUpperCase() === 'COMPOSITE')
  return {
    legalEntityId,
    registrations: regs,
    compositionCount: compositionRegs.length,
    eInvoiceBlockedFor: compositionRegs.map((r) => r.gstin),
    note: 'Composition registrationType blocks e-invoice IRN generation (Phase 11). LUT/export remains Phase 10.',
  }
}

export function classifySupplyBody(req: Request, body: GstClassifyBodyInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view')
  assertFeatureOn()
  return classifyGstSupply(body)
}

export function evaluateJobWorkBody(req: Request, body: GstJobWorkEvalBodyInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view')
  assertFeatureOn()
  return evaluateJobWorkGstTreatment({
    movement: body.movement as JobWorkMovement,
    processCharges: body.processCharges,
    materialsTaxableValue: body.materialsTaxableValue,
  })
}

/** Nil / exempt / non-GST / zero-rated ledger visibility register. */
export async function listNilExemptRegister(
  req: Request,
  tenantId: string,
  query: GstSpecialsNilRegisterQueryInput,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const where = {
    tenantId,
    legalEntityId: query.legalEntityId,
    returnPeriod: query.returnPeriod,
    ...(query.companyGstin ? { companyGstin: query.companyGstin } : {}),
    OR: [
      { supplyClass: { in: ['NIL_RATED', 'EXEMPT', 'NON_GST', 'ZERO_RATED', 'COMPOSITION'] } },
      {
        AND: [
          { taxAmount: 0 },
          { taxableValue: { gt: 0 } },
        ],
      },
    ],
  }

  const [total, rows] = await Promise.all([
    prisma.gstLedgerEntry.count({ where }),
    prisma.gstLedgerEntry.findMany({
      where,
      orderBy: [{ documentDate: 'asc' }, { documentNumber: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])

  const items = rows.map((r) => {
    const cls = (r.supplyClass as string | null) ?? 'NIL_RATED'
    return {
      id: r.id,
      documentId: r.documentId,
      documentNumber: r.documentNumber,
      documentDate: toDateOnlyString(r.documentDate),
      documentType: r.documentType,
      direction: r.direction,
      partyGstin: r.partyGstin,
      companyGstin: r.companyGstin,
      placeOfSupply: r.placeOfSupply,
      hsnSacCode: r.hsnSacCode,
      supplyClass: cls,
      isSpecialNilExempt: isNilExemptOrNonGstClass(cls as never) || cls === 'COMPOSITION',
      taxableValue: money(r.taxableValue),
      taxAmount: money(r.taxAmount),
      taxRate: money(r.taxRate),
      taxType: r.taxType,
    }
  })

  return { items, total, page: query.page, pageSize: query.pageSize }
}

function serializeWithholding(row: {
  id: string
  legalEntityId: string
  companyGstin: string | null
  kind: GstWithholdingKind
  status: GstWithholdingStatus
  returnPeriod: string
  documentDate: Date
  partyName: string
  partyGstin: string | null
  partyId: string | null
  sourceDocumentType: string | null
  sourceDocumentId: string | null
  sourceDocumentNumber: string | null
  taxableValue: { toString(): string }
  ratePct: { toString(): string }
  tdsCgst: { toString(): string }
  tdsSgst: { toString(): string }
  tdsIgst: { toString(): string }
  totalWithheld: { toString(): string }
  isInterstate: boolean
  paymentRef: string | null
  paidAt: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    kind: row.kind,
    status: row.status,
    returnPeriod: row.returnPeriod,
    documentDate: toDateOnlyString(row.documentDate),
    partyName: row.partyName,
    partyGstin: row.partyGstin,
    partyId: row.partyId,
    sourceDocumentType: row.sourceDocumentType,
    sourceDocumentId: row.sourceDocumentId,
    sourceDocumentNumber: row.sourceDocumentNumber,
    taxableValue: money(row.taxableValue),
    ratePct: money(row.ratePct),
    tdsCgst: money(row.tdsCgst),
    tdsSgst: money(row.tdsSgst),
    tdsIgst: money(row.tdsIgst),
    totalWithheld: money(row.totalWithheld),
    isInterstate: row.isInterstate,
    paymentRef: row.paymentRef,
    paidAt: row.paidAt?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listWithholding(
  req: Request,
  tenantId: string,
  query: GstWithholdingListQueryInput,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const where = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.returnPeriod ? { returnPeriod: query.returnPeriod } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.gstWithholdingEntry.count({ where }),
    prisma.gstWithholdingEntry.findMany({
      where,
      orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])

  return {
    items: rows.map(serializeWithholding),
    total,
    page: query.page,
    pageSize: query.pageSize,
    note: 'GST TDS/TCS books register only — not GSTR-7/8 portal filing; not Income-tax TDS.',
  }
}

export async function createWithholding(req: Request, tenantId: string, body: GstWithholdingCreateInput) {
  assertAny(req, 'tax.gst.specials.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  await getLegalEntityOrThrow(tenantId, body.legalEntityId)

  const computed = computeGstTdsLiability({
    kind: body.kind,
    taxableValue: body.taxableValue,
    isInterstate: body.isInterstate,
    ratePct: body.ratePct,
  })
  const documentDate = parseDateOnly(body.documentDate)
  const returnPeriod = body.returnPeriod ?? toReturnPeriod(documentDate)

  const row = await prisma.gstWithholdingEntry.create({
    data: {
      id: randomUUID(),
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: body.companyGstin ?? null,
      kind: body.kind,
      status: 'OPEN',
      returnPeriod,
      documentDate,
      partyName: body.partyName,
      partyGstin: body.partyGstin ?? null,
      partyId: body.partyId ?? null,
      sourceDocumentType: body.sourceDocumentType ?? null,
      sourceDocumentId: body.sourceDocumentId ?? null,
      sourceDocumentNumber: body.sourceDocumentNumber ?? null,
      taxableValue: computed.taxableValue,
      ratePct: computed.ratePct,
      tdsCgst: computed.tdsCgst,
      tdsSgst: computed.tdsSgst,
      tdsIgst: computed.tdsIgst,
      totalWithheld: computed.totalWithheld,
      isInterstate: body.isInterstate,
      notes: body.notes ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
  })
  return serializeWithholding(row)
}

export async function markWithholdingPaid(
  req: Request,
  tenantId: string,
  id: string,
  body: GstWithholdingMarkPaidInput,
) {
  assertAny(req, 'tax.gst.specials.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const row = await prisma.gstWithholdingEntry.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GST withholding entry not found')
  if (row.status === 'VOID') throw new AppError(422, 'Cannot mark paid a voided entry', 'GST_WH_VOID')
  if (row.status === 'PAID') return serializeWithholding(row)

  const updated = await prisma.gstWithholdingEntry.update({
    where: { id: row.id },
    data: {
      status: 'PAID',
      paymentRef: body.paymentRef ?? row.paymentRef,
      paidAt: new Date(),
      paidBy: userId,
      notes: body.notes ?? row.notes,
      updatedBy: userId,
    },
  })
  return serializeWithholding(updated)
}

export async function voidWithholding(
  req: Request,
  tenantId: string,
  id: string,
  body: GstWithholdingVoidInput,
) {
  assertAny(req, 'tax.gst.specials.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const row = await prisma.gstWithholdingEntry.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('GST withholding entry not found')
  if (row.status === 'VOID') return serializeWithholding(row)

  const updated = await prisma.gstWithholdingEntry.update({
    where: { id: row.id },
    data: {
      status: 'VOID',
      voidedAt: new Date(),
      voidedBy: userId,
      voidReason: body.reason,
      updatedBy: userId,
    },
  })
  return serializeWithholding(updated)
}

function serializeAdvance(row: {
  id: string
  legalEntityId: string
  companyGstin: string | null
  status: GstAdvanceStatus
  returnPeriod: string
  advanceDate: Date
  customerName: string
  customerGstin: string | null
  customerId: string | null
  receiptDocumentType: string | null
  receiptDocumentId: string | null
  receiptDocumentNumber: string | null
  advanceTaxable: { toString(): string }
  advanceTax: { toString(): string }
  adjustedTaxable: { toString(): string }
  adjustedTax: { toString(): string }
  placeOfSupply: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  adjustments?: Array<{
    id: string
    salesInvoiceId: string | null
    invoiceNumber: string | null
    invoiceDate: Date | null
    adjustedTaxable: { toString(): string }
    adjustedTax: { toString(): string }
    notes: string | null
    createdAt: Date
  }>
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    companyGstin: row.companyGstin,
    status: row.status,
    returnPeriod: row.returnPeriod,
    advanceDate: toDateOnlyString(row.advanceDate),
    customerName: row.customerName,
    customerGstin: row.customerGstin,
    customerId: row.customerId,
    receiptDocumentType: row.receiptDocumentType,
    receiptDocumentId: row.receiptDocumentId,
    receiptDocumentNumber: row.receiptDocumentNumber,
    advanceTaxable: money(row.advanceTaxable),
    advanceTax: money(row.advanceTax),
    adjustedTaxable: money(row.adjustedTaxable),
    adjustedTax: money(row.adjustedTax),
    remainingTaxable: money(num(row.advanceTaxable) - num(row.adjustedTaxable)),
    remainingTax: money(num(row.advanceTax) - num(row.adjustedTax)),
    placeOfSupply: row.placeOfSupply,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    adjustments: (row.adjustments ?? []).map((a) => ({
      id: a.id,
      salesInvoiceId: a.salesInvoiceId,
      invoiceNumber: a.invoiceNumber,
      invoiceDate: a.invoiceDate ? toDateOnlyString(a.invoiceDate) : null,
      adjustedTaxable: money(a.adjustedTaxable),
      adjustedTax: money(a.adjustedTax),
      notes: a.notes,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

export async function listAdvances(req: Request, tenantId: string, query: GstAdvanceListQueryInput) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.specials.view')
  assertFeatureOn()
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const where = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.returnPeriod ? { returnPeriod: query.returnPeriod } : {}),
    ...(query.status ? { status: query.status } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.gstAdvanceEntry.count({ where }),
    prisma.gstAdvanceEntry.findMany({
      where,
      include: { adjustments: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ advanceDate: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])

  return {
    items: rows.map(serializeAdvance),
    total,
    page: query.page,
    pageSize: query.pageSize,
    note: 'Advance register is books-side prep — not full GSTR-1 Table 11 engine.',
  }
}

export async function createAdvance(req: Request, tenantId: string, body: GstAdvanceCreateInput) {
  assertAny(req, 'tax.gst.specials.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  await getLegalEntityOrThrow(tenantId, body.legalEntityId)

  const advanceDate = parseDateOnly(body.advanceDate)
  const returnPeriod = body.returnPeriod ?? toReturnPeriod(advanceDate)

  const row = await prisma.gstAdvanceEntry.create({
    data: {
      id: randomUUID(),
      tenantId,
      legalEntityId: body.legalEntityId,
      companyGstin: body.companyGstin ?? null,
      status: 'RECEIVED',
      returnPeriod,
      advanceDate,
      customerName: body.customerName,
      customerGstin: body.customerGstin ?? null,
      customerId: body.customerId ?? null,
      receiptDocumentType: body.receiptDocumentType ?? null,
      receiptDocumentId: body.receiptDocumentId ?? null,
      receiptDocumentNumber: body.receiptDocumentNumber ?? null,
      advanceTaxable: body.advanceTaxable,
      advanceTax: body.advanceTax,
      adjustedTaxable: 0,
      adjustedTax: 0,
      placeOfSupply: body.placeOfSupply ?? null,
      notes: body.notes ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
    include: { adjustments: true },
  })
  return serializeAdvance(row)
}

export async function adjustAdvance(req: Request, tenantId: string, id: string, body: GstAdvanceAdjustInput) {
  assertAny(req, 'tax.gst.specials.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const row = await prisma.gstAdvanceEntry.findFirst({
    where: { id, tenantId },
    include: { adjustments: true },
  })
  if (!row) throw new NotFoundError('GST advance entry not found')
  if (row.status === 'VOID' || row.status === 'CLOSED') {
    throw new AppError(422, `Cannot adjust advance in status ${row.status}`, 'GST_ADVANCE_STATE')
  }

  const alloc = allocateAdvanceAgainstInvoice({
    advanceTaxable: num(row.advanceTaxable),
    advanceTax: num(row.advanceTax),
    invoiceTaxable: body.invoiceTaxable,
    invoiceTax: body.invoiceTax,
    alreadyAdjustedTaxable: num(row.adjustedTaxable),
    alreadyAdjustedTax: num(row.adjustedTax),
  })

  if (alloc.adjustableTaxable <= 0 && alloc.adjustableTax <= 0) {
    throw new AppError(422, alloc.warnings[0] ?? 'Nothing to adjust against this invoice', 'GST_ADVANCE_NO_ALLOC')
  }

  const newAdjTaxable = num(row.adjustedTaxable) + alloc.adjustableTaxable
  const newAdjTax = num(row.adjustedTax) + alloc.adjustableTax
  let status: GstAdvanceStatus = 'PARTIALLY_ADJUSTED'
  if (alloc.fullyAdjusted) status = 'ADJUSTED'

  const updated = await prisma.$transaction(async (tx) => {
    await tx.gstAdvanceAdjustment.create({
      data: {
        id: randomUUID(),
        tenantId,
        advanceEntryId: row.id,
        salesInvoiceId: body.salesInvoiceId ?? null,
        invoiceNumber: body.invoiceNumber ?? null,
        invoiceDate: body.invoiceDate ? parseDateOnly(body.invoiceDate) : null,
        adjustedTaxable: alloc.adjustableTaxable,
        adjustedTax: alloc.adjustableTax,
        notes: body.notes ?? null,
        createdBy: userId,
      },
    })
    return tx.gstAdvanceEntry.update({
      where: { id: row.id },
      data: {
        adjustedTaxable: newAdjTaxable,
        adjustedTax: newAdjTax,
        status,
        updatedBy: userId,
      },
      include: { adjustments: { orderBy: { createdAt: 'asc' } } },
    })
  })

  return { item: serializeAdvance(updated), allocation: alloc }
}

export async function closeAdvance(req: Request, tenantId: string, id: string) {
  assertAny(req, 'tax.gst.specials.manage', 'tax.gst.setup.manage')
  assertFeatureOn()
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const row = await prisma.gstAdvanceEntry.findFirst({
    where: { id, tenantId },
    include: { adjustments: true },
  })
  if (!row) throw new NotFoundError('GST advance entry not found')
  if (row.status === 'VOID') throw new AppError(422, 'Cannot close a voided advance', 'GST_ADVANCE_VOID')
  if (row.status !== 'ADJUSTED' && row.status !== 'PARTIALLY_ADJUSTED' && row.status !== 'RECEIVED') {
    // allow RECEIVED→CLOSED only when fully zero residual intentional
  }

  const updated = await prisma.gstAdvanceEntry.update({
    where: { id: row.id },
    data: { status: 'CLOSED', updatedBy: userId },
    include: { adjustments: true },
  })
  return serializeAdvance(updated)
}

/** Resolve registration scheme for composition gate (primary active reg preferred). */
export async function resolveLegalEntityRegistrationScheme(
  tenantId: string,
  legalEntityId: string,
): Promise<string> {
  const primary = await prisma.gstRegistration.findFirst({
    where: { tenantId, legalEntityId, isActive: true, isPrimary: true },
    select: { registrationType: true },
  })
  if (primary?.registrationType) return primary.registrationType
  const any = await prisma.gstRegistration.findFirst({
    where: { tenantId, legalEntityId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { registrationType: true },
  })
  return any?.registrationType ?? 'REGULAR'
}
