import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { formatForPersistence, sumDecimals } from '../shared/finance-decimal.js'
import type { GstExtractSummary, GstSupplyExtractRow } from './tax-compliance.types.js'

function toDateOnlyUtc(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function parseDateOnlyStart(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`)
}

function parseDateOnlyEnd(dateOnly: string): Date {
  return new Date(`${dateOnly}T23:59:59.999Z`)
}

/**
 * Prefer postingDate when present; otherwise invoice/document date.
 * Prisma equivalent of COALESCE(postingDate, documentDate) BETWEEN from AND to.
 */
function effectiveDateFilter(
  fromDate: string,
  toDate: string,
  documentDateField: 'invoiceDate' | 'documentDate',
): Prisma.SalesInvoiceWhereInput | Prisma.VendorInvoiceWhereInput {
  const from = parseDateOnlyStart(fromDate)
  const to = parseDateOnlyEnd(toDate)
  return {
    OR: [
      { postingDate: { gte: from, lte: to } },
      {
        AND: [{ postingDate: null }, { [documentDateField]: { gte: from, lte: to } }],
      },
    ],
  }
}

function emptySummary(): GstExtractSummary {
  return {
    documentCount: 0,
    taxableAmount: formatForPersistence(0),
    cgstAmount: formatForPersistence(0),
    sgstAmount: formatForPersistence(0),
    igstAmount: formatForPersistence(0),
    cessAmount: formatForPersistence(0),
    totalTaxAmount: formatForPersistence(0),
    totalAmount: formatForPersistence(0),
  }
}

function summarizeRows(
  rows: Array<{
    taxableAmount: Prisma.Decimal | string
    cgstAmount: Prisma.Decimal | string
    sgstAmount: Prisma.Decimal | string
    igstAmount: Prisma.Decimal | string
    cessAmount: Prisma.Decimal | string
    totalTaxAmount: Prisma.Decimal | string
    totalAmount: Prisma.Decimal | string
  }>,
): GstExtractSummary {
  if (rows.length === 0) return emptySummary()
  return {
    documentCount: rows.length,
    taxableAmount: formatForPersistence(sumDecimals(rows.map((r) => r.taxableAmount))),
    cgstAmount: formatForPersistence(sumDecimals(rows.map((r) => r.cgstAmount))),
    sgstAmount: formatForPersistence(sumDecimals(rows.map((r) => r.sgstAmount))),
    igstAmount: formatForPersistence(sumDecimals(rows.map((r) => r.igstAmount))),
    cessAmount: formatForPersistence(sumDecimals(rows.map((r) => r.cessAmount))),
    totalTaxAmount: formatForPersistence(sumDecimals(rows.map((r) => r.totalTaxAmount))),
    totalAmount: formatForPersistence(sumDecimals(rows.map((r) => r.totalAmount))),
  }
}

export async function listOutwardSupplies(params: {
  tenantId: string
  legalEntityId: string
  fromDate: string
  toDate: string
  page: number
  pageSize: number
  search?: string
}): Promise<{ items: GstSupplyExtractRow[]; total: number; summary: GstExtractSummary }> {
  const { tenantId, legalEntityId, fromDate, toDate, page, pageSize, search } = params

  const dateFilter = effectiveDateFilter(fromDate, toDate, 'invoiceDate') as Prisma.SalesInvoiceWhereInput
  const searchTrim = search?.trim()
  const searchFilter: Prisma.SalesInvoiceWhereInput | undefined = searchTrim
    ? {
        OR: [
          { customerNameSnapshot: { contains: searchTrim } },
          { invoiceNumber: { contains: searchTrim } },
          { customerGstinSnapshot: { contains: searchTrim } },
        ],
      }
    : undefined

  const where: Prisma.SalesInvoiceWhereInput = {
    tenantId,
    legalEntityId,
    status: 'POSTED',
    AND: [dateFilter, ...(searchFilter ? [searchFilter] : [])],
  }

  const [total, pageRows, allForSummary] = await Promise.all([
    prisma.salesInvoice.count({ where }),
    prisma.salesInvoice.findMany({
      where,
      orderBy: [{ postingDate: 'asc' }, { invoiceDate: 'asc' }, { invoiceNumber: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        postingDate: true,
        customerNameSnapshot: true,
        customerGstinSnapshot: true,
        customerStateCodeSnapshot: true,
        placeOfSupply: true,
        taxableAmount: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        cessAmount: true,
        totalTaxAmount: true,
        totalAmount: true,
        supplyType: true,
        taxTreatment: true,
        currencyCode: true,
      },
    }),
    prisma.salesInvoice.findMany({
      where,
      select: {
        taxableAmount: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        cessAmount: true,
        totalTaxAmount: true,
        totalAmount: true,
      },
    }),
  ])

  const items: GstSupplyExtractRow[] = pageRows.map((row) => {
    const invoiceDate = toDateOnlyUtc(row.invoiceDate)
    const postingDate = row.postingDate ? toDateOnlyUtc(row.postingDate) : null
    return {
      id: row.id,
      documentNumber: row.invoiceNumber ?? '',
      documentDate: postingDate ?? invoiceDate,
      invoiceDate,
      postingDate,
      partyName: row.customerNameSnapshot,
      partyGstin: row.customerGstinSnapshot,
      placeOfSupply: row.placeOfSupply,
      stateCode: row.customerStateCodeSnapshot,
      taxableAmount: formatForPersistence(row.taxableAmount),
      cgstAmount: formatForPersistence(row.cgstAmount),
      sgstAmount: formatForPersistence(row.sgstAmount),
      igstAmount: formatForPersistence(row.igstAmount),
      cessAmount: formatForPersistence(row.cessAmount),
      totalTaxAmount: formatForPersistence(row.totalTaxAmount),
      totalAmount: formatForPersistence(row.totalAmount),
      supplyType: row.supplyType,
      taxTreatment: row.taxTreatment,
      currencyCode: row.currencyCode,
      reverseCharge: false,
    }
  })

  return { items, total, summary: summarizeRows(allForSummary) }
}

export async function listInwardSupplies(params: {
  tenantId: string
  legalEntityId: string
  fromDate: string
  toDate: string
  page: number
  pageSize: number
  search?: string
}): Promise<{ items: GstSupplyExtractRow[]; total: number; summary: GstExtractSummary }> {
  const { tenantId, legalEntityId, fromDate, toDate, page, pageSize, search } = params

  const dateFilter = effectiveDateFilter(fromDate, toDate, 'documentDate') as Prisma.VendorInvoiceWhereInput
  const searchTrim = search?.trim()
  const searchFilter: Prisma.VendorInvoiceWhereInput | undefined = searchTrim
    ? {
        OR: [
          { vendorNameSnapshot: { contains: searchTrim } },
          { vendorInvoiceNumber: { contains: searchTrim } },
          { supplierInvoiceNumber: { contains: searchTrim } },
          { vendorGstinSnapshot: { contains: searchTrim } },
        ],
      }
    : undefined

  const where: Prisma.VendorInvoiceWhereInput = {
    tenantId,
    legalEntityId,
    status: 'POSTED',
    AND: [dateFilter, ...(searchFilter ? [searchFilter] : [])],
  }

  const [total, pageRows, allForSummary] = await Promise.all([
    prisma.vendorInvoice.count({ where }),
    prisma.vendorInvoice.findMany({
      where,
      orderBy: [{ postingDate: 'asc' }, { documentDate: 'asc' }, { vendorInvoiceNumber: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        vendorInvoiceNumber: true,
        supplierInvoiceNumber: true,
        documentDate: true,
        postingDate: true,
        vendorNameSnapshot: true,
        vendorGstinSnapshot: true,
        vendorStateCodeSnapshot: true,
        placeOfSupplyStateCode: true,
        taxableAmount: true,
        inputCgstAmount: true,
        inputSgstAmount: true,
        inputIgstAmount: true,
        inputCessAmount: true,
        invoiceGrandTotal: true,
        taxTreatment: true,
        currencyCode: true,
      },
    }),
    prisma.vendorInvoice.findMany({
      where,
      select: {
        taxableAmount: true,
        inputCgstAmount: true,
        inputSgstAmount: true,
        inputIgstAmount: true,
        inputCessAmount: true,
        invoiceGrandTotal: true,
      },
    }),
  ])

  const items: GstSupplyExtractRow[] = pageRows.map((row) => {
    const invoiceDate = toDateOnlyUtc(row.documentDate)
    const postingDate = row.postingDate ? toDateOnlyUtc(row.postingDate) : null
    const cgst = row.inputCgstAmount
    const sgst = row.inputSgstAmount
    const igst = row.inputIgstAmount
    const cess = row.inputCessAmount
    const totalTax = sumDecimals([cgst, sgst, igst, cess])
    return {
      id: row.id,
      documentNumber: row.vendorInvoiceNumber ?? row.supplierInvoiceNumber,
      documentDate: postingDate ?? invoiceDate,
      invoiceDate,
      postingDate,
      partyName: row.vendorNameSnapshot,
      partyGstin: row.vendorGstinSnapshot,
      placeOfSupply: row.placeOfSupplyStateCode,
      stateCode: row.vendorStateCodeSnapshot,
      taxableAmount: formatForPersistence(row.taxableAmount),
      cgstAmount: formatForPersistence(cgst),
      sgstAmount: formatForPersistence(sgst),
      igstAmount: formatForPersistence(igst),
      cessAmount: formatForPersistence(cess),
      totalTaxAmount: formatForPersistence(totalTax),
      totalAmount: formatForPersistence(row.invoiceGrandTotal),
      supplyType: null,
      taxTreatment: row.taxTreatment,
      currencyCode: row.currencyCode,
      reverseCharge: row.taxTreatment === 'REVERSE_CHARGE',
    }
  })

  const summaryRows = allForSummary.map((row) => {
    const totalTax = sumDecimals([
      row.inputCgstAmount,
      row.inputSgstAmount,
      row.inputIgstAmount,
      row.inputCessAmount,
    ])
    return {
      taxableAmount: row.taxableAmount,
      cgstAmount: row.inputCgstAmount,
      sgstAmount: row.inputSgstAmount,
      igstAmount: row.inputIgstAmount,
      cessAmount: row.inputCessAmount,
      totalTaxAmount: totalTax,
      totalAmount: row.invoiceGrandTotal,
    }
  })

  return { items, total, summary: summarizeRows(summaryRows) }
}

export async function getGstComplianceSummary(params: {
  tenantId: string
  legalEntityId: string
  fromDate: string
  toDate: string
}): Promise<{ outward: GstExtractSummary; inward: GstExtractSummary }> {
  const [outward, inward] = await Promise.all([
    listOutwardSupplies({ ...params, page: 1, pageSize: 1 }),
    listInwardSupplies({ ...params, page: 1, pageSize: 1 }),
  ])
  return { outward: outward.summary, inward: inward.summary }
}
