import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Search } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import {
  createAccount,
  getAccountTree,
  resolveLegalEntityId,
  updateAccount,
} from '@/services/bridges/financeApiBridge'
import type { AccountCategory, AccountTreeNode, AccountType } from '@/types/financeSetup'
import { cn } from '@/utils/cn'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'

const CATEGORIES: AccountCategory[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  expanded,
  toggle,
}: {
  node: AccountTreeNode
  depth: number
  selectedId: string | null
  onSelect: (n: AccountTreeNode) => void
  expanded: Set<string>
  toggle: (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const open = expanded.has(node.id)
  return (
    <div>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[12px] hover:bg-erp-surface-alt',
          selectedId === node.id && 'bg-erp-primary/10 text-erp-primary',
          !node.isActive && 'opacity-50',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <span
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              toggle(node.id)
            }}
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        ) : (
          <span className="w-3.5" />
        )}
        <span className="font-mono text-[10px] text-erp-muted">{node.accountCode}</span>
        <span className="truncate font-medium">{node.accountName}</span>
        {node.isGroup ? <span className="ml-auto text-[10px] text-erp-muted">Group</span> : null}
        {node.isControlAccount ? <span className="ml-auto text-[10px] text-amber-700">Control</span> : null}
      </button>
      {hasChildren && open
        ? node.children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} expanded={expanded} toggle={toggle} />
          ))
        : null}
    </div>
  )
}

export function ChartOfAccountsSetupPage() {
  const perms = useFinancePermissions()
  const [tree, setTree] = useState<AccountTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<AccountCategory | ''>('')
  const [selected, setSelected] = useState<AccountTreeNode | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({
    accountCode: '',
    accountName: '',
    category: 'ASSET' as AccountCategory,
    accountType: 'GENERAL' as AccountType,
    isGroup: false,
    parentAccountId: null as string | null,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const t = await getAccountTree(undefined, true)
      setTree(t)
      setExpanded(new Set(t.map((n) => n.id)))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load chart of accounts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canViewCoa) void load()
  }, [load, perms.canViewCoa])

  const filteredTree = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filterNode = (node: AccountTreeNode): AccountTreeNode | null => {
      if (category && node.category !== category) {
        const kids = node.children.map(filterNode).filter(Boolean) as AccountTreeNode[]
        return kids.length ? { ...node, children: kids } : null
      }
      const match = !q || node.accountCode.toLowerCase().includes(q) || node.accountName.toLowerCase().includes(q)
      const kids = node.children.map(filterNode).filter(Boolean) as AccountTreeNode[]
      if (match || kids.length) return { ...node, children: kids }
      return null
    }
    return tree.map(filterNode).filter(Boolean) as AccountTreeNode[]
  }, [tree, search, category])

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveAccount = async () => {
    try {
      const payload = { ...form, legalEntityId: resolveLegalEntityId(), normalBalance: form.category === 'ASSET' || form.category === 'EXPENSE' ? 'DEBIT' : 'CREDIT' }
      if (selected && drawerOpen && selected.id === form.parentAccountId) {
        await updateAccount(selected.id, form)
        notify.success('Account updated.')
      } else if (selected && !form.isGroup && selected.isGroup === false) {
        await updateAccount(selected.id, form)
        notify.success('Account updated.')
      } else {
        await createAccount(payload)
        notify.success('Account created.')
      }
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <FinanceSettingsShell
      title="Chart of Accounts"
      description="Configure posting accounts for finance activation (separate from operational CoA workspace)."
      actions={
        perms.canManageCoa ? (
          <ErpButton
            size="sm"
            onClick={() => {
              setForm({ accountCode: '', accountName: '', category: 'ASSET', accountType: 'GENERAL', isGroup: false, parentAccountId: selected?.isGroup ? selected.id : selected?.parentAccountId ?? null })
              setDrawerOpen(true)
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Account
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && perms.canViewCoa ? (
        <div className="grid min-h-[420px] grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded border border-erp-border p-2">
            <div className="mb-2 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-erp-muted" />
                <Input className="pl-7" placeholder="Search code or name" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={category} onChange={(e) => setCategory(e.target.value as AccountCategory | '')} className="w-32">
                <option value="">All</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {filteredTree.map((n) => (
                <TreeNode key={n.id} node={n} depth={0} selectedId={selected?.id ?? null} onSelect={setSelected} expanded={expanded} toggle={toggle} />
              ))}
            </div>
          </div>
          <div className="rounded border border-erp-border p-4">
            {selected ? (
              <>
                <p className="text-[10px] font-semibold uppercase text-erp-muted">Account detail</p>
                <h3 className="mt-1 text-[15px] font-semibold text-erp-text">{selected.accountName}</h3>
                <p className="font-mono text-[12px] text-erp-muted">{selected.accountCode}</p>
                <dl className="mt-4 space-y-2 text-[12px]">
                  <div className="flex justify-between"><dt className="text-erp-muted">Category</dt><dd>{selected.category}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Type</dt><dd>{selected.accountType}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Group</dt><dd>{selected.isGroup ? 'Yes' : 'Ledger'}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Control</dt><dd>{selected.isControlAccount ? 'Yes' : 'No'}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Status</dt><dd>{selected.isActive ? 'Active' : 'Inactive'}</dd></div>
                </dl>
                {perms.canManageCoa ? (
                  <ErpButton className="mt-4" size="sm" variant="outline" onClick={() => { setForm({ accountCode: selected.accountCode, accountName: selected.accountName, category: selected.category, accountType: selected.accountType, isGroup: selected.isGroup, parentAccountId: selected.parentAccountId ?? null }); setDrawerOpen(true) }}>
                    Edit
                  </ErpButton>
                ) : null}
              </>
            ) : (
              <p className="text-[13px] text-erp-muted">Select an account from the tree to view details.</p>
            )}
          </div>
        </div>
      ) : null}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Account"
        eyebrow="Chart of Accounts"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</ErpButton>
            <ErpButton onClick={() => void saveAccount()} disabled={!perms.canManageCoa}>Save</ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Account code"><Input value={form.accountCode} onChange={(e) => setForm((f) => ({ ...f, accountCode: e.target.value }))} /></FormField>
          <FormField label="Account name"><Input value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} /></FormField>
          <FormField label="Category"><Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as AccountCategory }))}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></FormField>
          <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={form.isGroup} onChange={(e) => setForm((f) => ({ ...f, isGroup: e.target.checked }))} /> Group account</label>
        </div>
      </AccountDrawerShell>
    </FinanceSettingsShell>
  )
}
