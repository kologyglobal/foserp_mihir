import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listPaymentBatches, type HrSalaryPaymentBatch } from '@/services/api/hrmsApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { HrEmptyState, HrRegisterShell, HrStatusChip } from '../components'
import '../hrms-ui.css'

/** Thin cross-run register — click through to the payroll run for full batch actions (approve/confirm/export). */
export function SalaryPaymentsPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrSalaryPaymentBatch[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await listPaymentBatches({ limit: 100 })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payment batches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (!perms.canViewSalaryPayment) {
    return (
      <OperationalPageShell title="Salary Payments" breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Salary Payments' }]}>
        <HrEmptyState icon={Banknote} title="No access" description="Requires salary payment view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Salary Payments"
      description="Payment batches generated from payroll runs — open a batch's payroll run to approve, confirm, or export."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Payroll', to: '/hrms/payroll/runs' }, { label: 'Salary Payments' }]}
    >
      <ErpCommandBar secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />
      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState icon={Banknote} title="No payment batches" description="Create one from a payroll run once finalized." />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Payment Date</th>
                <th>Employees</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Pending</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} onClick={() => navigate(`/hrms/payroll/runs/${b.payrollRunId}`)}>
                  <td className="font-medium text-erp-primary">{b.code}</td>
                  <td className="tabular-nums">{b.paymentDate}</td>
                  <td className="tabular-nums">{b.employeeCount}</td>
                  <td className="tabular-nums">{formatCurrency(b.totalAmount)}</td>
                  <td className="tabular-nums">{formatCurrency(b.paidAmount)}</td>
                  <td className="tabular-nums">{formatCurrency(b.pendingAmount)}</td>
                  <td>
                    <HrStatusChip status={b.status} domain="salaryPaymentBatch" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HrRegisterShell>
    </OperationalPageShell>
  )
}
