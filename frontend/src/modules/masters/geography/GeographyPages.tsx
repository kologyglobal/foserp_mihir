import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import {
  MasterListShell,
  CoreMasterRowActions,
  STATUS_FILTER_OPTIONS,
  matchesStatusFilter,
} from '../../../components/masters/MasterListShell'
import {
  DetailLayout,
  DetailSection,
  DetailGrid,
  DetailField,
  FormLayout,
  FormSection,
  MasterNotFound,
} from '../../../components/masters/MasterLayouts'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox } from '../../../components/forms/Inputs'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notifyMasterSaved } from '../../../store/toastStore'
import type { GeoCity, GeoCountry, GeoState } from '../../../types/geography'

const countrySchema = z.object({
  countryCode: z.string().min(2, 'Code required').max(3),
  countryName: z.string().min(1, 'Name required'),
  isActive: z.boolean(),
})

const stateSchema = z.object({
  stateCode: z.string().min(1, 'Code required').max(5),
  stateName: z.string().min(1, 'Name required'),
  isActive: z.boolean(),
})

const citySchema = z.object({
  stateId: z.string().min(1, 'State required'),
  cityName: z.string().min(1, 'City name required'),
  isActive: z.boolean(),
})

type CountryForm = z.infer<typeof countrySchema>
type StateForm = z.infer<typeof stateSchema>
type CityForm = z.infer<typeof citySchema>

// ——— Country ———

export function CountryListPage() {
  const geoCountries = useMasterStore((s) => s.geoCountries)
  const deleteGeoCountry = useMasterStore((s) => s.deleteGeoCountry)
  const activateGeoCountry = useMasterStore((s) => s.activateGeoCountry)
  const deactivateGeoCountry = useMasterStore((s) => s.deactivateGeoCountry)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(
    () =>
      geoCountries.filter(
        (c) =>
          matchesStatusFilter(c.isActive, status) &&
          (c.countryCode.toLowerCase().includes(search.toLowerCase()) ||
            c.countryName.toLowerCase().includes(search.toLowerCase())),
      ),
    [geoCountries, search, status],
  )

  const columns: ColumnDef<GeoCountry, unknown>[] = [
    {
      accessorKey: 'countryCode',
      header: 'Code',
      cell: ({ row }) => <span className="font-mono text-[13px] font-semibold text-erp-primary">{row.original.countryCode}</span>,
    },
    { accessorKey: 'countryName', header: 'Country' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <CoreMasterRowActions
          viewTo={`/masters/countries/${row.original.id}`}
          editTo={`/masters/countries/${row.original.id}/edit`}
          recordId={row.original.id}
          recordLabel={`${row.original.countryCode} — ${row.original.countryName}`}
          isActive={row.original.isActive}
          deleteRecord={deleteGeoCountry}
          activateRecord={activateGeoCountry}
          deactivateRecord={deactivateGeoCountry}
        />
      ),
    },
  ]

  return (
    <MasterListShell
      title="Country Master"
      description="Countries used on customer, vendor, and location address forms"
      masterGroupId="organization"
      createLabel="New Country"
      createTo="/masters/countries/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Countries', value: geoCountries.length },
        { label: 'Active', value: geoCountries.filter((c) => c.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} includeAuditColumns={false} />
    </MasterListShell>
  )
}

