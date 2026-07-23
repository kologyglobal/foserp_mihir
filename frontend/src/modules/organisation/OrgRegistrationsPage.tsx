import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { FinanceSettingsTable } from '@/modules/accounting/settings/financeSettingsShared'
import { OrganisationSetupShell } from './OrganisationSetupShell'
import {
  createOrgRegistration,
  listOrgRegistrations,
  updateOrgRegistration,
  type OrgRegistration,
} from '@/services/api/organisationApi'
import { ensureLegalEntity } from '@/services/bridges/financeApiBridge'
import { isApiMode } from '@/config/apiConfig'
import { useOrganisationPermissions } from '@/utils/permissions/organisation'
import { notify } from '@/store/toastStore'

const TYPES = ['GST', 'PAN', 'CIN', 'OTHER'] as const

export function OrgRegistrationsPage() {
  const perms = useOrganisationPermissions()
  const [rows, setRows] = useState<OrgRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<OrgRegistration | null>(null)
  const [legalEntityId, setLegalEntityId] = useState('')
  const [form, setForm] = useState({
    registrationType: 'GST' as (typeof TYPES)[number],
    registrationNumber: '',
    country: 'India',
    state: 'Gujarat',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const le = await ensureLegalEntity()
      setLegalEntityId(le.id)
      if (!isApiMode()) {
        setRows([])
        return
      }
      setRows(await listOrgRegistrations(le.id))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load registrations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const save = async () => {
    try {
      if (!isApiMode()) {
        notify.error('Registrations require API mode')
        return
      }
      if (editing) {
        await updateOrgRegistration(editing.id, form)
        notify.success('Registration updated')
      } else {
        await createOrgRegistration({ ...form, legalEntityId })
        notify.success('Registration created')
      }
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <OrganisationSetupShell
      title="Registration Details"
      actions={
        perms.canCreate ? (
          <ErpButton
            size="sm"
            onClick={() => {
              setEditing(null)
              setForm({
                registrationType: 'GST',
                registrationNumber: '',
                country: 'India',
                state: 'Gujarat',
                status: 'ACTIVE',
              })
              setDrawerOpen(true)
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Registration
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && perms.canView ? (
        <FinanceSettingsTable headers={['Type', 'Number', 'Country', 'State', 'Status', '']}>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-erp-muted" colSpan={6}>
                No registrations yet. Add GST / PAN / CIN details for the legal entity.
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium">{row.registrationType}</td>
              <td className="px-3 py-2">{row.registrationNumber}</td>
              <td className="px-3 py-2">{row.country}</td>
              <td className="px-3 py-2">{row.state ?? '—'}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2">
                {perms.canUpdate ? (
                  <ErpButton
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(row)
                      setForm({
                        registrationType: row.registrationType,
                        registrationNumber: row.registrationNumber,
                        country: row.country,
                        state: row.state ?? '',
                        status: row.status,
                      })
                      setDrawerOpen(true)
                    }}
                  >
                    Edit
                  </ErpButton>
                ) : null}
              </td>
            </tr>
          ))}
        </FinanceSettingsTable>
      ) : null}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Registration' : 'New Registration'}
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton onClick={() => void save()}>Save</ErpButton>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField label="Type">
            <Select
              value={form.registrationType}
              onChange={(e) => setForm((f) => ({ ...f, registrationType: e.target.value as (typeof TYPES)[number] }))}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Registration Number">
            <Input
              value={form.registrationNumber}
              onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))}
            />
          </FormField>
          <FormField label="Country">
            <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
          </FormField>
          <FormField label="State">
            <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </Select>
          </FormField>
        </div>
      </AccountDrawerShell>
    </OrganisationSetupShell>
  )
}
