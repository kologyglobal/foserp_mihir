import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import {
  MasterListShell,
  RowActions,
  STATUS_FILTER_OPTIONS,
  matchesStatusFilter,
} from '../../../components/masters/MasterListShell'
import {
  DetailLayout,
  DetailSection,
  DetailGrid,
  DetailField,
  FormLayout,
} from '../../../components/masters/MasterLayouts'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox, Textarea } from '../../../components/forms/Inputs'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'
import { useWorkCenterStore } from '../../../store/workCenterStore'
import { useActiveWarehouses } from '../../../hooks/useMasterLists'
import { useDepartmentOptions } from '../../../hooks/useCrmMasters'
import type { WorkCenter } from '../../../types/workcenter'
import type { Resolver } from 'react-hook-form'
import { formatCurrency } from '../../../utils/formatters/currency'
import { notifyMasterSaved } from '../../../store/toastStore'
const schema = z.object({
  workCenterCode: z.string().min(1, 'Required').max(20),
  workCenterName: z.string().min(1, 'Required'),
  department: z.string().min(1, 'Required'),
  plantCode: z.string().min(1, 'Required'),
  capacityHoursPerDay: z.coerce.number().min(1).max(24),
  costRatePerHour: z.coerce.number().min(0),
  description: z.string(),
  inputWarehouseCode: z.string().min(1, 'Input warehouse required'),
  wipWarehouseCode: z.string().min(1, 'WIP warehouse required'),
  outputWarehouseCode: z.string().min(1, 'Output warehouse required'),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

function warehouseLabel(code: string | null) {
  if (!code) return '—'
  return <span className="font-mono text-xs">{code}</span>
}

export function WorkCenterListPage() {
  const workCenters = useWorkCenterStore((s) => s.workCenters)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(
    () =>
      workCenters.filter(
        (w) =>
          matchesStatusFilter(w.isActive, status) &&
          (w.workCenterCode.toLowerCase().includes(search.toLowerCase()) ||
            w.workCenterName.toLowerCase().includes(search.toLowerCase()) ||
            w.department.toLowerCase().includes(search.toLowerCase())),
      ),
    [workCenters, search, status],
  )

  const columns: ColumnDef<WorkCenter, unknown>[] = [
    {
      accessorKey: 'workCenterCode',
      header: 'Code',
      cell: ({ row }) => (
        <span className="font-mono text-[13px] font-semibold text-erp-primary">{row.original.workCenterCode}</span>
      ),
    },
    { accessorKey: 'workCenterName', header: 'Work Center' },
    { accessorKey: 'department', header: 'Department' },
    {
      accessorKey: 'inputWarehouseCode',
      header: 'Input WH',
      cell: ({ row }) => warehouseLabel(row.original.inputWarehouseCode),
    },
    {
      accessorKey: 'wipWarehouseCode',
      header: 'WIP WH',
      cell: ({ row }) => warehouseLabel(row.original.wipWarehouseCode),
    },
    {
      accessorKey: 'outputWarehouseCode',
      header: 'Output WH',
      cell: ({ row }) => warehouseLabel(row.original.outputWarehouseCode),
    },
    { accessorKey: 'plantCode', header: 'Plant' },
    {
      accessorKey: 'capacityHoursPerDay',
      header: 'Capacity Hrs/Day',
      meta: { align: 'right' },
    },
    {
      accessorKey: 'costRatePerHour',
      header: 'Rate/Hr',
      cell: ({ row }) => formatCurrency(row.original.costRatePerHour),
      meta: { align: 'right' },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          viewTo={`/masters/work-centers/${row.original.id}`}
          editTo={`/masters/work-centers/${row.original.id}/edit`}
        />
      ),
    },
  ]

  return (
    <MasterListShell
      title="Work Centers"
      description="Manufacturing work centers — warehouse mapping drives WIP movement per routing operation"
      masterGroupId="production"
      createLabel="New Work Center"
      createTo="/masters/work-centers/new"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search code, name, department..."
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Total', value: workCenters.length },
        { label: 'Active', value: workCenters.filter((w) => w.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function WorkCenterFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const workCenters = useWorkCenterStore((s) => s.workCenters)
  const existing = useWorkCenterStore((s) => (id ? s.getWorkCenter(id) : undefined))
  const addWorkCenter = useWorkCenterStore((s) => s.addWorkCenter)
  const updateWorkCenter = useWorkCenterStore((s) => s.updateWorkCenter)
  const warehouses = useActiveWarehouses()
  const departmentOptions = useDepartmentOptions()
  const isEdit = !!id && !!existing
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? {
          ...existing,
          inputWarehouseCode: existing.inputWarehouseCode ?? '',
          wipWarehouseCode: existing.wipWarehouseCode ?? '',
          outputWarehouseCode: existing.outputWarehouseCode ?? '',
        }
      : {
          workCenterCode: '',
          workCenterName: '',
          department: 'Fabrication',
          plantCode: 'PUNE',
          capacityHoursPerDay: 16,
          costRatePerHour: 800,
          description: '',
          inputWarehouseCode: '',
          wipWarehouseCode: '',
          outputWarehouseCode: '',
          isActive: true,
        },
  })
  const watched = useWatch({ control })

  function onSubmit(data: FormData) {
    const validation = codeSeriesRef.current?.validateBeforeSave(data.workCenterCode, {
      checkDuplicate: (c) => workCenters.some((w) => w.workCenterCode === c && w.id !== id),
    })
    if (validation && !validation.ok) {
      setSaveError(validation.message ?? 'Invalid code')
      return
    }
    setSaveError(null)
    const payload = {
      ...data,
      inputWarehouseCode: data.inputWarehouseCode || null,
      wipWarehouseCode: data.wipWarehouseCode || null,
      outputWarehouseCode: data.outputWarehouseCode || null,
    }
    if (isEdit && id) {
      updateWorkCenter(id, payload)
      notifyMasterSaved('Work Center', false)
      navigate(`/masters/work-centers/${id}`)
    } else {
      const newId = addWorkCenter(payload)
      codeSeriesRef.current?.confirmSaved(data.workCenterCode)
      notifyMasterSaved('Work Center', true)
      navigate(`/masters/work-centers/${newId}`)
    }
  }

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate(isEdit ? `/masters/work-centers/${id}` : '/masters/work-centers')
  }

  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  function warehouseSelect(name: 'inputWarehouseCode' | 'wipWarehouseCode' | 'outputWarehouseCode', label: string) {
    return (
      <FormField label={label} error={errors[name]?.message}>
        <Select {...register(name)}>
          <option value="">— Select —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.warehouseCode}>
              {w.warehouseCode} — {w.warehouseName}
            </option>
          ))}
        </Select>
      </FormField>
    )
  }

  return (
    <FormLayout
      masterGroupId="manufacturing"
      title={isEdit ? 'Edit Work Center' : 'New Work Center'}
      backTo={isEdit ? `/masters/work-centers/${id}` : '/masters/work-centers'}
      backLabel="Work Centers"
      onSubmit={handleSubmit(onSubmit)}
      validationErrors={validationErrors}
      onCancel={cancelForm}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <MasterCodeField
          entityType="work_center"
          isEdit={isEdit}
          existingCode={existing?.workCenterCode}
          value={watched.workCenterCode ?? ''}
          onChange={(v) => setValue('workCenterCode', v, { shouldValidate: true })}
          onSeriesReady={(h) => { codeSeriesRef.current = h }}
          error={errors.workCenterCode?.message}
          label="Work Center Code"
          required
        />
        <FormField label="Work Center Name" error={errors.workCenterName?.message}>
          <Input {...register('workCenterName')} placeholder="Cutting Bay" />
        </FormField>
        <FormField label="Department" error={errors.department?.message}>
          <Select {...register('department')}>
            <option value="">— Select —</option>
            {departmentOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Plant" error={errors.plantCode?.message}>
          <Input {...register('plantCode')} />
        </FormField>
        <FormField label="Capacity (hrs/day)" error={errors.capacityHoursPerDay?.message}>
          <Input type="number" step="0.5" {...register('capacityHoursPerDay')} />
        </FormField>
        <FormField label="Cost Rate / Hour" error={errors.costRatePerHour?.message}>
          <Input type="number" step="0.01" {...register('costRatePerHour')} />
        </FormField>
      </div>

      <div className="mt-6 rounded-lg border border-erp-border bg-slate-50/80 p-4">
        <h3 className="text-sm font-semibold text-erp-text">Warehouse Movement Mapping</h3>
        <p className="mt-1 text-xs text-erp-muted">
          Routing operations inherit these rules — MOVE_TO_WIP on start, MOVE_FROM_WIP on complete / QC pass.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {warehouseSelect('inputWarehouseCode', 'Input Warehouse')}
          {warehouseSelect('wipWarehouseCode', 'WIP Warehouse')}
          {warehouseSelect('outputWarehouseCode', 'Output Warehouse')}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Description" className="sm:col-span-2">
          <Textarea {...register('description')} rows={2} />
        </FormField>
        <FormField label="Active">
          <Checkbox {...register('isActive')} label="Work center is active" />
        </FormField>
      </div>
    </FormLayout>
  )
}

