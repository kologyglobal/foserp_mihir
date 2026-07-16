import { prisma } from '../../../config/database.js'
import { ValidationError } from '../../../utils/errors.js'
import * as companyService from '../companies/company.service.js'
import * as contactService from '../contacts/contact.service.js'
import * as leadService from '../leads/lead.service.js'
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

export function companyImportTemplateCsv(): string {
  return [
    'Company Code,Company Name,Type,Industry,Address Line 1,City,State,Pincode,Country,GSTIN,PAN,Contact Person,Mobile,Email,Credit Days,Credit Limit,Sales Territory,Active',
    'CUST-0042,Acme Logistics Pvt Ltd,corporate,Cement,Plot 12,Mumbai,Maharashtra,400001,India,27AAAAA0000A1Z5,,Rajesh Kumar,9876543210,rajesh@acme.com,30,500000,West,true',
  ].join('\n')
}

export function contactImportTemplateCsv(): string {
  return [
    'Contact Code,Company Code,Company Name,Name,Designation,Department,Email,Phone,Primary,Active',
    ',CUST-0042,,Rajesh Kumar,Director,Sales,rajesh@acme.com,9876543210,true,true',
  ].join('\n')
}

export function leadImportTemplateCsv(): string {
  return [
    'Prospect Name,Company Name,Source,Industry,Email,Mobile,Contact Person,Expected Value,Stage,Priority,Lead Owner Email,Remarks',
    'New Trailer Inquiry,Acme Logistics,website,Cement,inquiry@acme.com,9876543210,Rajesh Kumar,2500000,new,medium,admin@vasant-trailers.com,Needs 40ft trailer',
  ].join('\n')
}

export async function importCompanies(tenantId: string, userId: string, payload: ImportPayload): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, failed: 0, rows: [] }

  for (const [index, row] of payload.rows.entries()) {
    const rowNo = index + 1
    const name = rowValue(row, 'Company Name', 'company_name', 'name')
    if (!name) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors: ['Company Name is required'] })
      continue
    }
    const code = rowValue(row, 'Company Code', 'company_code', 'code')
    try {
      const existing = code
        ? await prisma.crmCompany.findFirst({ where: { tenantId, companyCode: code, deletedAt: null } })
        : null
      const data = {
        companyCode: code || undefined,
        name,
        customerType: rowValue(row, 'Type', 'type') || 'corporate',
        industry: rowValue(row, 'Industry', 'industry') || undefined,
        addressLine1: rowValue(row, 'Address Line 1', 'address') || undefined,
        city: rowValue(row, 'City', 'city') || undefined,
        state: rowValue(row, 'State', 'state') || undefined,
        pincode: rowValue(row, 'Pincode', 'pincode') || undefined,
        country: rowValue(row, 'Country', 'country') || 'India',
        gstin: rowValue(row, 'GSTIN', 'gstin') || undefined,
        pan: rowValue(row, 'PAN', 'pan') || undefined,
        contactPerson: rowValue(row, 'Contact Person', 'contact_person') || undefined,
        contactPhone: rowValue(row, 'Mobile', 'mobile', 'phone') || undefined,
        contactEmail: rowValue(row, 'Email', 'email') || undefined,
        creditDays: Number(rowValue(row, 'Credit Days', 'credit_days') || '0') || 0,
        creditLimit: Number(rowValue(row, 'Credit Limit', 'credit_limit') || '0') || 0,
        salesTerritory: rowValue(row, 'Sales Territory', 'sales_territory') || undefined,
        isActive: parseBool(rowValue(row, 'Active', 'active'), true),
      }
      if (existing) {
        if (payload.duplicateMode === 'skip') {
          summary.skipped += 1
          summary.rows.push({ row: rowNo, ok: true, code: existing.companyCode })
          continue
        }
        if (payload.duplicateMode === 'error') {
          summary.failed += 1
          summary.rows.push({ row: rowNo, ok: false, errors: [`Duplicate company code ${existing.companyCode}`] })
          continue
        }
        await companyService.updateCompany(tenantId, existing.id, userId, data as never)
        summary.updated += 1
        summary.rows.push({ row: rowNo, ok: true, code: existing.companyCode })
        continue
      }
      const created = await companyService.createCompany(tenantId, userId, data as never)
      summary.imported += 1
      summary.rows.push({ row: rowNo, ok: true, code: created.customerCode })
    } catch (err) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors: [err instanceof Error ? err.message : 'Import failed'] })
    }
  }

  return summary
}

