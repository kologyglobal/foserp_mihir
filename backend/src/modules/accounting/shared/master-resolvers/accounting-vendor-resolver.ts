/**
 * Accounting vendor resolver — soft-link over MasterVendor.
 * Extracted from vendor-invoice loadActiveVendor / posting assertVendorEligible patterns.
 * No FinanceVendor table.
 */
import type { MasterVendor } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { AppError, NotFoundError } from '../../../../utils/errors.js'
import { normalizeStateCode, validateStateCode } from '../../receivables/validation/state-code.validator.js'

export class AccountingVendorNotFoundError extends NotFoundError {
  constructor(message = 'Vendor not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'ACCOUNTING_VENDOR_NOT_FOUND' })
  }
}

export class AccountingVendorInactiveError extends AppError {
  constructor(message = 'Vendor is inactive or blocked') {
    super(422, message, 'ACCOUNTING_VENDOR_INACTIVE')
  }
}

export interface AccountingVendorParty {
  id: string
  tenantId: string
  code: string
  name: string
  gstin: string | null
  pan: string | null
  state: string | null
  stateCode: string | null
  address: string | null
  address2: string | null
  city: string | null
  pincode: string | null
  country: string | null
  email: string | null
  contactPerson: string | null
  contactPhone: string | null
  paymentTermsDays: number
  isActive: boolean
  isBlocked: boolean
}

export interface AccountingVendorLookupItem {
  id: string
  code: string
  name: string
  gstin: string | null
  pan: string | null
  stateCode: string | null
  city: string | null
  paymentTermsDays: number
  isActive: boolean
  isBlocked: boolean
}

export interface FindAccountingVendorsQuery {
  search?: string
  activeOnly?: boolean
  page?: number
  limit?: number
}

function resolveVendorStateCode(vendor: Pick<MasterVendor, 'gstin' | 'state'>): string | null {
  const gstin = vendor.gstin?.trim().toUpperCase() ?? ''
  if (gstin.length >= 2) {
    const fromGstin = validateStateCode(gstin.slice(0, 2))
    if (fromGstin.valid) return fromGstin.normalized
  }
  const fromState = validateStateCode(vendor.state)
  if (fromState.valid) return fromState.normalized
  return normalizeStateCode(vendor.state || null)
}

export function mapMasterVendorToAccountingParty(vendor: MasterVendor): AccountingVendorParty {
  const gstin = vendor.gstin?.trim() ? vendor.gstin.trim() : null
  return {
    id: vendor.id,
    tenantId: vendor.tenantId,
    code: vendor.code,
    name: vendor.name,
    gstin,
    pan: vendor.pan,
    state: vendor.state || null,
    stateCode: resolveVendorStateCode(vendor),
    address: vendor.address,
    address2: vendor.address2,
    city: vendor.city || null,
    pincode: vendor.pincode,
    country: vendor.country,
    email: vendor.email,
    contactPerson: vendor.contactPerson || null,
    contactPhone: vendor.contactPhone || null,
    paymentTermsDays: vendor.paymentTermsDays,
    isActive: vendor.status === 'ACTIVE' && !vendor.isBlocked && vendor.deletedAt == null,
    isBlocked: vendor.isBlocked,
  }
}

function toLookupItem(party: AccountingVendorParty): AccountingVendorLookupItem {
  return {
    id: party.id,
    code: party.code,
    name: party.name,
    gstin: party.gstin,
    pan: party.pan,
    stateCode: party.stateCode,
    city: party.city,
    paymentTermsDays: party.paymentTermsDays,
    isActive: party.isActive,
    isBlocked: party.isBlocked,
  }
}

export async function findAccountingVendor(
  tenantId: string,
  vendorId: string,
): Promise<AccountingVendorParty | null> {
  const vendor = await prisma.masterVendor.findFirst({
    where: { id: vendorId, tenantId, deletedAt: null },
  })
  return vendor ? mapMasterVendorToAccountingParty(vendor) : null
}

/** Active + not blocked — used on create/update/validate/post soft-link revalidation. */
export async function requireActiveAccountingVendor(
  tenantId: string,
  vendorId: string,
): Promise<AccountingVendorParty> {
  const vendor = await prisma.masterVendor.findFirst({
    where: { id: vendorId, tenantId, deletedAt: null },
  })
  if (!vendor) throw new AccountingVendorNotFoundError()
  const party = mapMasterVendorToAccountingParty(vendor)
  if (!party.isActive) throw new AccountingVendorInactiveError()
  return party
}

export async function listAccountingVendors(
  tenantId: string,
  query: FindAccountingVendorsQuery,
): Promise<{ items: AccountingVendorLookupItem[]; total: number; page: number; limit: number }> {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'asc',
  })
  const activeOnly = query.activeOnly !== false
  const where = {
    tenantId,
    deletedAt: null,
    ...(activeOnly ? { status: 'ACTIVE' as const, isBlocked: false } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search } },
            { name: { contains: query.search } },
            { searchName: { contains: query.search } },
            { gstin: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.masterVendor.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.masterVendor.count({ where }),
  ])

  return {
    items: rows.map((v) => toLookupItem(mapMasterVendorToAccountingParty(v))),
    total,
    page,
    limit,
  }
}

export async function getAccountingVendorLookup(
  tenantId: string,
  vendorId: string,
): Promise<AccountingVendorLookupItem | null> {
  const party = await findAccountingVendor(tenantId, vendorId)
  return party ? toLookupItem(party) : null
}
