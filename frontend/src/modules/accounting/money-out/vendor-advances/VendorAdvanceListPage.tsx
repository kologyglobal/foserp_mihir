import { VendorPaymentListPage } from '../vendor-payments/VendorPaymentListPage'

/** Vendor advances = vendor payments with paymentPurpose=ADVANCE. Reuses the payment register. */
export function VendorAdvanceListPage() {
  return <VendorPaymentListPage fixedPurpose="ADVANCE" title="Vendor Advances" />
}
