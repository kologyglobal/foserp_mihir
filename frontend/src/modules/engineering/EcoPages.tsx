import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { DataGrid } from '../../components/design-system/DataGrid'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useEcoStore } from '../../store/ecoStore'
import { PermissionGate } from '../../components/auth/ProtectedRoute'
import { formatDate } from '../../utils/dates/format'
import { ApprovalChainPanel } from '../../components/approval/ApprovalChainPanel'
import { EntityDocumentsPanel } from '../../components/dms/EntityDocumentsPanel'

export function EcoRegisterPage() {
  const ecrsRaw = useEcoStore((s) => s.ecrs)
  const ecosRaw = useEcoStore((s) => s.ecos)
  const ecrs = useMemo(
    () => [...ecrsRaw].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [ecrsRaw],
  )
  const ecos = useMemo(
    () => [...ecosRaw].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [ecosRaw],
  )

  return (
    <OperationalPageShell
      title="Engineering Change Control"
      description="ECR → Review → Impact Analysis → ECO → Approval → Release → Implementation"
      badge={`${ecrs.length} ECR · ${ecos.length} ECO`}
      actions={
        <PermissionGate module="engineering" action="create">
          <Link to="/engineering/eco/new">
            <Button size="sm">New ECR</Button>
          </Link>
        </PermissionGate>
      }
    >
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Engineering Change Requests</h2>
          <DataGrid
            data={ecrs}
            columns={[
              {
                accessorKey: 'ecrNo',
                header: 'ECR No',
                cell: ({ row }) => (
                  <Link to={`/engineering/eco/${row.original.id}`} className="font-medium text-blue-600">
                    {row.original.ecrNo}
                  </Link>
                ),
              },
              { accessorKey: 'changeType', header: 'Type', cell: ({ row }) => <StatusBadge status={row.original.changeType} /> },
              { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <StatusBadge status={row.original.priority} /> },
              { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
              { accessorKey: 'requestedBy', header: 'Requested By' },
              { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDate(row.original.createdAt) },
            ]}
            compact
          />
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Engineering Change Orders</h2>
          <DataGrid
            data={ecos}
            columns={[
              { accessorKey: 'ecoNo', header: 'ECO No' },
              { accessorKey: 'ecrId', header: 'Linked ECR' },
              { accessorKey: 'effectiveDate', header: 'Effective Date' },
              { accessorKey: 'approvalStatus', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.approvalStatus} /> },
              { accessorKey: 'costImpact', header: 'Cost Impact', cell: ({ row }) => `₹${row.original.costImpact.toLocaleString()}` },
            ]}
            compact
          />
        </section>
      </div>
    </OperationalPageShell>
  )
}

export function EcoNewPage() {
  const createEcr = useEcoStore((s) => s.createEcr)

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createEcr({
      changeType: fd.get('changeType') as 'bom',
      productId: (fd.get('productId') as string) || null,
      bomId: (fd.get('bomId') as string) || null,
      reason: fd.get('reason') as string,
      priority: (fd.get('priority') as 'medium') || 'medium',
    })
    window.location.href = '/engineering/eco'
  }

  return (
    <OperationalPageShell title="New Engineering Change Request" description="Submit a formal change request for engineering review.">
      <form onSubmit={handleCreate} className="max-w-xl space-y-4 rounded-lg border bg-white p-6">
        <label className="block text-sm">
          Change Type
          <select name="changeType" className="mt-1 w-full rounded border px-3 py-2">
            <option value="bom">BOM</option>
            <option value="routing">Routing</option>
            <option value="product">Product</option>
            <option value="item">Item</option>
          </select>
        </label>
        <label className="block text-sm">
          Product ID
          <input name="productId" className="mt-1 w-full rounded border px-3 py-2" placeholder="prod-45m3" />
        </label>
        <label className="block text-sm">
          BOM ID
          <input name="bomId" className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">
          Priority
          <select name="priority" className="mt-1 w-full rounded border px-3 py-2">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="block text-sm">
          Reason
          <textarea name="reason" required className="mt-1 w-full rounded border px-3 py-2" rows={4} />
        </label>
        <Button type="submit">Create ECR</Button>
      </form>
    </OperationalPageShell>
  )
}

