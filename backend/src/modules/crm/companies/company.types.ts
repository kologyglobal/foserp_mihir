import type { CrmCompany } from '@prisma/client'
import { decimalToNumber, mapAuditFields, type AuditUserNames } from '../../../shared/index.js'

export interface CustomerDto {
  id: string
  customerCode: string
  customerName: string
  customerType: string
  industry?: string
  website?: string | null
  turnoverRange?: string | null
  employeeRange?: string | null
  email?: string | null
  phone?: string | null
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  pincode: string
  country?: string
  gstin: string
  pan?: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  creditDays: number
  creditLimit?: number
  salesTerritory: string
  source?: string | null
  status: string
  isActive: boolean
  notes?: string | null
  ownerId?: string | null
  ownerName?: string | null
  createdById: string
  createdByName: string
  createdAt: string
  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null
  approvedById: string | null
  approvedByName: string | null
  approvedAt: string | null
}

export function mapCompanyToCustomer(
  company: CrmCompany,
  names?: AuditUserNames & { ownerName?: string },
): CustomerDto {
  return {
    id: company.id,
    customerCode: company.companyCode,
    customerName: company.name,
    customerType: company.customerType,
    industry: company.industry ?? undefined,
    website: company.website,
    turnoverRange: company.turnoverRange,
    employeeRange: company.employeeRange,
    email: company.email,
    phone: company.phone,
    addressLine1: company.addressLine1 ?? '',
    addressLine2: company.addressLine2 ?? undefined,
    city: company.city ?? '',
    state: company.state ?? '',
    pincode: company.pincode ?? '',
    country: company.country ?? undefined,
    gstin: company.gstin ?? '',
    pan: company.pan ?? undefined,
    contactPerson: company.contactPerson ?? '',
    contactPhone: company.contactPhone ?? '',
    contactEmail: company.contactEmail ?? '',
    creditDays: company.creditDays,
    creditLimit: company.creditLimit != null ? decimalToNumber(company.creditLimit) : undefined,
    salesTerritory: company.salesTerritory ?? '',
    source: company.source,
    status: company.status,
    isActive: company.isActive,
    notes: company.notes,
    ownerId: company.ownerId,
    ownerName: names?.ownerName ?? null,
    ...mapAuditFields(company, names),
  }
}

export function mapCustomerInputToCompany(data: Record<string, unknown>) {
  return {
    companyCode: data.customerCode as string | undefined,
    name: data.customerName as string | undefined,
    customerType: data.customerType as string | undefined,
    industry: data.industry as string | undefined,
    website: data.website as string | undefined,
    turnoverRange: data.turnoverRange as string | undefined,
    employeeRange: data.employeeRange as string | undefined,
    email: data.email as string | undefined,
    phone: data.phone as string | undefined,
    addressLine1: data.addressLine1 as string | undefined,
    addressLine2: data.addressLine2 as string | undefined,
    city: data.city as string | undefined,
    state: data.state as string | undefined,
    pincode: data.pincode as string | undefined,
    country: data.country as string | undefined,
    gstin: data.gstin as string | undefined,
    pan: data.pan as string | undefined,
    contactPerson: data.contactPerson as string | undefined,
    contactPhone: data.contactPhone as string | undefined,
    contactEmail: data.contactEmail as string | undefined,
    creditDays: data.creditDays as number | undefined,
    creditLimit: data.creditLimit as number | undefined,
    salesTerritory: data.salesTerritory as string | undefined,
    source: data.source as string | undefined,
    status: data.status as string | undefined,
    isActive: data.isActive as boolean | undefined,
    notes: data.notes as string | undefined,
    ownerId: data.ownerId as string | undefined,
  }
}
