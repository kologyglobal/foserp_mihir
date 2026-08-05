/**
 * Phase 2 — GST subledger (compliance truth). Populated from **posted document tax snapshots**
 * only — never re-resolves master rates at write time. GL remains accounting truth via post().
 * Phase 5 — blocks silent rewrite when period/document is FILED or return period is LOCKED.
 */
import type { GstLedgerTaxType, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { assertDocumentLedgerMutable, assertLedgerPeriodMutable } from './gstr-return.service.js'
import { resolveCompanyGstinScope } from './gst-registration-scope.util.js'
import { isZeroRatedTaxTreatment, paymentModeFromTreatment } from './export-sez-lut.util.js'
import { classifyGstSupply } from './gst-specials.util.js'

export function toReturnPeriod(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00.000Z`) : date
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

type Tx = Prisma.TransactionClient

function num(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

type ComponentSeed = {
  taxType: GstLedgerTaxType
  taxRate: number
  taxAmount: number
  taxableValue: number
}

function pushIfPositive(list: ComponentSeed[], taxType: GstLedgerTaxType, taxRate: number, taxAmount: number, taxableValue: number) {
  if (Math.abs(taxAmount) < 0.00005) return
  list.push({ taxType, taxRate, taxAmount, taxableValue })
}

/** Phase 10 — allow zero-tax OUTPUT_IGST seed so export/SEZ WOPAY appears in registers. */
function pushZeroRatedOutward(
  list: ComponentSeed[],
  taxType: GstLedgerTaxType,
  taxableValue: number,
) {
  if (Math.abs(taxableValue) < 0.00005) return
  if (list.length > 0) return
  list.push({ taxType, taxRate: 0, taxAmount: 0, taxableValue })
}

/**
 * Write / replace ledger rows for a posted sales invoice from stored line snapshots.
 */
export async function recordSalesInvoiceGstLedger(
  tx: Tx,
  params: {
    tenantId: string
    salesInvoiceId: string
    accountingVoucherId: string
    postingEventId: string
    documentNumber: string
  },
): Promise<number> {
  const inv = await tx.salesInvoice.findFirst({
    where: { id: params.salesInvoiceId, tenantId: params.tenantId },
    include: {
      lines: true,
      legalEntity: { select: { id: true, gstin: true, stateCode: true } },
    },
  })
  if (!inv || inv.status !== 'POSTED') return 0

  const documentDate = inv.postingDate ?? inv.invoiceDate
  const returnPeriod = toReturnPeriod(documentDate)

  let branchGstin: string | null = null
  let branchStateCode: string | null = null
  if (inv.branchId) {
    const branch = await tx.branch.findFirst({
      where: { id: inv.branchId, tenantId: params.tenantId, legalEntityId: inv.legalEntityId },
      select: { gstin: true, stateCode: true },
    })
    branchGstin = branch?.gstin ?? null
    branchStateCode = branch?.stateCode ?? null
  }

  const scope = resolveCompanyGstinScope({
    legalEntityId: inv.legalEntityId,
    legalEntityGstin: inv.legalEntity?.gstin,
    legalEntityStateCode: inv.legalEntity?.stateCode,
    branchId: inv.branchId,
    branchGstin,
    branchStateCode,
  })
  const companyGstin = 'ok' in scope ? null : scope.gstin
  const companyGstinSource = 'ok' in scope ? null : scope.source

  await assertDocumentLedgerMutable(tx, {
    tenantId: params.tenantId,
    documentId: inv.id,
    documentType: 'SALES_INVOICE',
  })
  await assertLedgerPeriodMutable({
    tenantId: params.tenantId,
    legalEntityId: inv.legalEntityId,
    returnPeriod,
    companyGstin: companyGstin ?? undefined,
  })

  await tx.gstLedgerEntry.deleteMany({
    where: {
      tenantId: params.tenantId,
      documentType: 'SALES_INVOICE',
      documentId: inv.id,
      filingStatus: { not: 'FILED' },
    },
  })

  const rows: Prisma.GstLedgerEntryCreateManyInput[] = []
  const zeroRated = isZeroRatedTaxTreatment(inv.taxTreatment)
  const zeroRatedMode = paymentModeFromTreatment(inv.taxTreatment)
  const headerClass = classifyGstSupply({
    gstRate: zeroRated ? 0 : 1,
    taxTreatment: inv.taxTreatment,
    taxCategoryHint: inv.taxTreatment === 'NON_GST' ? 'NON_GST' : zeroRated ? 'ZERO_RATED' : null,
  })
  for (const line of inv.lines) {
    const taxable = num(line.taxableAmount)
    const lineTax =
      num(line.cgstAmount) + num(line.sgstAmount) + num(line.igstAmount) + num(line.cessAmount)
    const lineClass = classifyGstSupply({
      gstRate: lineTax > 0 ? 1 : 0,
      taxTreatment: inv.taxTreatment,
      taxCategoryHint:
        inv.taxTreatment === 'NON_GST'
          ? 'NON_GST'
          : zeroRated
            ? 'ZERO_RATED'
            : lineTax === 0 && taxable > 0
              ? 'NIL_RATED'
              : null,
    })
    const supplyClass = zeroRated ? 'ZERO_RATED' : lineClass.supplyClass
    const seeds: ComponentSeed[] = []
    pushIfPositive(seeds, 'OUTPUT_CGST', num(line.cgstRate), num(line.cgstAmount), taxable)
    pushIfPositive(seeds, 'OUTPUT_SGST', num(line.sgstRate), num(line.sgstAmount), taxable)
    pushIfPositive(seeds, 'OUTPUT_IGST', num(line.igstRate), num(line.igstAmount), taxable)
    pushIfPositive(seeds, 'OUTPUT_CESS', num(line.cessRate), num(line.cessAmount), taxable)
    // Phase 10: stamp zero-rated export/SEZ taxable lines even when all tax is 0 (WOPAY)
    // Phase 11: stamp nil/exempt/non-gst zero-tax lines for register visibility
    if (seeds.length === 0 && taxable > 0 && (zeroRated || lineClass.isZeroTaxVisible || inv.taxTreatment === 'NON_GST')) {
      pushZeroRatedOutward(seeds, 'OUTPUT_IGST', taxable)
    }
    for (const s of seeds) {
      rows.push({
        tenantId: params.tenantId,
        legalEntityId: inv.legalEntityId,
        branchId: inv.branchId,
        direction: 'OUTWARD',
        documentType: 'SALES_INVOICE',
        documentId: inv.id,
        documentLineId: line.id,
        documentNumber: params.documentNumber || inv.invoiceNumber || inv.id.slice(0, 8),
        documentDate,
        returnPeriod,
        partyGstin: inv.customerGstinSnapshot,
        companyGstin,
        placeOfSupply: inv.placeOfSupply,
        hsnSacCode: line.hsnCodeSnapshot,
        taxType: s.taxType,
        taxableValue: s.taxableValue,
        taxRate: s.taxRate,
        taxAmount: s.taxAmount,
        isReverseCharge: false,
        itcEligibility: null,
        supplyClass,
        filingStatus: 'NOT_FILED',
        accountingVoucherId: params.accountingVoucherId,
        postingEventId: params.postingEventId,
        sourceSnapshot: {
          lineNumber: line.lineNumber,
          itemId: line.itemId ?? null,
          cgstRate: formatForPersistence(line.cgstRate),
          sgstRate: formatForPersistence(line.sgstRate),
          igstRate: formatForPersistence(line.igstRate),
          cessRate: formatForPersistence(line.cessRate),
          companyGstinSource,
          taxTreatment: inv.taxTreatment,
          supplyType: inv.supplyType,
          supplyClass,
          headerSupplyClass: headerClass.supplyClass,
          zeroRatedMode,
          lutId: inv.lutId ?? null,
          lutNumber: inv.lutNumberSnapshot ?? null,
          shippingBillNumber: inv.shippingBillNumber ?? null,
          shippingBillDate: inv.shippingBillDate
            ? inv.shippingBillDate.toISOString().slice(0, 10)
            : null,
          shippingPortCode: inv.shippingPortCode ?? null,
        },
      })
    }
  }

  if (!rows.length) return 0
  await tx.gstLedgerEntry.createMany({ data: rows })
  return rows.length
}

/**
 * Write / replace ledger rows for a posted vendor invoice from stored line snapshots + RCM header.
 */
export async function recordVendorInvoiceGstLedger(
  tx: Tx,
  params: {
    tenantId: string
    vendorInvoiceId: string
    accountingVoucherId: string
    postingEventId: string
    documentNumber: string
  },
): Promise<number> {
  const inv = await tx.vendorInvoice.findFirst({
    where: { id: params.vendorInvoiceId, tenantId: params.tenantId },
    include: { lines: true },
  })
  if (!inv || inv.status !== 'POSTED') return 0

  const documentDate = inv.postingDate ?? inv.documentDate
  const returnPeriod = toReturnPeriod(documentDate)
  const isRcm = inv.taxTreatment === 'REVERSE_CHARGE'

  await assertDocumentLedgerMutable(tx, {
    tenantId: params.tenantId,
    documentId: inv.id,
    documentType: 'VENDOR_INVOICE',
  })
  await assertLedgerPeriodMutable({
    tenantId: params.tenantId,
    legalEntityId: inv.legalEntityId,
    returnPeriod,
    companyGstin: inv.companyGstinSnapshot,
  })

  await tx.gstLedgerEntry.deleteMany({
    where: {
      tenantId: params.tenantId,
      documentType: 'VENDOR_INVOICE',
      documentId: inv.id,
      filingStatus: { not: 'FILED' },
    },
  })

  const rows: Prisma.GstLedgerEntryCreateManyInput[] = []
  for (const line of inv.lines) {
    const taxable = num(line.taxableAmount)
    const lineTax =
      num(line.cgstAmount) + num(line.sgstAmount) + num(line.igstAmount) + num(line.cessAmount)
    const supplyClass = isRcm
      ? 'REVERSE_CHARGE'
      : classifyGstSupply({
          gstRate: lineTax > 0 ? 1 : 0,
          reverseCharge: isRcm,
          taxTreatment: inv.taxTreatment,
        }).supplyClass
    const seeds: ComponentSeed[] = []
    if (isRcm) {
      pushIfPositive(seeds, 'RCM_CGST', num(line.cgstRate), num(line.cgstAmount), taxable)
      pushIfPositive(seeds, 'RCM_SGST', num(line.sgstRate), num(line.sgstAmount), taxable)
      pushIfPositive(seeds, 'RCM_IGST', num(line.igstRate), num(line.igstAmount), taxable)
    } else {
      pushIfPositive(seeds, 'INPUT_CGST', num(line.cgstRate), num(line.cgstAmount), taxable)
      pushIfPositive(seeds, 'INPUT_SGST', num(line.sgstRate), num(line.sgstAmount), taxable)
      pushIfPositive(seeds, 'INPUT_IGST', num(line.igstRate), num(line.igstAmount), taxable)
      pushIfPositive(seeds, 'INPUT_CESS', num(line.cessRate), num(line.cessAmount), taxable)
    }
    // Phase 11: zero-tax inward nil visibility
    if (seeds.length === 0 && taxable > 0 && !isRcm) {
      seeds.push({ taxType: 'INPUT_IGST', taxRate: 0, taxAmount: 0, taxableValue: taxable })
    }
    for (const s of seeds) {
      rows.push({
        tenantId: params.tenantId,
        legalEntityId: inv.legalEntityId,
        branchId: inv.branchId,
        direction: 'INWARD',
        documentType: 'VENDOR_INVOICE',
        documentId: inv.id,
        documentLineId: line.id,
        documentNumber: params.documentNumber || inv.vendorInvoiceNumber || inv.draftReference || inv.id.slice(0, 8),
        documentDate,
        returnPeriod,
        partyGstin: inv.vendorGstinSnapshot,
        companyGstin: inv.companyGstinSnapshot,
        placeOfSupply: inv.placeOfSupplyStateCode ?? null,
        hsnSacCode: line.hsnSacCode,
        taxType: s.taxType,
        taxableValue: s.taxableValue,
        taxRate: s.taxRate,
        taxAmount: s.taxAmount,
        isReverseCharge: isRcm,
        itcEligibility: line.itcEligibility ?? inv.itcEligibility ?? null,
        supplyClass,
        filingStatus: 'NOT_FILED',
        accountingVoucherId: params.accountingVoucherId,
        postingEventId: params.postingEventId,
        sourceSnapshot: {
          lineNumber: line.lineNumber,
          itemId: line.itemId ?? null,
          taxTreatment: inv.taxTreatment,
          supplyClass,
        },
      })
    }
  }

  if (!rows.length) return 0
  await tx.gstLedgerEntry.createMany({ data: rows })
  return rows.length
}

export async function listGstLedgerEntries(params: {
  tenantId: string
  legalEntityId: string
  returnPeriod?: string
  fromDate?: string
  toDate?: string
  direction?: 'OUTWARD' | 'INWARD'
  page?: number
  pageSize?: number
}): Promise<{ items: unknown[]; total: number }> {
  const page = params.page ?? 1
  const pageSize = Math.min(params.pageSize ?? 50, 200)
  const where: Prisma.GstLedgerEntryWhereInput = {
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
  }
  if (params.returnPeriod) where.returnPeriod = params.returnPeriod
  if (params.direction) where.direction = params.direction
  if (params.fromDate || params.toDate) {
    where.documentDate = {}
    if (params.fromDate) where.documentDate.gte = new Date(`${params.fromDate}T00:00:00.000Z`)
    if (params.toDate) where.documentDate.lte = new Date(`${params.toDate}T23:59:59.999Z`)
  }

  const [total, rows] = await Promise.all([
    prisma.gstLedgerEntry.count({ where }),
    prisma.gstLedgerEntry.findMany({
      where,
      orderBy: [{ documentDate: 'desc' }, { documentNumber: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  const items = rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    documentType: r.documentType,
    documentId: r.documentId,
    documentLineId: r.documentLineId || null,
    documentNumber: r.documentNumber,
    documentDate: r.documentDate.toISOString().slice(0, 10),
    returnPeriod: r.returnPeriod,
    partyGstin: r.partyGstin,
    companyGstin: r.companyGstin,
    placeOfSupply: r.placeOfSupply,
    hsnSacCode: r.hsnSacCode,
    taxType: r.taxType,
    taxableValue: formatForPersistence(r.taxableValue),
    taxRate: formatForPersistence(r.taxRate),
    taxAmount: formatForPersistence(r.taxAmount),
    isReverseCharge: r.isReverseCharge,
    itcEligibility: r.itcEligibility,
    filingStatus: r.filingStatus,
    accountingVoucherId: r.accountingVoucherId,
  }))

  return { items, total }
}
