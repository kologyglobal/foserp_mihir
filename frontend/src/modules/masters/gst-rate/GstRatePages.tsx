import { useMemo, useState, useRef, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Calendar, Percent } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, CoreMasterRowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { GstGroupSelect, GeoStateSelect } from '../../../components/masters/TaxMasterSelects'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Checkbox } from '../../../components/forms/Inputs'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notifyMasterSaved } from '../../../store/toastStore'
import type { GstRate } from '../../../types/taxMaster'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import { EnterpriseMasterWorkspace, MasterForm, MasterStickyFooter } from '../shared/EnterpriseMasterShell'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'

const schema = z.object({
  code: z.string().min(1, 'Code required').max(20),
  gstGroupId: z.string().min(1, 'GST group required'),
  fromState: z.string().min(1, 'From state required'),
  locationStateCode: z.string().min(1, 'Location state required'),
  dateFrom: z.string().min(1, 'Date from required'),
  dateTo: z.string().nullable().optional(),
  sgst: z.coerce.number().min(0).max(100),
  cgst: z.coerce.number().min(0).max(100),
  igst: z.coerce.number().min(0).max(100),
  isActive: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.dateTo && data.dateFrom && data.dateTo < data.dateFrom) {
    ctx.addIssue({ code: 'custom', message: 'Date To cannot be before Date From', path: ['dateTo'] })
  }
  const intra = data.fromState === data.locationStateCode
  if (intra) {
    if (Math.abs(data.sgst + data.cgst - data.igst) > 0.01) {
      ctx.addIssue({ code: 'custom', message: 'Intra-state: SGST + CGST should equal IGST', path: ['igst'] })
    }
  } else if (data.sgst + data.cgst > 0) {
    ctx.addIssue({ code: 'custom', message: 'Inter-state: use IGST only (SGST/CGST should be 0)', path: ['sgst'] })
  }
})

type FormData = z.infer<typeof schema>

