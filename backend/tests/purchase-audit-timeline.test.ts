import { describe, expect, it } from 'vitest'
import {
  isTimelineEntityType,
  purchaseAuditActionLabel,
  PURCHASE_AUDIT_ACTION,
  TIMELINE_ENTITY_MAP,
} from '../src/modules/purchase/shared/purchase-audit.js'
import { dedupePurchaseTimelineEvents } from '../src/modules/purchase/timeline/purchase-timeline.service.js'

describe('purchase audit catalog', () => {
  it('labels core PR / planning / RFQ / PO actions', () => {
    expect(purchaseAuditActionLabel(PURCHASE_AUDIT_ACTION.PR_CREATED)).toBe('Created')
    expect(purchaseAuditActionLabel(PURCHASE_AUDIT_ACTION.PR_LINE_ADDED)).toBe('Line added')
    expect(purchaseAuditActionLabel(PURCHASE_AUDIT_ACTION.PR_RFQ_DECISION_CHANGED)).toBe(
      'RFQ decision changed',
    )
    expect(purchaseAuditActionLabel(PURCHASE_AUDIT_ACTION.PPS_ROW_GENERATED)).toBe(
      'Planning row generated',
    )
    expect(purchaseAuditActionLabel(PURCHASE_AUDIT_ACTION.RFQ_VENDOR_AWARDED)).toBe('Vendor awarded')
    expect(purchaseAuditActionLabel(PURCHASE_AUDIT_ACTION.PO_SENT_TO_VENDOR)).toBe('Sent to vendor')
  })

  it('maps timeline entity types to audit entities and view permissions', () => {
    expect(isTimelineEntityType('purchase-requisition')).toBe(true)
    expect(isTimelineEntityType('unknown')).toBe(false)
    expect(TIMELINE_ENTITY_MAP.rfq.auditEntity).toBe('RequestForQuotation')
    expect(TIMELINE_ENTITY_MAP['planning-row'].viewPermission).toBe('purchase.planning.view')
    expect(TIMELINE_ENTITY_MAP['purchase-order'].statusDocumentType).toBe('PURCHASE_ORDER')
  })

  it('merges duplicate lifecycle audit + status rows', () => {
    const merged = dedupePurchaseTimelineEvents([
      {
        id: 'audit:1',
        source: 'audit',
        tenantId: 't1',
        module: 'purchase',
        entityType: 'PurchaseRequisition',
        entityId: 'pr-1',
        action: 'PR_APPROVED',
        actionLabel: 'Approved',
        previousValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'APPROVED', rfqRequired: false },
        actorId: 'u1',
        actorName: null,
        timestamp: '2026-08-06T09:31:00.000Z',
        remarks: null,
        requestMetadata: null,
      },
      {
        id: 'status:1',
        source: 'status_history',
        tenantId: 't1',
        module: 'purchase',
        entityType: 'PurchaseRequisition',
        entityId: 'pr-1',
        action: 'APPROVED',
        actionLabel: 'Approved',
        previousValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'APPROVED' },
        actorId: 'u1',
        actorName: 'Rajesh Patel',
        timestamp: '2026-08-06T09:31:00.000Z',
        remarks: 'E2E approve L0',
        requestMetadata: null,
      },
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]?.remarks).toBe('E2E approve L0')
    expect(merged[0]?.newValue).toEqual({ status: 'APPROVED', rfqRequired: false })
  })
})