export async function importContacts(tenantId: string, userId: string, payload: ImportPayload): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, failed: 0, rows: [] }

  for (const [index, row] of payload.rows.entries()) {
    const rowNo = index + 1
    const name = rowValue(row, 'Name', 'name')
    const companyCode = rowValue(row, 'Company Code', 'company_code')
    const companyName = rowValue(row, 'Company Name', 'company_name')
    if (!name) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors: ['Name is required'] })
      continue
    }
    try {
      let company = companyCode
        ? await prisma.crmCompany.findFirst({ where: { tenantId, companyCode, deletedAt: null } })
        : null
      if (!company && companyName) {
        company = await prisma.crmCompany.findFirst({ where: { tenantId, name: companyName, deletedAt: null } })
      }
      if (!company) throw new ValidationError('Company not found for contact row')

      const code = rowValue(row, 'Contact Code', 'contact_code', 'code')
      const existing = code
        ? await prisma.crmContact.findFirst({ where: { tenantId, contactCode: code, deletedAt: null } })
        : null
      const data = {
        customerId: company.id,
        name,
        designation: rowValue(row, 'Designation', 'designation') || undefined,
        department: rowValue(row, 'Department', 'department') || undefined,
        email: rowValue(row, 'Email', 'email') || undefined,
        phone: rowValue(row, 'Phone', 'phone', 'mobile') || undefined,
        isPrimary: parseBool(rowValue(row, 'Primary', 'primary'), false),
        isActive: parseBool(rowValue(row, 'Active', 'active'), true),
      }
      if (existing) {
        if (payload.duplicateMode === 'skip') {
          summary.skipped += 1
          summary.rows.push({ row: rowNo, ok: true, code: existing.contactCode })
          continue
        }
        if (payload.duplicateMode === 'error') {
          summary.failed += 1
          summary.rows.push({ row: rowNo, ok: false, errors: [`Duplicate contact code ${existing.contactCode}`] })
          continue
        }
        await contactService.updateContact(tenantId, existing.id, userId, data as never)
        summary.updated += 1
        summary.rows.push({ row: rowNo, ok: true, code: existing.contactCode })
        continue
      }
      const created = await contactService.createContact(tenantId, userId, data as never)
      summary.imported += 1
      summary.rows.push({ row: rowNo, ok: true, code: created.contactCode })
    } catch (err) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors: [err instanceof Error ? err.message : 'Import failed'] })
    }
  }

  return summary
}

export async function importLeads(tenantId: string, userId: string, payload: ImportPayload): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, failed: 0, rows: [] }

  for (const [index, row] of payload.rows.entries()) {
    const rowNo = index + 1
    const prospectName = rowValue(row, 'Prospect Name', 'prospect_name', 'name')
    if (!prospectName) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors: ['Prospect Name is required'] })
      continue
    }
    try {
      const ownerEmail = rowValue(row, 'Lead Owner Email', 'lead_owner_email')
      let leadOwnerId: string | null = null
      if (ownerEmail) {
        const owner = await prisma.user.findFirst({ where: { tenantId, email: ownerEmail, deletedAt: null } })
        if (!owner) throw new ValidationError(`Lead owner not found: ${ownerEmail}`)
        leadOwnerId = owner.id
      }
      const companyName = rowValue(row, 'Company Name', 'company_name')
      let customerId: string | undefined
      if (companyName) {
        const company = await prisma.crmCompany.findFirst({ where: { tenantId, name: companyName, deletedAt: null } })
        customerId = company?.id
      }
      const data = {
        prospectName,
        companyName: companyName || undefined,
        customerId,
        source: rowValue(row, 'Source', 'source') || 'other',
        industry: rowValue(row, 'Industry', 'industry') || undefined,
        email: rowValue(row, 'Email', 'email') || undefined,
        mobile: rowValue(row, 'Mobile', 'mobile', 'phone') || undefined,
        contactPerson: rowValue(row, 'Contact Person', 'contact_person') || undefined,
        expectedValue: Number(rowValue(row, 'Expected Value', 'expected_value') || '0') || 0,
        stage: rowValue(row, 'Stage', 'stage') || 'new',
        priority: rowValue(row, 'Priority', 'priority') || 'medium',
        leadOwnerId,
        remarks: rowValue(row, 'Remarks', 'remarks') || undefined,
      }
      const leadCode = rowValue(row, 'Lead No', 'lead_no', 'code')
      if (leadCode) {
        const existing = await prisma.crmLead.findFirst({ where: { tenantId, leadCode, deletedAt: null } })
        if (existing) {
          if (payload.duplicateMode === 'skip') {
            summary.skipped += 1
            summary.rows.push({ row: rowNo, ok: true, code: existing.leadCode })
            continue
          }
          if (payload.duplicateMode === 'error') {
            summary.failed += 1
            summary.rows.push({ row: rowNo, ok: false, errors: [`Duplicate lead code ${existing.leadCode}`] })
            continue
          }
          await leadService.updateLead(tenantId, existing.id, userId, data as never)
          summary.updated += 1
          summary.rows.push({ row: rowNo, ok: true, code: existing.leadCode })
          continue
        }
      }
      const created = await leadService.createLead(tenantId, userId, { ...data, leadNo: leadCode || undefined } as never)
      summary.imported += 1
      summary.rows.push({ row: rowNo, ok: true, code: created.leadNo })
    } catch (err) {
      summary.failed += 1
      summary.rows.push({ row: rowNo, ok: false, errors: [err instanceof Error ? err.message : 'Import failed'] })
    }
  }

  return summary
}
