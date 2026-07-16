import { useCallback, useEffect, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import {
  createEntityAttachmentApi,
  deleteEntityAttachmentApi,
  fetchEntityAttachmentsApi,
  type CrmAttachmentDto,
} from '../services/api/crmApi'
import { apiDownloadBlob } from '../services/api/client'
import { attachmentDownloadPath } from '../services/api/crmApi'
import { formatApiError } from '../services/api/apiErrors'
import type { CrmEntityTypeApi } from '../types/crmEntity'

export const CRM_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const ALLOWED_MIME_PREFIXES = [
  'application/pdf',
  'image/',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]

export function isAllowedAttachmentFile(file: File): string | null {
  if (file.size > CRM_MAX_ATTACHMENT_BYTES) {
    return `File exceeds ${Math.round(CRM_MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB limit.`
  }
  if (!ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p) || file.type === p)) {
    return 'File type is not allowed.'
  }
  return null
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function useEntityAttachments(entityType: CrmEntityTypeApi, entityId: string | undefined) {
  const [attachments, setAttachments] = useState<CrmAttachmentDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    if (!isApiMode() || !entityId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchEntityAttachmentsApi(entityType, entityId)
      setAttachments(res.data)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const uploadFile = useCallback(
    async (file: File, documentType?: string) => {
      if (!entityId) return { ok: false as const, error: 'Entity not found' }
      const validation = isAllowedAttachmentFile(file)
      if (validation) return { ok: false as const, error: validation }

      setPending(true)
      setUploadProgress(0)
      setError(null)
      try {
        setUploadProgress(30)
        const contentBase64 = await readFileAsBase64(file)
        setUploadProgress(70)
        const res = await createEntityAttachmentApi(entityType, entityId, {
          originalFilename: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64,
          documentType,
        })
        setAttachments((prev) => [res.data, ...prev])
        return { ok: true as const }
      } catch (err) {
        const message = formatApiError(err)
        setError(message)
        return { ok: false as const, error: message }
      } finally {
        setPending(false)
        setUploadProgress(null)
      }
    },
    [entityType, entityId],
  )

  const deleteAttachment = useCallback(async (attachmentId: string) => {
    setPending(true)
    setError(null)
    try {
      await deleteEntityAttachmentApi(attachmentId)
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
      return { ok: true as const }
    } catch (err) {
      const message = formatApiError(err)
      setError(message)
      return { ok: false as const, error: message }
    } finally {
      setPending(false)
    }
  }, [])

  const downloadAttachment = useCallback(async (attachmentId: string, filename: string) => {
    try {
      const { blob } = await apiDownloadBlob(attachmentDownloadPath(attachmentId))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      return { ok: true as const }
    } catch (err) {
      const message = formatApiError(err)
      setError(message)
      return { ok: false as const, error: message }
    }
  }, [])

  return {
    attachments,
    loading,
    error,
    pending,
    uploadProgress,
    refresh,
    uploadFile,
    deleteAttachment,
    downloadAttachment,
    isApiBacked: isApiMode(),
  }
}
