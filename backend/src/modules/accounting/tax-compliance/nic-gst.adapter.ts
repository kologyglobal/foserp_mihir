/**
 * NIC / GST portal adapter interface.
 * Default implementation is SIMULATED — deterministic local IRN/EWB generation.
 * Swap via GST_NIC_PROVIDER=live later without changing callers.
 *
 * Live NIC must follow current official GST / NIC e-Way Bill API specs
 * (auth, encryption, error codes). Do not treat EWB number as a free-text field.
 */
import { createHash, randomBytes } from 'crypto'

export type NicProviderMode = 'SIMULATED' | 'LIVE'

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
}

let cached: NicGstAdapter | null = null

/** Resolve adapter — only SIMULATED is shipped; LIVE throws until configured. */
export function getNicGstAdapter(): NicGstAdapter {
  if (cached) return cached
  const mode = (process.env.GST_NIC_PROVIDER ?? 'SIMULATED').toUpperCase()
  if (mode === 'LIVE') {
    throw new Error(
      'GST_NIC_PROVIDER=LIVE is not configured — live NIC auth/encryption must follow current official GST specs',
    )
  }
  cached = new SimulatedNicAdapter()
  return cached
}

/** Test helper — clear cached adapter between suites. */
export function resetNicGstAdapterCache(): void {
  cached = null
}
