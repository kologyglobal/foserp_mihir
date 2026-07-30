import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, CoreMasterRowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, FormLayout, FormSection, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox } from '../../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../../components/forms/selectStandards'
import { useActiveLocations, useActiveWarehouses } from '../../../hooks/useMasterLists'
import { isApiMode } from '../../../config/apiConfig'
import {
  activateMasterApi,
  createMasterApi,
  deactivateMasterApi,
  deleteMasterApi,
  fetchMasterBins,
  updateMasterApi,
  type MasterRecordDto,
} from '../../../services/api/masterApi'
import { formatApiError } from '../../../services/api/apiErrors'
import { notifyMasterSaved } from '../../../store/toastStore'
import { usePurchaseMasterStore } from '../../../store/purchaseMasterStore'

export interface BinRecord {
  id: string
  code: string
  name: string
  warehouseId: string
  storageLocationId: string
  binType: string | null
  isActive: boolean
}

function mapDtoToBin(row: MasterRecordDto): BinRecord {
  return {
    id: row.id,
    code: row.code ?? '',
    name: row.name,
    warehouseId: row.warehouseId ?? '',
    storageLocationId: row.storageLocationId ?? '',
    binType: row.binType ?? null,
    isActive: row.status !== 'INACTIVE',
  }
}

