/** CRM entity attachment — classified by Document Type master */

export interface CrmTypedAttachment {
  id: string
  leadId?: string | null
  opportunityId?: string | null
  contactId?: string | null
  quotationId?: string | null
  documentTypeCode: string
  documentTypeName: string
  fileName: string
  mimeType: string
  sizeBytes: number
  /** Data URL or blob URL for inline preview */
  previewUrl: string | null
  uploadedAt: string
}
