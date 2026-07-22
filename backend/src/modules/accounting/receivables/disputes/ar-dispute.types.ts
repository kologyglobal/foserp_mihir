import type { ArDispute, ArDisputePriority, ArDisputeStatus, ArDisputeType } from '@prisma/client'

export type ArDisputeDto = {
  id: string
  tenantId: string
  legalEntityId: string
  disputeNumber: string
  customerId: string
  customerNameSnapshot: string
  salesInvoiceId: string
  openItemId: string | null
  invoiceNumberSnapshot: string
  sourceContext: ArDisputeSourceContext
  disputeDate: string
  disputeType: ArDisputeType
  disputedAmount: string
  description: string
  ownerName: string
  responsibleDepartment: string
  priority: ArDisputePriority
  targetResolutionDate: string | null
  status: ArDisputeStatus
  resolution: string | null
  creditNoteRequired: boolean
  collectionHold: boolean
  supportingDocuments: string[]
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type ArDisputeSourceContext = {
  invoiceSourceType: string
  sourceDocumentId: string | null
  salesOrders: Array<{ id: string; number: string }>
  dispatches: Array<{ id: string; number: string | null }>
}

export function toDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

export function mapArDispute(
  row: ArDispute,
  sourceContext: ArDisputeSourceContext = {
    invoiceSourceType: 'DIRECT',
    sourceDocumentId: null,
    salesOrders: [],
    dispatches: [],
  },
): ArDisputeDto {
  const docs = Array.isArray(row.supportingDocuments)
    ? (row.supportingDocuments as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  return {
    id: row.id,
    tenantId: row.tenantId,
    legalEntityId: row.legalEntityId,
    disputeNumber: row.disputeNumber,
    customerId: row.customerId,
    customerNameSnapshot: row.customerNameSnapshot,
    salesInvoiceId: row.salesInvoiceId,
    openItemId: row.openItemId,
    invoiceNumberSnapshot: row.invoiceNumberSnapshot,
    sourceContext,
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
    creditNoteRequired: row.creditNoteRequired,
    collectionHold: row.collectionHold,
    supportingDocuments: docs,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const TERMINAL_DISPUTE_STATUSES: ArDisputeStatus[] = ['RESOLVED', 'REJECTED', 'CLOSED']
