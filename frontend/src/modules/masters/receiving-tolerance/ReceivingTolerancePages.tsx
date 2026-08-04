import { useMemo, useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Scale } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import {
  MasterListShell,
  CoreMasterRowActions,
  RowActions,
  STATUS_FILTER_OPTIONS,
  matchesStatusFilter,
} from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Checkbox, Input, Textarea } from '../../../components/forms/Inputs'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notifyMasterSaved } from '../../../store/toastStore'
import type { ReceivingToleranceMaster } from '../../../types/taxMaster'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import { EnterpriseMasterWorkspace, MasterForm, MasterStickyFooter } from '../shared/EnterpriseMasterShell'

const schema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  percentage: z.coerce.number().min(0).max(100),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

export function ReceivingToleranceListPage() {
  const rows = useMasterStore((s) => s.receivingTolerances)
  const deleteRecord = useMasterStore((s) => s.deleteReceivingTolerance)
  const activateRecord = useMasterStore((s) => s.activateReceivingTolerance)
  const deactivateRecord = useMasterStore((s) => s.deactivateReceivingTolerance)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    void import('../../../services/bridges/masterBatchApiBridge').then((m) => m.syncBatchMastersFromApi())
  }, [])

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const s = search.toLowerCase()
        return (
          matchesStatusFilter(r.isActive, status) &&
          (r.code.toLowerCase().includes(s) ||
            r.name.toLowerCase().includes(s) ||
            (r.description ?? '').toLowerCase().includes(s))
        )
      }),
    [rows, search, status],
  )

  const columns: ColumnDef<ReceivingToleranceMaster, unknown>[] = [
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span> },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'percentage', header: 'Excess %', cell: ({ row }) => `${row.original.percentage}%` },
    { id: 'system', header: 'System', cell: ({ row }) => (row.original.isSystem ? 'Yes' : '—') },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.isSystem ? (
          <RowActions viewTo={`/masters/receiving-tolerances/${row.original.id}`} />
        ) : (
          <CoreMasterRowActions
            viewTo={`/masters/receiving-tolerances/${row.original.id}`}
            editTo={`/masters/receiving-tolerances/${row.original.id}/edit`}
            recordId={row.original.id}
            recordLabel={row.original.code}
            isActive={row.original.isActive}
            deleteRecord={deleteRecord}
            activateRecord={activateRecord}
            deactivateRecord={deactivateRecord}
          />
        ),
    },
  ]

  return (
    <MasterListShell
      title="Receiving Tolerance Master"
      description="Excess-only receiving tolerance bands for GRN unit and weight validation"
      masterGroupId="inventory"
      createLabel="New tolerance"
      createTo="/masters/receiving-tolerances/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Rules', value: rows.length },
        { label: 'Active', value: rows.filter((r) => r.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function ReceivingToleranceFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const rows = useMasterStore((s) => s.receivingTolerances)
  const addRecord = useMasterStore((s) => s.addReceivingTolerance)
  const updateRecord = useMasterStore((s) => s.updateReceivingTolerance)
  const existing = id ? rows.find((r) => r.id === id) : undefined
  const isEdit = Boolean(id && existing)
  const isSystem = Boolean(existing?.isSystem)
  const [saveError, setSaveError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? {
          code: existing.code,
          name: existing.name,
          description: existing.description ?? '',
          percentage: existing.percentage,
          isActive: existing.isActive,
        }
      : { code: '', name: '', description: '', percentage: 0, isActive: true },
  })
  const watched = useWatch({ control })

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit(async (data) => {
      setSaveError(null)
      try {
        let recordId = id
        if (isEdit && id) {
          await resolveMaybeVoid(updateRecord(id, data))
        } else {
          recordId = await resolveMaybeId(addRecord(data))
        }
        notifyMasterSaved('Receiving tolerance', !isEdit)
        if (mode === 'new') {
          navigate('/masters/receiving-tolerances/new')
          return
        }
        if (mode === 'close') {
          navigate('/masters/receiving-tolerances')
          return
        }
        if (!isEdit && recordId) {
          navigate(`/masters/receiving-tolerances/${recordId}`)
          return
        }
        if (isEdit && id) navigate(`/masters/receiving-tolerances/${id}`)
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  function cancelForm() {
    navigate('/masters/receiving-tolerances')
  }

  if (isEdit && !existing) return <MasterNotFound message="Receiving tolerance not found." />

  const validationErrors = [
    ...Object.values(errors)
      .map((e) => e?.message)
      .filter(Boolean) as string[],
    ...(saveError ? [saveError] : []),
  ]

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? existing!.code : 'New receiving tolerance'}
      subtitle="Excess-only tolerance for GRN receiving"
      breadcrumbs={buildMasterBreadcrumbs('inventory', isEdit ? 'Edit tolerance' : 'New tolerance')}
      validationErrors={validationErrors}
      documentStrip={[
        { label: 'Code', value: watched.code?.trim() || '—', highlight: Boolean(watched.code?.trim()) },
        { label: 'Excess %', value: watched.percentage != null ? `${watched.percentage}%` : '—' },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
      ]}
      commandBar={
        <MasterForm
          listPath="/masters/receiving-tolerances"
          isEdit={isEdit}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={cancelForm}
        />
      }
      stickyFooter={
        <MasterStickyFooter
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={cancelForm}
        />
      }
    >
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save('default') }}>
        <ErpCardSection title="Tolerance rule" icon={Scale} columns={2}>
          <FormField label="Code" required error={errors.code?.message}>
            <Input {...register('code')} readOnly={isSystem} disabled={isSystem} />
          </FormField>
          <FormField label="Name" required error={errors.name?.message}>
            <Input {...register('name')} readOnly={isSystem} disabled={isSystem} />
          </FormField>
          <FormField label="Excess tolerance (%)" required error={errors.percentage?.message}>
            <Input type="number" step="0.0001" min={0} max={100} {...register('percentage')} disabled={isSystem} />
          </FormField>
          <FormField label="Active">
            <Checkbox {...register('isActive')} label="Active" disabled={isSystem} />
          </FormField>
          <FormField label="Description" className="col-span-full">
            <Textarea rows={2} {...register('description')} disabled={isSystem} />
          </FormField>
        </ErpCardSection>
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function ReceivingToleranceDetailPage() {
  const { id } = useParams()
  const rows = useMasterStore((s) => s.receivingTolerances)
  const row = rows.find((r) => r.id === id)
  if (!row) return <MasterNotFound message="Receiving tolerance not found." />

  return (
    <DetailLayout
      backTo="/masters/receiving-tolerances"
      backLabel="Receiving Tolerance Master"
      masterGroupId="inventory"
      title={row.name}
      subtitle={row.code}
      editTo={row.isSystem ? undefined : `/masters/receiving-tolerances/${row.id}/edit`}
      badges={<ActiveBadge isActive={row.isActive} />}
    >
      <DetailSection title="Tolerance rule">
        <DetailGrid>
          <DetailField label="Code" value={<span className="font-mono">{row.code}</span>} />
          <DetailField label="Excess %" value={`${row.percentage}%`} />
          <DetailField label="System" value={row.isSystem ? 'Yes' : 'No'} />
          <DetailField label="Status" value={<ActiveBadge isActive={row.isActive} />} />
          <DetailField label="Description" value={row.description || '—'} />
          <DetailField label="Created" value={formatDate(row.createdAt)} />
          <DetailField label="Updated" value={formatDate(row.updatedAt)} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
