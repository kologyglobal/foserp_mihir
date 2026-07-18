import { useEffect, useMemo, useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { Modal } from '../../design-system/components/Modal'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import {
  ErpDocumentUpload,
  type ErpDocumentFileMeta,
} from '../erp/ErpDocumentUpload'
import { ErpSmartSelect } from '../erp/ErpSmartSelect'
import { Input, Textarea } from '../forms/Inputs'
import { CommercialTermSelect } from '../masters/GeographySelects'
import {
  DOCUMENT_UPLOAD_CATEGORIES,
  getDocumentUploadCategory,
} from '../../config/documentUploadCategories'
import { useDocumentTypeOptions } from '../../hooks/useCrmMasters'
import { useCrmMasterStore } from '../../store/crmMasterStore'
import { formatCurrency } from '../../utils/formatters/currency'
import {
  documentTypeUploadHint,
  mimeTypesForExtensions,
  parseAllowedFileTypes,
} from '../../utils/crmDocumentUploadUtils'
import type { SalesOrder } from '../../types/mrp'

/** Default Document Type master code for SO confirmation (Customer PO). */
export const SO_CONFIRM_DEFAULT_DOC_TYPE = 'customer_po'

const CUSTOMER_PO_CATEGORY = DOCUMENT_UPLOAD_CATEGORIES.customer_po

export type SalesOrderConfirmValues = {
  customerPoNumber: string
  customerPoDate: string
  paymentTerms: string
  deliveryTerms: string
  requiredDate: string
  directSoReason: string
  documentTypeCode: string
  documentFile: File | null
}

export function buildSalesOrderConfirmDefaults(order: SalesOrder): Omit<SalesOrderConfirmValues, 'documentFile'> {
  return {
    customerPoNumber: order.customerPoNumber?.trim() ?? '',
    customerPoDate: order.customerPoDate?.slice(0, 10) ?? '',
    paymentTerms: order.paymentTerms?.trim() || '30% advance, balance before dispatch',
    deliveryTerms: order.deliveryTerms?.trim() || 'Ex-works',
    requiredDate: order.requiredDate?.slice(0, 10) ?? order.expectedDeliveryDate?.slice(0, 10) ?? '',
    directSoReason: order.directSoReason?.trim() ?? '',
    documentTypeCode: SO_CONFIRM_DEFAULT_DOC_TYPE,
  }
}

export function needsDirectSoReason(order: SalesOrder): boolean {
  const quotationBacked = Boolean(order.quotationId)
  const directOrder = order.source === 'direct' || Boolean(order.directSoReason?.trim())
  return directOrder && !quotationBacked
}

export function validateSalesOrderConfirmValues(
  order: SalesOrder,
  values: SalesOrderConfirmValues,
): string[] {
  const errors: string[] = []
  if (!values.customerPoNumber.trim()) errors.push('Customer PO number is required.')
  if (!values.paymentTerms.trim()) errors.push('Payment terms are required.')
  if (!values.deliveryTerms.trim()) errors.push('Delivery terms are required.')
  if (!values.documentTypeCode.trim()) errors.push('Document type is required.')
  if (!values.documentFile) errors.push('Upload the customer PO document (JPG or PDF).')
  if (needsDirectSoReason(order) && !values.directSoReason.trim()) {
    errors.push('Direct sales orders require a justification before confirmation.')
  }
  const grand = order.grandTotal != null ? Number(order.grandTotal) : 0
  if (!(grand > 0) && !(order.qty > 0 && (order.unitPrice ?? 0) > 0)) {
    errors.push('Grand total must be greater than zero before confirmation.')
  }
  return errors
}

interface SalesOrderConfirmDialogProps {
  open: boolean
  order: SalesOrder | null
  customerName?: string
  isSubmitting?: boolean
  onClose: () => void
  onConfirm: (values: SalesOrderConfirmValues) => void | Promise<void>
}

export function SalesOrderConfirmDialog({
  open,
  order,
  customerName,
  isSubmitting = false,
  onClose,
  onConfirm,
}: SalesOrderConfirmDialogProps) {
  const documentTypeOptions = useDocumentTypeOptions()
  const getByCode = useCrmMasterStore((s) => s.getByCode)

  const [values, setValues] = useState<SalesOrderConfirmValues>(() => ({
    ...(order
      ? buildSalesOrderConfirmDefaults(order)
      : buildSalesOrderConfirmDefaults({} as SalesOrder)),
    documentFile: null,
  }))
  const [localError, setLocalError] = useState<string | null>(null)
  const [stagedDocs, setStagedDocs] = useState<ErpDocumentFileMeta[]>([])

  useEffect(() => {
    if (!open || !order) return
    const defaults = buildSalesOrderConfirmDefaults(order)
    const activeCodes = useCrmMasterStore
      .getState()
      .entries.filter((e) => e.kind === 'document-types' && e.status === 'active')
      .map((e) => e.code)
    const hasDefaultType = activeCodes.includes(defaults.documentTypeCode)
    setValues({
      ...defaults,
      documentTypeCode: hasDefaultType
        ? defaults.documentTypeCode
        : (activeCodes[0] ?? defaults.documentTypeCode),
      documentFile: null,
    })
    setStagedDocs([])
    setLocalError(null)
  }, [open, order])

  const requireDirectReason = useMemo(() => (order ? needsDirectSoReason(order) : false), [order])

  const selectedType = values.documentTypeCode
    ? getByCode('document-types', values.documentTypeCode)
    : undefined
  const category =
    getDocumentUploadCategory(values.documentTypeCode) ?? CUSTOMER_PO_CATEGORY
  const allowedExtensions = useMemo(
    () =>
      selectedType
        ? parseAllowedFileTypes(selectedType.attributes.fileTypes)
        : category.acceptedExtensions,
    [selectedType, category],
  )
  const acceptedMimeTypes = useMemo(
    () =>
      selectedType
        ? mimeTypesForExtensions(allowedExtensions)
        : category.acceptedMimeTypes,
    [selectedType, allowedExtensions, category],
  )
  const maxFileSizeMb = selectedType
    ? Number(selectedType.attributes.maxSizeMb) || category.maxFileSizeMb
    : category.maxFileSizeMb

  const typeSelectOptions = useMemo(
    () =>
      documentTypeOptions.map((o) => ({
        value: o.value,
        label: o.label,
        searchText: o.label.toLowerCase(),
      })),
    [documentTypeOptions],
  )

  if (!order) return null

  function patch(partial: Partial<SalesOrderConfirmValues>) {
    setValues((prev) => ({ ...prev, ...partial }))
    setLocalError(null)
  }

  async function handleSubmit() {
    const errors = validateSalesOrderConfirmValues(order!, values)
    if (errors.length) {
      setLocalError(errors[0] ?? 'Complete required fields.')
      return
    }
    await onConfirm(values)
  }

  const valueLabel =
    order.grandTotal != null && Number(order.grandTotal) > 0
      ? formatCurrency(Number(order.grandTotal))
      : '—'

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={isSubmitting}
      title="Confirm sales order"
      description="Review commercial details, then lock terms and move to Confirmed."
      size="md"
      footer={
        <ErpButtonGroup className="justify-end">
          <ErpButton type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </ErpButton>
          <ErpButton
            type="button"
            variant="primary"
            icon={CheckCircle}
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Confirming…' : 'Confirm order'}
          </ErpButton>
        </ErpButtonGroup>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-erp-border bg-erp-surface-alt/50 px-3 py-2.5 text-[12px]">
          <p className="font-semibold text-erp-text">
            {order.salesOrderNo}
            {customerName ? ` · ${customerName}` : ''}
          </p>
          <p className="mt-0.5 text-erp-muted">
            Order value {valueLabel} · Status moves from Draft → Confirmed
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-1">
            <span className="text-[12px] font-semibold text-erp-text">
              Customer PO <span className="text-erp-danger">*</span>
            </span>
            <Input
              value={values.customerPoNumber}
              onChange={(e) => patch({ customerPoNumber: e.target.value })}
              placeholder="e.g. PO/2026/1842"
              autoFocus
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-semibold text-erp-text">Customer PO date</span>
            <Input
              type="date"
              value={values.customerPoDate}
              onChange={(e) => patch({ customerPoDate: e.target.value })}
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-[12px] font-semibold text-erp-text">
              Payment terms <span className="text-erp-danger">*</span>
            </span>
            <CommercialTermSelect
              termType="payment"
              value={values.paymentTerms}
              onChange={(v) => patch({ paymentTerms: v })}
              placeholder="Select payment terms"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-[12px] font-semibold text-erp-text">
              Delivery terms <span className="text-erp-danger">*</span>
            </span>
            <CommercialTermSelect
              termType="delivery"
              value={values.deliveryTerms}
              onChange={(v) => patch({ deliveryTerms: v })}
              placeholder="Select delivery terms"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-[12px] font-semibold text-erp-text">Required / delivery date</span>
            <Input
              type="date"
              value={values.requiredDate}
              onChange={(e) => patch({ requiredDate: e.target.value })}
            />
          </label>
          {requireDirectReason ? (
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-[12px] font-semibold text-erp-text">
                Direct SO justification <span className="text-erp-danger">*</span>
              </span>
              <Textarea
                rows={2}
                value={values.directSoReason}
                onChange={(e) => patch({ directSoReason: e.target.value })}
                placeholder="Why is this order created without a quotation?"
              />
            </label>
          ) : null}

          <div className="space-y-1.5 sm:col-span-2">
            <span className="text-[12px] font-semibold text-erp-text">
              Document type <span className="text-erp-danger">*</span>
            </span>
            <ErpSmartSelect
              options={typeSelectOptions}
              value={values.documentTypeCode}
              onChange={(v) => {
                patch({ documentTypeCode: v ?? '', documentFile: null })
                setStagedDocs([])
              }}
              placeholder="Choose from Document Type Master…"
              appearance="dropdown"
              disabled={isSubmitting}
            />
            {selectedType ? (
              <p className="text-[11px] text-erp-muted">{documentTypeUploadHint(selectedType)}</p>
            ) : (
              <p className="text-[11px] text-erp-muted">
                Types are managed in CRM → Document Type / Attachment Master.
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <span className="text-[12px] font-semibold text-erp-text">
              Customer PO document <span className="text-erp-danger">*</span>
            </span>
            <ErpDocumentUpload
              category={category.code}
              acceptedMimeTypes={acceptedMimeTypes}
              acceptedExtensions={allowedExtensions}
              maxFileSizeMb={maxFileSizeMb}
              maxFiles={1}
              allowPreview
              allowRemove
              allowDownload
              files={stagedDocs}
              onChange={(next) => {
                setStagedDocs(next)
                patch({ documentFile: next[0]?.file ?? null })
              }}
              disabled={isSubmitting || !selectedType}
              documentTypeCode={values.documentTypeCode || category.documentTypeCode}
              documentTypeName={selectedType?.name ?? category.label}
              hint={
                selectedType
                  ? documentTypeUploadHint(selectedType)
                  : 'Select a document type to enable upload'
              }
              dropzoneTitle={
                selectedType
                  ? `Upload ${selectedType.name} (${allowedExtensions.map((e) => e.toUpperCase()).join(', ')})`
                  : 'Select document type first'
              }
              hideDropzoneWhenFull
            />
          </div>
        </div>

        {localError ? (
          <p className="rounded-md border border-erp-danger/30 bg-erp-danger/5 px-3 py-2 text-[12px] text-erp-danger">
            {localError}
          </p>
        ) : (
          <p className="text-[12px] text-erp-muted">
            Confirmation locks commercial terms and enables MRP / production planning.
          </p>
        )}
      </div>
    </Modal>
  )
}
