import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, PowerOff, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import { useTreasuryAccountOptions } from '../../transfers/hooks/useTreasuryAccountOptions'
import {
  createBankPostingRuleDraft,
  deactivateBankPostingRule,
  fetchBankPostingRules,
  updateBankPostingRuleDraft,
} from '../api/treasury-adjustment.api'
import type { BankPostingRuleDto } from '../api/treasury-adjustment.types'
import {
  BankPostingRuleFormDrawer,
  EMPTY_BANK_POSTING_RULE_FORM,
  bankPostingRuleToFormValues,
  buildCreateBankPostingRulePayload,
  type BankPostingRuleFormValues,
} from '../components/BankPostingRuleFormDrawer'
import { AdjustmentWorkspaceShell } from '../components/AdjustmentWorkspaceShell'
import { ADJUSTMENT_TYPE_LABELS, formatAdjustmentDateTime } from '../utils/format'

export function ApiBankPostingRuleListPage() {
  const perms = useTreasuryAdjustmentPermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const { accounts } = useTreasuryAccountOptions(legalEntityId)
  const bankAccounts = useMemo(() => accounts.filter((a) => a.accountType === 'BANK'), [accounts])

  const [items, setItems] = useState<BankPostingRuleDto[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingUpdatedAt, setEditingUpdatedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [values, setValues] = useState<BankPostingRuleFormValues>(EMPTY_BANK_POSTING_RULE_FORM)

  const load = useCallback(async () => {
    if (!perms.canViewPostingRules || !legalEntityId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetchBankPostingRules({ legalEntityId, limit: 100 })
      setItems(res.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load posting rules')
    } finally {
      setLoading(false)
    }
  }, [perms.canViewPostingRules, legalEntityId])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setEditingUpdatedAt(null)
    setValues(EMPTY_BANK_POSTING_RULE_FORM)
    setDrawerOpen(true)
  }

  const openEdit = (rule: BankPostingRuleDto) => {
    setEditingId(rule.id)
    setEditingUpdatedAt(rule.updatedAt)
    setValues(bankPostingRuleToFormValues(rule))
    setDrawerOpen(true)
  }

  const save = async () => {
    if (!values.name.trim() || values.keywordPatterns.trim().length === 0) {
      notify.error('Name and at least one keyword pattern are required')
      return
    }
    setSaving(true)
    try {
      const payload = buildCreateBankPostingRulePayload(values, legalEntityId)
      if (editingId && editingUpdatedAt) {
        await updateBankPostingRuleDraft(editingId, { ...payload, expectedUpdatedAt: editingUpdatedAt })
        notify.success('Posting rule updated')
      } else {
        await createBankPostingRuleDraft(payload)
        notify.success('Posting rule created')
      }
      setDrawerOpen(false)
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to save posting rule')
    } finally {
      setSaving(false)
    }
  }

  const doDeactivate = async (rule: BankPostingRuleDto) => {
    const confirmed = await appConfirm({ title: `Deactivate "${rule.name}"?`, confirmLabel: 'Deactivate', tone: 'danger' })
    if (!confirmed) return
    setBusyId(rule.id)
    try {
      await deactivateBankPostingRule(rule.id)
      notify.success('Posting rule deactivated')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to deactivate')
    } finally {
      setBusyId(null)
    }
  }

  if (!perms.canViewPostingRules) {
    return (
      <AdjustmentWorkspaceShell title="Bank Posting Rules">
        <p className="text-[13px] text-erp-muted">You do not have permission to view bank posting rules.</p>
      </AdjustmentWorkspaceShell>
    )
  }

  return (
    <AdjustmentWorkspaceShell
      title="Bank Posting Rules"
      description="Deterministic keyword/amount rules used to classify bank statement lines into treasury adjustment drafts."
      actions={
        <div className="flex gap-2">
          {perms.canManagePostingRules ? (
            <ErpButton icon={Plus} onClick={openCreate}>
              New Rule
            </ErpButton>
          ) : null}
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      {loading ? <LoadingState variant="table" rows={6} /> : null}

      {!loading && items.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-erp-border bg-white p-6 text-center">
          <p className="text-[13px] text-erp-muted">No bank posting rules configured yet.</p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="mt-3">
          <EnterpriseRegisterTableShell>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5">Keywords</th>
                  <th className="px-2 py-1.5">Type</th>
                  <th className="px-2 py-1.5">Priority</th>
                  <th className="px-2 py-1.5">Matches</th>
                  <th className="px-2 py-1.5">Active</th>
                  <th className="px-2 py-1.5">Last matched</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {items.map((rule) => (
                  <tr key={rule.id} className="border-t border-erp-border hover:bg-erp-surface/40">
                    <td className="px-2 py-1.5">
                      <p className="font-semibold text-erp-text">{rule.name}</p>
                      {rule.description ? <p className="text-erp-muted">{rule.description}</p> : null}
                    </td>
                    <td className="px-2 py-1.5">{rule.keywordPatterns.join(', ')}</td>
                    <td className="px-2 py-1.5">{ADJUSTMENT_TYPE_LABELS[rule.adjustmentType] ?? rule.adjustmentType}</td>
                    <td className="px-2 py-1.5">{rule.priority}</td>
                    <td className="px-2 py-1.5">{rule.matchCount}</td>
                    <td className="px-2 py-1.5">
                      {rule.isActive ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
                      ) : (
                        <span className="rounded bg-erp-surface px-1.5 py-0.5 text-[11px] font-semibold text-erp-muted">Inactive</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">{rule.lastMatchedAt ? formatAdjustmentDateTime(rule.lastMatchedAt) : 'â€”'}</td>
                    <td className="px-2 py-1.5">
                      {perms.canManagePostingRules ? (
                        <div className="flex justify-end gap-1">
                          <ErpButton variant="secondary" size="sm" icon={Pencil} onClick={() => openEdit(rule)}>
                            Edit
                          </ErpButton>
                          {rule.isActive ? (
                            <ErpButton
                              variant="danger"
                              size="sm"
                              icon={PowerOff}
                              disabled={busyId === rule.id}
                              onClick={() => void doDeactivate(rule)}
                            >
                              Deactivate
                            </ErpButton>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </EnterpriseRegisterTableShell>
        </div>
      ) : null}

      <BankPostingRuleFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        values={values}
        onChange={setValues}
        onSave={() => void save()}
        saving={saving}
        accounts={bankAccounts}
        legalEntityId={legalEntityId}
        title={editingId ? 'Edit Bank Posting Rule' : 'New Bank Posting Rule'}
      />
    </AdjustmentWorkspaceShell>
  )
}
