import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Hash } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, CoreMasterRowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { GstGroupSelect } from '../../../components/masters/TaxMasterSelects'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Checkbox, Textarea } from '../../../components/forms/Inputs'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { MasterBatchImportDialog } from '../../../components/masters/MasterBatchImportDialog'
import { isApiMode } from '../../../config/apiConfig'
import { downloadMasterExport } from '../../../services/api/masterBatchApi'
import { formatApiError } from '../../../services/api/apiErrors'
import { notify, notifyMasterSaved } from '../../../store/toastStore'
import type { HsnMaster } from '../../../types/taxMaster'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import { EnterpriseMasterWorkspace, MasterFormCommandBar, MasterStickyFooter } from '../shared/EnterpriseMasterShell'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'

const schema = z.object({
  code: z.string().min(4, 'HSN code required').max(10),
  gstGroupId: z.string().min(1, 'GST group required'),
  description: z.string().min(1, 'Description required'),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

export function HsnListPage() {
  const hsnMasters = useMasterStore((s) => s.hsnMasters)
  const deleteHsn = useMasterStore((s) => s.deleteHsn)
  const activateHsn = useMasterStore((s) => s.activateHsn)
  const deactivateHsn = useMasterStore((s) => s.deactivateHsn)
  const getGstGroup = useMasterStore((s) => s.getGstGroup)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [importOpen, setImportOpen] = useState(false)

  const filtered = useMemo(
    () =>
      hsnMasters.filter((h) => {
        const s = search.toLowerCase()
        return matchesStatusFilter(h.isActive, status) && (h.code.includes(s) || h.description.toLowerCase().includes(s))
      }),
    [hsnMasters, search, status],
  )

  const columns: ColumnDef<HsnMaster, unknown>[] = [
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span> },
    { id: 'gstGroup', header: 'GST Group Code', cell: ({ row }) => getGstGroup(row.original.gstGroupId)?.code ?? '—' },
    { accessorKey: 'description', header: 'HSN Description' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => (
      <CoreMasterRowActions
        viewTo={`/masters/hsn/${row.original.id}`}
        editTo={`/masters/hsn/${row.original.id}/edit`}
        recordId={row.original.id}
        recordLabel={row.original.code}
        isActive={row.original.isActive}
        deleteRecord={deleteHsn}
        activateRecord={activateHsn}
        deactivateRecord={deactivateHsn}
      />
    ) },
  ]

  async function handleExport() {
    if (!isApiMode()) {
      notify.info('Export downloads the current register from the tenant database in API mode.')
      return
    }
    try {
      await downloadMasterExport('hsn-sac', {
        search: search || undefined,
        status: status === 'all' ? undefined : status === 'active' ? 'ACTIVE' : 'INACTIVE',
      })
    } catch (err) {
      notify.error(formatApiError(err))
    }
  }

  return (
    <>
    <MasterListShell
      title="HSN Master"
      description="Harmonized System of Nomenclature codes linked to GST groups"
      masterGroupId="tax"
      createLabel="New HSN"
      createTo="/masters/hsn/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      onImport={() => setImportOpen(true)}
      onExport={() => void handleExport()}
      stats={[
        { label: 'HSN Codes', value: hsnMasters.length },
        { label: 'Active', value: hsnMasters.filter((h) => h.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
    <MasterBatchImportDialog open={importOpen} onClose={() => setImportOpen(false)} resource="hsn-sac" />
    </>
  )
}

export function HsnFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const hsnMasters = useMasterStore((s) => s.hsnMasters)
  const existing = useMasterStore((s) => (id ? s.getHsn(id) : undefined))
  const addHsn = useMasterStore((s) => s.addHsn)
  const updateHsn = useMasterStore((s) => s.updateHsn)
  const getGstGroup = useMasterStore((s) => s.getGstGroup)
  const isEdit = Boolean(id && existing)
  const [activeSection, setActiveSection] = useState('general')
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing ?? { code: '', isActive: true, gstGroupId: '', description: '' },
  })
  const watched = useWatch({ control })
  const gstGroupId = watch('gstGroupId')

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit(async (data) => {
      const validation = codeSeriesRef.current?.validateBeforeSave(data.code, {
        checkDuplicate: (c) => hsnMasters.some((h) => h.code === c && h.id !== id),
      })
      if (validation && !validation.ok) {
        setSaveError(validation.message ?? 'Invalid code')
        return
      }
      setSaveError(null)
      try {
        let recordId = id
        if (isEdit && id) await resolveMaybeVoid(updateHsn(id, data))
        else recordId = await resolveMaybeId(addHsn(data))
        if (!isEdit) codeSeriesRef.current?.confirmSaved(data.code)
        notifyMasterSaved('HSN Code', !isEdit)
        if (mode === 'new') { navigate('/masters/hsn/new'); return }
        if (mode === 'close') { navigate('/masters/hsn'); return }
        if (!isEdit && recordId) navigate(`/masters/hsn/${recordId}/edit`, { replace: true })
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/masters/hsn')
  }

  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? existing!.code : 'New HSN Code'}
      subtitle="HSN classification for GST on items and invoices"
      breadcrumbs={buildMasterBreadcrumbs('inventory', isEdit ? 'Edit HSN' : 'New HSN')}
      validationErrors={validationErrors}
      documentStrip={[
        { label: 'Code', value: watched.code?.trim() || '—', highlight: Boolean(watched.code?.trim()) },
        { label: 'GST Group', value: getGstGroup(gstGroupId)?.code ?? '—' },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
      ]}
      commandBar={(
        <MasterFormCommandBar listPath="/masters/hsn" isEdit={isEdit} onSave={() => save('default')} onSaveClose={() => save('close')} onSaveNew={() => save('new')} onCancel={cancelForm} />
      )}
      sectionNavItems={[{ id: 'general', label: 'General', icon: Hash, done: Boolean(watched.code?.trim() && gstGroupId) }]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'GST Group', value: getGstGroup(gstGroupId)?.code ?? '—', accent: 'blue' as const },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive', accent: 'green' as const },
      ]}
      factBoxTitle="HSN insight"
      factBoxSummary={[
        { label: 'Used in', value: 'Item Master, Sales, Purchase, GST' },
        { label: 'GST Group', value: getGstGroup(gstGroupId)?.code ?? 'Select group' },
        { label: 'Modified', value: existing ? formatDate(existing.updatedAt.slice(0, 10)) : 'New' },
      ]}
      stickyFooter={(
        <MasterStickyFooter isEdit={isEdit} isSubmitting={isSubmitting} onSave={() => save('default')} onSaveClose={() => save('close')} onSaveNew={() => save('new')} onCancel={cancelForm} />
      )}
    >
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save('default') }}>
        <ErpCardSection id="hsn-section-general" title="General" subtitle="HSN code, GST group, and description." icon={Hash} accent="blue" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <MasterCodeField
              entityType="hsn"
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
            <FormField label="HSN Description" required error={errors.description?.message} className="md:col-span-2">
              <Textarea rows={3} {...register('description')} />
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

export function HsnDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getHsn(id) : undefined))
  const getGstGroup = useMasterStore((s) => s.getGstGroup)
  if (!record) return <MasterNotFound message="HSN code not found." />
  return (
    <DetailLayout backTo="/masters/hsn" backLabel="HSN Master" title={record.code} editTo={`/masters/hsn/${record.id}/edit`}>
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="Code" value={record.code} />
          <DetailField label="GST Group Code" value={getGstGroup(record.gstGroupId)?.code ?? '—'} />
          <DetailField label="HSN Description" value={record.description} />
          <DetailField label="Status" value={record.isActive ? 'Active' : 'Inactive'} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
