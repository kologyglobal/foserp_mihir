import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { type ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { DataTable } from '@/components/tables/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { ItemLookupSelect } from '@/components/lookups/ItemLookupSelect'
import { LocationEntryField } from '@/components/masters/LocationEntryField'
import { useActiveLocations } from '../../hooks/useMasterLists'
import { getDefaultLocationId, resolveLocationWarehouseId } from '@/utils/locationUtils'
import { useInventoryStore } from '@/store/inventoryStore'
import { useMasterStore } from '@/store/masterStore'
import { formatNumber } from '@/utils/formatters/currency'
import type { StockReservation } from '@/types/inventory'

const schema = z.object({
  itemId: z.string().min(1, 'Select item'),
  locationId: z.string().min(1, 'Select location code'),
  qty: z.coerce.number().positive('Quantity must be positive'),
  demandType: z.enum(['SO', 'WO']),
  demandId: z.string().min(1, 'Enter SO or WO number'),
  remarks: z.string(),
})

type FormData = z.infer<typeof schema>

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
]

const DEMAND_OPTIONS = [
  { value: 'all', label: 'All Demand' },
  { value: 'SO', label: 'Sales Order' },
  { value: 'WO', label: 'Work Order' },
]

export function ReservationsPage() {
  const reservations = useInventoryStore((s) => s.reservations)
  const createReservation = useInventoryStore((s) => s.createReservation)
  const cancelReservation = useInventoryStore((s) => s.cancelReservation)
  const fulfillReservation = useInventoryStore((s) => s.fulfillReservation)
  const getFreeQty = useInventoryStore((s) => s.getFreeQty)

  const allLocations = useActiveLocations()
  const defaultLocationId = getDefaultLocationId(allLocations, 'all')
  const getItem = useMasterStore((s) => s.getItem)
  const getLocationName = useMasterStore((s) => s.getLocationName)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)

  const [statusFilter, setStatusFilter] = useState('active')
  const [demandFilter, setDemandFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [locationId, setLocationId] = useState(defaultLocationId)
  const [warehouseId, setWarehouseId] = useState(() => resolveLocationWarehouseId(defaultLocationId, allLocations) ?? '')

  const filtered = useMemo(
    () =>
      reservations.filter((r) => {
        const matchStatus = statusFilter === 'all' || r.status === statusFilter
        const matchDemand = demandFilter === 'all' || r.demandType === demandFilter
        return matchStatus && matchDemand
      }),
    [reservations, statusFilter, demandFilter],
  )

  const { register, handleSubmit, watch, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { demandType: 'SO', remarks: '', locationId: defaultLocationId },
  })

  const itemId = watch('itemId')
  const freeQty = itemId && warehouseId ? getFreeQty(itemId, warehouseId) : null

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const onSubmit = handleSubmit((data) => {
    const whId = resolveLocationWarehouseId(data.locationId, allLocations)
    if (!whId) {
      showToast('Selected location has no warehouse posting')
      return
    }
    const result = createReservation({ ...data, warehouseId: whId })
    if (result.ok) {
      showToast('Reservation created')
      reset({ demandType: 'SO', remarks: '', locationId: defaultLocationId })
      setLocationId(defaultLocationId)
      setWarehouseId(resolveLocationWarehouseId(defaultLocationId, allLocations) ?? '')
      setModalOpen(false)
    } else {
      showToast(result.error ?? 'Failed to create reservation')
    }
  })

  const columns: ColumnDef<StockReservation, unknown>[] = [
    {
      id: 'item',
      header: 'Item',
      cell: ({ row }) => {
        const item = getItem(row.original.itemId)
        return (
          <div>
            <Link to={`/inventory/stock/${row.original.itemId}`} className="font-mono text-xs text-erp-accent hover:underline">
              {item?.itemCode ?? '—'}
            </Link>
            <p className="text-sm text-slate-700">{item?.itemName ?? '—'}</p>
          </div>
        )
      },
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => {
        const wh = getWarehouse(row.original.warehouseId)
        return wh?.warehouseCode ?? getLocationName(row.original.warehouseId) ?? '—'
      },
    },
    { accessorKey: 'qty', header: 'Qty', cell: ({ row }) => formatNumber(row.original.qty) },
    {
      accessorKey: 'demandType',
      header: 'Demand',
      cell: ({ row }) => (
        <Badge color={row.original.demandType === 'SO' ? 'blue' : 'purple'}>
          {row.original.demandType}
        </Badge>
      ),
    },
    { accessorKey: 'demandId', header: 'SO / WO No', cell: ({ row }) => <span className="font-mono text-xs">{row.original.demandId}</span> },
    { accessorKey: 'remarks', header: 'Remarks', cell: ({ row }) => <span className="max-w-[200px] truncate text-xs">{row.original.remarks}</span> },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge color={row.original.status === 'active' ? 'green' : row.original.status === 'fulfilled' ? 'gray' : 'red'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        if (row.original.status !== 'active') return '—'
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const r = fulfillReservation(row.original.id)
                showToast(r.ok ? 'Reservation fulfilled' : (r.error ?? 'Failed'))
              }}
            >
              Fulfill
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const r = cancelReservation(row.original.id)
                showToast(r.ok ? 'Reservation cancelled' : (r.error ?? 'Failed'))
              }}
            >
              Cancel
            </Button>
          </div>
        )
      },
    },
  ]

  const activeCount = reservations.filter((r) => r.status === 'active').length
  const soCount = reservations.filter((r) => r.status === 'active' && r.demandType === 'SO').length
  const woCount = reservations.filter((r) => r.status === 'active' && r.demandType === 'WO').length

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title="Stock Reservations"
        description="Reserve stock against Sales Orders (SO) and Work Orders (WO) — reduces free stock"
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Reservation
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Active Reservations</p>
          <p className="text-2xl font-bold">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Linked to Sales Orders</p>
          <p className="text-2xl font-bold text-blue-600">{soCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Linked to Work Orders</p>
          <p className="text-2xl font-bold text-purple-600">{woCount}</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-erp-border p-4">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={demandFilter} onChange={(e) => setDemandFilter(e.target.value)} className="w-44">
            {DEMAND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
        <DataTable data={filtered} columns={columns} />
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-erp-border px-5 py-4">
              <h3 className="font-semibold text-slate-900">Create Reservation</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onSubmit} className="space-y-4 p-5">
              <FormField label="Item" required error={errors.itemId?.message}>
                <Controller
                  name="itemId"
                  control={control}
                  render={({ field }) => (
                    <ItemLookupSelect
                      value={field.value ?? ''}
                      onChange={(sel) => field.onChange(sel?.itemId ?? '')}
                      error={Boolean(errors.itemId)}
                    />
                  )}
                />
              </FormField>
              <input type="hidden" {...register('locationId')} />
              <LocationEntryField
                label="Location Code"
                required
                value={locationId}
                error={errors.locationId?.message}
                onChange={(locId, whId) => {
                  setLocationId(locId)
                  setWarehouseId(whId)
                  setValue('locationId', locId, { shouldValidate: true })
                }}
              />
              {freeQty !== null && (
                <p className="text-xs text-slate-500">Free stock available: {formatNumber(freeQty)}</p>
              )}
              <FormField label="Quantity" required error={errors.qty?.message}>
                <Input type="number" step="any" min={0.001} {...register('qty')} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Demand Type" required>
                  <Select {...register('demandType')}>
                    <option value="SO">Sales Order (SO)</option>
                    <option value="WO">Work Order (WO)</option>
                  </Select>
                </FormField>
                <FormField label="SO / WO Number" required error={errors.demandId?.message}>
                  <Input {...register('demandId')} placeholder="SO-2026-0142" />
                </FormField>
              </div>
              <FormField label="Remarks">
                <Textarea {...register('remarks')} />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>Create Reservation</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
