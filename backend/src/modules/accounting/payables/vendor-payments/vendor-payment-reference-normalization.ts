/**
 * Vendor payment reference normalisation + uniqueness key (Phase 4B3).
 *
 * The uniqueness key is a deterministic duplicate-payment guard scoped by
 * tenant + legal entity + payment method + payment account + normalised external
 * reference (bank ref / cheque number / instrument ref). CASH payments carry no
 * external reference and therefore never produce a key (multiple cash payments are legal).
 */
import type { VendorPaymentMethod } from '@prisma/client'

/** Trim, collapse repeated internal whitespace, uppercase. */
export function normalizePaymentReference(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase()
}

export interface VendorPaymentReferenceSource {
  paymentMethod: VendorPaymentMethod
  paymentAccountId?: string | null
  paymentReference?: string | null
  bankReference?: string | null
  chequeNumber?: string | null
  chequeDate?: Date | string | null
  instrumentReference?: string | null
}

function toDateKey(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

/**
 * Resolves the external (bank/instrument) reference that identifies a distinct payment.
 * Returns `null` when no external reference exists (e.g. CASH) → no uniqueness key claimed.
 */
export function resolveExternalReference(payment: VendorPaymentReferenceSource): string | null {
  switch (payment.paymentMethod) {
    case 'BANK_TRANSFER': {
      const raw = payment.bankReference || payment.paymentReference
      return raw ? normalizePaymentReference(raw) : null
    }
    case 'CHEQUE': {
      if (!payment.chequeNumber) return null
      const parts = [payment.chequeNumber, toDateKey(payment.chequeDate), payment.paymentAccountId ?? '']
      return normalizePaymentReference(parts.join(' '))
    }
    case 'UPI':
    case 'CARD': {
      const raw = payment.instrumentReference || payment.paymentReference
      return raw ? normalizePaymentReference(raw) : null
    }
    case 'OTHER': {
      const raw = payment.paymentReference
      return raw ? normalizePaymentReference(raw) : null
    }
    case 'CASH':
    default:
      return null
  }
}

export function buildPaymentUniquenessKey(parts: {
  tenantId: string
  legalEntityId: string
  paymentMethod: VendorPaymentMethod
  paymentAccountId?: string | null
  normalizedExternalRef: string
}): string {
  return [
    parts.tenantId,
    parts.legalEntityId,
    parts.paymentMethod,
    parts.paymentAccountId ?? '',
    parts.normalizedExternalRef,
  ].join('|')
}

/**
 * Resolves the full uniqueness key for a payment, or `null` when the payment method /
 * data carries no external reference (CASH, or missing reference on optional methods).
 */
export function resolvePaymentUniquenessKey(params: {
  tenantId: string
  legalEntityId: string
  payment: VendorPaymentReferenceSource
}): string | null {
  const normalizedExternalRef = resolveExternalReference(params.payment)
  if (!normalizedExternalRef) return null
  return buildPaymentUniquenessKey({
    tenantId: params.tenantId,
    legalEntityId: params.legalEntityId,
    paymentMethod: params.payment.paymentMethod,
    paymentAccountId: params.payment.paymentAccountId ?? null,
    normalizedExternalRef,
  })
}
