import { describe, expect, it } from 'vitest'
import {
  PURCHASE_ERROR_CODE,
  PURCHASE_ERROR_MESSAGES,
  purchaseMessage,
} from '../src/modules/purchase/shared/purchase-error-catalog.js'

describe('purchase error catalog', () => {
  it('exposes Phase 14 business messages for PR / Planning / PO', () => {
    expect(purchaseMessage(PURCHASE_ERROR_CODE.PR_DEPARTMENT_REQUIRED)).toBe('Department is required.')
    expect(purchaseMessage(PURCHASE_ERROR_CODE.PR_REQUESTED_BY_REQUIRED)).toBe('Requested By is required.')
    expect(purchaseMessage(PURCHASE_ERROR_CODE.PR_NO_LINES)).toBe('Add at least one item.')
    expect(purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_EDITABLE)).toBe('Submitted PR cannot be edited.')
    expect(purchaseMessage(PURCHASE_ERROR_CODE.PR_MUST_REOPEN)).toBe(
      'Approved PR must be reopened before amendment.',
    )
    expect(purchaseMessage(PURCHASE_ERROR_CODE.PPS_VENDOR_REQUIRED)).toBe(
      'Selected vendor is required before PO creation.',
    )
    expect(purchaseMessage(PURCHASE_ERROR_CODE.PPS_RFQ_REQUIRED)).toBe(
      'RFQ-required PR items cannot be processed from Planning.',
    )
    expect(purchaseMessage(PURCHASE_ERROR_CODE.PO_NO_ELIGIBLE_ROWS)).toBe(
      'Select at least one eligible Planning row.',
    )
    expect(purchaseMessage(PURCHASE_ERROR_CODE.PO_VENDOR_INACTIVE)).toBe('Vendor must be active.')
  })

  it('keeps every catalog code mapped', () => {
    for (const code of Object.values(PURCHASE_ERROR_CODE)) {
      expect(PURCHASE_ERROR_MESSAGES[code]).toBeTruthy()
    }
  })
})
