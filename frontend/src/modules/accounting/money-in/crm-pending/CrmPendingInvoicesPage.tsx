/**
 * CRM Tax Invoices pending queue — retired after unified SalesInvoice.
 * Redirects users to Money In invoices (same canonical document).
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'
import { moneyInPath } from '../moneyInUi'

export function CrmPendingInvoicesPage() {
  const navigate = useNavigate()
  const invoicesHref = moneyInPath('invoices')

  useEffect(() => {
    const t = window.setTimeout(() => {
      navigate(invoicesHref, { replace: true })
    }, 2500)
    return () => window.clearTimeout(t)
  }, [navigate, invoicesHref])

  return (
    <MoneyInWorkspaceShell
      title="CRM Tax Invoices"
      description="Unified with Money In Sales Invoices"
    >
      <div className="rounded-lg border border-[var(--erp-border,#e2e8f0)] bg-white p-6" style={{ maxWidth: 640 }}>
        <p style={{ margin: 0, fontWeight: 650 }}>Convert queue retired</p>
        <p style={{ margin: '8px 0 16px', color: 'var(--erp-muted, #64748b)', fontSize: 13, lineHeight: 1.45 }}>
          CRM Tax Invoice and Money In Sales Invoice are now one document. Create and manage invoices
          from Sales or Money In — there is no separate convert step.
        </p>
        <ErpButton type="button" variant="primary" onClick={() => navigate(invoicesHref)}>
          Open Invoices
        </ErpButton>
      </div>
    </MoneyInWorkspaceShell>
  )
}
