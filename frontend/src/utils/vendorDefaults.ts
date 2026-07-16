import type { Vendor } from '../types/master'
import { panFromGstin } from './customerUtils'
import { previewNextCode } from '../services/codeSeriesService'

export function enrichVendorWithDefaults(vendor: Vendor): Vendor {
  const gstin = vendor.gstin?.trim().toUpperCase() ?? ''
  const pan = vendor.pan?.trim().toUpperCase() || (gstin.length === 15 ? panFromGstin(gstin) : '')
  return {
    ...vendor,
    searchName: vendor.searchName?.trim() || vendor.vendorName.toUpperCase().slice(0, 20),
    isBlocked: vendor.isBlocked ?? false,
    address: vendor.address ?? '',
    address2: vendor.address2 ?? '',
    pincode: vendor.pincode ?? '',
    country: vendor.country ?? 'India',
    email: vendor.email ?? '',
    gstVendorType: vendor.gstVendorType ?? (gstin ? 'registered' : 'unregistered'),
    pan,
    panStatus: vendor.panStatus ?? (pan ? 'pan_applied' : 'pan_not_available'),
    paymentMethod: vendor.paymentMethod ?? 'NEFT',
    bankDetails: vendor.bankDetails ?? '',
    vendorType: vendor.vendorType ?? 'manufacturer',
    contactPerson: vendor.contactPerson ?? '',
    paymentTermsDays: vendor.paymentTermsDays ?? 30,
    defaultLeadTimeDays: vendor.defaultLeadTimeDays ?? 7,
    suppliedCategories: vendor.suppliedCategories ?? [],
    rating: vendor.rating ?? 4,
  }
}

export function suggestVendorCode(_vendors: Vendor[]): string {
  return previewNextCode('vendor')
}
