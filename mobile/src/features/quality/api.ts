import { apiClient, tenantPath } from '@/api/client'

export interface QcKioskQueueItem {
  id: string
  inspectionNumber?: string
  status?: string
  category?: string
  productionOrderNumber?: string | null
  workOrderNumber?: string | null
  stageName?: string | null
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  inspectedQty?: string | null
  requestedAt?: string
  planCode?: string | null
  planName?: string | null
  [key: string]: unknown
}

export interface QcKioskQueueResult {
  items?: QcKioskQueueItem[]
  data?: QcKioskQueueItem[]
  summary?: { openCount: number; pendingCount: number; reworkCount: number }
  [key: string]: unknown
}

/** Backend decision codes for manufacturing QC. */
export type QcDecision = 'PASS' | 'CONDITIONAL_PASS' | 'HOLD' | 'REWORK' | 'REJECT' | 'USE_AS_IS'

export interface QcPhoto {
  id: string
  inspectionId: string
  originalFilename: string
  mimeType: string
  fileSize: number
  caption: string | null
  uploadedBy: string | null
  uploadedAt: string
}

export interface DecideInspectionPayload {
  decision: QcDecision
  remarks?: string
  acceptedQty?: number
  rejectedQty?: number
  reworkQty?: number
  heldQty?: number
  scrapQty?: number
  parameterResults?: Array<Record<string, unknown>>
  [key: string]: unknown
}

function qs(params: Record<string, string | number | undefined> = {}) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export async function getQcKioskQueue(params?: { limit?: number }) {
  const res = await apiClient.get<QcKioskQueueResult | QcKioskQueueItem[]>(
    tenantPath(`/quality/kiosk/queue${qs({ limit: params?.limit ?? 50 })}`),
  )
  const data = res.data
  if (Array.isArray(data)) return { items: data, summary: undefined as QcKioskQueueResult['summary'] }
  const items = data?.items ?? data?.data ?? []
  return { items: Array.isArray(items) ? items : [], summary: data?.summary }
}

export async function getQcKioskSummary() {
  const res = await apiClient.get<{ openCount: number; pendingCount: number; reworkCount: number }>(
    tenantPath('/quality/kiosk/summary'),
  )
  return res.data
}

export async function getQcKioskInspection(id: string) {
  const res = await apiClient.get<Record<string, unknown>>(
    tenantPath(`/quality/kiosk/inspections/${id}`),
  )
  return res.data
}

/** Multipart photo upload is production-ready against QUALITY_UPLOAD_DIR storage. */
export const QC_PHOTO_UPLOAD_READY = true

export async function listQcPhotos(inspectionId: string) {
  const res = await apiClient.get<QcPhoto[]>(
    tenantPath(`/quality/kiosk/inspections/${inspectionId}/photos`),
  )
  return res.data ?? []
}

/**
 * Upload a photo file for a QC inspection.
 * field name must be `file` (multer single).
 */
export async function uploadQcPhoto(
  inspectionId: string,
  file: { uri: string; name: string; type: string },
  caption?: string,
) {
  const form = new FormData()
  // React Native FormData file shape
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob)
  if (caption?.trim()) form.append('caption', caption.trim())

  const res = await apiClient.post<QcPhoto>(
    tenantPath(`/quality/kiosk/inspections/${inspectionId}/photos`),
    form,
    { retries: 0, timeoutMs: 60_000 },
  )
  return res.data
}

export async function deleteQcPhoto(inspectionId: string, photoId: string) {
  const res = await apiClient.delete<{ id: string; deleted: boolean }>(
    tenantPath(`/quality/inspections/${inspectionId}/photos/${photoId}`),
  )
  return res.data
}

/** Map UI taps to backend decision enum. FAIL → REJECT. */
export function toBackendDecision(ui: 'PASS' | 'FAIL' | 'HOLD' | 'REWORK'): QcDecision {
  if (ui === 'FAIL') return 'REJECT'
  return ui
}

export async function decideQcKioskInspection(id: string, payload: DecideInspectionPayload) {
  const res = await apiClient.post(tenantPath(`/quality/kiosk/inspections/${id}/decide`), payload)
  return res.data
}
