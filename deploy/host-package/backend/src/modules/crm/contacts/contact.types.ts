import type { CrmContact } from '@prisma/client'
import { mapAuditFields, type AuditUserNames } from '../../../shared/index.js'

export interface CrmContactDto {
  id: string
  contactCode: string
  customerId: string
  name: string
  designation: string
  department?: string
  email: string
  phone: string
  alternatePhone?: string | null
  linkedInUrl?: string | null
  isPrimary: boolean
  isActive?: boolean
  masterContactId?: string
  status: string
  notes?: string | null
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

export function mapContactToDto(contact: CrmContact, names?: AuditUserNames): CrmContactDto {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim()
  return {
    id: contact.id,
    contactCode: contact.contactCode,
    customerId: contact.companyId,
    name: fullName,
    designation: contact.designation ?? '',
    department: contact.department ?? undefined,
    email: contact.email ?? '',
    phone: contact.mobile ?? '',
    alternatePhone: contact.alternateMobile,
    linkedInUrl: contact.linkedInUrl,
    isPrimary: contact.isPrimary,
    isActive: contact.isActive,
    masterContactId: contact.masterContactId ?? undefined,
    status: contact.status,
    notes: contact.notes,
    ...mapAuditFields(contact, names),
  }
}

export function splitContactName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}
