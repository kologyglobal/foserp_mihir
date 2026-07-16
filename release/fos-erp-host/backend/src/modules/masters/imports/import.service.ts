import { prisma } from '../../../config/database.js'
import { ValidationError } from '../../../utils/errors.js'
import * as itemService from '../../items/item.service.js'
import * as vendorService from '../../vendors/vendor.service.js'
import * as masterService from '../master.service.js'
import { getMasterResource } from '../master.registry.js'
import type { ImportPayload, ImportSummary } from './import.validation.js'

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '_')
}

function rowValue(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = row[key]
    if (direct != null && String(direct).trim() !== '') return String(direct).trim()
    const normalized = Object.entries(row).find(([k]) => normalizeKey(k) === normalizeKey(key))
    if (normalized?.[1] != null && String(normalized[1]).trim() !== '') return String(normalized[1]).trim()
  }
  return ''
}

function parseBool(value: string, defaultValue = true): boolean {
  if (!value) return defaultValue
  const v = value.toLowerCase()
  return v === 'true' || v === 'yes' || v === '1' || v === 'active' || v === 'y'
}

function duplicateRejected(mode: ImportPayload['duplicateMode']): boolean {
  return mode === 'reject'
}

export function itemImportTemplateCsv(): string {
  return [
    'Item Code,Item Name,Category Code,Base UOM Code,Item Type,Product Type,HSN Code,GST Group Code,Standard Rate,Status',
    'RM-001,Steel Plate 6mm,CAT-RAW,NOS,raw,raw_material,72085100,GG18,1250.00,ACTIVE',
  ].join('\n')
}

export function vendorImportTemplateCsv(): string {
  return [
    'Vendor Code,Vendor Name,Search Name,Vendor Type,City,State,Country,Country Code,State Code,City Name,GSTIN,Contact Person,Contact Phone,Payment Terms Days,Status',
    'VND-001,Acme Steel Supplies,ACME STEEL,manufacturer,Pune,Maharashtra,India,IN,MH,Pune,27AAAAA0000A1Z5,Rajesh Kumar,9876543210,30,ACTIVE',
  ].join('\n')
}

export function hsnSacImportTemplateCsv(): string {
  return [
    'HSN Code,GST Group Code,Description,Status',
    '72085100,GG18,Flat-rolled steel products,ACTIVE',
  ].join('\n')
}

async function resolveCategoryId(tenantId: string, code: string): Promise<string> {
  const category = await prisma.masterItemCategory.findFirst({
    where: { tenantId, code, deletedAt: null },
  })
  if (!category) throw new ValidationError(`Category not found: ${code}`)
  return category.id
}

async function resolveUomId(tenantId: string, code: string): Promise<string> {
  const uom = await prisma.masterUom.findFirst({
    where: { tenantId, code, deletedAt: null },
  })
  if (!uom) throw new ValidationError(`UOM not found: ${code}`)
  return uom.id
}

async function resolveGstGroupId(tenantId: string, code: string): Promise<string> {
  const group = await prisma.masterGstGroup.findFirst({
    where: { tenantId, code, deletedAt: null },
  })
  if (!group) throw new ValidationError(`GST group not found: ${code}`)
  return group.id
}

async function resolveHsnId(tenantId: string, code: string): Promise<string | undefined> {
  if (!code) return undefined
  const hsn = await prisma.masterHsnCode.findFirst({
    where: { tenantId, code, deletedAt: null },
  })
  if (!hsn) throw new ValidationError(`HSN code not found: ${code}`)
  return hsn.id
}

async function resolveCountryId(tenantId: string, code: string): Promise<string | undefined> {
  if (!code) return undefined
  const country = await prisma.masterCountry.findFirst({
    where: { tenantId, code, deletedAt: null },
  })
  if (!country) throw new ValidationError(`Country not found: ${code}`)
  return country.id
}

async function resolveStateId(tenantId: string, code: string): Promise<string | undefined> {
  if (!code) return undefined
  const state = await prisma.masterState.findFirst({
    where: { tenantId, code, deletedAt: null },
  })
  if (!state) throw new ValidationError(`State not found: ${code}`)
  return state.id
}

