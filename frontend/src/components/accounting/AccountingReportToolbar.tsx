import { Download, Printer, RefreshCw } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { notify } from '../../store/toastStore'

interface AccountingReportToolbarProps {
  asOfDate: string
  onAsOfDateChange: (date: string) => void
  fromDate?: string
  onFromDateChange?: (date: string) => void
  reportName: string
  onRefresh?: () => void
  extra?: React.ReactNode
}

/** Common toolbar for Accounting financial reports — period range, refresh, export, print. */
export function AccountingReportToolbar({
  asOfDate,
  onAsOfDateChange,
  fromDate,
  onFromDateChange,
  reportName,
  onRefresh,
  extra,
}: AccountingReportToolbarProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-erp-border bg-erp-surface px-3 py-2.5">
      <div className="flex flex-wrap items-end gap-3">
        {onFromDateChange ? (
          <label className="flex flex-col gap-1 text-[11px] font-medium text-erp-muted">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              className="h-8 rounded-md border border-erp-border px-2 text-[13px]"
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-[11px] font-medium text-erp-muted">
          {onFromDateChange ? 'To' : 'As of'}
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => onAsOfDateChange(e.target.value)}
            className="h-8 rounded-md border border-erp-border px-2 text-[13px]"
          />
        </label>
        {extra}
      </div>
      <ErpButtonGroup>
        <ErpButton
          type="button"
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          onClick={() => {
            onRefresh?.()
            notify.info(`${reportName} refreshed`)
          }}
        >
          Refresh
        </ErpButton>
        <ErpButton
          type="button"
          variant="secondary"
          size="sm"
          icon={Download}
          onClick={() => notify.success(`Exported ${reportName} (demo)`)}
        >
          Export
        </ErpButton>
        <ErpButton type="button" variant="outline" size="sm" icon={Printer} onClick={() => window.print()}>
          Print
        </ErpButton>
      </ErpButtonGroup>
    </div>
  )
}
