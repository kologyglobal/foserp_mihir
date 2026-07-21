import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, CoreMasterRowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, FormLayout, FormSection, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { ActiveBadge, TypeBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox } from '../../../components/forms/Inputs'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notifyMasterSaved } from '../../../store/toastStore'
import type { Warehouse, WarehouseType } from '../../../types/master'

const WAREHOUSE_TYPE_OPTIONS: Array<{ value: WarehouseType; label: string }> = [
  { value: 'main', label: 'Main Store' },
  { value: 'sub', label: 'Sub Store' },
  { value: 'wip', label: 'WIP' },
  { value: 'fg', label: 'Finished Goods' },
  { value: 'quarantine', label: 'Quarantine' },
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'finished_goods', label: 'Finished Goods (Prod)' },
  { value: 'work_in_progress', label: 'Work In Progress' },
  { value: 'receiving', label: 'Receiving' },
  { value: 'quality_hold', label: 'Quality Hold' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'vendor_return', label: 'Vendor Return' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'consumables', label: 'Consumables' },
  { value: 'scrap', label: 'Scrap' },
  { value: 'transit', label: 'Transit' },
  { value: 'dispatch', label: 'Dispatch' },
]

const schema = z.object({
  warehouseCode: z.string().min(1),
  warehouseName: z.string().min(1),
  warehouseType: z.enum(
    WAREHOUSE_TYPE_OPTIONS.map((o) => o.value) as [WarehouseType, ...WarehouseType[]],
  ),
  plantCode: z.string().min(1),
  address: z.string(),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

export function WarehouseListPage() {
  const warehouses = useMasterStore((s) => s.warehouses)
  const deleteWarehouse = useMasterStore((s) => s.deleteWarehouse)
  const activateWarehouse = useMasterStore((s) => s.activateWarehouse)
  const deactivateWarehouse = useMasterStore((s) => s.deactivateWarehouse)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = useMemo(
    () =>
      warehouses.filter((w) => {
        const s = search.toLowerCase()
        return (
          matchesStatusFilter(w.isActive, status) &&
          (typeFilter === 'all' || w.warehouseType === typeFilter) &&
          (w.warehouseCode.toLowerCase().includes(s) || w.warehouseName.toLowerCase().includes(s))
        )
      }),
    [warehouses, search, status, typeFilter],
  )

  const columns: ColumnDef<Warehouse, unknown>[] = [
    { accessorKey: 'warehouseCode', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.warehouseCode}</span> },
    { accessorKey: 'warehouseName', header: 'Name' },
    { accessorKey: 'warehouseType', header: 'Type', cell: ({ row }) => <TypeBadge value={row.original.warehouseType} color="purple" /> },
    { accessorKey: 'plantCode', header: 'Plant' },
    { accessorKey: 'address', header: 'Location' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => (
      <CoreMasterRowActions
        viewTo={`/masters/warehouses/${row.original.id}`}
        editTo={`/masters/warehouses/${row.original.id}/edit`}
        recordId={row.original.id}
        recordLabel={`${row.original.warehouseCode} — ${row.original.warehouseName}`}
        isActive={row.original.isActive}
        deleteRecord={deleteWarehouse}
        activateRecord={activateWarehouse}
        deactivateRecord={deactivateWarehouse}
      />
    ) },
  ]

  return (
    <MasterListShell
      title="Warehouse Master"
      description="Storage locations for raw materials, bought-out parts, WIP, and finished goods"
      masterGroupId="inventory"
      createLabel="New Warehouse"
      createTo="/masters/warehouses/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      extraFilters={
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-36">
          <option value="all">All Types</option>
          <option value="main">Main</option>
          <option value="sub">Sub</option>
          <option value="wip">WIP</option>
          <option value="fg">FG</option>
          <option value="quarantine">Quarantine</option>
        </Select>
      }
      stats={[
        { label: 'Warehouses', value: warehouses.length },
        { label: 'Main Stores', value: warehouses.filter((w) => w.warehouseType === 'main').length },
        { label: 'WIP Locations', value: warehouses.filter((w) => w.warehouseType === 'wip').length },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function WarehouseFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const warehouses = useMasterStore((s) => s.warehouses)
  const existing = useMasterStore((s) => (id ? s.getWarehouse(id) : undefined))
  const addWarehouse = useMasterStore((s) => s.addWarehouse)
  const updateWarehouse = useMasterStore((s) => s.updateWarehouse)
  const isEdit = Boolean(id && existing)
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing ?? { warehouseCode: '', warehouseName: '', warehouseType: 'main' as WarehouseType, plantCode: 'PUNE', address: '', isActive: true },
  })
  const watched = useWatch({ control })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSubmit(async (data) => {
      const validation = codeSeriesRef.current?.validateBeforeSave(data.warehouseCode, {
        checkDuplicate: (c) => warehouses.some((w) => w.warehouseCode === c && w.id !== id),
      })
      if (validation && !validation.ok) {
        setSaveError(validation.message ?? 'Invalid code')
        return
      }
      setSaveError(null)
      try {
        if (isEdit && id) {
          await resolveMaybeVoid(updateWarehouse(id, data))
          notifyMasterSaved('Warehouse', false)
          navigate(`/masters/warehouses/${id}`)
        } else {
          const newId = await resolveMaybeId(addWarehouse(data))
          codeSeriesRef.current?.confirmSaved(data.warehouseCode)
          notifyMasterSaved('Warehouse', true)
          navigate(`/masters/warehouses/${newId}`)
        }
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/masters/warehouses')
  }

  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  return (
    <FormLayout masterGroupId="inventory" backTo="/masters/warehouses" backLabel="Back to Warehouses" title={isEdit ? 'Edit Warehouse' : 'Create Warehouse'} onSubmit={onSubmit} isSubmitting={isSubmitting} validationErrors={validationErrors} onCancel={cancelForm}>
      <FormSection title="Warehouse Details">
      <MasterCodeField
        entityType="warehouse"
        isEdit={isEdit}
        existingCode={existing?.warehouseCode}
        value={watched.warehouseCode ?? ''}
        onChange={(v) => setValue('warehouseCode', v, { shouldValidate: true })}
        onSeriesReady={(h) => { codeSeriesRef.current = h }}
        error={errors.warehouseCode?.message}
        label="Warehouse Code"
        required
      />
      <FormField label="Warehouse Name" required error={errors.warehouseName?.message}><Input {...register('warehouseName')} error={!!errors.warehouseName} /></FormField>
      <FormField label="Type" required><Select {...register('warehouseType')}>{WAREHOUSE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></FormField>
      <FormField label="Plant Code"><Input {...register('plantCode')} /></FormField>
      <FormField label="Address" className="md:col-span-2"><Input {...register('address')} /></FormField>
      <div className="flex items-end md:col-span-2"><Checkbox label="Active" {...register('isActive')} /></div>
      </FormSection>
    </FormLayout>
  )
}

export function WarehouseDetailPage() {
  const { id } = useParams()
  const warehouse = useMasterStore((s) => (id ? s.getWarehouse(id) : undefined))
  const allCategories = useMasterStore((s) => s.categories)
  const categories = useMemo(() => allCategories.filter((c) => c.defaultWarehouseId === id), [allCategories, id])

  if (!warehouse) return <MasterNotFound message="Warehouse not found." />

  return (
    <DetailLayout backTo="/masters/warehouses" backLabel="Back to Warehouses" masterGroupId="inventory" title={warehouse.warehouseName} subtitle={warehouse.warehouseCode} editTo={`/masters/warehouses/${warehouse.id}/edit`} badges={<><TypeBadge value={warehouse.warehouseType} color="purple" /><ActiveBadge isActive={warehouse.isActive} /></>}>
      <div className="space-y-6">
        <DetailSection title="Warehouse Details">
          <DetailGrid>
            <DetailField label="Code" value={<span className="font-mono">{warehouse.warehouseCode}</span>} />
            <DetailField label="Type" value={<TypeBadge value={warehouse.warehouseType} color="purple" />} />
            <DetailField label="Plant" value={warehouse.plantCode} />
            <DetailField label="Address" value={warehouse.address} />
          </DetailGrid>
        </DetailSection>
        {categories.length > 0 && (
          <DetailSection title="Default for Categories">
            <ul className="space-y-1 text-sm text-erp-text">
              {categories.map((c) => <li key={c.id}>{c.categoryName} ({c.categoryCode})</li>)}
            </ul>
          </DetailSection>
        )}
      </div>
    </DetailLayout>
  )
}
