/**
 * QR code utilities — payload build, validation, and image generation.
 * QR-first traceability; wraps qrPayload + qrcode package.
 */
import QRCode from 'qrcode'
import type { QrEntityType, QrPayload } from '../types/qrTraceability'
import { buildQrPayload, parseQrPayload, isQrEntityType } from './qrPayload'

export type QrCodeMetadata = Partial<{
  wo: string
  item: string
  batch: string
  grn: string
  vendor: string
  trailer: string
  chassis: string
}>

export function generateQrPayload(
  entityType: QrEntityType,
  entityId: string,
  metadata: QrCodeMetadata = {},
): QrPayload {
  return {
    type: entityType,
    id: entityId,
    ...metadata,
  }
}

export function generateQrCodeValue(payload: QrPayload | string): string {
  if (typeof payload === 'string') return buildQrPayload({ type: 'MATERIAL_LOT', id: payload })
  return buildQrPayload(payload)
}

export async function generateQrImageDataUrl(
  payload: QrPayload | string,
  size = 256,
): Promise<string> {
  const value = typeof payload === 'string' ? payload : generateQrCodeValue(payload)
  return QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
}

export function validateQrPayload(qrValue: string): { ok: true; payload: QrPayload } | { ok: false; error: string } {
  const payload = parseQrPayload(qrValue)
  if (!payload) return { ok: false, error: 'Invalid QR payload — expected JSON with type and id' }
  if (!isQrEntityType(payload.type)) return { ok: false, error: `Unknown entity type: ${payload.type}` }
  if (!payload.id.trim()) return { ok: false, error: 'QR payload id is required' }
  return { ok: true, payload }
}

export { buildQrPayload, parseQrPayload, isQrEntityType }
