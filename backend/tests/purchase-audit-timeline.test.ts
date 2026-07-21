import { describe, expect, it } from 'vitest'
import {
  isTimelineEntityType,
  purchaseAuditActionLabel,
  PURCHASE_AUDIT_ACTION,
  TIMELINE_ENTITY_MAP,
} from '../src/modules/purchase/shared/purchase-audit.js'

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
})
