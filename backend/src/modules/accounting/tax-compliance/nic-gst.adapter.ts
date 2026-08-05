/**
 * NIC / GST portal adapter interface.
 * Default: SIMULATED — deterministic local IRN/EWB generation.
 *
 * Mode resolution (Phase 6):
 *   GST_EINVOICE_PROVIDER_MODE = SIMULATED | LIVE   (preferred)
 *   GST_NIC_PROVIDER            = SIMULATED | LIVE   (legacy fallback)
 *
 * LIVE requires UAT certification flag + credentials + explicit HTTP transport opt-in.
 * See `einvoice-readiness.util.ts` / `docs/tax/PHASE6_EINVOICE.md`.
 */
import { createHash, randomBytes } from 'crypto'
import {
  assertLiveEInvoiceConfigured,
  resolveEInvoiceProviderMode,
  type EInvoiceProviderMode,
} from './einvoice-readiness.util.js'

export type NicProviderMode = EInvoiceProviderMode

export interface NicIrnRequest {
  sellerGstin: string
  buyerGstin: string | null
  invoiceNumber: string
  invoiceDate: string
  taxableAmount: string
  taxAmount: string
  totalAmount: string
}

export interface NicIrnResult {
  irn: string
  ackNo: string
  ackDate: Date
  qrPayload: string
  providerRef: string
  providerMode: NicProviderMode
  requestSnapshot?: Record<string, unknown>
  responseSnapshot?: Record<string, unknown>
}

export interface NicEwbRequest {
  sellerGstin: string
  buyerGstin: string | null
  documentType: 'INV' | 'CHL' | 'BIL' | 'OTH'
  documentNumber: string
  documentDate: string
  fromPlace: string
  toPlace: string
  distanceKm: number
  vehicleNumber: string | null
  transporterId: string | null
  transporterName: string | null
  taxableAmount: string
  transportMode?: '1' | '2' | '3' | '4'
  movementReason?: string | null
}

export interface NicEwbResult {
  ewbNumber: string
  validUpto: Date
  generatedAt: Date
  providerRef: string
  providerMode: NicProviderMode
  requestSnapshot: Record<string, unknown>
  responseSnapshot: Record<string, unknown>
}

export interface NicEwbVehicleUpdateRequest {
  ewbNumber: string
  vehicleNumber: string
  fromPlace?: string | null
  reasonCode?: string | null
}

export interface NicEwbExtendRequest {
  ewbNumber: string
  /** Hours to add to current validity (SIMULATED cap applied in product util). */
  extensionHours: number
  currentValidUpto: Date
  reason?: string | null
}

export interface NicGstAdapter {
  readonly mode: NicProviderMode
  generateIrn(input: NicIrnRequest): Promise<NicIrnResult>
  cancelIrn(irn: string, reason: string): Promise<{
    cancelledAt: Date
    providerRef: string
    requestSnapshot: Record<string, unknown>
    responseSnapshot: Record<string, unknown>
  }>
  generateEwb(input: NicEwbRequest): Promise<NicEwbResult>
  cancelEwb(ewbNumber: string, reason: string): Promise<{
    cancelledAt: Date
    providerRef: string
    requestSnapshot: Record<string, unknown>
    responseSnapshot: Record<string, unknown>
  }>
  updateEwbVehicle(input: NicEwbVehicleUpdateRequest): Promise<{
    updatedAt: Date
    providerRef: string
    requestSnapshot: Record<string, unknown>
    responseSnapshot: Record<string, unknown>
  }>
  extendEwb(input: NicEwbExtendRequest): Promise<{
    validUpto: Date
    providerRef: string
    requestSnapshot: Record<string, unknown>
    responseSnapshot: Record<string, unknown>
  }>
}

function hashToken(parts: string[], bytes = 32): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, bytes).toUpperCase()
}

export class SimulatedNicAdapter implements NicGstAdapter {
  readonly mode: NicProviderMode = 'SIMULATED'

  async generateIrn(input: NicIrnRequest): Promise<NicIrnResult> {
    const irn = hashToken(
      [input.sellerGstin, input.invoiceNumber, input.invoiceDate, input.totalAmount, 'IRN'],
      64,
    )
    const ackNo = `ACK${hashToken([irn, 'ACK'], 12)}`
    const ackDate = new Date()
    const requestSnapshot = { ...input, mode: this.mode }
    const responseSnapshot = { irn, ackNo, ackDate: ackDate.toISOString(), status: 'ACT', mode: this.mode }
    return {
      irn,
      ackNo,
      ackDate,
      qrPayload: JSON.stringify({
        irn,
        ackNo,
        sellerGstin: input.sellerGstin,
        buyerGstin: input.buyerGstin,
        docNo: input.invoiceNumber,
        mode: 'SIMULATED',
      }),
      providerRef: `SIM-IRN-${randomBytes(4).toString('hex')}`,
      providerMode: this.mode,
      requestSnapshot,
      responseSnapshot,
    }
  }

  async cancelIrn(irn: string, reason: string) {
    const requestSnapshot = { irn, reason, mode: this.mode }
    const cancelledAt = new Date()
    const responseSnapshot = { irn, cancelledAt: cancelledAt.toISOString(), status: 'CNL', mode: this.mode }
    return {
      cancelledAt,
      providerRef: `SIM-IRN-CANCEL-${hashToken([irn, reason], 10)}`,
      requestSnapshot,
      responseSnapshot,
    }
  }