export function EcoDetailPage() {
  const { id } = useParams()
  const ecr = useEcoStore((s) => s.ecrs.find((e) => e.id === id))
  const eco = useEcoStore((s) => s.ecos.find((e) => e.ecrId === id))
  const impact = useMemo(
    () => (id ? useEcoStore.getState().computeImpactAnalysis(id) : null),
    [id, ecr, eco],
  )
  const submitEcr = useEcoStore((s) => s.submitEcr)
  const startReview = useEcoStore((s) => s.startEngineeringReview)
  const completeImpact = useEcoStore((s) => s.completeImpactAnalysis)
  const approveForEco = useEcoStore((s) => s.approveEcrForEco)
  const submitEco = useEcoStore((s) => s.submitEcoForApproval)
  const approveEco = useEcoStore((s) => s.approveEco)
  const releaseEco = useEcoStore((s) => s.releaseEco)
  const implementEco = useEcoStore((s) => s.implementEco)

  if (!ecr) {
    return (
      <OperationalPageShell title="ECR Not Found" description="">
        <p className="text-sm text-slate-600">The requested change request was not found.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell title={ecr.ecrNo} description={ecr.reason} badge={ecr.status}>
      <div className="mb-6 flex flex-wrap gap-2">
        {ecr.status === 'draft' && (
          <Button size="sm" onClick={() => submitEcr(ecr.id)}>
            Submit ECR
          </Button>
        )}
        {ecr.status === 'submitted' && (
          <Button size="sm" onClick={() => startReview(ecr.id)}>
            Start Review
          </Button>
        )}
        {ecr.status === 'under_review' && (
          <Button size="sm" onClick={() => completeImpact(ecr.id)}>
            Complete Impact Analysis
          </Button>
        )}
        {ecr.status === 'impact_analysis' && (
          <Button size="sm" onClick={() => approveForEco(ecr.id)}>
            Approve for ECO
          </Button>
        )}
        {eco && eco.approvalStatus === 'draft' && (
          <Button size="sm" onClick={() => submitEco(eco.id)}>
            Submit ECO for Approval
          </Button>
        )}
        {eco && eco.approvalStatus === 'pending_approval' && (
          <Button size="sm" onClick={() => approveEco(eco.id)}>
            Approve ECO
          </Button>
        )}
        {eco && eco.approvalStatus === 'approved' && (
          <Button size="sm" onClick={() => releaseEco(eco.id)}>
            Release ECO
          </Button>
        )}
        {eco && eco.approvalStatus === 'released' && (
          <Button size="sm" onClick={() => implementEco(eco.id)}>
            Implement ECO
          </Button>
        )}
      </div>

      {eco && (
        <div className="mb-6 rounded-lg border bg-white p-4 text-sm">
          <p>
            <strong>{eco.ecoNo}</strong> — Effective {eco.effectiveDate} — {eco.approvalStatus}
          </p>
          <div className="mt-4">
            <ApprovalChainPanel documentType="engineering_change" entityId={eco.id} />
          </div>
          <div className="mt-4">
            <EntityDocumentsPanel entityType="eco" entityId={eco.id} entityLabel={eco.ecoNo} title="ECO Drawings & Attachments" />
          </div>
        </div>
      )}

      {impact && (
        <div className="grid gap-4 md:grid-cols-2">
          <ImpactPanel title="Open Work Orders" rows={impact.openWorkOrders.map((w) => `${w.woNo} (${w.status})`)} />
          <ImpactPanel title="Open Sales Orders" rows={impact.openSalesOrders.map((s) => `${s.salesOrderNo} (${s.status})`)} />
          <ImpactPanel title="BOMs" rows={impact.boms.map((b) => `${b.bomNo} Rev ${b.revision}`)} />
          <ImpactPanel title="Open POs" rows={impact.openPurchaseOrders.map((p) => `${p.poNo} — ₹${p.totalAmount}`)} />
        </div>
      )}
    </OperationalPageShell>
  )
}

function ImpactPanel({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-1 text-xs text-slate-600">
        {rows.length === 0 ? <li>None</li> : rows.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </div>
  )
}