const schema = z.object({
  code: z.string().trim().min(1, 'BIN code required').max(32),
  name: z.string().trim().min(1, 'BIN name required').max(200),
  warehouseId: z.string().uuid('Warehouse required'),
  storageLocationId: z.string().uuid('Storage location required'),
  binType: z.string().trim().max(32).optional(),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

function useBinRecords() {
  const [records, setRecords] = useState<BinRecord[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      if (isApiMode()) {
        const rows = await fetchMasterBins()
        setRecords(rows.map(mapDtoToBin))
      } else {
        const demo = usePurchaseMasterStore.getState().getByKind('bin-codes', false)
        setRecords(
          demo.map((e) => ({
            id: e.code,
            code: e.code,
            name: e.name,
            warehouseId: '',
            storageLocationId: '',
            binType: null,
            isActive: e.status !== 'inactive',
          })),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { records, loading, reload }
}

export function BinListPage() {
  const { records, loading, reload } = useBinRecords()
  const warehouses = useActiveWarehouses()
  const locations = useActiveLocations()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const warehouseName = (id: string) => warehouses.find((w) => w.id === id)?.warehouseName ?? '—'
  const locationName = (id: string) => locations.find((l) => l.id === id)?.locationName ?? '—'

  const filtered = useMemo(
    () =>
      records.filter((b) => {
        const s = search.toLowerCase()
        return (
          matchesStatusFilter(b.isActive, status) &&
          (b.code.toLowerCase().includes(s) || b.name.toLowerCase().includes(s))
        )
      }),
    [records, search, status],
  )

  const columns: ColumnDef<BinRecord, unknown>[] = [
    { accessorKey: 'code', header: 'BIN Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
    { accessorKey: 'name', header: 'BIN Name' },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: ({ row }) => warehouseName(row.original.warehouseId),
    },
    {
      id: 'location',
      header: 'Storage Location',
      cell: ({ row }) => locationName(row.original.storageLocationId),
    },
    { accessorKey: 'binType', header: 'Type', cell: ({ row }) => row.original.binType || '—' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) =>
        isApiMode() ? (
          <CoreMasterRowActions
            viewTo={`/masters/bins/${row.original.id}`}
            editTo={`/masters/bins/${row.original.id}/edit`}
            recordId={row.original.id}
            recordLabel={`${row.original.code} — ${row.original.name}`}
            isActive={row.original.isActive}
            deleteRecord={async (id) => {
              await deleteMasterApi('bins', id)
              await reload()
            }}
            activateRecord={async (id) => {
              await activateMasterApi('bins', id)
              await reload()
            }}
            deactivateRecord={async (id) => {
              await deactivateMasterApi('bins', id)
              await reload()
            }}
          />
        ) : (
          <span className="text-[11px] text-erp-muted">Demo store</span>
        ),
    },
  ]

  return (
    <MasterListShell
      title="BIN Code Master"
      description="Storage bin codes for purchase lines, GRN, and inventory"
      masterGroupId="inventory"
      createLabel="New BIN Code"
      createTo={isApiMode() ? '/masters/bins/new' : '/masters/bins'}
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'BIN codes', value: records.length },
        { label: 'Active', value: records.filter((b) => b.isActive).length },
      ]}
    >
      {loading ? <p className="p-4 text-sm text-erp-muted">Loading…</p> : <MasterRegisterTable data={filtered} columns={columns} />}
    </MasterListShell>
  )
}

export function BinFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const warehouses = useActiveWarehouses()
  const locations = useActiveLocations()
  const { records, reload } = useBinRecords()
  const existing = id ? records.find((b) => b.id === id) : undefined
  const isEdit = Boolean(id && existing)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? {
          code: existing.code,
          name: existing.name,
          warehouseId: existing.warehouseId,
          storageLocationId: existing.storageLocationId,
          binType: existing.binType ?? '',
          isActive: existing.isActive,
        }
      : {
          code: '',
          name: '',
          warehouseId: warehouses[0]?.id ?? '',
          storageLocationId: '',
          binType: '',
          isActive: true,
        },
  })
  const watched = useWatch({ control })
  const warehouseId = watch('warehouseId')
  const warehouseLocations = useMemo(
    () => locations.filter((l) => !warehouseId || l.warehouseId === warehouseId),
    [locations, warehouseId],
  )

  if (!isApiMode()) {
    return (
      <FormLayout
        masterGroupId="inventory"
        backTo="/masters/bins"
        backLabel="Back to BIN Codes"
        title="BIN Code Master"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="text-sm text-erp-muted">BIN master CRUD requires API mode. Demo bins are seeded in purchase setup.</p>
      </FormLayout>
    )
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSubmit(async (data) => {
      if (records.some((b) => b.code === data.code && b.id !== id)) {
        setSaveError('BIN code already exists')
        return
      }
      setSaveError(null)
      const payload = {
        code: data.code.trim(),
        name: data.name.trim(),
        warehouseId: data.warehouseId,
        storageLocationId: data.storageLocationId,
        binType: data.binType?.trim() || undefined,
        status: data.isActive ? 'ACTIVE' : 'INACTIVE',
      }
      try {
        if (isEdit && id) {
          await updateMasterApi('bins', id, payload)
          notifyMasterSaved('BIN Code', false)
          navigate(`/masters/bins/${id}`)
        } else {
          const created = await createMasterApi('bins', payload)
          notifyMasterSaved('BIN Code', true)
          navigate(`/masters/bins/${created.data.id}`)
        }
        await reload()
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  return (
    <FormLayout
      masterGroupId="inventory"
      backTo="/masters/bins"
      backLabel="Back to BIN Codes"
      title={isEdit ? 'Edit BIN Code' : 'Create BIN Code'}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      validationErrors={validationErrors}
      onCancel={() => navigate('/masters/bins')}
    >
      <FormSection title="BIN Details">
        <FormField label="BIN Code" required error={errors.code?.message}>
          <Input
            {...register('code')}
            disabled={isEdit}
            readOnly={isEdit}
            error={!!errors.code}
          />
        </FormField>
        <FormField label="BIN Name" required error={errors.name?.message}>
          <Input {...register('name')} error={!!errors.name} />
        </FormField>
        <FormField label="Warehouse" required error={errors.warehouseId?.message}>
          <Select
            value={watched.warehouseId ?? ''}
            onChange={(e) => {
              setValue('warehouseId', e.target.value, { shouldValidate: true })
              setValue('storageLocationId', '', { shouldValidate: true })
            }}
          >
            <option value="">{SELECT_PLACEHOLDER}</option>
            {warehouses.filter((w) => w.isActive).map((w) => (
              <option key={w.id} value={w.id}>
                {w.warehouseCode} — {w.warehouseName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Storage Location" required error={errors.storageLocationId?.message}>
          <Select {...register('storageLocationId')} disabled={!warehouseId}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {warehouseLocations.filter((l) => l.isActive).map((l) => (
              <option key={l.id} value={l.id}>
                {l.locationCode} — {l.locationName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="BIN Type">
          <Input {...register('binType')} placeholder="Optional" />
        </FormField>
        <div className="flex items-end md:col-span-2">
          <Checkbox label="Active" {...register('isActive')} />
        </div>
      </FormSection>
    </FormLayout>
  )
}

export function BinDetailPage() {
  const { id } = useParams()
  const { records } = useBinRecords()
  const warehouses = useActiveWarehouses()
  const locations = useActiveLocations()
  const record = id ? records.find((b) => b.id === id) : undefined

  if (!record) return <MasterNotFound message="BIN code not found." />

  const warehouse = warehouses.find((w) => w.id === record.warehouseId)
  const location = locations.find((l) => l.id === record.storageLocationId)

  return (
    <DetailLayout
      backTo="/masters/bins"
      backLabel="Back to BIN Codes"
      masterGroupId="inventory"
      title={record.name}
      subtitle={record.code}
      editTo={isApiMode() ? `/masters/bins/${record.id}/edit` : undefined}
      badges={<ActiveBadge isActive={record.isActive} />}
    >
      <DetailSection title="BIN Details">
        <DetailGrid>
          <DetailField label="Code" value={<span className="font-mono">{record.code}</span>} />
          <DetailField label="Warehouse" value={warehouse ? `${warehouse.warehouseCode} — ${warehouse.warehouseName}` : '—'} />
          <DetailField label="Storage Location" value={location ? `${location.locationCode} — ${location.locationName}` : '—'} />
          <DetailField label="BIN Type" value={record.binType || '—'} />
          <DetailField label="Status" value={<ActiveBadge isActive={record.isActive} />} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}

export const BinMasterIcon = MapPin
