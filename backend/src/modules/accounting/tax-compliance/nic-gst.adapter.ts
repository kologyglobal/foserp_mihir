/**
 * NIC / GST portal adapter interface.
 * Default implementation is SIMULATED — deterministic local IRN/EWB generation.
 * Swap via GST_NIC_PROVIDER=live later without changing callers.
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
}

export interface NicEwbRequest {
  sellerGstin: string
  buyerGstin: string | null
  documentNumber: string
  documentDate: string
  fromPlace: string
  toPlace: string
  distanceKm: number
  vehicleNumber: string | null
  taxableAmount: string
}

export interface NicEwbResult {
  ewbNumber: string
  validUpto: Date
  providerRef: string
  providerMode: NicProviderMode
}

export interface NicGstAdapter {
  readonly mode: NicProviderMode
  generateIrn(input: NicIrnRequest): Promise<NicIrnResult>
  cancelIrn(irn: string, reason: string): Promise<{ cancelledAt: Date; providerRef: string }>
  generateEwb(input: NicEwbRequest): Promise<NicEwbResult>
  cancelEwb(ewbNumber: string, reason: string): Promise<{ cancelledAt: Date; providerRef: string }>
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
    }
  }

  async cancelIrn(irn: string, reason: string): Promise<{ cancelledAt: Date; providerRef: string }> {
    return {
      cancelledAt: new Date(),
      providerRef: `SIM-IRN-CANCEL-${hashToken([irn, reason], 10)}`,
    }
  }

  async generateEwb(input: NicEwbRequest): Promise<NicEwbResult> {
    const ewbNumber = `EWB${hashToken(
      [input.sellerGstin, input.documentNumber, input.documentDate, input.toPlace, 'EWB'],
      12,
    )}`
    const validUpto = new Date()
    validUpto.setDate(validUpto.getDate() + 1)
    return {
      ewbNumber,
      validUpto,
      providerRef: `SIM-EWB-${randomBytes(4).toString('hex')}`,
      providerMode: this.mode,
    }
  }

  async cancelEwb(ewbNumber: string, reason: string): Promise<{ cancelledAt: Date; providerRef: string }> {
    return {
      cancelledAt: new Date(),
      providerRef: `SIM-EWB-CANCEL-${hashToken([ewbNumber, reason], 10)}`,
    }
  }
}

let cached: NicGstAdapter | null = null

/** Resolve adapter — only SIMULATED is shipped; LIVE throws until configured. */
export function getNicGstAdapter(): NicGstAdapter {
  if (cached) return cached
  const mode = (process.env.GST_NIC_PROVIDER ?? 'SIMULATED').toUpperCase()
  if (mode === 'LIVE') {
    throw new Error('GST_NIC_PROVIDER=LIVE is not configured in this build — use SIMULATED')
  }
  cached = new SimulatedNicAdapter()
  return cached
}
