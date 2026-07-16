import type { QrEntityType, QrPayload } from '../types/qrTraceability'

export function buildQrPayload(input: QrPayload): string {
  const compact: Record<string, string> = { type: input.type, id: input.id }
  if (input.wo) compact.wo = input.wo
  if (input.item) compact.item = input.item
  if (input.batch) compact.batch = input.batch
  if (input.grn) compact.grn = input.grn
  if (input.vendor) compact.vendor = input.vendor
  if (input.trailer) compact.trailer = input.trailer
  if (input.chassis) compact.chassis = input.chassis
  return JSON.stringify(compact)
}

export function parseQrPayload(raw: string): QrPayload | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as Partial<QrPayload>
    if (!parsed.type || !parsed.id) return null
    return parsed as QrPayload
  } catch {
    return null
  }
}

export function isQrEntityType(value: string): value is QrEntityType {
  return [
    'ITEM_BATCH',
    'GRN_LINE',
    'MATERIAL_LOT',
    'SUB_ASSEMBLY',
    'WORK_ORDER',
    'JOB_CARD',
    'JOB_WORK_ORDER',
    'FINISHED_TRAILER',
    'DISPATCH',
  ].includes(value)
}
