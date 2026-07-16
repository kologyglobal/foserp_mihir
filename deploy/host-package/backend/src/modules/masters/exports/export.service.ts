import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { MasterExportQuery } from './export.validation.js'

function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))]
  return lines.join('\n')
}

export async function exportItemsCsv(tenantId: string, query: MasterExportQuery): Promise<string> {
  const where: Record<string, unknown> = { ...tenantActiveFilter(tenantId) }
  if (query.status) where.status = query.status
  if (query.itemType) where.itemType = query.itemType
  if (query.categoryId) where.categoryId = query.categoryId
  if (query.search) {
    where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }]
  }

  const items = await prisma.masterItem.findMany({
    where,
    orderBy: { code: 'asc' },
    include: {
      category: { select: { code: true } },
      baseUom: { select: { code: true } },
      hsn: { select: { code: true } },
      gstGroup: { select: { code: true } },
    },
  })

  const headers = [
    'Item Code',
    'Item Name',
    'Category Code',
    'Base UOM Code',
    'Item Type',
    'Product Type',
    'HSN Code',
    'GST Group Code',
    'Standard Rate',
    'Status',
  ]

  const rows = items.map((item) => [
    item.code,
    item.name,
    item.category.code,
    item.baseUom.code,
    item.itemType,
    item.productType ?? '',
    item.hsn?.code ?? item.hsnCode,
    item.gstGroup?.code ?? '',
    String(item.standardRate),
    item.status,
  ])

  return toCsv(headers, rows)
}

export async function exportVendorsCsv(tenantId: string, query: MasterExportQuery): Promise<string> {
  const where: Record<string, unknown> = { ...tenantActiveFilter(tenantId) }
  if (query.status) where.status = query.status
  if (query.vendorType) where.vendorType = query.vendorType
  if (query.search) {
    where.OR = [
      { code: { contains: query.search } },
      { name: { contains: query.search } },
      { searchName: { contains: query.search } },
      { gstin: { contains: query.search } },
    ]
  }

  const vendors = await prisma.masterVendor.findMany({
    where,
    orderBy: { code: 'asc' },
    include: {
      countryRef: { select: { code: true } },
      stateRef: { select: { code: true } },
      cityRef: { select: { name: true } },
    },
  })

  const headers = [
    'Vendor Code',
    'Vendor Name',
    'Search Name',
    'Vendor Type',
    'City',
    'State',
    'Country',
    'Country Code',
    'State Code',
    'City Name',
    'GSTIN',
    'Contact Person',
    'Contact Phone',
    'Payment Terms Days',
    'Status',
  ]

  const rows = vendors.map((vendor) => [
    vendor.code,
    vendor.name,
    vendor.searchName ?? '',
    vendor.vendorType,
    vendor.city,
    vendor.state,
    vendor.country ?? '',
    vendor.countryRef?.code ?? '',
    vendor.stateRef?.code ?? '',
    vendor.cityRef?.name ?? '',
    vendor.gstin,
    vendor.contactPerson,
    vendor.contactPhone,
    String(vendor.paymentTermsDays),
    vendor.status,
  ])

  return toCsv(headers, rows)
}

export async function exportHsnSacCsv(tenantId: string, query: MasterExportQuery): Promise<string> {
  const where: Record<string, unknown> = { ...tenantActiveFilter(tenantId) }
  if (query.status) where.status = query.status
  if (query.gstGroupId) where.gstGroupId = query.gstGroupId
  if (query.search) {
    where.OR = [{ code: { contains: query.search } }, { description: { contains: query.search } }]
  }

  const records = await prisma.masterHsnCode.findMany({
    where,
    orderBy: { code: 'asc' },
    include: { gstGroup: { select: { code: true } } },
  })

  const headers = ['HSN Code', 'GST Group Code', 'Description', 'Status']
  const rows = records.map((record) => [
    record.code,
    record.gstGroup.code,
    record.description,
    record.status,
  ])

  return toCsv(headers, rows)
}
