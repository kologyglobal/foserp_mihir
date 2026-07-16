import { AlertTriangle, ExternalLink } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { Modal } from '../../design-system/components'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate } from '../../utils/dates/format'
import type { useQuotationConversion } from '../../modules/crm/hooks/useQuotationConversion'

type ConversionApi = ReturnType<typeof useQuotationConversion>

export interface QuotationConversionDialogProps {
  conversion: ConversionApi
  onViewSalesOrder?: (salesOrderId: string) => void
  onStay?: () => void
}

/** Confirmation (not approval) + post-success Stay | View Sales Order. */
export function QuotationConversionDialog({
  conversion,
  onViewSalesOrder,
  onStay,
}: QuotationConversionDialogProps) {
  const {
    isOpen,
    closeConversionModal,
    dismissConversion,
    confirmConversion,
    isConverting,
    conversionError,
    preview,
    warnings,
    success,
  } = conversion

  const handleSuccessClose = () => {
    dismissConversion()
    onStay?.()
  }

  return (
    <>
      <Modal
        open={Boolean(success)}
        onClose={handleSuccessClose}
        title={success?.alreadyConverted ? 'Sales Order already exists' : 'Sales Order created'}
        size="sm"
        footer={
          success ? (
            <ErpButtonGroup className="justify-end">
              <ErpButton type="button" variant="secondary" onClick={handleSuccessClose}>
                Stay on Quotations
              </ErpButton>
              <ErpButton
                type="button"
                variant="primary"
                icon={ExternalLink}
                onClick={() => {
                  const id = success.salesOrderId
                  dismissConversion()
                  onViewSalesOrder?.(id)
                }}
              >
                View Sales Order
              </ErpButton>
            </ErpButtonGroup>
          ) : null
        }
      >
        {success ? (
          <p className="ds-type-caption text-[var(--dyn-text-muted)]">
            {success.alreadyConverted
              ? `This quotation was already converted to ${success.salesOrderNo}.`
              : `Quotation converted to ${success.salesOrderNo}. The sales order is Open (draft) — not released.`}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={isOpen && !success && Boolean(preview)}
        onClose={closeConversionModal}
        closeDisabled={isConverting}
        title="Convert to Sales Order"
        description="Create an Open sales order from this approved quotation. The linked opportunity will be marked Won."
        size="md"
        footer={
          <ErpButtonGroup className="justify-end">
            <ErpButton
              type="button"
              variant="secondary"
              onClick={closeConversionModal}
              disabled={isConverting}
            >
              Cancel
            </ErpButton>
            <ErpButton
              type="button"
              variant="primary"
              onClick={() => void confirmConversion()}
              disabled={isConverting}
            >
              {isConverting ? 'Converting…' : 'Convert to Sales Order'}
            </ErpButton>
          </ErpButtonGroup>
        }
      >
        {preview ? (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <div>
                <dt className="text-[var(--dyn-text-muted)]">Quotation</dt>
                <dd className="font-medium text-[var(--dyn-text)]">
                  {preview.quotationNo} Rev {preview.revisionNo}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--dyn-text-muted)]">Customer</dt>
                <dd className="font-medium text-[var(--dyn-text)]">{preview.customerName}</dd>
              </div>
              <div>
                <dt className="text-[var(--dyn-text-muted)]">Opportunity</dt>
                <dd className="font-medium text-[var(--dyn-text)]">{preview.opportunityName}</dd>
              </div>
              <div>
                <dt className="text-[var(--dyn-text-muted)]">Lines</dt>
                <dd className="font-medium text-[var(--dyn-text)]">{preview.lineCount}</dd>
              </div>
              <div>
                <dt className="text-[var(--dyn-text-muted)]">Grand total</dt>
                <dd className="font-medium text-[var(--dyn-text)]">
                  {formatCrmCurrency(preview.grandTotal)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--dyn-text-muted)]">Valid till</dt>
                <dd className="font-medium text-[var(--dyn-text)]">
                  {preview.validTill && preview.validTill !== '—'
                    ? formatDate(preview.validTill)
                    : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[var(--dyn-text-muted)]">Payment / Delivery</dt>
                <dd className="font-medium text-[var(--dyn-text)]">
                  {preview.paymentTerms} · {preview.deliveryTerms}
                </dd>
              </div>
            </dl>

            {warnings.length > 0 ? (
              <div
                role="status"
                className="mt-3 flex items-start gap-2 rounded-lg border border-erp-warning/30 bg-erp-warning-soft/30 px-3 py-2 text-[12px] text-erp-warning-fg"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <ul className="min-w-0 list-disc space-y-1 pl-5">
                  {warnings.map((w) => (
                    <li key={w.id}>{w.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {conversionError ? (
              <p className="mt-3 text-[13px] text-red-600" role="alert">
                {conversionError}
              </p>
            ) : null}
          </>
        ) : null}
      </Modal>
    </>
  )
}
