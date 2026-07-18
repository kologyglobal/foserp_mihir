import type { CrmMasterEntry } from '../types/crmMasters'

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  eml: 'message/rfc822',
  dwg: 'application/acad',
  dxf: 'application/dxf',
  zip: 'application/zip',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export function parseAllowedFileTypes(fileTypes: string | number | boolean | null | undefined): string[] {
  if (!fileTypes || typeof fileTypes !== 'string') return []
  return fileTypes.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

export function buildAcceptAttribute(extensions: string[]): string {
  const parts = new Set<string>()
  for (const ext of extensions) {
    const mime = EXT_MIME[ext]
    if (mime) parts.add(mime)
    parts.add(`.${ext}`)
  }
  return Array.from(parts).join(',')
}

/** MIME types implied by extension list (unknown extensions omitted). */
export function mimeTypesForExtensions(extensions: string[]): string[] {
  const mimes = new Set<string>()
  for (const ext of extensions) {
    const mime = EXT_MIME[ext.toLowerCase()]
    if (mime) mimes.add(mime)
  }
  return Array.from(mimes)
}

export function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

export type ErpUploadValidationOptions = {
  acceptedExtensions: string[]
  acceptedMimeTypes?: string[]
  maxFileSizeMb: number
  /** Label used in error copy (document type name, category, etc.) */
  label?: string
}

/** Validate MIME + extension + size for reusable ErpDocumentUpload. */
export function validateErpUploadFile(
  file: File,
  opts: ErpUploadValidationOptions,
): string | null {
  const label = opts.label?.trim() || 'upload'
  const allowedExt = opts.acceptedExtensions.map((e) => e.replace(/^\./, '').toLowerCase()).filter(Boolean)
  const allowedMime = (opts.acceptedMimeTypes ?? []).map((m) => m.toLowerCase()).filter(Boolean)
  const maxMb = opts.maxFileSizeMb > 0 ? opts.maxFileSizeMb : 10
  const ext = fileExtension(file.name)
  const mime = (file.type || '').toLowerCase()

  if (allowedExt.length > 0 && !allowedExt.includes(ext)) {
    return `“${file.name}” is not allowed for ${label}. Accepted: ${allowedExt.map((e) => `.${e}`).join(', ')}`
  }
  if (allowedMime.length > 0 && mime && !allowedMime.includes(mime)) {
    return `“${file.name}” has an unsupported type (${file.type || 'unknown'}) for ${label}.`
  }
  if (file.size > maxMb * 1024 * 1024) {
    return `“${file.name}” exceeds the ${maxMb} MB limit for ${label}.`
  }
  return null
}

export function validateCrmUploadFile(file: File, docType: CrmMasterEntry): string | null {
  const allowed = parseAllowedFileTypes(docType.attributes.fileTypes)
  return validateErpUploadFile(file, {
    acceptedExtensions: allowed,
    acceptedMimeTypes: mimeTypesForExtensions(allowed),
    maxFileSizeMb: Number(docType.attributes.maxSizeMb) || 10,
    label: docType.name,
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isPreviewableImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function isPreviewablePdf(mimeType: string, fileName: string): boolean {
  return mimeType === 'application/pdf' || fileExtension(fileName) === 'pdf'
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function documentTypeUploadHint(docType: CrmMasterEntry): string {
  const allowed = parseAllowedFileTypes(docType.attributes.fileTypes)
  const maxMb = Number(docType.attributes.maxSizeMb) || 10
  const typesLabel = allowed.length ? allowed.map((e) => `.${e}`).join(', ') : 'Any file type'
  const requiredFor = docType.attributes.requiredFor
  const req = requiredFor ? ` · Required for ${requiredFor}` : ''
  return `${typesLabel} · up to ${maxMb} MB${req}`
}
