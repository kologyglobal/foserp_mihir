import { useMemo, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import { DataTable } from '../../../components/tables/DataTable'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, RowActions } from '../../../components/masters/MasterListShell'
import { DetailLayout, FormLayout, FormSection } from '../../../components/masters/MasterLayouts'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Select, Textarea } from '../../../components/forms/Inputs'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { SectionCard } from '../../../components/ui/SectionCard'
import { RoutingApprovalBar } from '../../../components/routing/RoutingApprovalBar'
import { ApprovalChainPanel } from '../../../components/approval/ApprovalChainPanel'
import { QcChecklistPanel } from '../../../components/production/QcChecklistPanel'
import { useRoutingStore } from '../../../store/routingStore'
import { useMasterStore } from '../../../store/masterStore'
import { useWorkCenterStore } from '../../../store/workCenterStore'
import { hasInactiveWorkCenters, enrichRoutingOperations } from '../../../utils/routing'
import type { RoutingHeader, RoutingOperationEnriched } from '../../../types/routing'
import type { Resolver } from 'react-hook-form'
import { useActiveProducts, useActiveWorkCenters } from '../../../hooks/useMasterLists'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'

const schema = z.object({
  productId: z.string().min(1, 'Select a product'),
  routingNo: z.string().min(1, 'Routing number is required'),
  description: z.string().min(1, 'Description is required'),
})

type FormData = z.infer<typeof schema>

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'released', label: 'Released' },
  { value: 'obsolete', label: 'Obsolete' },
]

