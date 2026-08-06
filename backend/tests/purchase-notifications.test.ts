import { describe, expect, it } from 'vitest'
import {
  PURCHASE_NOTIFICATION_TYPES,
} from '../src/modules/purchase/notifications/purchase-notification.emitters.js'
import { buildDedupKey } from '../src/modules/notifications/notification.constants.js'
import { normalizeNotificationPreferences } from '../src/modules/purchase/setup/purchase-setup.mapper.js'

describe('purchase notification prefs', () => {
  it('defaults enable in-app for core events', () => {
    const prefs = normalizeNotificationPreferences(null)
    expect(prefs.prPendingApproval.inApp).toBe(true)
    expect(prefs.poOverdue.inApp).toBe(true)
    expect(prefs.invoiceMismatch.inApp).toBe(true)
  })

  it('merges stored toggles without inventing unknown keys', () => {
    const prefs = normalizeNotificationPreferences({
      prPendingApproval: { inApp: false, email: true },
      weirdEvent: { inApp: true, email: true },
    })
    expect(prefs.prPendingApproval.inApp).toBe(false)
    expect(prefs.prPendingApproval.email).toBe(true)
    expect(prefs.rfqResponseDue.inApp).toBe(true)
  })
})

describe('purchase notification types', () => {
  it('exports stable type codes', () => {
    expect(PURCHASE_NOTIFICATION_TYPES.PR_PENDING_APPROVAL).toBe('PR_PENDING_APPROVAL')
    expect(PURCHASE_NOTIFICATION_TYPES.GRN_PENDING_INSPECTION).toBe('GRN_PENDING_INSPECTION')
  })

  it('builds per-recipient dedupe keys', () => {
    const a = buildDedupKey(['t1', 'PR_PENDING_APPROVAL', 'pr-1', 'u1'])
    const b = buildDedupKey(['t1', 'PR_PENDING_APPROVAL', 'pr-1', 'u2'])
    expect(a).not.toBe(b)
  })
})
