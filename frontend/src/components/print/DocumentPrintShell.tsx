import type { ReactNode } from 'react'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import {
  handlePurchasePdfDownload,
  printPurchaseDocument,
} from '@/utils/purchaseDocumentPdfExport'
import {
  PURCHASE_PDF_SIZE_LOCK_NOTE,
  purchasePrintOrientation,
  type PurchasePrintDocumentKind,
  type PurchasePrintOrientationLocked,
} from '@/utils/purchasePrintFormat'
import { cn } from '@/utils/cn'

export type DocumentPrintShellProps = {
  title: string
  subtitle: string
  backLabel?: string
  /** Prefer route-based back (aligned PageBackLink above the toolbar). */
  backTo?: string
  /** Fallback when `backTo` is not provided. */
  onBack?: () => void
  children: ReactNode
  className?: string
  /** Extra toolbar actions (Excel export, etc.) */
  extraActions?: ReactNode
  /** Suggested PDF file name (without requiring .pdf). */
  pdfFileName?: string
  /**
   * Purchase document kind — drives locked A4 orientation
   * (GRN = landscape; PO/Invoice/PR/RFQ/Return = portrait).
   */
  documentKind?: PurchasePrintDocumentKind
  /** Explicit orientation when documentKind is not enough. */
  orientation?: PurchasePrintOrientationLocked
}

/**
 * Shared print-ready document chrome for purchase (and similar) letterheads.
 * Print / PDF are always A4; orientation is fixed by document type.
 */
export function DocumentPrintShell({
  title,
  subtitle,
  backLabel = 'Back',
  backTo,
  onBack,
  children,
  className,
  extraActions,
  pdfFileName,
  documentKind = 'generic',
  orientation: orientationProp,
}: DocumentPrintShellProps) {
  const fileName = pdfFileName?.trim() || `${title.trim() || 'Document'}.pdf`
  const orientation = orientationProp ?? purchasePrintOrientation(documentKind)
  const printOpts = { fileName, documentKind, orientation }

  return (
    <div
      className={cn(
        'po-print-page erp-page',
        orientation === 'landscape' && 'po-print-page--landscape',
        className,
      )}
      data-print-paper="A4"
      data-print-orientation={orientation}
    >
      {backTo ? (
        <PageBackLink to={backTo} label={backLabel} className="po-print-back no-print" />
      ) : onBack ? (
        <div className="po-print-back no-print">
          <ErpButton type="button" variant="ghost" icon={ArrowLeft} onClick={onBack}>
            {backLabel}
          </ErpButton>
        </div>
      ) : null}

      <div className="po-print-toolbar no-print">
        <div className="po-print-toolbar__copy">
          <p className="po-print-toolbar__title">{title}</p>
          <p className="po-print-toolbar__subtitle">{subtitle}</p>
          <p className="po-print-toolbar__format" title={PURCHASE_PDF_SIZE_LOCK_NOTE}>
            Format: A4 {orientation === 'landscape' ? 'Landscape' : 'Portrait'} (fixed)
          </p>
        </div>
        <ErpButtonGroup className="po-print-toolbar__actions">
          <ErpButton
            type="button"
            variant="secondary"
            icon={Printer}
            onClick={() => printPurchaseDocument(printOpts)}
          >
            Print
          </ErpButton>
          <ErpButton
            type="button"
            variant="secondary"
            icon={Download}
            onClick={() => void handlePurchasePdfDownload(fileName, printOpts)}
          >
            Download PDF
          </ErpButton>
          {extraActions}
        </ErpButtonGroup>
      </div>

      <div className="po-print-stage">
        <div
          className={cn(
            orientation === 'landscape' && 'po-print-doc-wrap--landscape',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