export function CountryFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useMasterStore((s) => (id ? s.getGeoCountry(id) : undefined))
  const addGeoCountry = useMasterStore((s) => s.addGeoCountry)
  const updateGeoCountry = useMasterStore((s) => s.updateGeoCountry)
  const isEdit = Boolean(id && existing)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CountryForm>({
    resolver: zodResolver(countrySchema) as Resolver<CountryForm>,
    defaultValues: existing ?? { isActive: true },
  })

  const onSubmit = handleSubmit((data) => {
    void (async () => {
      const payload = {
        ...data,
        countryCode: data.countryCode.trim().toUpperCase(),
        countryName: data.countryName.trim(),
      }
      try {
        if (isEdit && id) {
          await resolveMaybeVoid(updateGeoCountry(id, payload))
          notifyMasterSaved('Country', false)
          navigate(`/masters/countries/${id}`)
        } else {
          const newId = await resolveMaybeId(addGeoCountry(payload))
          notifyMasterSaved('Country', true)
          navigate(`/masters/countries/${newId}`)
        }
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  })

  return (
    <FormLayout
      masterGroupId="organization"
      backTo="/masters/countries"
      backLabel="Back to Countries"
      title={isEdit ? 'Edit Country' : 'New Country'}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      validationErrors={saveError ? [saveError] : undefined}
    >
      <FormSection title="Country Details" subtitle="ISO code and display name for address dropdowns.">
        <FormField label="Country Code" required error={errors.countryCode?.message}>
          <Input {...register('countryCode')} disabled={isEdit} placeholder="IN" maxLength={3} />
        </FormField>
        <FormField label="Country Name" required error={errors.countryName?.message}>
          <Input {...register('countryName')} placeholder="India" />
        </FormField>
        <div className="flex items-end md:col-span-2">
          <Checkbox label="Active" {...register('isActive')} />
        </div>
      </FormSection>
    </FormLayout>
  )
}

export function CountryDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getGeoCountry(id) : undefined))
  if (!record) return <MasterNotFound message="Country not found." />

  return (
    <DetailLayout
      masterGroupId="organization"
      backTo="/masters/countries"
      backLabel="Country Master"
      title={record.countryName}
      subtitle={record.countryCode}
      editTo={`/masters/countries/${record.id}/edit`}
      badges={<ActiveBadge isActive={record.isActive} />}
    >
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="Code" value={record.countryCode} />
          <DetailField label="Country" value={record.countryName} />
          <DetailField label="Status" value={record.isActive ? 'Active' : 'Inactive'} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}

// ——— State ———

export function StateListPage() {
  const geoStates = useMasterStore((s) => s.geoStates)
  const geoCities = useMasterStore((s) => s.geoCities)
  const deleteGeoState = useMasterStore((s) => s.deleteGeoState)
  const activateGeoState = useMasterStore((s) => s.activateGeoState)
  const deactivateGeoState = useMasterStore((s) => s.deactivateGeoState)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const cityCountByState = useMemo(() => {
    const map = new Map<string, number>()
    for (const city of geoCities) {
      map.set(city.stateId, (map.get(city.stateId) ?? 0) + 1)
    }
    return map
  }, [geoCities])

  const filtered = useMemo(
    () =>
      geoStates.filter(
        (st) =>
          matchesStatusFilter(st.isActive, status) &&
          (st.stateCode.toLowerCase().includes(search.toLowerCase()) ||
            st.stateName.toLowerCase().includes(search.toLowerCase())),
      ),
    [geoStates, search, status],
  )

  const columns: ColumnDef<GeoState, unknown>[] = [
    {
      accessorKey: 'stateCode',
      header: 'Code',
      cell: ({ row }) => <span className="font-mono text-[13px] font-semibold text-erp-primary">{row.original.stateCode}</span>,
    },
    { accessorKey: 'stateName', header: 'State / Province' },
    {
      id: 'cities',
      header: 'Cities',
      cell: ({ row }) => cityCountByState.get(row.original.id) ?? 0,
    },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <CoreMasterRowActions
          viewTo={`/masters/states/${row.original.id}`}
          editTo={`/masters/states/${row.original.id}/edit`}
          recordId={row.original.id}
          recordLabel={`${row.original.stateCode} — ${row.original.stateName}`}
          isActive={row.original.isActive}
          deleteRecord={deleteGeoState}
          activateRecord={activateGeoState}
          deactivateRecord={deactivateGeoState}
        />
      ),
    },
  ]

  return (
    <MasterListShell
      title="State / Province Master"
      description="States and provinces for customer, vendor, and CRM address forms"
      masterGroupId="organization"
      createLabel="New State"
      createTo="/masters/states/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'States', value: geoStates.length },
        { label: 'Active', value: geoStates.filter((s) => s.isActive).length, accent: 'green' },
        { label: 'Cities linked', value: geoCities.length, accent: 'purple' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} includeAuditColumns={false} />
    </MasterListShell>
  )
}

