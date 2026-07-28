import type { ReactNode } from 'react'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { PageBackLink } from '@/components/ui/PageBackLink'
import {
  handlePurchasePdfDownload,
  printPurchaseDocument,
} from '@/utils/purchaseDocumentPdfExport'
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
}

/**
 * Shared print-ready document chrome for purchase (and similar) letterheads.
 * Print uses the browser dialog; Download PDF captures `.po-print-doc` via jsPDF.
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
}: DocumentPrintShellProps) {
  const fileName = pdfFileName?.trim() || `${title.trim() || 'Document'}.pdf`

  return (
    <div className={cn('po-print-page erp-page', className)}>
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
        </div>
        <ErpButtonGroup className="po-print-toolbar__actions">
          <ErpButton
            type="button"
            variant="secondary"
            icon={Printer}
            onClick={() => printPurchaseDocument({ fileName })}
          >
            Print
          </ErpButton>
          <ErpButton
            type="button"
            variant="secondary"
            icon={Download}
            onClick={() => void handlePurchasePdfDownload(fileName)}
          >
            Download PDF
          </ErpButton>
          {extraActions}
        </ErpButtonGroup>
      </div>

      <div className="po-print-stage">{children}</div>
    </div>
  )
}
