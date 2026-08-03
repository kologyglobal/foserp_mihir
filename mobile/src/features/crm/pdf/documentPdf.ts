import { axiosInstance, ensureFreshAccessToken } from '@/api/client'
import { env } from '@/config/env'
import { useSessionStore } from '@/store/sessionStore'
import * as FileSystem from 'expo-file-system'
import { ApiError } from '@/api/errors'
import { entityAttachmentDownloadPath, listEntityAttachments } from '@/api/crmApi'
import type { CrmAttachment } from '@/types/crm'
import { pickPdfAttachment } from '@/features/crm/pdf/pickPdfAttachment'

export { pickPdfAttachment }

/**
 * Download authenticated binary path to a local cache file.
 * Does not log body content.
 */
export async function downloadAuthenticatedFile(
  apiPath: string,
  filename: string,
): Promise<{ uri: string; mimeType: string }> {
  if (!useSessionStore.getState().isOnline) {
    throw new ApiError('You are offline. Connect to download this document.', {
      status: 0,
      kind: 'network',
    })
  }

  await ensureFreshAccessToken()
  const session = useSessionStore.getState().session
  if (!session?.accessToken) {
    throw new ApiError('Session expired. Sign in again.', {
      status: 401,
      kind: 'session_expired',
    })
  }

  const url = `${env.apiBaseUrl}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`
  try {
    const res = await axiosInstance.get(url, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: 'application/pdf,application/octet-stream,*/*',
      },
      transformResponse: [(data) => data],
      validateStatus: () => true,
    })

    if (res.status === 401 || res.status === 403) {
      throw new ApiError(
        res.status === 403 ? 'You do not have permission to view this PDF.' : 'Session expired.',
        { status: res.status, kind: res.status === 403 ? 'unknown' : 'session_expired' },
      )
    }
    if (res.status === 404) {
      throw new ApiError('PDF is not available on the server for this document.', {
        status: 404,
      })
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ApiError(`Download failed (${res.status})`, { status: res.status })
    }

    const mime =
      String(res.headers['content-type'] || 'application/pdf').split(';')[0] || 'application/pdf'
    const dir = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}pdfs/`
    const dirInfo = await FileSystem.getInfoAsync(dir)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }
    const safe = filename.replace(/[^\w.\-]+/g, '_')
    const uri = `${dir}${Date.now()}_${safe}`
    // Convert ArrayBuffer to base64 without logging
    const bytes = new Uint8Array(res.data as ArrayBuffer)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    // btoa may be missing on RN — use FileSystem encoding via base64 from buffer polyfill-free:
    const base64 = globalThis.btoa ? globalThis.btoa(binary) : arrayBufferToBase64(bytes)
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: (FileSystem as { EncodingType?: { Base64: string } }).EncodingType?.Base64 ?? 'base64',
    } as FileSystem.WritingOptions)

    return { uri, mimeType: mime }
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError('Download failed. Try again when online.', { kind: 'network' })
  }
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0
    const b1 = bytes[i + 1] ?? 0
    const b2 = bytes[i + 2] ?? 0
    const n = (b0 << 16) | (b1 << 8) | b2
    result += chars[(n >> 18) & 63]! + chars[(n >> 12) & 63]! + chars[(n >> 6) & 63]! + chars[n & 63]!
  }
  if (i < bytes.length) {
    const a = bytes[i] ?? 0
    const b = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0
    const n = (a << 16) | (b << 8)
    result +=
      chars[(n >> 18) & 63]! +
      chars[(n >> 12) & 63]! +
      (i + 1 < bytes.length ? chars[(n >> 6) & 63]! : '=') +
      '='
  }
  return result
}

export type DocumentPdfEntity = 'quotation' | 'sales_order'

/**
 * Resolve server-stored PDF for quotation/SO via entity attachments.
 * Mobile never generates PDFs.
 */
export async function resolveDocumentPdf(
  entity: DocumentPdfEntity,
  entityId: string,
): Promise<{ uri: string; mimeType: string; filename: string; attachmentId: string }> {
  const entityType = entity === 'quotation' ? 'QUOTATION' : 'SALES_ORDER'
  // Prefer QUOTATION entity; fall back if SO attachments not used
  let files: CrmAttachment[] = []
  try {
    files = (await listEntityAttachments(entityType, entityId)).data ?? []
  } catch {
    if (entity === 'sales_order') {
      files = (await listEntityAttachments('QUOTATION', entityId)).data ?? []
    } else {
      throw new ApiError('Could not list document attachments.', { status: 500 })
    }
  }

  const pdf = pickPdfAttachment(files)
  if (!pdf) {
    throw new ApiError(
      'PDF unavailable. Export the document to DMS from web (quotation_pdf) before viewing on mobile.',
      { status: 404 },
    )
  }

  const path = entityAttachmentDownloadPath(pdf.id)
  const file = await downloadAuthenticatedFile(
    path,
    pdf.originalFilename || `${entity}.pdf`,
  )
  return {
    ...file,
    filename: pdf.originalFilename || `${entity}.pdf`,
    attachmentId: pdf.id,
  }
}