export function WorkCenterDetailPage() {
  const { id } = useParams()
  const wc = useWorkCenterStore((s) => (id ? s.getWorkCenter(id) : undefined))
  if (!wc) return <div className="erp-page py-12 text-center text-erp-muted">Work center not found</div>

  return (
    <DetailLayout
      masterGroupId="production"
      title={wc.workCenterName}
      subtitle={wc.workCenterCode}
      backTo="/masters/work-centers"
      backLabel="Work Centers"
      editTo={`/masters/work-centers/${wc.id}/edit`}
      badges={<ActiveBadge isActive={wc.isActive} />}
    >
      <DetailSection title="Work Center Details">
        <DetailGrid>
          <DetailField label="Code" value={<span className="font-mono">{wc.workCenterCode}</span>} />
          <DetailField label="Department" value={wc.department} />
          <DetailField label="Plant" value={wc.plantCode} />
          <DetailField label="Capacity" value={`${wc.capacityHoursPerDay} hrs/day`} />
          <DetailField label="Cost Rate" value={formatCurrency(wc.costRatePerHour)} />
          <DetailField label="Description" value={wc.description || '—'} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Warehouse Movement Mapping">
        <DetailGrid>
          <DetailField label="Input Warehouse" value={warehouseLabel(wc.inputWarehouseCode)} />
          <DetailField label="WIP Warehouse" value={warehouseLabel(wc.wipWarehouseCode)} />
          <DetailField label="Output Warehouse" value={warehouseLabel(wc.outputWarehouseCode)} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