  async generateEwb(input: NicEwbRequest): Promise<NicEwbResult> {
    const ewbNumber = `EWB${hashToken(
      [input.sellerGstin, input.documentNumber, input.documentDate, input.toPlace, 'EWB'],
      12,
    )}`
    const generatedAt = new Date()
    const validUpto = new Date(generatedAt)
    validUpto.setDate(validUpto.getDate() + 1)
    const requestSnapshot = { ...input, mode: this.mode }
    const responseSnapshot = {
      ewbNo: ewbNumber,
      ewayBillDate: generatedAt.toISOString(),
      validUpto: validUpto.toISOString(),
      status: 'ACT',
      mode: this.mode,
    }
    return {
      ewbNumber,
      validUpto,
      generatedAt,
      providerRef: `SIM-EWB-${randomBytes(4).toString('hex')}`,
      providerMode: this.mode,
      requestSnapshot,
      responseSnapshot,
    }
  }

  async cancelEwb(ewbNumber: string, reason: string) {
    const cancelledAt = new Date()
    const requestSnapshot = { ewbNumber, reason, mode: this.mode }
    const responseSnapshot = {
      ewbNo: ewbNumber,
      cancelledAt: cancelledAt.toISOString(),
      status: 'CNL',
      mode: this.mode,
    }
    return {
      cancelledAt,
      providerRef: `SIM-EWB-CANCEL-${hashToken([ewbNumber, reason], 10)}`,
      requestSnapshot,
      responseSnapshot,
    }
  }

  async updateEwbVehicle(input: NicEwbVehicleUpdateRequest) {
    const updatedAt = new Date()
    const requestSnapshot = { ...input, mode: this.mode }
    const responseSnapshot = {
      ewbNo: input.ewbNumber,
      vehicleNo: input.vehicleNumber,
      updatedAt: updatedAt.toISOString(),
      status: 'ACT',
      mode: this.mode,
    }
    return {
      updatedAt,
      providerRef: `SIM-EWB-VEH-${hashToken([input.ewbNumber, input.vehicleNumber], 10)}`,
      requestSnapshot,
      responseSnapshot,
    }
  }

  async extendEwb(input: NicEwbExtendRequest) {
    const hours = Math.min(Math.max(input.extensionHours, 1), 24)
    const validUpto = new Date(input.currentValidUpto)
    validUpto.setHours(validUpto.getHours() + hours)
    const requestSnapshot = {
      ewbNumber: input.ewbNumber,
      extensionHours: hours,
      currentValidUpto: input.currentValidUpto.toISOString(),
      reason: input.reason ?? null,
      mode: this.mode,
    }
    const responseSnapshot = {
      ewbNo: input.ewbNumber,
      validUpto: validUpto.toISOString(),
      status: 'ACT',
      mode: this.mode,
    }
    return {
      validUpto,
      providerRef: `SIM-EWB-EXT-${hashToken([input.ewbNumber, String(hours)], 10)}`,
      requestSnapshot,
      responseSnapshot,
    }
  }
}

/**
 * LIVE adapter shell — refuses all calls unless fully gated.
 * Real NIC/GSP HTTP is intentionally not embedded; enable only after certified UAT.
 */
export class LiveNicAdapter implements NicGstAdapter {
  readonly mode: NicProviderMode = 'LIVE'

  private refuse(operation: string): never {
    const { ready, blockers } = assertLiveEInvoiceConfigured()
    if (!ready) {
      throw new Error(
        `GST e-invoice LIVE (${operation}) blocked: ${blockers.join('; ')}. Keep GST_EINVOICE_PROVIDER_MODE=SIMULATED until portal UAT.`,
      )
    }
    // Defensive: core factory should never reach here without a plugged-in LiveHttp adapter.
    throw new Error(
      `GST e-invoice LIVE (${operation}): gates passed but no Live HTTP adapter factory is registered in this process.`,
    )
  }

  async generateIrn(_input: NicIrnRequest): Promise<NicIrnResult> {
    this.refuse('generateIrn')
  }

  async cancelIrn(_irn: string, _reason: string) {
    this.refuse('cancelIrn')
  }

  async generateEwb(_input: NicEwbRequest): Promise<NicEwbResult> {
    this.refuse('generateEwb')
  }

  async cancelEwb(_ewbNumber: string, _reason: string) {
    this.refuse('cancelEwb')
  }

  async updateEwbVehicle(_input: NicEwbVehicleUpdateRequest) {
    this.refuse('updateEwbVehicle')
  }

  async extendEwb(_input: NicEwbExtendRequest) {
    this.refuse('extendEwb')
  }
}

let cached: NicGstAdapter | null = null

/** Resolve adapter — SIMULATED default; LIVE uses gated LiveNicAdapter. */
export function getNicGstAdapter(): NicGstAdapter {
  if (cached) return cached
  const mode = resolveEInvoiceProviderMode()
  cached = mode === 'LIVE' ? new LiveNicAdapter() : new SimulatedNicAdapter()
  return cached
}

/** Current resolved mode (for APIs / status banners). */
export function getEInvoiceProviderMode(): NicProviderMode {
  return resolveEInvoiceProviderMode()
}

/** Test helper — clear cached adapter between suites. */
export function resetNicGstAdapterCache(): void {
  cached = null
}