export function GstRateListPage() {
  const gstRates = useMasterStore((s) => s.gstRates)
  const deleteGstRate = useMasterStore((s) => s.deleteGstRate)
  const activateGstRate = useMasterStore((s) => s.activateGstRate)
  const deactivateGstRate = useMasterStore((s) => s.deactivateGstRate)
  const getGstGroup = useMasterStore((s) => s.getGstGroup)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(
    () =>
      gstRates.filter((r) => {
        const grp = getGstGroup(r.gstGroupId)?.code ?? ''
        const s = search.toLowerCase()
        return matchesStatusFilter(r.isActive, status) && (r.code.toLowerCase().includes(s) || grp.toLowerCase().includes(s) || r.fromState.toLowerCase().includes(s))
      }),
    [gstRates, search, status, getGstGroup],
  )

  const columns: ColumnDef<GstRate, unknown>[] = [
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span> },
    { id: 'group', header: 'GST Group Code', cell: ({ row }) => getGstGroup(row.original.gstGroupId)?.code ?? '—' },
    { accessorKey: 'fromState', header: 'From State' },
    { accessorKey: 'locationStateCode', header: 'Location State Code' },
    { accessorKey: 'dateFrom', header: 'Date From', cell: ({ row }) => formatDate(row.original.dateFrom) },
    { accessorKey: 'dateTo', header: 'Date To', cell: ({ row }) => (row.original.dateTo ? formatDate(row.original.dateTo) : 'Open') },
    { accessorKey: 'sgst', header: 'SGST', cell: ({ row }) => `${row.original.sgst}%` },
    { accessorKey: 'cgst', header: 'CGST', cell: ({ row }) => `${row.original.cgst}%` },
    { accessorKey: 'igst', header: 'IGST', cell: ({ row }) => `${row.original.igst}%` },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => (
      <CoreMasterRowActions
        viewTo={`/masters/gst-rates/${row.original.id}`}
        editTo={`/masters/gst-rates/${row.original.id}/edit`}
        recordId={row.original.id}
        recordLabel={row.original.code}
        isActive={row.original.isActive}
        deleteRecord={deleteGstRate}
        activateRecord={activateGstRate}
        deactivateRecord={deactivateGstRate}
      />
    ) },
  ]

  return (
    <MasterListShell
      title="GST Rate Master"
      description="State-wise GST rate slabs by group — SGST, CGST, IGST"
      masterGroupId="inventory"
      createLabel="New GST Rate"
      createTo="/masters/gst-rates/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[{ label: 'Rate Slabs', value: gstRates.length }, { label: 'Active', value: gstRates.filter((r) => r.isActive).length, accent: 'green' }]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function GstRateFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useMasterStore((s) => (id ? s.getGstRate(id) : undefined))
  const gstRates = useMasterStore((s) => s.gstRates)
  const addGstRate = useMasterStore((s) => s.addGstRate)
  const updateGstRate = useMasterStore((s) => s.updateGstRate)
  const getGstGroup = useMasterStore((s) => s.getGstGroup)
  const isEdit = Boolean(id && existing)
  const [activeSection, setActiveSection] = useState('general')
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? { ...existing, dateTo: existing.dateTo ?? '' }
      : { code: '', gstGroupId: '', fromState: 'Maharashtra', locationStateCode: 'Maharashtra', dateFrom: new Date().toISOString().slice(0, 10), dateTo: '', sgst: 9, cgst: 9, igst: 18, isActive: true },
  })
  const watched = useWatch({ control })
  const gstGroupId = watch('gstGroupId')
  const fromState = watch('fromState')
  const locationStateCode = watch('locationStateCode')

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit(async (data) => {
      const validation = codeSeriesRef.current?.validateBeforeSave(data.code, {
        checkDuplicate: (c) => gstRates.some((r) => r.code === c && r.id !== id),
      })
      if (validation && !validation.ok) {
        setSaveError(validation.message ?? 'Invalid code')
        return
      }
      setSaveError(null)
      const payload = { ...data, dateTo: data.dateTo?.trim() ? data.dateTo : null }
      try {
        let recordId = id
        if (isEdit && id) await resolveMaybeVoid(updateGstRate(id, payload))
        else recordId = await resolveMaybeId(addGstRate(payload))
        if (!isEdit) codeSeriesRef.current?.confirmSaved(data.code)
        notifyMasterSaved('GST Rate', !isEdit)
        if (mode === 'new') { navigate('/masters/gst-rates/new'); return }
        if (mode === 'close') { navigate('/masters/gst-rates'); return }
        if (!isEdit && recordId) navigate(`/masters/gst-rates/${recordId}/edit`, { replace: true })
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/masters/gst-rates')
  }

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? `${existing!.code} — ${existing!.fromState}` : 'New GST Rate'}
      subtitle="Effective-dated GST rate slab"
      breadcrumbs={buildMasterBreadcrumbs('inventory', isEdit ? 'Edit GST Rate' : 'New GST Rate')}
      validationErrors={validationErrors}
      documentStrip={[
        { label: 'Code', value: watched.code?.trim() || '—', highlight: Boolean(watched.code?.trim()) },
        { label: 'GST Group', value: getGstGroup(gstGroupId)?.code ?? '—', highlight: Boolean(gstGroupId) },
        { label: 'From', value: fromState || '—' },
        { label: 'Location', value: locationStateCode || '—' },
        { label: 'IGST', value: watched.igst != null ? `${watched.igst}%` : '—' },
      ]}
      commandBar={<MasterForm listPath="/masters/gst-rates" isEdit={isEdit} onSave={() => save('default')} onSaveClose={() => save('close')} onSaveNew={() => save('new')} onCancel={cancelForm} />}
      sectionNavItems={[{ id: 'general', label: 'Rate Slab', icon: Percent, done: Boolean(watched.code?.trim() && gstGroupId && watched.dateFrom) }]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'Total GST', value: `${(watched.sgst ?? 0) + (watched.cgst ?? 0)}%`, accent: 'blue' as const, hint: `IGST ${watched.igst ?? 0}%` },
        { label: 'Scheme', value: fromState === locationStateCode ? 'Intra-state' : 'Inter-state', accent: 'violet' as const },
      ]}
      factBoxTitle="Rate insight"
      factBoxSummary={[
        { label: 'GST Group', value: getGstGroup(gstGroupId)?.code ?? '—' },
        { label: 'Valid from', value: watched.dateFrom ? formatDate(watched.dateFrom) : '—' },
        { label: 'Used in', value: 'Sales, Purchase, Proforma, Tax Invoice' },
      ]}
      stickyFooter={<MasterStickyFooter isEdit={isEdit} isSubmitting={isSubmitting} onSave={() => save('default')} onSaveClose={() => save('close')} onSaveNew={() => save('new')} onCancel={cancelForm} />}
    >
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save('default') }}>
        <ErpCardSection id="gstr-section-general" title="Rate Configuration" subtitle="Group, states, validity, and tax percentages." icon={Calendar} accent="green" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <MasterCodeField
              entityType="gst_rate"
              isEdit={isEdit}
              existingCode={existing?.code}
              value={watched.code ?? ''}
              onChange={(v) => setValue('code', v, { shouldValidate: true })}
              onSeriesReady={(h) => { codeSeriesRef.current = h }}
              error={errors.code?.message}
              required
            />
            <FormField label="GST Group Code" required error={errors.gstGroupId?.message}>
              <GstGroupSelect value={gstGroupId} onChange={(v) => setValue('gstGroupId', v, { shouldValidate: true })} />
            </FormField>
            <FormField label="From State" required error={errors.fromState?.message}>
              <GeoStateSelect value={fromState} onChange={(v) => setValue('fromState', v, { shouldValidate: true })} />
            </FormField>
            <FormField label="Location State Code" required error={errors.locationStateCode?.message}>
              <GeoStateSelect value={locationStateCode} onChange={(v) => setValue('locationStateCode', v, { shouldValidate: true })} placeholder="Supply location state" />
            </FormField>
            <FormField label="Date From" required error={errors.dateFrom?.message}>
              <Input type="date" {...register('dateFrom')} />
            </FormField>
            <FormField label="Date To" error={errors.dateTo?.message}>
              <Input type="date" {...register('dateTo')} />
            </FormField>
            <FormField label="SGST %" required error={errors.sgst?.message}>
              <Input type="number" step="0.01" {...register('sgst')} />
            </FormField>
            <FormField label="CGST %" required error={errors.cgst?.message}>
              <Input type="number" step="0.01" {...register('cgst')} />
            </FormField>
            <FormField label="IGST %" required error={errors.igst?.message}>
              <Input type="number" step="0.01" {...register('igst')} />
            </FormField>
            <FormField label="Status">
              <Checkbox {...register('isActive')} label="Active" />
            </FormField>
          </div>
        </ErpCardSection>
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function GstRateDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getGstRate(id) : undefined))
  const getGstGroup = useMasterStore((s) => s.getGstGroup)
  if (!record) return <MasterNotFound message="GST rate not found." />
  return (
    <DetailLayout backTo="/masters/gst-rates" backLabel="GST Rates" title={`${record.code} — ${record.fromState}`} editTo={`/masters/gst-rates/${record.id}/edit`}>
      <DetailSection title="Rate Slab">
        <DetailGrid>
          <DetailField label="Code" value={record.code} />
          <DetailField label="GST Group" value={getGstGroup(record.gstGroupId)?.code ?? '—'} />
          <DetailField label="From State" value={record.fromState} />
          <DetailField label="Location State" value={record.locationStateCode} />
          <DetailField label="Date From" value={formatDate(record.dateFrom)} />
          <DetailField label="Date To" value={record.dateTo ? formatDate(record.dateTo) : 'Open-ended'} />
          <DetailField label="SGST" value={`${record.sgst}%`} />
          <DetailField label="CGST" value={`${record.cgst}%`} />
          <DetailField label="IGST" value={`${record.igst}%`} />
          <DetailField label="Status" value={record.isActive ? 'Active' : 'Inactive'} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