async function resolveCityId(tenantId: string, stateId: string | undefined, name: string): Promise<string | undefined> {
  if (!name) return undefined
  const where: Record<string, unknown> = { tenantId, name, deletedAt: null }
  if (stateId) where.stateId = stateId
  const city = await prisma.masterCity.findFirst({ where })
  if (!city) throw new ValidationError(`City not found: ${name}`)
  return city.id
}

export async function importItems(
  req: import('express').Request,
  tenantId: string,
  _userId: string,
  payload: ImportPayload,
): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, failed: 0, rows: [] }

  for (const [index, row] of payload.rows.entries()) {
    const rowNo = index + 1
    const code = rowValue(row, 'Item Code', 'item_code', 'code')
    const name = rowValue(row, 'Item Name', 'item_name', 'name')
    const categoryCode = rowValue(row, 'Category Code', 'category_code')
    const baseUomCode = rowValue(row, 'Base UOM Code', 'base_uom_code', 'uom_code')

    if (!code || !name || !categoryCode || !baseUomCode) {
      summary.failed += 1
      summary.rows.push({
        row: rowNo,
        ok: false,
        errors: ['Item Code, Item Name, Category Code and Base UOM Code are required'],
      })
      continue
    }

    try {
      const categoryId = await resolveCategoryId(tenantId, categoryCode)
      const baseUomId = await resolveUomId(tenantId, baseUomCode)
      const gstGroupCode = rowValue(row, 'GST Group Code', 'gst_group_code')
      const hsnCode = rowValue(row, 'HSN Code', 'hsn_code')
      const gstGroupId = gstGroupCode ? await resolveGstGroupId(tenantId, gstGroupCode) : undefined
      const hsnId = hsnCode ? await resolveHsnId(tenantId, hsnCode) : undefined

      const data = {
        code,
        name,
        categoryId,
        baseUomId,
        itemType: rowValue(row, 'Item Type', 'item_type') || 'raw',
        productType: rowValue(row, 'Product Type', 'product_type') || undefined,
        hsnCode: hsnCode || '',
        hsnId: hsnId ?? null,
        gstGroupId: gstGroupId ?? null,
        standardRate: Number(rowValue(row, 'Standard Rate', 'standard_rate') || '0') || 0,
        status: parseBool(rowValue(row, 'Status', 'status'), true) ? 'ACTIVE' : 'INACTIVE',
      }

      const existing = await prisma.masterItem.findFirst({
        where: { tenantId, code, deletedAt: null },
      })

      if (existing) {
        if (payload.duplicateMode === 'skip') {
          summary.skipped += 1
          summary.rows.push({ row: rowNo, ok: true, code: existing.code })
          continue
        }
        if (duplicateRejected(payload.duplicateMode)) {
          summary.failed += 1
          summary.rows.push({ row: rowNo, ok: false, errors: [`Duplicate item code ${code}`] })
          continue
        }
        await itemService.updateRecord(req, tenantId, existing.id, data as Record<string, unknown>)
        summary.updated += 1
        summary.rows.push({ row: rowNo, ok: true, code })
        continue
      }

      await itemService.createRecord(req, tenantId, data as Record<string, unknown>)
      summary.imported += 1
      summary.rows.push({ row: rowNo, ok: true, code })
    } catch (err) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors: [err instanceof Error ? err.message : 'Import failed'] })
    }
  }

  return summary
}

