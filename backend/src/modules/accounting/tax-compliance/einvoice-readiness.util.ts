/**
 * Phase 6 — e-Invoice readiness & provider mode (pure helpers, no I/O).
 * Phase 11 — composition registration blocks IRN.
 */
import { assertCompositionAllowsEInvoice } from './gst-specials.util.js'

export type EInvoiceProviderMode = 'SIMULATED' | 'LIVE'

export type EInvoiceReadinessInput = {
  salesInvoiceStatus: string
  legalEntityGstin: string | null | undefined
  customerGstin: string | null | undefined
  invoiceNumber: string | null | undefined
  /** Phase 11 — REGULAR / COMPOSITION / … from GstRegistration.registrationType */
  sellerRegistrationScheme?: string | null | undefined
}

export type EInvoiceReadinessResult =
  | { ok: true }
  | { ok: false; code: string; message: string }

/** Resolve mode from env — prefers GST_EINVOICE_PROVIDER_MODE, falls back to GST_NIC_PROVIDER. */
export function resolveEInvoiceProviderMode(env: NodeJS.ProcessEnv = process.env): EInvoiceProviderMode {
  const raw = (
    env.GST_EINVOICE_PROVIDER_MODE ??
    env.GST_NIC_PROVIDER ??
    'SIMULATED'
  )
    .trim()
    .toUpperCase()
  return raw === 'LIVE' ? 'LIVE' : 'SIMULATED'
}

/**
 * LIVE operational readiness checklist (env only — no network).
 *
 * Core FOS does **not** ship a certified NIC/GSP HTTP client. Even with all env vars set,
 * `ready` stays false until a build provides `GST_EINVOICE_HTTP_TRANSPORT_READY=true`
 * from an integrated connector package (post-UAT).
 */
export function assertLiveEInvoiceConfigured(env: NodeJS.ProcessEnv = process.env): {
  ready: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.GST_EINVOICE_LIVE_UAT_CERTIFIED !== 'true') {
    blockers.push(
      'GST_EINVOICE_LIVE_UAT_CERTIFIED must be "true" after certified NIC/GSP UAT (never default)',
    )
  }
  const required = [
    'GST_EINVOICE_API_BASE_URL',
    'GST_EINVOICE_USERNAME',
    'GST_EINVOICE_PASSWORD',
    'GST_EINVOICE_CLIENT_ID',
    'GST_EINVOICE_CLIENT_SECRET',
  ] as const
  for (const key of required) {
    if (!env[key]?.trim()) blockers.push(`Missing env ${key} for LIVE e-invoice`)
  }
  if (env.GST_EINVOICE_HTTP_TRANSPORT_READY !== 'true') {
    blockers.push(
      'GST_EINVOICE_HTTP_TRANSPORT_READY is not true — core build has no certified NIC/GSP HTTP transport (SIMULATED only until UAT connector is integrated)',
    )
  }
  return { ready: blockers.length === 0, blockers }
}

/** Canonical SI pre-checks for IRN (B2B only in this phase). */
export function checkEInvoiceReadiness(input: EInvoiceReadinessInput): EInvoiceReadinessResult {
  if (input.salesInvoiceStatus !== 'POSTED') {
    return {
      ok: false,
      code: 'NOT_POSTED',
      message: 'Only posted sales invoices can generate an e-invoice',
    }
  }
  if (!input.legalEntityGstin?.trim()) {
    return {
      ok: false,
      code: 'LE_GSTIN',
      message: 'Legal entity GSTIN is required to generate an e-invoice',
    }
  }
  if (!input.customerGstin?.trim()) {
    return {
      ok: false,
      code: 'BUYER_GSTIN',
      message: 'Customer GSTIN is required for B2B e-invoice generation',
    }
  }
  if (!input.invoiceNumber?.trim()) {
    return {
      ok: false,
      code: 'INVOICE_NUMBER',
      message: 'Posted sales invoice number is required before IRN generation',
    }
  }
  const composition = assertCompositionAllowsEInvoice({
    sellerRegistrationScheme: input.sellerRegistrationScheme,
  })
  if (!composition.allowed) {
    return {
      ok: false,
      code: composition.code,
      message: composition.message,
    }
  }
  return { ok: true }
}

export type EInvoiceRowLifecycle = {
  status: string
  irn: string | null
  idempotencyKey?: string | null
}

/**
 * Decide generate action for an existing register row (or none).
 * Never silently re-issue IRN for CANCELLED.
 */
export function planEInvoiceGenerate(args: {
  existing: EInvoiceRowLifecycle | null
  requestIdempotencyKey?: string | null
}): {
  action: 'IDEMPOTENT_RETURN' | 'RETRY' | 'CREATE' | 'BLOCK'
  reason?: string
} {
  const { existing, requestIdempotencyKey } = args
  if (!existing) return { action: 'CREATE' }
  if (existing.status === 'GENERATED' && existing.irn) {
    if (
      requestIdempotencyKey &&
      existing.idempotencyKey &&
      requestIdempotencyKey !== existing.idempotencyKey
    ) {
      return {
        action: 'BLOCK',
        reason: 'Sales invoice already has a generated IRN under a different idempotency key',
      }
    }
    return { action: 'IDEMPOTENT_RETURN' }
  }
  if (existing.status === 'CANCELLED') {
    return {
      action: 'BLOCK',
      reason: 'Previous IRN was cancelled — create a revised invoice before regenerating',
    }
  }
  if (existing.status === 'EXCEPTION' || existing.status === 'PENDING') {
    return { action: 'RETRY' }
  }
  return { action: 'CREATE' }
}
