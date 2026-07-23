import type { ReactNode } from 'react'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { triggerPrintPdf } from '@/utils/documentPrint'
import { cn } from '@/utils/cn'

export type DocumentPrintShellProps = {
  title: string
  subtitle: string
  backLabel?: string
  onBack: () => void
  children: ReactNode
  className?: string
  /** Extra toolbar actions (Excel export, etc.) */
  extraActions?: ReactNode
}

/**
 * Shared print-ready document chrome.
 * Print and Download PDF both open the browser print dialog (Save as PDF).
 */
export function DocumentPrintShell({
  title,
  subtitle,
  backLabel = 'Back',
  onBack,
  children,
  className,
  extraActions,
}: DocumentPrintShellProps) {
  return (
    <div className={cn('po-print-page erp-page', className)}>
      <div className="po-print-toolbar no-print">
        <div>
          <p className="po-print-toolbar__title">{title}</p>
          <p className="po-print-toolbar__subtitle">{subtitle}</p>
        </div>
        <ErpButtonGroup>
          <ErpButton type="button" variant="secondary" icon={Printer} onClick={() => triggerPrintPdf()}>
            Print
          </ErpButton>
          <ErpButton type="button" variant="secondary" icon={Download} onClick={() => triggerPrintPdf()}>
            Download PDF
          </ErpButton>
          {extraActions}
          <ErpButton type="button" variant="ghost" icon={ArrowLeft} onClick={onBack}>
            {backLabel}
          </ErpButton>
        </ErpButtonGroup>
      </div>
      {children}
    </div>
  )
}
