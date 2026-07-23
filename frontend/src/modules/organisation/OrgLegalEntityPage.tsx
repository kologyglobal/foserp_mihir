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
  createOrgLegalEntity,
  listOrgLegalEntities,
  updateOrgLegalEntity,
  type OrgLegalEntity,
} from '@/services/api/organisationApi'
import { isApiMode } from '@/config/apiConfig'
import { useOrganisationPermissions } from '@/utils/permissions/organisation'
import { notify } from '@/store/toastStore'
import { listLegalEntities } from '@/services/bridges/financeApiBridge'

const BUSINESS_TYPES = [
  'PRIVATE_LIMITED',
  'PUBLIC_LIMITED',
  'LLP',
  'PARTNERSHIP',
  'PROPRIETORSHIP',
  'TRUST',
  'OTHER',
] as const

const emptyForm = {
  code: 'HO',
  legalName: '',
  tradeName: '',
  businessType: 'PRIVATE_LIMITED' as (typeof BUSINESS_TYPES)[number],
  gstNumber: '',
  pan: '',
  country: 'India',
  state: '',
  district: '',
  city: '',
  postalCode: '',
  addressLine: '',
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  fiscalYearStartMonth: 4,
}

export function OrgLegalEntityPage() {
  const perms = useOrganisationPermissions()
  const [rows, setRows] = useState<OrgLegalEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<OrgLegalEntity | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (isApiMode()) {
        setRows(await listOrgLegalEntities())
      } else {
        const entities = await listLegalEntities()
        setRows(
          entities.map((e) => ({
            id: e.id,
            tenantId: e.tenantId,
            code: e.code,
            legalName: e.legalName,
            tradeName: e.displayName,
            businessType: e.entityType,
            gstNumber: e.gstin,
            pan: e.pan,
            country: e.countryCode === 'IN' ? 'India' : e.countryCode,
            state: '',
            district: null,
            city: '',
            postalCode: '',
            addressLine: '',
            status: e.isActive ? 'ACTIVE' : 'INACTIVE',
            isDefault: e.isDefault,
            fiscalYearStartMonth: e.fiscalYearStartMonth,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          })),
        )
      }
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
    setForm(emptyForm)
    setDrawerOpen(true)
  }

  const openEdit = (row: OrgLegalEntity) => {
    setEditing(row)
    setForm({
      code: row.code,
      legalName: row.legalName,
      tradeName: row.tradeName,
      businessType: (row.businessType as (typeof BUSINESS_TYPES)[number]) || 'PRIVATE_LIMITED',
      gstNumber: row.gstNumber ?? '',
      pan: row.pan ?? '',
      country: row.country || 'India',
      state: row.state,
      district: row.district ?? '',
      city: row.city,
      postalCode: row.postalCode,
      addressLine: row.addressLine,
      status: row.status,
      fiscalYearStartMonth: row.fiscalYearStartMonth,
    })
    setDrawerOpen(true)
  }

  const save = async () => {
    try {
      if (!isApiMode()) {
        notify.error('Create/update legal entity requires API mode')
        return
      }
      if (editing) {
        await updateOrgLegalEntity(editing.id, form)
        notify.success('Legal entity updated')
      } else {
        await createOrgLegalEntity({ ...form, isDefault: rows.length === 0 })
        notify.success('Legal entity created')
      }
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <OrganisationSetupShell
      title="Legal Entity"
      actions={
        perms.canCreate ? (
          <ErpButton size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Entity
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && perms.canView ? (
        <FinanceSettingsTable headers={['Code', 'Legal Name', 'Trade Name', 'GSTIN', 'City', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium">{row.code}</td>
              <td className="px-3 py-2">{row.legalName}</td>
              <td className="px-3 py-2">{row.tradeName}</td>
              <td className="px-3 py-2">{row.gstNumber ?? '—'}</td>
              <td className="px-3 py-2">{row.city || '—'}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2">
                {perms.canUpdate ? (
                  <ErpButton size="sm" variant="outline" onClick={() => openEdit(row)}>
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
        title={editing ? 'Edit Legal Entity' : 'New Legal Entity'}
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton onClick={() => void save()}>Save</ErpButton>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Code">
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} disabled={Boolean(editing)} />
          </FormField>
          <FormField label="Business Type">
            <Select value={form.businessType} onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value as typeof form.businessType }))}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Legal Name" className="sm:col-span-2">
            <Input value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} />
          </FormField>
          <FormField label="Trade Name" className="sm:col-span-2">
            <Input value={form.tradeName} onChange={(e) => setForm((f) => ({ ...f, tradeName: e.target.value }))} />
          </FormField>
          <FormField label="GSTIN">
            <Input value={form.gstNumber} onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value.toUpperCase() }))} />
          </FormField>
          <FormField label="PAN">
            <Input value={form.pan} onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))} />
          </FormField>
          <FormField label="Address" className="sm:col-span-2">
            <Input value={form.addressLine} onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))} />
          </FormField>
          <FormField label="District">
            <Input value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
          </FormField>
          <FormField label="City">
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </FormField>
          <FormField label="State">
            <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
          </FormField>
          <FormField label="Postal Code">
            <Input value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} />
          </FormField>
          <FormField label="Country">
            <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
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
