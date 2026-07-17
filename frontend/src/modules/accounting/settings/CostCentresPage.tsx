import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import {
  createCostCentre,
  getCostCentreTree,
  resolveLegalEntityId,
} from '@/services/bridges/financeApiBridge'
import type { CostCentreTreeNode } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'

function renderTree(nodes: CostCentreTreeNode[], depth = 0): React.ReactNode {
  return nodes.map((n) => (
    <div key={n.id}>
      <div className="flex items-center justify-between py-1 text-[12px]" style={{ paddingLeft: depth * 16 }}>
        <span>
          <span className="font-mono text-[10px] text-erp-muted">{n.code}</span> {n.name}
          {!n.isActive ? <span className="ml-2 text-erp-muted">(inactive)</span> : null}
        </span>
      </div>
      {n.children.length ? renderTree(n.children, depth + 1) : null}
    </div>
  ))
}

export function CostCentresPage() {
  const perms = useFinancePermissions()
  const [tree, setTree] = useState<CostCentreTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', description: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTree(await getCostCentreTree())
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load cost centres')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const save = async () => {
    try {
      await createCostCentre({
        legalEntityId: resolveLegalEntityId(),
        code: form.code,
        name: form.name,
        description: form.description,
        isGroup: false,
        isActive: true,
      })
      notify.success('Cost centre created.')
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <FinanceSettingsShell
      title="Cost Centres"
      actions={
        perms.canManageCostCentres ? (
          <ErpButton size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Cost Centre
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && perms.canView ? (
        tree.length ? (
          <div className="rounded border border-erp-border p-3">{renderTree(tree)}</div>
        ) : (
          <p className="text-[13px] text-erp-muted">No cost centres yet.</p>
        )
      ) : null}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New Cost Centre"
        eyebrow="Finance Setup"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</ErpButton>
            <ErpButton onClick={() => void save()} disabled={!perms.canManageCostCentres}>Save</ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Code"><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} /></FormField>
          <FormField label="Name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></FormField>
          <FormField label="Description"><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></FormField>
        </div>
      </AccountDrawerShell>
    </FinanceSettingsShell>
  )
}