export function StateFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useMasterStore((s) => (id ? s.getGeoState(id) : undefined))
  const addGeoState = useMasterStore((s) => s.addGeoState)
  const updateGeoState = useMasterStore((s) => s.updateGeoState)
  const isEdit = Boolean(id && existing)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<StateForm>({
    resolver: zodResolver(stateSchema) as Resolver<StateForm>,
    defaultValues: existing ?? { isActive: true },
  })

  const onSubmit = handleSubmit((data) => {
    void (async () => {
      const payload = {
        ...data,
        stateCode: data.stateCode.trim().toUpperCase(),
        stateName: data.stateName.trim(),
      }
      try {
        if (isEdit && id) {
          await resolveMaybeVoid(updateGeoState(id, payload))
          notifyMasterSaved('State', false)
          navigate(`/masters/states/${id}`)
        } else {
          const newId = await resolveMaybeId(addGeoState(payload))
          notifyMasterSaved('State', true)
          navigate(`/masters/states/${newId}`)
        }
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  })

  return (
    <FormLayout
      masterGroupId="organization"
      backTo="/masters/states"
      backLabel="Back to States"
      title={isEdit ? 'Edit State' : 'New State'}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      validationErrors={saveError ? [saveError] : undefined}
    >
      <FormSection title="State Details" subtitle="Short code and name used in state dropdowns.">
        <FormField label="State Code" required error={errors.stateCode?.message}>
          <Input {...register('stateCode')} disabled={isEdit} placeholder="MH" maxLength={5} />
        </FormField>
        <FormField label="State Name" required error={errors.stateName?.message}>
          <Input {...register('stateName')} placeholder="Maharashtra" />
        </FormField>
        <div className="flex items-end md:col-span-2">
          <Checkbox label="Active" {...register('isActive')} />
        </div>
      </FormSection>
    </FormLayout>
  )
}

export function StateDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getGeoState(id) : undefined))
  const cities = useMasterStore((s) => (id ? s.getCitiesByStateId(id) : []))
  if (!record) return <MasterNotFound message="State not found." />

  return (
    <DetailLayout
      masterGroupId="organization"
      backTo="/masters/states"
      backLabel="State Master"
      title={record.stateName}
      subtitle={record.stateCode}
      editTo={`/masters/states/${record.id}/edit`}
      badges={<ActiveBadge isActive={record.isActive} />}
    >
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="Code" value={record.stateCode} />
          <DetailField label="State" value={record.stateName} />
          <DetailField label="Cities" value={String(cities.length)} />
          <DetailField label="Status" value={record.isActive ? 'Active' : 'Inactive'} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}

// ——— City ———

