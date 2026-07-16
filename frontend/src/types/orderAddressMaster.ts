import type { MasterRecordAudit } from './master'

/** BC Order Address — alternate ship-to / order-from address per vendor */
export interface VendorOrderAddress extends MasterRecordAudit {
  id: string
  vendorId: string
  /** Order address code (max 10) */
  code: string
  name: string
  address: string
  address2?: string
  state: string
  city: string
  postCode: string
  country: string
  gstin: string
  phone: string
  email: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}
