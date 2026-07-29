/** Compose a multi-line vendor mailing address for document forms. */
export function formatVendorAddress(
  vendor:
    | {
        address?: string | null
        address2?: string | null
        city?: string | null
        state?: string | null
        pincode?: string | null
        country?: string | null
      }
    | null
    | undefined,
): string {
  if (!vendor) return ''
  const cityStatePin = [vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ')
  const lines = [
    vendor.address?.trim(),
    vendor.address2?.trim(),
    cityStatePin || undefined,
    vendor.country?.trim() && vendor.country !== 'India' ? vendor.country.trim() : undefined,
  ].filter(Boolean) as string[]
  return lines.join('\n')
}

/** Single-line variant for dense grids / factboxes. */
export function formatVendorAddressInline(
  vendor: Parameters<typeof formatVendorAddress>[0],
): string {
  return formatVendorAddress(vendor).replace(/\n+/g, ', ')
}
