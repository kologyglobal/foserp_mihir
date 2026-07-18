/**
 * Reusable document-upload category presets for `ErpDocumentUpload`.
 * Codes that match CRM Document Type master (`document-types`) share the same code
 * (e.g. `customer_po`, `drawing`, `general` ↔ `general_document`).
 *
 * Max sizes align with CRM masters / `CRM_MAX_UPLOAD_BYTES` (default 25 MB).
 */

export type DocumentUploadCategoryCode =
  | 'customer_po'
  | 'image'
  | 'excel'
  | 'drawing'
  | 'general_document'
  | 'quotation_attachment'

export type DocumentUploadCategory = {
  code: DocumentUploadCategoryCode
  label: string
  acceptedMimeTypes: string[]
  acceptedExtensions: string[]
  maxFileSizeMb: number
  /** CRM `document-types` master code when this category maps 1:1. */
  documentTypeCode?: string
}

/** Preset map — use `getDocumentUploadCategory` at call sites. */
export const DOCUMENT_UPLOAD_CATEGORIES: Record<DocumentUploadCategoryCode, DocumentUploadCategory> = {
  customer_po: {
    code: 'customer_po',
    label: 'Customer PO',
    acceptedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxFileSizeMb: 10,
    documentTypeCode: 'customer_po',
  },
  image: {
    code: 'image',
    label: 'Image',
    acceptedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFileSizeMb: 10,
    documentTypeCode: 'site_photo',
  },
  excel: {
    code: 'excel',
    label: 'Excel',
    acceptedExtensions: ['xls', 'xlsx', 'csv'],
    acceptedMimeTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv',
    ],
    maxFileSizeMb: 10,
  },
  drawing: {
    code: 'drawing',
    label: 'Drawing',
    acceptedExtensions: ['pdf', 'dwg', 'dxf', 'jpg', 'png'],
    acceptedMimeTypes: [
      'application/pdf',
      'application/acad',
      'application/x-dwg',
      'image/vnd.dwg',
      'application/dxf',
      'image/vnd.dxf',
      'image/jpeg',
      'image/png',
      'application/octet-stream',
    ],
    maxFileSizeMb: 25,
    documentTypeCode: 'drawing',
  },
  general_document: {
    code: 'general_document',
    label: 'General Document',
    acceptedExtensions: ['pdf', 'doc', 'docx'],
    acceptedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxFileSizeMb: 10,
    documentTypeCode: 'general',
  },
  quotation_attachment: {
    code: 'quotation_attachment',
    label: 'Quotation Attachment',
    acceptedExtensions: ['pdf', 'xlsx', 'docx'],
    acceptedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxFileSizeMb: 10,
  },
}

const ALIASES: Record<string, DocumentUploadCategoryCode> = {
  general: 'general_document',
  site_photo: 'image',
  quotation_pdf: 'quotation_attachment',
}

export function getDocumentUploadCategory(code: string): DocumentUploadCategory | undefined {
  const normalized = code.trim().toLowerCase()
  if (!normalized) return undefined
  const aliased = ALIASES[normalized]
  if (aliased) return DOCUMENT_UPLOAD_CATEGORIES[aliased]
  if (normalized in DOCUMENT_UPLOAD_CATEGORIES) {
    return DOCUMENT_UPLOAD_CATEGORIES[normalized as DocumentUploadCategoryCode]
  }
  return undefined
}

/** Props slice ready to spread into `ErpDocumentUpload`. */
export function documentUploadCategoryProps(code: DocumentUploadCategoryCode | string) {
  const cat = getDocumentUploadCategory(code)
  if (!cat) return null
  return {
    category: cat.code,
    acceptedMimeTypes: cat.acceptedMimeTypes,
    acceptedExtensions: cat.acceptedExtensions,
    maxFileSizeMb: cat.maxFileSizeMb,
    documentTypeCode: cat.documentTypeCode,
    documentTypeName: cat.label,
  }
}
