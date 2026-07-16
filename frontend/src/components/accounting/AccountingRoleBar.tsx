import { ShieldCheck } from 'lucide-react'
import { useAccountingStore } from '../../store/accountingStore'
import { ACCOUNTING_ROLE_LABELS, ALL_ACCOUNTING_ROLES } from '../../types/accounting'
import { isAccountingReadOnly } from '../../utils/accounting/roleAccess'

/** Mock role switcher — scoped to the Accounting module only, persisted in accountingStore. */
export function AccountingRoleBar() {
  const mockRole = useAccountingStore((s) => s.mockRole)
  const setMockRole = useAccountingStore((s) => s.setMockRole)
  const readOnly = isAccountingReadOnly(mockRole)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-erp-border bg-erp-surface-alt/60 px-3 py-1.5 text-[12px]">
      <ShieldCheck className="h-3.5 w-3.5 text-erp-primary" aria-hidden />
      <span className="text-erp-muted">Viewing as</span>
      <select
        value={mockRole}
        onChange={(e) => setMockRole(e.target.value as typeof mockRole)}
        className="h-7 rounded-md border border-erp-border bg-erp-surface px-2 text-[12px] font-medium text-erp-text"
        aria-label="Accounting mock role"
      >
        {ALL_ACCOUNTING_ROLES.map((role) => (
          <option key={role} value={role}>{ACCOUNTING_ROLE_LABELS[role]}</option>
        ))}
      </select>
      {readOnly ? (
        <span className="rounded-full bg-erp-warning-soft px-2 py-0.5 text-[10px] font-semibold text-erp-warning-fg">
          Read-only role
        </span>
      ) : null}
      <span className="text-erp-muted">— demo role switcher, does not affect other modules</span>
    </div>
  )
}
