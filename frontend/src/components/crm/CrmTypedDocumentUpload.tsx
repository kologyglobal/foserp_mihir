import { useMemo, useState } from 'react'
import { ErpSmartSelect } from '../erp/ErpSmartSelect'
import {
  ErpDocumentUpload,
  type ErpDocumentFileMeta,
} from '../erp/ErpDocumentUpload'
import { getDocumentUploadCategory } from '../../config/documentUploadCategories'
import { useDocumentTypeOptions } from '../../hooks/useCrmMasters'
import { useCrmMasterStore } from '../../store/crmMasterStore'
import type { CrmTypedAttachment } from '../../types/crmDocuments'
import {
  documentTypeUploadHint,
  mimeTypesForExtensions,
  parseAllowedFileTypes,
} from '../../utils/crmDocumentUploadUtils'
import { cn } from '../../utils/cn'

export interface CrmTypedDocumentUploadProps {
  attachments: CrmTypedAttachment[]
  onChange: (attachments: CrmTypedAttachment[]) => void
  disabled?: boolean
  className?: string
  /** Prefer a category preset when no master type selected yet. */
  defaultCategory?: string
}

function toMeta(att: CrmTypedAttachment): ErpDocumentFileMeta {
  return {
    id: att.id,
    fileName: att.fileName,
    mimeType: att.mimeType,
    sizeBytes: att.sizeBytes,
    previewUrl: att.previewUrl,
    documentTypeCode: att.documentTypeCode,
    documentTypeName: att.documentTypeName,
    uploadedAt: att.uploadedAt,
    category: att.documentTypeCode || 'crm-attachment',
    uploadStatus: 'uploaded',
    downloadUrl: att.previewUrl,
  }
}

function toAttachment(meta: ErpDocumentFileMeta, fallbackType?: { code: string; name: string }): CrmTypedAttachment {
  return {
    id: meta.id,
    documentTypeCode: meta.documentTypeCode || fallbackType?.code || '',
    documentTypeName: meta.documentTypeName || fallbackType?.name || '',
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    previewUrl: meta.previewUrl ?? null,
    uploadedAt: meta.uploadedAt || new Date().toISOString(),
  }
}

export function CrmTypedDocumentUpload({
  attachments,
  onChange,
  disabled = false,
  className,
  defaultCategory = 'general_document',
}: CrmTypedDocumentUploadProps) {
  const documentTypeOptions = useDocumentTypeOptions()
  const getByCode = useCrmMasterStore((s) => s.getByCode)
  const [selectedTypeCode, setSelectedTypeCode] = useState('')

  const selectedType = selectedTypeCode ? getByCode('document-types', selectedTypeCode) : undefined
  const category = getDocumentUploadCategory(selectedTypeCode || defaultCategory)

  const allowedExtensions = useMemo(() => {
    if (selectedType) return parseAllowedFileTypes(selectedType.attributes.fileTypes)
    return category?.acceptedExtensions ?? []
  }, [selectedType, category])

  const acceptedMimeTypes = useMemo(() => {
    if (selectedType) return mimeTypesForExtensions(allowedExtensions)
    return category?.acceptedMimeTypes ?? []
  }, [selectedType, allowedExtensions, category])

  const maxFileSizeMb = selectedType
    ? Number(selectedType.attributes.maxSizeMb) || category?.maxFileSizeMb || 10
    : category?.maxFileSizeMb || 10

  const typeSelectOptions = useMemo(
    () =>
      documentTypeOptions.map((o) => ({
        value: o.value,
        label: o.label,
        searchText: o.label.toLowerCase(),
      })),
    [documentTypeOptions],
  )

  const files = useMemo(() => attachments.map(toMeta), [attachments])

  return (
    <div className={cn('crm-typed-doc-upload col-span-2', className)}>
      <div className="crm-typed-doc-upload__type-row">
        <label className="crm-typed-doc-upload__label">
          Attachment type <span className="text-red-600">*</span>
        </label>
        <ErpSmartSelect
          options={typeSelectOptions}
          value={selectedTypeCode}
          onChange={(v) => setSelectedTypeCode(v ?? '')}
          placeholder="Choose from Document Type / Attachment Master…"
          appearance="dropdown"
          disabled={disabled}
          allowEmpty
        />
        {selectedType ? (
          <p className="crm-typed-doc-upload__hint">{documentTypeUploadHint(selectedType)}</p>
        ) : (
          <p className="crm-typed-doc-upload__hint crm-typed-doc-upload__hint--muted">
            Select an attachment type to enable upload. Types are managed in CRM Document Type / Attachment Master.
          </p>
        )}
      </div>

      <ErpDocumentUpload
        category={category?.code || selectedTypeCode || defaultCategory}
        acceptedMimeTypes={acceptedMimeTypes}
        acceptedExtensions={allowedExtensions}
        maxFileSizeMb={maxFileSizeMb}
        maxFiles={50}
        allowPreview
        allowRemove
        allowDownload
        files={files}
        onChange={(next) => {
          const fallback = selectedType
            ? { code: selectedType.code, name: selectedType.name }
            : category?.documentTypeCode
              ? { code: category.documentTypeCode, name: category.label }
              : undefined
          onChange(next.map((m) => toAttachment(m, fallback)))
        }}
        disabled={disabled || !selectedType}
        documentTypeCode={selectedType?.code ?? category?.documentTypeCode}
        documentTypeName={selectedType?.name ?? category?.label}
        hint={
          selectedType
            ? documentTypeUploadHint(selectedType)
            : 'Document type master controls allowed formats and size'
        }
        dropzoneTitle={
          selectedType ? 'Drag and drop or click to upload' : 'Select document type first'
        }
      />
    </div>
  )
}
