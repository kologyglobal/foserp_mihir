import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import {
  activateLegalEntity,
  createLegalEntity,
  deactivateLegalEntity,
  listLegalEntities,
  setDefaultLegalEntity,
  updateLegalEntity,
} from '@/services/bridges/financeApiBridge'
import type { LegalEntity, LegalEntityType } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'
import { FinanceSettingsTable } from './financeSettingsShared'

const ENTITY_TYPES: LegalEntityType[] = [
  'PRIVATE_LIMITED',
  'PUBLIC_LIMITED',
  'LLP',
  'PARTNERSHIP',
  'PROPRIETORSHIP',
  'TRUST',
  'OTHER',
]

export function LegalEntitiesPage() {
  const perms = useFinancePermissions()
  const [rows, setRows] = useState<LegalEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<LegalEntity | null>(null)
  const [form, setForm] = useState({
    code: '',
    legalName: '',
    displayName: '',
    entityType: 'PRIVATE_LIMITED' as LegalEntityType,
    pan: '',
    gstin: '',
    fiscalYearStartMonth: 4,
    baseCurrency: 'INR',
    stateCode: '27',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listLegalEntities())
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load legal entities')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const openCreate = () => {
    setEditing(null)
    setForm({
      code: '',
      legalName: '',
      displayName: '',
      entityType: 'PRIVATE_LIMITED',
      pan: '',
      gstin: '',
      fiscalYearStartMonth: 4,
      baseCurrency: 'INR',
      stateCode: '27',
    })
    setDrawerOpen(true)
  }

  const openEdit = (row: LegalEntity) => {
    setEditing(row)
    setForm({
      code: row.code,
      legalName: row.legalName,
      displayName: row.displayName,
      entityType: row.entityType,
      pan: row.pan ?? '',
      gstin: row.gstin ?? '',
      fiscalYearStartMonth: row.fiscalYearStartMonth,
      baseCurrency: row.baseCurrency,
      stateCode: row.stateCode ?? '',
    })
    setDrawerOpen(true)
  }

  const save = async () => {
    try {
      if (editing) {
        await updateLegalEntity(editing.id, form)
        notify.success('Legal entity updated.')
      } else {
        await createLegalEntity({
          ...form,
          initialBranch: { name: 'Head Office', code: 'HO', branchType: 'HEAD_OFFICE' },
        })
        notify.success('Legal entity created with Head Office branch.')
      }
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    if (!window.confirm(`${label}?`)) return
    try {
      await fn()
      notify.success(`${label} completed.`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    }
  }

  return (
    <FinanceSettingsShell
      title="Legal Entities"
      actions={
        perms.canManageLegalEntity ? (
          <ErpButton size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Entity
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && !perms.canView ? (
        <p className="text-[13px] text-erp-muted">You do not have permission to view legal entities.</p>
      ) : null}
      {!loading && perms.canView ? (
        <FinanceSettingsTable headers={['Code', 'Name', 'GSTIN', 'FY Start', 'Default', 'Status', 'Actions']}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-erp-surface-alt/60">
              <td className="px-3 py-2 font-mono text-[11px]">{row.code}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-erp-text">{row.displayName}</div>
                <div className="text-[11px] text-erp-muted">{row.legalName}</div>
              </td>
              <td className="px-3 py-2">{row.gstin ?? '—'}</td>
              <td className="px-3 py-2">Month {row.fiscalYearStartMonth}</td>
              <td className="px-3 py-2">{row.isDefault ? 'Yes' : 'No'}</td>
              <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {perms.canManageLegalEntity ? (
                    <>
                      <ErpButton size="sm" variant="outline" onClick={() => openEdit(row)}>
                        Edit
                      </ErpButton>
                      {!row.isDefault ? (
                        <ErpButton size="sm" variant="outline" onClick={() => void runAction('Set as default', () => setDefaultLegalEntity(row.id))}>
                          Set default
                        </ErpButton>
                      ) : null}
                      {row.isActive ? (
                        <ErpButton size="sm" variant="outline" onClick={() => void runAction('Deactivate', () => deactivateLegalEntity(row.id))}>
                          Deactivate
                        </ErpButton>
                      ) : (
                        <ErpButton size="sm" variant="outline" onClick={() => void runAction('Activate', () => activateLegalEntity(row.id))}>
                          Activate
                        </ErpButton>
                      )}
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </FinanceSettingsTable>
      ) : null}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Legal Entity' : 'New Legal Entity'}
        subtitle="Company registration and fiscal defaults"
        eyebrow="Finance Setup"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton onClick={() => void save()} disabled={!perms.canManageLegalEntity}>
              Save
            </ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Code" required>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </FormField>
          <FormField label="Legal name" required>
            <Input value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} />
          </FormField>
          <FormField label="Display name" required>
            <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
          </FormField>
          <FormField label="Entity type">
            <Select value={form.entityType} onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value as LegalEntityType }))}>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </FormField>
          <details className="rounded border border-erp-border p-2">
            <summary className="cursor-pointer text-[12px] font-semibold text-erp-text">Advanced</summary>
            <div className="mt-3 space-y-3">
              <FormField label="PAN">
                <Input value={form.pan} onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))} />
              </FormField>
              <FormField label="GSTIN">
                <Input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))} />
              </FormField>
              <FormField label="State code">
                <Input value={form.stateCode} onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))} />
              </FormField>
              <FormField label="FY start month (1–12)">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.fiscalYearStartMonth}
                  onChange={(e) => setForm((f) => ({ ...f, fiscalYearStartMonth: Number(e.target.value) }))}
                />
              </FormField>
              <FormField label="Base currency">
                <Input value={form.baseCurrency} onChange={(e) => setForm((f) => ({ ...f, baseCurrency: e.target.value.toUpperCase() }))} />
              </FormField>
            </div>
          </details>
        </div>
      </AccountDrawerShell>
    </FinanceSettingsShell>
  )
}