export async function importVendors(
  req: import('express').Request,
  tenantId: string,
  _userId: string,
  payload: ImportPayload,
): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, failed: 0, rows: [] }

  for (const [index, row] of payload.rows.entries()) {
    const rowNo = index + 1
    const code = rowValue(row, 'Vendor Code', 'vendor_code', 'code')
    const name = rowValue(row, 'Vendor Name', 'vendor_name', 'name')

    if (!code || !name) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors: ['Vendor Code and Vendor Name are required'] })
      continue
    }

    try {
      const stateCode = rowValue(row, 'State Code', 'state_code')
      const countryCode = rowValue(row, 'Country Code', 'country_code')
      const cityName = rowValue(row, 'City Name', 'city_name')
      const stateId = await resolveStateId(tenantId, stateCode)
      const countryId = await resolveCountryId(tenantId, countryCode)
      const cityId = await resolveCityId(tenantId, stateId, cityName)

      const data = {
        code,
        name,
        searchName: rowValue(row, 'Search Name', 'search_name') || undefined,
        vendorType: rowValue(row, 'Vendor Type', 'vendor_type') || 'manufacturer',
        city: rowValue(row, 'City', 'city') || '',
        state: rowValue(row, 'State', 'state') || '',
        country: rowValue(row, 'Country', 'country') || undefined,
        countryId: countryId ?? null,
        stateId: stateId ?? null,
        cityId: cityId ?? null,
        gstin: rowValue(row, 'GSTIN', 'gstin') || '',
        contactPerson: rowValue(row, 'Contact Person', 'contact_person') || '',
        contactPhone: rowValue(row, 'Contact Phone', 'contact_phone', 'phone') || '',
        paymentTermsDays: Number(rowValue(row, 'Payment Terms Days', 'payment_terms_days') || '30') || 30,
        status: parseBool(rowValue(row, 'Status', 'status'), true) ? 'ACTIVE' : 'INACTIVE',
      }

      const existing = await prisma.masterVendor.findFirst({
        where: { tenantId, code, deletedAt: null },
      })

      if (existing) {
        if (payload.duplicateMode === 'skip') {
          summary.skipped += 1
          summary.rows.push({ row: rowNo, ok: true, code: existing.code })
          continue
        }
        if (duplicateRejected(payload.duplicateMode)) {
          summary.failed += 1
          summary.rows.push({ row: rowNo, ok: false, errors: [`Duplicate vendor code ${code}`] })
          continue
        }
        await vendorService.updateRecord(req, tenantId, existing.id, data as Record<string, unknown>)
        summary.updated += 1
        summary.rows.push({ row: rowNo, ok: true, code })
        continue
      }

      await vendorService.createRecord(req, tenantId, data as Record<string, unknown>)
      summary.imported += 1
      summary.rows.push({ row: rowNo, ok: true, code })
    } catch (err) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors: [err instanceof Error ? err.message : 'Import failed'] })
    }
  }

  return summary
}

export async function importHsnSac(
  req: import('express').Request,
  tenantId: string,
  _userId: string,
  payload: ImportPayload,
): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, failed: 0, rows: [] }
  const config = getMasterResource('hsn-sac')
  if (!config) throw new ValidationError('HSN/SAC master resource not configured')

  for (const [index, row] of payload.rows.entries()) {
    const rowNo = index + 1
    const code = rowValue(row, 'HSN Code', 'hsn_code', 'code')
    const gstGroupCode = rowValue(row, 'GST Group Code', 'gst_group_code')
    const description = rowValue(row, 'Description', 'description')

    if (!code || !gstGroupCode || !description) {
      summary.failed += 1
      summary.rows.push({
        row: rowNo,
        ok: false,
        errors: ['HSN Code, GST Group Code and Description are required'],
      })
      continue
    }

    try {
      const gstGroupId = await resolveGstGroupId(tenantId, gstGroupCode)
      const data = {
        code,
        gstGroupId,
        description,
        status: parseBool(rowValue(row, 'Status', 'status'), true) ? 'ACTIVE' : 'INACTIVE',
      }

      const existing = await prisma.masterHsnCode.findFirst({
        where: { tenantId, code, deletedAt: null },
      })

      if (existing) {
        if (payload.duplicateMode === 'skip') {
          summary.skipped += 1
          summary.rows.push({ row: rowNo, ok: true, code: existing.code })
          continue
        }
        if (duplicateRejected(payload.duplicateMode)) {
          summary.failed += 1
          summary.rows.push({ row: rowNo, ok: false, errors: [`Duplicate HSN code ${code}`] })
          continue
        }
        await masterService.updateRecord(req, tenantId, config, existing.id, data as Record<string, unknown>)
        summary.updated += 1
        summary.rows.push({ row: rowNo, ok: true, code })
        continue
      }

      await masterService.createRecord(req, tenantId, config, data as Record<string, unknown>)
      summary.imported += 1
      summary.rows.push({ row: rowNo, ok: true, code })
    } catch (err) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors: [err instanceof Error ? err.message : 'Import failed'] })
    }
  }

  return summary
}
