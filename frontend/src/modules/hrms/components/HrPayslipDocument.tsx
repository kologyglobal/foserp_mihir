import type { HrPayslipDetail } from '@/services/api/hrmsApi'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function money(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

interface HrPayslipDocumentProps {
  payslip: HrPayslipDetail
}

/**
 * Professional payslip document preview — company identity, PAYSLIP — MONTH title,
 * employee info, attendance, earnings|deductions columns, gross/deduction/net, masked bank.
 * Mirrors the server-rendered PDF layout (see payslipPdf.ts) for on-screen preview drawers.
 */
export function HrPayslipDocument({ payslip }: HrPayslipDocumentProps) {
  const snapshot = payslip.snapshot
  const monthLabel = `${MONTHS[payslip.month - 1]} ${payslip.year}`

  if (!snapshot) {
    return <p className="text-sm text-erp-muted">Snapshot unavailable for this payslip.</p>
  }

  const { header, attendance, earnings, deductions, totals } = snapshot

  return (
    <div className="hr-payslip-doc">
      <div className="hr-payslip-doc__header">
        <div>
          <div className="hr-payslip-doc__company">{header.company}</div>
          <div className="hr-payslip-doc__meta">
            {header.branch ? `${header.branch} · ` : ''}Payslip No. {payslip.payslipNumber}
          </div>
        </div>
        <div className="hr-payslip-doc__title">
          <div className="hr-payslip-doc__title-main">Payslip — {monthLabel}</div>
          <div className="hr-payslip-doc__title-period">
            {payslip.status === 'VOID' ? 'Void' : 'Generated ' + new Date(payslip.generatedAt).toLocaleDateString('en-IN')}
          </div>
        </div>
      </div>

      <dl className="hr-payslip-doc__employee">
        <div className="hr-payslip-doc__employee-row">
          <dt>Employee</dt>
          <dd>{header.employeeName}</dd>
        </div>
        <div className="hr-payslip-doc__employee-row">
          <dt>Employee code</dt>
          <dd>{header.employeeCode}</dd>
        </div>
        <div className="hr-payslip-doc__employee-row">
          <dt>Designation</dt>
          <dd>{header.designation || '-'}</dd>
        </div>
        <div className="hr-payslip-doc__employee-row">
          <dt>Department</dt>
          <dd>{header.department || '-'}</dd>
        </div>
        <div className="hr-payslip-doc__employee-row">
          <dt>Paid days</dt>
          <dd>
            {attendance.paidDays} / {attendance.workingDays}
          </dd>
        </div>
        <div className="hr-payslip-doc__employee-row">
          <dt>LOP · Paid leave · OT</dt>
          <dd>
            {attendance.lop} · {attendance.paidLeave} · {(attendance.approvedOtMinutes / 60).toFixed(1)}h
          </dd>
        </div>
      </dl>

      <div className="hr-payslip-doc__columns">
        <div>
          <div className="hr-payslip-doc__col-title">Earnings</div>
          {earnings.length === 0 ? (
            <p className="text-xs text-erp-muted">No earning lines.</p>
          ) : (
            earnings.map((c) => (
              <div key={c.code} className="hr-payslip-doc__line">
                <span>{c.name}</span>
                <span>{money(c.amount)}</span>
              </div>
            ))
          )}
          <div className="hr-payslip-doc__line hr-payslip-doc__line--total">
            <span>Gross Earnings</span>
            <span>{money(totals.gross)}</span>
          </div>
        </div>
        <div>
          <div className="hr-payslip-doc__col-title">Deductions</div>
          {deductions.length === 0 ? (
            <p className="text-xs text-erp-muted">No deduction lines.</p>
          ) : (
            deductions.map((c) => (
              <div key={c.code} className="hr-payslip-doc__line">
                <span>{c.name}</span>
                <span>{money(c.amount)}</span>
              </div>
            ))
          )}
          <div className="hr-payslip-doc__line hr-payslip-doc__line--total">
            <span>Total Deductions</span>
            <span>{money(totals.totalDeduction)}</span>
          </div>
        </div>
      </div>

      <div className="hr-payslip-doc__net">
        <span className="hr-payslip-doc__net-label">Net Pay</span>
        <span className="hr-payslip-doc__net-value">{money(totals.netPay)}</span>
      </div>

      <div className="hr-payslip-doc__bank">Bank account: {header.bankAccountMasked ?? 'Not on file'}</div>
    </div>
  )
}
