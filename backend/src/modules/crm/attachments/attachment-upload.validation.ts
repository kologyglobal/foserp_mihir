/**
 * Backend MIME / size validation for CRM entity attachments.
 * Validates against Document Type master `fileTypes` + `maxSizeMb`,
 * capped by `CRM_MAX_UPLOAD_BYTES`.
 */

import { env } from '../../../config/env.js'
import { ValidationError } from '../../../utils/errors.js'

/** Extension → accepted MIME types (browsers vary; include common aliases). */
export const EXT_TO_MIME: Record<string, string[]> = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  csv: ['text/csv', 'application/csv', 'text/plain'],
  txt: ['text/plain'],
  eml: ['message/rfc822'],
  dwg: ['application/acad', 'application/x-dwg', 'image/vnd.dwg', 'application/octet-stream'],
  dxf: ['application/dxf', 'image/vnd.dxf', 'application/octet-stream', 'text/plain'],
  zip: ['application/zip', 'application/x-zip-compressed'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
}

/** Absolute ceiling of MIME types the platform accepts (independent of master). */
export const GLOBAL_ALLOWED_MIME = new Set(
  Object.values(EXT_TO_MIME)
    .flat()
    .map((m) => m.toLowerCase()),
)

export function fileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : ''
}

export function parseFileTypesAttribute(fileTypes: unknown): string[] {
  if (typeof fileTypes !== 'string' || !fileTypes.trim()) return []
  return fileTypes
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean)
}

export function parseMaxSizeMbAttribute(maxSizeMb: unknown, fallback = 10): number {
  const n = typeof maxSizeMb === 'number' ? maxSizeMb : Number(maxSizeMb)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

export function mimeTypesForExtensions(extensions: string[]): Set<string> {
  const set = new Set<string>()
  for (const ext of extensions) {
    for (const mime of EXT_TO_MIME[ext.toLowerCase()] ?? []) {
      set.add(mime.toLowerCase())
    }
  }
  return set
}

export type AttachmentUploadCheckInput = {
  originalFilename: string
  mimeType: string
  sizeBytes: number
  /** Master `fileTypes` CSV (empty = use global MIME allowlist only). */
  allowedExtensions: string[]
  /** Master max size in MB (before global cap). */
  maxSizeMb: number
  /** Override for tests; defaults to env.CRM_MAX_UPLOAD_BYTES. */
  globalMaxBytes?: number
  documentTypeLabel?: string
}

/**
 * Throws ValidationError (400) when MIME, extension, or size is invalid.
 */
export function assertAttachmentUploadAllowed(input: AttachmentUploadCheckInput): void {
  const label = input.documentTypeLabel?.trim() || 'this document type'
  const mime = (input.mimeType || '').trim().toLowerCase()
  const ext = fileExtension(input.originalFilename)
  const allowedExt = input.allowedExtensions.map((e) => e.replace(/^\./, '').toLowerCase()).filter(Boolean)
  const globalMax = input.globalMaxBytes ?? env.CRM_MAX_UPLOAD_BYTES
  const typeMaxBytes = Math.round(input.maxSizeMb * 1024 * 1024)
  const maxBytes = Math.min(typeMaxBytes, globalMax)
  const maxMbDisplay = Math.round(maxBytes / (1024 * 1024))

  if (!mime) {
    throw new ValidationError('File type is required', [
      { field: 'mimeType', message: 'MIME type is required' },
    ])
  }

  if (!GLOBAL_ALLOWED_MIME.has(mime)) {
    throw new ValidationError(`File type “${mime}” is not allowed`, [
      { field: 'mimeType', message: `MIME type “${mime}” is not allowed` },
    ])
  }

  if (allowedExt.length > 0) {
    if (!ext || !allowedExt.includes(ext)) {
      throw new ValidationError(
        `“${input.originalFilename}” is not allowed for ${label}. Accepted: ${allowedExt.map((e) => `.${e}`).join(', ')}`,
        [
          {
            field: 'originalFilename',
            message: `Accepted extensions: ${allowedExt.map((e) => `.${e}`).join(', ')}`,
          },
        ],
      )
    }
    const allowedMime = mimeTypesForExtensions(allowedExt)
    // octet-stream is only OK when the extension is in the allow-list (CAD files).
    if (!allowedMime.has(mime)) {
      throw new ValidationError(
        `MIME type “${mime}” is not allowed for ${label}`,
        [{ field: 'mimeType', message: `MIME type “${mime}” is not allowed for ${label}` }],
      )
    }
  }

  if (input.sizeBytes <= 0) {
    throw new ValidationError('File is empty', [{ field: 'contentBase64', message: 'File is empty' }])
  }

  if (input.sizeBytes > maxBytes) {
    throw new ValidationError(`File exceeds maximum size of ${maxMbDisplay} MB for ${label}`, [
      { field: 'contentBase64', message: `Maximum size is ${maxMbDisplay} MB` },
    ])
  }
}
