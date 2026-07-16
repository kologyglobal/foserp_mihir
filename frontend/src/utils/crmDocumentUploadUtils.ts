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
  eml: 'message/rfc822',
  dwg: 'application/acad',
  zip: 'application/zip',
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

export function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

export function validateCrmUploadFile(file: File, docType: CrmMasterEntry): string | null {
  const allowed = parseAllowedFileTypes(docType.attributes.fileTypes)
  const maxMb = Number(docType.attributes.maxSizeMb) || 10
  const ext = fileExtension(file.name)

  if (allowed.length > 0 && !allowed.includes(ext)) {
    return `“${file.name}” is not allowed for ${docType.name}. Accepted: ${allowed.map((e) => `.${e}`).join(', ')}`
  }
  if (file.size > maxMb * 1024 * 1024) {
    return `“${file.name}” exceeds the ${maxMb} MB limit for ${docType.name}.`
  }
  return null
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