export function CityListPage() {
  const geoStates = useMasterStore((s) => s.geoStates)
  const geoCities = useMasterStore((s) => s.geoCities)
  const deleteGeoCity = useMasterStore((s) => s.deleteGeoCity)
  const activateGeoCity = useMasterStore((s) => s.activateGeoCity)
  const deactivateGeoCity = useMasterStore((s) => s.deactivateGeoCity)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')

  const stateNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const st of geoStates) map.set(st.id, st.stateName)
    return map
  }, [geoStates])

  const filtered = useMemo(
    () =>
      geoCities.filter((city) => {
        const stateName = stateNameById.get(city.stateId) ?? ''
        return (
          matchesStatusFilter(city.isActive, status) &&
          (stateFilter === 'all' || city.stateId === stateFilter) &&
          (city.cityName.toLowerCase().includes(search.toLowerCase()) ||
            stateName.toLowerCase().includes(search.toLowerCase()))
        )
      }),
    [geoCities, search, status, stateFilter, stateNameById],
  )

  const columns: ColumnDef<GeoCity, unknown>[] = [
    { accessorKey: 'cityName', header: 'City' },
    {
      id: 'state',
      header: 'State',
      cell: ({ row }) => stateNameById.get(row.original.stateId) ?? '—',
    },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <CoreMasterRowActions
          viewTo={`/masters/cities/${row.original.id}`}
          editTo={`/masters/cities/${row.original.id}/edit`}
          recordId={row.original.id}
          recordLabel={row.original.cityName}
          isActive={row.original.isActive}
          deleteRecord={deleteGeoCity}
          activateRecord={activateGeoCity}
          deactivateRecord={deactivateGeoCity}
        />
      ),
    },
  ]

  return (
    <MasterListShell
      title="City Master"
      description="Cities linked to states for address and CRM location fields"
      masterGroupId="organization"
      createLabel="New City"
      createTo="/masters/cities/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      extraFilters={
        <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="w-44">
          <option value="all">All States</option>
          {geoStates.map((st) => (
            <option key={st.id} value={st.id}>
              {st.stateName}
            </option>
          ))}
        </Select>
      }
      stats={[
        { label: 'Cities', value: geoCities.length },
        { label: 'States', value: geoStates.length, accent: 'purple' },
        { label: 'Active', value: geoCities.filter((c) => c.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} includeAuditColumns={false} />
    </MasterListShell>
  )
}

export function CityFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const geoStates = useMasterStore((s) => s.geoStates)
  const existing = useMasterStore((s) => (id ? s.getGeoCity(id) : undefined))
  const addGeoCity = useMasterStore((s) => s.addGeoCity)
  const updateGeoCity = useMasterStore((s) => s.updateGeoCity)
  const isEdit = Boolean(id && existing)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CityForm>({
    resolver: zodResolver(citySchema) as Resolver<CityForm>,
    defaultValues: existing ?? { stateId: geoStates[0]?.id ?? '', isActive: true },
  })

  const onSubmit = handleSubmit((data) => {
    void (async () => {
      const payload = { ...data, cityName: data.cityName.trim() }
      try {
        if (isEdit && id) {
          await resolveMaybeVoid(updateGeoCity(id, payload))
          notifyMasterSaved('City', false)
          navigate(`/masters/cities/${id}`)
        } else {
          const newId = await resolveMaybeId(addGeoCity(payload))
          notifyMasterSaved('City', true)
          navigate(`/masters/cities/${newId}`)
        }
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  })

  return (
    <FormLayout
      masterGroupId="organization"
      backTo="/masters/cities"
      backLabel="Back to Cities"
      title={isEdit ? 'Edit City' : 'New City'}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      validationErrors={saveError ? [saveError] : undefined}
    >
      <FormSection title="City Details" subtitle="Link city to a state for dependent dropdowns.">
        <FormField label="State" required error={errors.stateId?.message}>
          <Select {...register('stateId')}>
            <option value="">— Select state —</option>
            {geoStates.map((st) => (
              <option key={st.id} value={st.id}>
                {st.stateName} ({st.stateCode})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="City Name" required error={errors.cityName?.message}>
          <Input {...register('cityName')} placeholder="Pune" />
        </FormField>
        <div className="flex items-end md:col-span-2">
          <Checkbox label="Active" {...register('isActive')} />
        </div>
      </FormSection>
    </FormLayout>
  )
}

export function CityDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getGeoCity(id) : undefined))
  const state = useMasterStore((s) => (record ? s.getGeoState(record.stateId) : undefined))
  if (!record) return <MasterNotFound message="City not found." />

  return (
    <DetailLayout
      masterGroupId="organization"
      backTo="/masters/cities"
      backLabel="City Master"
      title={record.cityName}
      subtitle={state?.stateName}
      editTo={`/masters/cities/${record.id}/edit`}
      badges={<ActiveBadge isActive={record.isActive} />}
    >
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="City" value={record.cityName} />
          <DetailField label="State" value={state?.stateName} />
          <DetailField label="State Code" value={state?.stateCode} />
          <DetailField label="Status" value={record.isActive ? 'Active' : 'Inactive'} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
