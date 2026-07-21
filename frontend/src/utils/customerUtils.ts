import type { Customer } from '../types/master'

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export function isValidGstin(gstin: string): boolean {
  return GSTIN_RE.test(gstin.trim().toUpperCase())
}

/**
 * Validate GSTIN when provided. Empty is allowed (optional on quick create).
 * @returns error message, or null when valid / empty.
 */
export function validateGstin(
  gstin: string | null | undefined,
  options?: { required?: boolean },
): string | null {
  const raw = String(gstin ?? '').trim().toUpperCase()
  if (!raw) {
    return options?.required ? 'GSTIN is required' : null
  }
  if (raw.length !== 15) {
    return 'GSTIN must be exactly 15 characters'
  }
  if (!/^[0-9A-Z]+$/.test(raw)) {
    return 'GSTIN must contain only letters and numbers'
  }
  if (!isValidGstin(raw)) {
    return 'Enter a valid GSTIN (e.g. 27AABCU9603R1ZM)'
  }
  return null
}

export function panFromGstin(gstin: string): string {
  const g = gstin.trim().toUpperCase()
  if (g.length !== 15) return ''
  return g.slice(2, 12)
}

export function gstStateCodeFromGstin(gstin: string): string {
  return gstin.trim().slice(0, 2)
}

function appendCountry(parts: string[], country?: string) {
  const c = country?.trim()
  if (c && c !== 'India') parts.push(c)
}

export function formatCustomerBillingAddress(
  customer: Pick<Customer, 'addressLine1' | 'addressLine2' | 'city' | 'state' | 'pincode' | 'country'>,
): string {
  const parts = [customer.addressLine1, customer.addressLine2, customer.city, customer.state, customer.pincode].filter((x): x is string => Boolean(x))
  appendCountry(parts, customer.country)
  return parts.join(', ')
}

export function formatCustomerShippingAddress(
  customer: Pick<
    Customer,
    'shippingAddress' | 'shippingAddressLine2' | 'shippingCity' | 'shippingState' | 'shippingPincode' | 'shippingCountry'
  >,
): string {
  const parts = [
    customer.shippingAddress,
    customer.shippingAddressLine2,
    customer.shippingCity,
    customer.shippingState,
    customer.shippingPincode,
  ].filter((x): x is string => Boolean(x))
  appendCountry(parts, customer.shippingCountry)
  return parts.join(', ')
}

export function formatCustomerDeliveryAddress(
  customer: Pick<
    Customer,
    'deliveryAddress' | 'deliveryAddressLine2' | 'deliveryCity' | 'deliveryState' | 'deliveryPincode' | 'deliveryCountry'
  >,
): string {
  const parts = [
    customer.deliveryAddress,
    customer.deliveryAddressLine2,
    customer.deliveryCity,
    customer.deliveryState,
    customer.deliveryPincode,
  ].filter((x): x is string => Boolean(x))
  appendCountry(parts, customer.deliveryCountry)
  return parts.join(', ')
}

export function hasCustomShippingAddress(
  customer: Pick<
    Customer,
    'shippingAddress' | 'shippingAddressLine2' | 'shippingCity' | 'shippingState' | 'shippingPincode' | 'shippingCountry'
  >,
): boolean {
  return Boolean(
    customer.shippingAddress?.trim()
    || customer.shippingAddressLine2?.trim()
    || customer.shippingCity?.trim()
    || customer.shippingState?.trim()
    || customer.shippingPincode?.trim()
    || customer.shippingCountry?.trim(),
  )
}

export function hasCustomDeliveryAddress(
  customer: Pick<
    Customer,
    'deliveryAddress' | 'deliveryAddressLine2' | 'deliveryCity' | 'deliveryState' | 'deliveryPincode' | 'deliveryCountry'
  >,
): boolean {
  return Boolean(
    customer.deliveryAddress?.trim()
    || customer.deliveryAddressLine2?.trim()
    || customer.deliveryCity?.trim()
    || customer.deliveryState?.trim()
    || customer.deliveryPincode?.trim()
    || customer.deliveryCountry?.trim(),
  )
}

export function resolveCustomerShippingAddress(
  customer: Pick<
    Customer,
    | 'addressLine1'
    | 'addressLine2'
    | 'shippingAddress'
    | 'shippingAddressLine2'
    | 'shippingCity'
    | 'shippingState'
    | 'shippingPincode'
    | 'shippingCountry'
    | 'city'
    | 'state'
    | 'pincode'
    | 'country'
  >,
): string {
  const shipping = formatCustomerShippingAddress(customer)
  if (shipping) return shipping
  return formatCustomerBillingAddress(customer)
}

export function resolveCustomerDeliveryAddress(
  customer: Pick<
    Customer,
    | 'addressLine1'
    | 'addressLine2'
    | 'shippingAddress'
    | 'shippingAddressLine2'
    | 'shippingCity'
    | 'shippingState'
    | 'shippingPincode'
    | 'shippingCountry'
    | 'deliveryAddress'
    | 'deliveryAddressLine2'
    | 'deliveryCity'
    | 'deliveryState'
    | 'deliveryPincode'
    | 'deliveryCountry'
    | 'city'
    | 'state'
    | 'pincode'
    | 'country'
  >,
): string {
  const delivery = formatCustomerDeliveryAddress(customer)
  if (delivery) return delivery
  return resolveCustomerShippingAddress(customer)
}

export function resolveCustomerCreditLimit(customer: Pick<Customer, 'creditLimit'>, estimatedLimit: number): number {
  if (customer.creditLimit != null && customer.creditLimit > 0) return customer.creditLimit
  return estimatedLimit
}
