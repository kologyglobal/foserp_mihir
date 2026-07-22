import type {
  ApDisputePriority,
  ApDisputeStatus,
  ApDisputeType,
  Prisma,
  VendorInvoiceSourceLinkType,
} from '@prisma/client'

export type ApDisputeWithContext = Prisma.ApDisputeGetPayload<{
  include: { vendorInvoice: { include: { sourceLinks: true } } }
}>

export type ApDisputeSourceLinkDto = {
  sourceType: VendorInvoiceSourceLinkType
  sourceDocumentId: string
  sourceDocumentNumberSnapshot: string | null
}

export type ApDisputeDto = {
  id: string
  tenantId: string
  legalEntityId: string
  disputeNumber: string
  vendorId: string
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  vendorInvoiceId: string
  payableOpenItemId: string | null
  vendorInvoiceNumber: string
  supplierInvoiceNumber: string
  sourceLinks: ApDisputeSourceLinkDto[]
  disputeDate: string
  disputeType: ApDisputeType
  disputedAmount: string
  description: string
  ownerName: string
  responsibleDepartment: string
  priority: ApDisputePriority
  targetResolutionDate: string | null
  status: ApDisputeStatus
  resolution: string | null
  debitNoteRequired: boolean
  paymentHold: boolean
  supportingDocuments: string[]
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

function toDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

export function mapApDispute(row: ApDisputeWithContext): ApDisputeDto {
  const docs = Array.isArray(row.supportingDocuments)
    ? (row.supportingDocuments as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  return {
    id: row.id,
    tenantId: row.tenantId,
    legalEntityId: row.legalEntityId,
    disputeNumber: row.disputeNumber,
    vendorId: row.vendorId,
    vendorCodeSnapshot: row.vendorCodeSnapshot,
    vendorNameSnapshot: row.vendorNameSnapshot,
    vendorInvoiceId: row.vendorInvoiceId,
    payableOpenItemId: row.payableOpenItemId,
    vendorInvoiceNumber: row.vendorInvoiceNumberSnapshot,
    supplierInvoiceNumber: row.supplierInvoiceNumberSnapshot,
    sourceLinks: row.vendorInvoice.sourceLinks.map((link) => ({
      sourceType: link.sourceType,
      sourceDocumentId: link.sourceDocumentId,
      sourceDocumentNumberSnapshot: link.sourceDocumentNumberSnapshot,
    })),
    disputeDate: toDateOnly(row.disputeDate) ?? '',
    disputeType: row.disputeType,
    disputedAmount: row.disputedAmount.toFixed(4),
    description: row.description,
    ownerName: row.ownerName,
    responsibleDepartment: row.responsibleDepartment,
    priority: row.priority,
    targetResolutionDate: toDateOnly(row.targetResolutionDate),
    status: row.status,
    resolution: row.resolution,
    debitNoteRequired: row.debitNoteRequired,
    paymentHold: row.paymentHold,
    supportingDocuments: docs,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const TERMINAL_AP_DISPUTE_STATUSES: ApDisputeStatus[] = ['RESOLVED', 'REJECTED', 'CLOSED']
