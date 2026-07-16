import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw, Upload } from 'lucide-react'
import { TaxComplianceShell, TaxStatusBadge } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getGstr2bLines,
  importGstr2bPreview,
  loadPeriodFilter,
} from '@/services/accounting/taxComplianceService'
import type { Gstr2bLine, PeriodFilterState } from '@/types/taxCompliance'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'

export function Gstr2bImportPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [lines, setLines] = useState<Gstr2bLine[]>([])
  const [imported, setImported] = useState(false)
  const [fileName, setFileName] = useState('gstr2b-jun2026-demo.json')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getGstr2bLines(filter)
      setLines(res.lines)
      setImported(res.imported)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const onImport = async () => {
    if (!perms.canGstReconcile) {
      notify.error('Permission denied for GSTR-2B import preview.')
      return
    }
    setBusy(true)
    try {
      const res = await importGstr2bPreview(fileName)
      notify.success(`Imported ${res.importedCount} GSTR-2B lines from “${res.fileName}” (demo preview — not GST portal).`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <TaxComplianceShell
      title="GSTR-2B"
      description="Import wizard for offline/demo GSTR-2B extract. Does not download from GST portal."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'import',
            label: busy ? 'Importing…' : 'Import Preview File',
            icon: Upload,
            disabled: busy || !perms.canGstReconcile,
            onClick: () => void onImport(),
          }}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'export',
              label: 'Export Preview',
              icon: Download,
              onClick: () => notify.info('Placeholder export — use ITC workbench for matched extract.'),
            },
          ]}
        />
      }
    >
      <ol className="mb-3 list-decimal space-y-1 pl-4 text-[12px] text-erp-muted">
        <li>Obtain GSTR-2B JSON/CSV offline from your GST practice tooling.</li>
        <li>Enter demo file name below and run Import Preview (session only).</li>
        <li>Review lines, then continue to ITC Reconciliation — no auto-accept of low confidence.</li>
      </ol>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
          Demo file name
          <input
            className="h-8 w-72 rounded border border-erp-border px-2 text-[12px]"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            aria-label="GSTR-2B demo file name"
          />
        </label>
        <TaxStatusBadge status={imported ? 'Ready for Review' : 'Open'} />
      </div>
      {loading ? (
        <LoadingState />
      ) : (
        <div className="overflow-auto rounded border border-erp-border">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-erp-surface text-[11px] font-semibold uppercase text-erp-muted">
              <tr>
                <th className="px-2 py-1.5">Supplier</th>
                <th className="px-2 py-1.5">GSTIN</th>
                <th className="px-2 py-1.5">Invoice</th>
                <th className="px-2 py-1.5">Date</th>
                <th className="px-2 py-1.5 text-right">Taxable</th>
                <th className="px-2 py-1.5 text-right">Tax</th>
                <th className="px-2 py-1.5">ITC</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-erp-border/70">
                  <td className="px-2 py-1.5">{l.supplierName}</td>
                  <td className="px-2 py-1.5">{l.supplierGstin}</td>
                  <td className="px-2 py-1.5">{l.invoiceNo}</td>
                  <td className="px-2 py-1.5">{formatDate(l.invoiceDate)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(l.taxableValue)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(l.igst + l.cgst + l.sgst + l.cess)}</td>
                  <td className="px-2 py-1.5">{l.itcAvailability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TaxComplianceShell>
  )
}
