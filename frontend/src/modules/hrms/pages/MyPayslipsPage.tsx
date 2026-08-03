import { useEffect, useState } from 'react'
import { Download, Eye, FileText, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getPayslip, listMyPayslips, type HrPayslip, type HrPayslipDetail } from '@/services/api/hrmsApi'
import { downloadPayslipPdf } from '@/modules/hrms/payslipPdf'
import { notify } from '@/store/toastStore'
import {
  HrApprovalDrawer,
  HrEmptyState,
  HrPayslipDocument,
  HrRegisterShell,
  HrStatusChip,
} from '@/modules/hrms/components'
import '../hrms-ui.css'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function money(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

/** Self-service payslip history for the signed-in employee. */
export function MyPayslipsPage() {
  const [rows, setRows] = useState<HrPayslip[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [preview, setPreview] = useState<HrPayslipDetail | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await listMyPayslips({ limit: 100 })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payslips')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const onPreview = async (row: HrPayslip) => {
    try {
      const res = await getPayslip(row.id)
      setPreview(res.data ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payslip')
    }
  }

  const onDownload = async (row: HrPayslip) => {
    setBusyId(row.id)
    try {
      const result = await downloadPayslipPdf(row.id, `Payslip-${row.payslipNumber}`)
      if (!result.ok) notify.error(result.error)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <OperationalPageShell
      title="My Payslips"
      description="Your payslip history."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'My Payslips' }]}
    >
      <ErpCommandBar
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />

      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState
            icon={FileText}
            title="No payslips"
            description="Payslips will appear here once payroll is finalized and generated."
          />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Payslip No.</th>
                <th>Gross</th>
                <th>Deduction</th>
                <th>Net</th>
                <th>Payment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => void onPreview(r)}>
                  <td className="font-medium">
                    {MONTHS[r.month - 1]} {r.year}
                  </td>
                  <td>{r.payslipNumber}</td>
                  <td>{money(r.grossAmount)}</td>
                  <td>{money(r.deductionAmount)}</td>
                  <td className="font-medium">{money(r.netAmount)}</td>
                  <td>
                    <HrStatusChip status={r.paymentStatus} domain="paymentStatus" />
                  </td>
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => void onPreview(r)} title="Preview">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busyId === r.id}
                        onClick={() => void onDownload(r)}
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HrRegisterShell>

      <HrApprovalDrawer
        open={preview != null}
        onClose={() => setPreview(null)}
        title={preview?.payslipNumber ?? ''}
        subtitle={preview ? `${MONTHS[preview.month - 1]} ${preview.year}` : undefined}
        footer={
          preview ? (
            <>
              <button type="button" className="btn btn--primary" onClick={() => void onDownload(preview)}>
                <Download className="mr-1 h-4 w-4" />
                Download PDF
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setPreview(null)}>
                Close
              </button>
            </>
          ) : undefined
        }
      >
        {preview ? <HrPayslipDocument payslip={preview} /> : null}
      </HrApprovalDrawer>
    </OperationalPageShell>
  )
}
