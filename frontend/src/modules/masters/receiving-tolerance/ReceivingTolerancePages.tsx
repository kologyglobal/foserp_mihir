import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Scale } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, CoreMasterRowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Checkbox, Input, Textarea } from '../../../components/forms/Inputs'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { notify, notifyMasterSaved } from '../../../store/toastStore'
import type { ReceivingToleranceMaster } from '../../../types/taxMaster'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import { EnterpriseMasterWorkspace, MasterFormCommandBar, MasterStickyFooter } from '../shared/EnterpriseMasterShell'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'

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
      cell: ({ row }) => (
        <CoreMasterRowActions
          viewTo={`/masters/receiving-tolerances/${row.original.id}`}
          editTo={`/masters/receiving-tolerances/${row.original.id}/edit`}
          recordId={row.original.id}
          recordLabel={row.original.code}
          isActive={row.original.isActive}
          deleteRecord={row.original.isSystem ? undefined : deleteRecord}
          activateRecord={row.original.isSystem ? undefined : activateRecord}
          deactivateRecord={row.original.isSystem ? undefined : deactivateRecord}
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
  const isEdit = Boolean(id)
  const rows = useMasterStore((s) => s.receivingTolerances)
  const addRecord = useMasterStore((s) => s.addReceivingTolerance)
  const updateRecord = useMasterStore((s) => s.updateReceivingTolerance)
  const existing = id ? rows.find((r) => r.id === id) : undefined

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
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

  async function onSubmit(data: FormData) {
    try {
      if (isEdit && id) {
        await resolveMaybeVoid(updateRecord(id, data))
      } else {
        const newId = await resolveMaybeId(addRecord(data))
        notifyMasterSaved('Receiving tolerance')
        navigate(`/masters/receiving-tolerances/${newId}`)
        return
      }
      notifyMasterSaved('Receiving tolerance')
      navigate(`/masters/receiving-tolerances/${id}`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Save failed')
    }
  }

  if (isEdit && !existing) return <MasterNotFound backTo="/masters/receiving-tolerances" label="Receiving tolerance" />

  return (
    <EnterpriseMasterWorkspace
      breadcrumbs={buildMasterBreadcrumbs('Receiving Tolerance', isEdit ? existing!.code : 'New', '/masters/receiving-tolerances')}
      title={isEdit ? `Edit ${existing!.code}` : 'New receiving tolerance'}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <MasterFormCommandBar title={isEdit ? 'Edit tolerance' : 'Create tolerance'} backTo="/masters/receiving-tolerances" />
        <ErpCardSection title="Tolerance rule" icon={Scale} columns={2}>
          <FormField label="Code" required error={errors.code?.message}>
            <MasterCodeField
              value={watch('code')}
              onChange={(v) => setValue('code', v, { shouldValidate: true })}
              disabled={Boolean(existing?.isSystem)}
            />
          </FormField>
          <FormField label="Name" required error={errors.name?.message}>
            <Input {...register('name')} />
          </FormField>
          <FormField label="Excess tolerance (%)" required error={errors.percentage?.message}>
            <Input type="number" step="0.0001" min={0} max={100} {...register('percentage')} disabled={Boolean(existing?.isSystem)} />
          </FormField>
          <FormField label="Active">
            <Checkbox {...register('isActive')} label="Active" disabled={Boolean(existing?.isSystem)} />
          </FormField>
          <FormField label="Description" className="col-span-full">
            <Textarea rows={2} {...register('description')} />
          </FormField>
        </ErpCardSection>
        <MasterStickyFooter isSubmitting={isSubmitting} submitLabel={isEdit ? 'Save changes' : 'Create tolerance'} />
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function ReceivingToleranceDetailPage() {
  const { id } = useParams()
  const rows = useMasterStore((s) => s.receivingTolerances)
  const row = rows.find((r) => r.id === id)
  if (!row) return <MasterNotFound backTo="/masters/receiving-tolerances" label="Receiving tolerance" />

  return (
    <DetailLayout
      breadcrumbs={buildMasterBreadcrumbs('Receiving Tolerance', row.code, '/masters/receiving-tolerances')}
      title={row.name}
      subtitle={row.code}
      editTo={`/masters/receiving-tolerances/${row.id}/edit`}
      backTo="/masters/receiving-tolerances"
    >
      <DetailSection title="Tolerance rule">
        <DetailGrid>
          <DetailField label="Code" value={row.code} mono />
          <DetailField label="Excess %" value={`${row.percentage}%`} />
          <DetailField label="System" value={row.isSystem ? 'Yes' : 'No'} />
          <DetailField label="Status" value={<ActiveBadge isActive={row.isActive} />} />
          <DetailField label="Description" value={row.description || '—'} className="col-span-full" />
          <DetailField label="Created" value={formatDate(row.createdAt)} />
          <DetailField label="Updated" value={formatDate(row.updatedAt)} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
