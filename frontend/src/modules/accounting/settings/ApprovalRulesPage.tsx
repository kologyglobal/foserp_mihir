import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { createApprovalRule, listApprovalRules, resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { FinanceApprovalRule } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'
import { FinanceSettingsTable } from './financeSettingsShared'

export function ApprovalRulesPage() {
  const perms = useFinancePermissions()
  const [rows, setRows] = useState<FinanceApprovalRule[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({
    documentType: 'JOURNAL',
    ruleName: '',
    amountFrom: 0,
    amountTo: 100000,
    approvalLevel: 1,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listApprovalRules())
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load approval rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const save = async () => {
    try {
      await createApprovalRule({
        legalEntityId: resolveLegalEntityId(),
        ...form,
        isActive: true,
      })
      notify.success('Approval rule created.')
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <FinanceSettingsShell
      title="Approval Rules"
      description="Foundation configuration for voucher approval thresholds."
      actions={
        perms.canManageApprovalRules ? (
          <ErpButton size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Rule
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && perms.canView ? (
        rows.length ? (
          <FinanceSettingsTable headers={['Document', 'Rule', 'Amount range', 'Level', 'Active']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">{r.documentType}</td>
                <td className="px-3 py-2 font-medium">{r.ruleName}</td>
                <td className="px-3 py-2">
                  {r.amountFrom} – {r.amountTo ?? '∞'}
                </td>
                <td className="px-3 py-2">{r.approvalLevel}</td>
                <td className="px-3 py-2">{r.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </FinanceSettingsTable>
        ) : (
          <p className="text-[13px] text-erp-muted">No approval rules configured. This step is optional for activation.</p>
        )
      ) : null}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New Approval Rule"
        eyebrow="Finance Setup"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</ErpButton>
            <ErpButton onClick={() => void save()} disabled={!perms.canManageApprovalRules}>Save</ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Document type"><Input value={form.documentType} onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value.toUpperCase() }))} /></FormField>
          <FormField label="Rule name"><Input value={form.ruleName} onChange={(e) => setForm((f) => ({ ...f, ruleName: e.target.value }))} /></FormField>
          <FormField label="Amount from"><Input type="number" value={form.amountFrom} onChange={(e) => setForm((f) => ({ ...f, amountFrom: Number(e.target.value) }))} /></FormField>
          <FormField label="Amount to"><Input type="number" value={form.amountTo} onChange={(e) => setForm((f) => ({ ...f, amountTo: Number(e.target.value) }))} /></FormField>
        </div>
      </AccountDrawerShell>
    </FinanceSettingsShell>
  )
}