export function RoutingListPage() {
  const routingHeaders = useRoutingStore((s) => s.routingHeaders)
  const products = useMasterStore((s) => s.products)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const filtered = useMemo(
    () =>
      routingHeaders.filter((r) => {
        const product = productMap.get(r.productId)
        const s = search.toLowerCase()
        return (
          (status === 'all' || r.status === status) &&
          (r.routingNo.toLowerCase().includes(s) ||
            r.revision.toLowerCase().includes(s) ||
            product?.productName.toLowerCase().includes(s) ||
            product?.productCode.toLowerCase().includes(s))
        )
      }),
    [routingHeaders, search, status, productMap],
  )

  const columns: ColumnDef<RoutingHeader, unknown>[] = [
    {
      accessorKey: 'routingNo',
      header: 'Routing No',
      cell: ({ row }) => (
        <Link to={`/masters/routing/${row.original.id}`} className="font-mono text-[13px] font-semibold text-erp-primary hover:underline">
          {row.original.routingNo}
        </Link>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      cell: ({ row }) => {
        const p = productMap.get(row.original.productId)
        return (
          <div>
            <p className="text-[13px] font-medium">{p?.productName ?? '—'}</p>
            <p className="font-mono text-[11px] text-erp-muted">{p?.productCode}</p>
          </div>
        )
      },
    },
    { accessorKey: 'revision', header: 'Revision', cell: ({ row }) => <Badge color="purple">{row.original.revision}</Badge> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      accessorKey: 'totalStdHours',
      header: 'Std Hours',
      cell: ({ row }) => row.original.totalStdHours.toFixed(1),
      meta: { align: 'right' },
    },
    {
      id: 'production',
      header: 'Production',
      cell: ({ row }) =>
        row.original.status === 'released' ? (
          <Badge color="green">Eligible</Badge>
        ) : (
          <Badge color="gray">Not Ready</Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions viewTo={`/masters/routing/${row.original.id}`} />
      ),
    },
  ]

  return (
    <MasterListShell
      title="Manufacturing Routing"
      description="Product routing — operation sequence, work centers, and standard times"
      masterGroupId="production"
      createLabel="New Routing"
      createTo="/masters/routing/new"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search routing no, product, revision..."
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Total Routings', value: routingHeaders.length },
        { label: 'Released', value: routingHeaders.filter((r) => r.status === 'released').length, accent: 'green' },
        { label: 'Draft', value: routingHeaders.filter((r) => r.status === 'draft').length },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function RoutingFormPage() {
  const navigate = useNavigate()
  const products = useActiveProducts()
  const createRouting = useRoutingStore((s) => s.createRouting)
  const routingHeaders = useRoutingStore((s) => s.routingHeaders)
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { productId: '', routingNo: '', description: '' },
  })
  const watched = useWatch({ control })

  function onSubmit(data: FormData) {
    const validation = codeSeriesRef.current?.validateBeforeSave(data.routingNo, {
      checkDuplicate: (c) => routingHeaders.some((r) => r.routingNo === c),
    })
    if (validation && !validation.ok) {
      setSaveError(validation.message ?? 'Invalid routing number')
      return
    }
    setSaveError(null)
    const id = createRouting(data.productId, data.description, data.routingNo)
    codeSeriesRef.current?.confirmSaved(data.routingNo)
    navigate(`/masters/routing/${id}`)
  }

  return (
    <FormLayout
      masterGroupId="manufacturing"
      title="New Manufacturing Routing"
      subtitle="Routing belongs to Product — define operation sequence after creation"
      backTo="/masters/routing"
      backLabel="Routing"
      onSubmit={handleSubmit(onSubmit)}
    >
      <FormSection title="Routing Header">
        <MasterCodeField
          entityType="routing"
          label="Routing No"
          value={watched.routingNo ?? ''}
          onChange={(v) => setValue('routingNo', v, { shouldValidate: true })}
          onSeriesReady={(h) => { codeSeriesRef.current = h }}
          error={errors.routingNo?.message ?? saveError ?? undefined}
          required
        />
        <FormField label="Product" error={errors.productId?.message}>
          <Select {...register('productId')}>
            <option value="">Select product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.productCode} — {p.productName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Description" error={errors.description?.message} className="md:col-span-2">
          <Textarea {...register('description')} rows={2} placeholder="Standard routing for…" />
        </FormField>
      </FormSection>
    </FormLayout>
  )
}

export function RoutingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const routing = useRoutingStore((s) => (id ? s.getRouting(id) : undefined))
  const routingOperations = useRoutingStore((s) => s.routingOperations)
  const submitForApproval = useRoutingStore((s) => s.submitForApproval)
  const approveRouting = useRoutingStore((s) => s.approveRouting)
  const releaseRouting = useRoutingStore((s) => s.releaseRouting)
  const reviseRouting = useRoutingStore((s) => s.reviseRouting)
  const removeOperation = useRoutingStore((s) => s.removeOperation)
  const addOperation = useRoutingStore((s) => s.addOperation)
  const product = useMasterStore((s) => (routing ? s.getProduct(routing.productId) : undefined))
  const allWorkCenters = useWorkCenterStore((s) => s.workCenters)
  const workCenters = useActiveWorkCenters()
  const [toast, setToast] = useState('')

  const operations = useMemo((): RoutingOperationEnriched[] => {
    if (!routing) return []
    const ops = routingOperations
      .filter((o) => o.routingHeaderId === routing.id)
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
    return enrichRoutingOperations(ops, allWorkCenters)
  }, [routing, routingOperations, allWorkCenters])

  const inactiveWc = useMemo(() => {
    if (!routing) return false
    const ops = routingOperations.filter((o) => o.routingHeaderId === routing.id)
    return hasInactiveWorkCenters(ops, allWorkCenters)
  }, [routing, routingOperations, allWorkCenters])

  const [newOp, setNewOp] = useState({
    operationCode: '',
    sequenceNo: '',
    operationName: '',
    workCenterId: workCenters[0]?.id ?? '',
    standardHours: '8',
    setupTimeHours: '1',
    runTimeHours: '7',
    laborRequirement: '2',
    qcRequired: false,
    outsourced: false,
  })

  if (!routing) return <div className="erp-page py-12 text-center text-erp-muted">Routing not found</div>

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const opColumns: ColumnDef<RoutingOperationEnriched, unknown>[] = [
    { accessorKey: 'sequenceNo', header: 'Seq', meta: { align: 'right' } },
    { accessorKey: 'operationCode', header: 'Op Code', cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.operationCode}</span> },
    { accessorKey: 'operationName', header: 'Operation' },
    {
      id: 'workCenter',
      header: 'Work Center',
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-[12px]">{row.original.workCenterCode}</p>
          <p className="text-[11px] text-erp-muted">{row.original.workCenterName}</p>
        </div>
      ),
    },
    { accessorKey: 'standardHours', header: 'Std Hrs', meta: { align: 'right' } },
    { accessorKey: 'setupTimeHours', header: 'Setup', meta: { align: 'right' } },
    { accessorKey: 'runTimeHours', header: 'Run', meta: { align: 'right' } },
    { accessorKey: 'laborRequirement', header: 'Labor', meta: { align: 'right' } },
    {
      accessorKey: 'qcRequired',
      header: 'QC',
      cell: ({ row }) => row.original.qcRequired ? <Badge color="yellow">Yes</Badge> : '—',
    },
    {
      accessorKey: 'outsourced',
      header: 'Outsourced',
      cell: ({ row }) => row.original.outsourced ? <Badge color="purple">Yes</Badge> : '—',
    },
    ...(routing.status === 'draft'
      ? [{
          id: 'del',
          header: '',
          enableSorting: false,
          cell: ({ row }: { row: { original: RoutingOperationEnriched } }) => (
            <button type="button" className="text-erp-danger" onClick={() => removeOperation(row.original.id)}>
              <Trash2 className="h-4 w-4" />
            </button>
          ),
        }]
      : []),
  ]

  return (
    <DetailLayout
      title={routing.routingNo}
      subtitle={`${product?.productName ?? '—'} · ${routing.revision} · ${routing.totalStdHours.toFixed(1)} std hrs`}
      backTo="/masters/routing"
      backLabel="Routing"
      editTo={routing.status === 'draft' ? `/masters/routing/${routing.id}#operations` : undefined}
      editLabel="Edit Operations"
      badges={<StatusBadge status={routing.status} />}
      breadcrumbs={[
        { label: 'Masters', to: '/masters' },
        { label: 'Routing', to: '/masters/routing' },
        { label: routing.routingNo },
      ]}
    >
      {toast && (
        <div className="mb-3 rounded-sm border border-erp-border bg-erp-primary-soft px-3 py-2 text-[13px] text-erp-primary">{toast}</div>
      )}

      <RoutingApprovalBar
        routing={routing}
        hasInactiveWorkCenters={inactiveWc}
        onSubmit={() => { const r = submitForApproval(routing.id); show(r.ok ? 'Submitted' : r.error ?? 'Failed') }}
        onApprove={() => { const r = approveRouting(routing.id, 'Production Manager'); show(r.ok ? 'Approved' : r.error ?? 'Failed') }}
        onRelease={() => { const r = releaseRouting(routing.id); show(r.ok ? 'Released — production eligible' : r.error ?? 'Failed') }}
      />

      <div className="mt-4">
        <ApprovalChainPanel documentType="routing_revision" entityId={routing.id} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {routing.status === 'approved' && (
          <Button size="sm" variant="secondary" onClick={() => {
            const newId = reviseRouting(routing.id)
            navigate(`/masters/routing/${newId}`)
          }}>
            <GitBranch className="h-4 w-4" /> Revise Routing
          </Button>
        )}
        {product && (
          <Link to={`/masters/products/${product.id}`} className="text-[13px] text-erp-primary hover:underline">
            View Product →
          </Link>
        )}
      </div>

      {routing.status === 'draft' && (
        <SectionCard title="Add Operation" subtitle="Sequence must be unique (10, 20, 30…)" className="mt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input className="h-8 rounded-sm border border-erp-border px-2 text-[13px]" placeholder="Op Code" value={newOp.operationCode} onChange={(e) => setNewOp({ ...newOp, operationCode: e.target.value })} />
            <input className="h-8 rounded-sm border border-erp-border px-2 text-[13px]" placeholder="Sequence" value={newOp.sequenceNo} onChange={(e) => setNewOp({ ...newOp, sequenceNo: e.target.value })} />
            <input className="h-8 rounded-sm border border-erp-border px-2 text-[13px]" placeholder="Operation Name" value={newOp.operationName} onChange={(e) => setNewOp({ ...newOp, operationName: e.target.value })} />
            <select className="h-8 rounded-sm border border-erp-border px-2 text-[13px]" value={newOp.workCenterId} onChange={(e) => setNewOp({ ...newOp, workCenterId: e.target.value })}>
              {workCenters.map((w) => <option key={w.id} value={w.id}>{w.workCenterCode}</option>)}
            </select>
            <input className="h-8 rounded-sm border border-erp-border px-2 text-[13px]" placeholder="Std Hrs" value={newOp.standardHours} onChange={(e) => setNewOp({ ...newOp, standardHours: e.target.value })} />
            <input className="h-8 rounded-sm border border-erp-border px-2 text-[13px]" placeholder="Setup Hrs" value={newOp.setupTimeHours} onChange={(e) => setNewOp({ ...newOp, setupTimeHours: e.target.value })} />
            <input className="h-8 rounded-sm border border-erp-border px-2 text-[13px]" placeholder="Run Hrs" value={newOp.runTimeHours} onChange={(e) => setNewOp({ ...newOp, runTimeHours: e.target.value })} />
            <input className="h-8 rounded-sm border border-erp-border px-2 text-[13px]" placeholder="Labor" value={newOp.laborRequirement} onChange={(e) => setNewOp({ ...newOp, laborRequirement: e.target.value })} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={newOp.qcRequired} onChange={(e) => setNewOp({ ...newOp, qcRequired: e.target.checked })} /> QC Required
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={newOp.outsourced} onChange={(e) => setNewOp({ ...newOp, outsourced: e.target.checked })} /> Outsourced
            </label>
            <Button size="sm" onClick={() => {
              const r = addOperation(routing.id, {
                operationCode: newOp.operationCode,
                sequenceNo: parseInt(newOp.sequenceNo, 10),
                operationName: newOp.operationName,
                workCenterId: newOp.workCenterId,
                standardHours: parseFloat(newOp.standardHours),
                setupTimeHours: parseFloat(newOp.setupTimeHours),
                runTimeHours: parseFloat(newOp.runTimeHours),
                laborRequirement: parseInt(newOp.laborRequirement, 10),
                qcRequired: newOp.qcRequired,
                outsourced: newOp.outsourced,
              })
              show(r.ok ? 'Operation added' : r.error ?? 'Failed')
            }}>
              <Plus className="h-4 w-4" /> Add Operation
            </Button>
          </div>
        </SectionCard>
      )}

      <div id="operations">
      <SectionCard title="Routing Operations" className="mt-4" noPadding>
        <DataTable data={operations} columns={opColumns} emptyMessage="No operations — add operations in draft status" />
      </SectionCard>

      {operations.some((op) => op.qcChecklist.length > 0) && (
        <SectionCard title="QC Checklists" subtitle="In-process inspection points per operation" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {operations
              .filter((op) => op.qcChecklist.length > 0)
              .map((op) => (
                <div key={op.id}>
                  <p className="mb-2 text-[13px] font-medium text-erp-text">
                    Operation {op.sequenceNo} · {op.operationName}
                  </p>
                  <QcChecklistPanel items={op.qcChecklist} readonly compact />
                </div>
              ))}
          </div>
        </SectionCard>
      )}
      </div>
    </DetailLayout>
  )
}
