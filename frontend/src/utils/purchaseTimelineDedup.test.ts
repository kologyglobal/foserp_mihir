import { describe, expect, it } from 'vitest'
import { dedupePurchaseTimelineEvents } from './purchaseTimelineDedup'
import type { PurchaseTimelineEvent } from '@/services/purchase/purchaseTimelineApi'

function event(
  partial: Partial<PurchaseTimelineEvent> & Pick<PurchaseTimelineEvent, 'id' | 'action' | 'source'>,
): PurchaseTimelineEvent {
  return {
    tenantId: 't1',
    module: 'purchase',
    entityType: 'PurchaseRequisition',
    entityId: 'pr-1',
    actionLabel: partial.action,
    previousValue: null,
    newValue: null,
    actorId: 'user-1',
    actorName: 'Rajesh Patel',
    timestamp: '2026-08-06T09:31:00.000Z',
    remarks: null,
    requestMetadata: null,
    ...partial,
  }
}

describe('dedupePurchaseTimelineEvents', () => {
  it('merges audit + status_history for the same lifecycle moment', () => {
    const merged = dedupePurchaseTimelineEvents([
      event({
        id: 'audit:1',
        source: 'audit',
        action: 'PR_APPROVED',
        actionLabel: 'Approved',
        newValue: { status: 'APPROVED', rfqRequired: false },
      }),
      event({
        id: 'status:1',
        source: 'status_history',
        action: 'APPROVED',
        actionLabel: 'Approved',
        remarks: 'E2E approve L0',
        previousValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'APPROVED' },
      }),
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]?.remarks).toBe('E2E approve L0')
    expect(merged[0]?.newValue).toEqual({ status: 'APPROVED', rfqRequired: false })
  })

  it('merges approve pairs written a few seconds apart in the same minute', () => {
    const merged = dedupePurchaseTimelineEvents([
      event({
        id: 'status:1',
        source: 'status_history',
        action: 'APPROVED',
        actionLabel: 'Approved',
        remarks: 'Approved — no RFQ',
        timestamp: '2026-08-07T09:17:02.000Z',
        previousValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'APPROVED' },
      }),
      event({
        id: 'audit:1',
        source: 'audit',
        action: 'PR_APPROVED',
        actionLabel: 'Approved',
        timestamp: '2026-08-07T09:17:00.000Z',
        newValue: { status: 'APPROVED', rfqRequired: false },
      }),
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]?.remarks).toBe('Approved — no RFQ')
  })

  it('merges created/submitted pairs separately', () => {
    const merged = dedupePurchaseTimelineEvents([
      event({
        id: 'audit:created',
        source: 'audit',
        action: 'PR_CREATED',
        actionLabel: 'Created',
        newValue: { status: 'DRAFT', rfqRequired: false },
      }),
      event({
        id: 'status:created',
        source: 'status_history',
        action: 'CREATED',
        actionLabel: 'Created',
        newValue: { status: 'DRAFT' },
      }),
      event({
        id: 'audit:submit',
        source: 'audit',
        action: 'PR_SUBMITTED',
        actionLabel: 'Submitted',
        timestamp: '2026-08-06T10:31:00.000Z',
        previousValue: { status: 'DRAFT' },
        newValue: { status: 'PENDING_APPROVAL' },
      }),
      event({
        id: 'status:submit',
        source: 'status_history',
        action: 'SUBMITTED',
        actionLabel: 'Submitted',
        timestamp: '2026-08-06T10:31:00.000Z',
        previousValue: { status: 'DRAFT' },
        newValue: { status: 'PENDING_APPROVAL' },
      }),
    ])

    expect(merged).toHaveLength(2)
    expect(merged.map((row) => row.actionLabel).sort()).toEqual(['Created', 'Submitted'])
  })
})
