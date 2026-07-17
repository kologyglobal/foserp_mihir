import { Link, useParams } from 'react-router-dom'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { DataGrid } from '../../components/design-system/DataGrid'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Button } from '../../components/ui/Button'
import { useApprovalStore } from '../../store/approvalStore'
import {
  APPROVAL_DOCUMENT_LABELS,
  type ApprovalDocumentType,
  type ApprovalRequest,
} from '../../types/approvalMatrix'
import {
  listPendingApprovalsForUser,
  getCurrentStep,
  canUserApproveStep,
  advanceApprovalStep,
  rejectApprovalStep,
  buildApprovalTimelineEvents,
} from '../../utils/approvalEngine'
import { getSessionUser, ERP_ROLE_LABELS } from '../../utils/permissions'
import { systemPrompt } from '../../utils/systemConfirm'
import { ApprovalTimeline } from '../../components/approval/ApprovalTimeline'
import { formatDate } from '../../utils/dates/format'
function entityLink(request: ApprovalRequest): string {
  switch (request.documentType) {
    case 'purchase_order':
      return `/purchase/po/${request.entityId}`
    case 'bom_revision':
      return `/masters/bom/${request.entityId}/manage`
    case 'routing_revision':
      return `/masters/routing/${request.entityId}`
    case 'engineering_change':
      return `/engineering/eco/${request.entityId}`
    case 'cost_override':
      return `/masters/products/${request.entityId}`
    case 'dispatch_override':
      return `/dispatch/${request.entityId}`
    case 'ncr_closure':
    case 'qc_reject_closure':
      return `/quality/ncr/${request.entityId}`
    case 'invoice_cancellation':
      return `/invoice/${request.entityId}`
    default:
      return '/approvals'
  }
}

export function MyApprovalsPage() {
  const user = getSessionUser()
  const pending = listPendingApprovalsForUser(user)
  const allRequests = useApprovalStore((s) => s.listRequests()).slice(0, 50)

  return (
    <OperationalPageShell
      title="My Approvals"
      description={`Pending items for ${ERP_ROLE_LABELS[user.role]}`}
      badge={`${pending.length} pending`}
    >
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Awaiting Your Action</h2>
        <DataGrid
          data={pending}
          columns={[
            {
              accessorKey: 'entityLabel',
              header: 'Document',
              cell: ({ row }) => (
                <Link to={`/approvals/${row.original.id}`} className="font-medium text-blue-600">
                  {row.original.entityLabel}
                </Link>
              ),
            },
            {
              accessorKey: 'documentType',
              header: 'Type',
              cell: ({ row }) => APPROVAL_DOCUMENT_LABELS[row.original.documentType as ApprovalDocumentType],
            },
            {
              accessorKey: 'submittedAt',
              header: 'Submitted',
              cell: ({ row }) => formatDate(row.original.submittedAt.slice(0, 10)),
            },
            {
              accessorKey: 'submittedByName',
              header: 'By',
            },
          ]}
          compact
          emptyMessage="No pending approvals for your role."
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Recent Approval History</h2>
        <DataGrid
          data={allRequests}
          columns={[
            {
              accessorKey: 'entityLabel',
              header: 'Document',
              cell: ({ row }) => (
                <Link to={`/approvals/${row.original.id}`} className="text-blue-600">
                  {row.original.entityLabel}
                </Link>
              ),
            },
            {
              accessorKey: 'documentType',
              header: 'Type',
              cell: ({ row }) => APPROVAL_DOCUMENT_LABELS[row.original.documentType as ApprovalDocumentType],
            },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row }) => <StatusBadge status={row.original.status} />,
            },
            {
              accessorKey: 'submittedAt',
              header: 'Date',
              cell: ({ row }) => formatDate(row.original.submittedAt.slice(0, 10)),
            },
          ]}
          compact
        />
      </section>
    </OperationalPageShell>
  )
}

export function ApprovalDetailPage() {
  const { id } = useParams()
  const request = useApprovalStore((s) => s.getRequest(id!))
  const approvers = useApprovalStore((s) => s.approvers)
  const user = getSessionUser()

  if (!request) {
    return (
      <OperationalPageShell title="Approval Not Found" description="">
        <p className="text-sm text-slate-600">The requested approval record was not found.</p>
      </OperationalPageShell>
    )
  }

  const approval = request
  const step = getCurrentStep(approval)
  const canAct = step ? canUserApproveStep(user, step, approvers) : false
  const timeline = buildApprovalTimelineEvents(approval)
  const docType = approval.documentType
  const entityId = approval.entityId

  function handleApprove() {
    advanceApprovalStep(docType, entityId, user)
    window.location.reload()
  }

  async function handleReject() {
    const remarks = await systemPrompt({
      title: 'Reject approval',
      description: `Reject ${approval.entityLabel}? Comments are required.`,
      fieldLabel: 'Rejection remarks',
      placeholder: 'Explain why this request is being rejected…',
      confirmLabel: 'Reject',
      cancelLabel: 'Cancel',
      variant: 'danger',
      required: true,
    })
    if (remarks == null) return
    rejectApprovalStep(docType, entityId, user, remarks)
    window.location.reload()
  }

  return (
    <OperationalPageShell
      title={request.entityLabel}
      description={APPROVAL_DOCUMENT_LABELS[request.documentType]}
      badge={request.status}
      actions={
        <Link to={entityLink(request)}>
          <Button size="sm" variant="secondary">Open Document</Button>
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Approval Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Status</dt>
              <dd><StatusBadge status={request.status} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Submitted by</dt>
              <dd>{request.submittedByName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Submitted</dt>
              <dd>{formatDate(request.submittedAt.slice(0, 10))}</dd>
            </div>
            {step && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Current step</dt>
                <dd>{step.approverLabel} — {step.ruleLabel}</dd>
              </div>
            )}
          </dl>

          {request.status === 'pending' && canAct && (
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={handleApprove}>Approve</Button>
              <Button size="sm" variant="secondary" onClick={handleReject}>Reject</Button>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Approval Timeline</h3>
          <ApprovalTimeline events={timeline} />
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold">Approver Chain</h3>
        <ol className="space-y-2">
          {request.steps.map((s) => (
            <li key={s.ruleId} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <span>{s.approverLabel} — {s.ruleLabel}</span>
              <StatusBadge status={s.status} />
            </li>
          ))}
        </ol>
      </div>
    </OperationalPageShell>
  )
}
