import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataGrid } from '../../components/design-system/DataGrid'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useApprovalStore } from '../../store/approvalStore'
import {
  APPROVAL_DOCUMENT_LABELS,
  APPROVER_CODE_LABELS,
  type ApprovalDocumentType,
} from '../../types/approvalMatrix'
import { formatRuleCondition } from '../../utils/approvalEngine'
import { PRIMARY_ERP_ROLES } from '../../utils/permissions'
import { APPROVAL_CONDITION_TYPE_LABELS } from '../../types/approvalMatrix'

const ALL_ROLES = PRIMARY_ERP_ROLES
const DOC_FILTERS: Array<ApprovalDocumentType | 'all'> = [
  'all',
  'purchase_order',
  'bom_revision',
  'routing_revision',
  'engineering_change',
  'cost_override',
  'dispatch_override',
  'ncr_closure',
  'invoice_cancellation',
  'job_work_order',
]

export function ApprovalMatrixConfigPage() {
  const rules = useApprovalStore((s) => s.rules)
  const approvers = useApprovalStore((s) => s.approvers)
  const updateRule = useApprovalStore((s) => s.updateRule)
  const resetRulesToDefault = useApprovalStore((s) => s.resetRulesToDefault)
  const updateApproverRoles = useApprovalStore((s) => s.updateApproverRoles)
  const [filter, setFilter] = useState<ApprovalDocumentType | 'all'>('all')

  const filteredRules = useMemo(
    () => (filter === 'all' ? rules : rules.filter((r) => r.documentType === filter)),
    [rules, filter],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Workflow"
        description="Configurable approval routing — PO value tiers, BOM revisions, and cost overrides"
        actions={
          <Button size="sm" variant="secondary" onClick={() => resetRulesToDefault()}>
            Reset to defaults
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-erp-border bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" />
            Approver Roles
          </h2>
          <ul className="space-y-3">
            {approvers.map((a) => (
              <li key={a.code} className="rounded-md border border-erp-border p-3">
                <p className="font-medium">{a.label}</p>
                <p className="text-xs text-erp-muted mb-2">Code: {a.code}</p>
                <div className="flex flex-wrap gap-1">
                  {ALL_ROLES.map((role) => {
                    const on = a.mappedRoles.includes(role)
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          const next = on
                            ? a.mappedRoles.filter((r) => r !== role)
                            : [...a.mappedRoles, role]
                          updateApproverRoles(a.code, next)
                        }}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          on ? 'bg-erp-accent text-white' : 'bg-erp-surface-alt text-erp-muted'
                        }`}
                      >
                        {role}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-erp-border bg-white p-4">
          <h2 className="mb-3 font-medium">Default routing summary</h2>
          <ul className="space-y-2 text-sm text-erp-muted">
            <li>PO &gt; ₹5 Lakh → Purchase Head</li>
            <li>PO &gt; ₹25 Lakh → Director (after Purchase Head)</li>
            <li>BOM revision → Engineering Head</li>
            <li>Cost override → Finance</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {DOC_FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              filter === id ? 'border-erp-accent bg-erp-accent/5 text-erp-accent' : 'border-erp-border'
            }`}
          >
            {id === 'all' ? 'All rules' : APPROVAL_DOCUMENT_LABELS[id]}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-erp-border bg-white">
        <DataGrid
          data={filteredRules}
          columns={[
            { accessorKey: 'label', header: 'Rule' },
            {
              accessorKey: 'documentType',
              header: 'Document',
              cell: ({ row }) => APPROVAL_DOCUMENT_LABELS[row.original.documentType],
            },
            {
              accessorKey: 'conditionType',
              header: 'Condition Type',
              cell: ({ row }) => APPROVAL_CONDITION_TYPE_LABELS[row.original.conditionType],
            },
            {
              id: 'condition',
              header: 'Condition',
              cell: ({ row }) => formatRuleCondition(row.original),
            },
            {
              accessorKey: 'approverCode',
              header: 'Approver',
              cell: ({ row }) => APPROVER_CODE_LABELS[row.original.approverCode],
            },
            { accessorKey: 'sequence', header: 'Seq' },
            {
              id: 'threshold',
              header: 'Threshold (₹)',
              cell: ({ row }) =>
                row.original.condition.field === 'totalAmount' ? (
                  <input
                    type="number"
                    className="w-28 rounded border border-erp-border px-2 py-1 text-xs"
                    value={Number(row.original.condition.value ?? 0)}
                    onChange={(e) => updateRule(row.original.id, { threshold: Number(e.target.value) })}
                  />
                ) : (
                  '—'
                ),
            },
            {
              id: 'active',
              header: 'Active',
              cell: ({ row }) => (
                <button
                  type="button"
                  onClick={() => updateRule(row.original.id, { active: !row.original.active })}
                >
                  <Badge color={row.original.active ? 'green' : 'gray'}>
                    {row.original.active ? 'Active' : 'Off'}
                  </Badge>
                </button>
              ),
            },
          ]}
          compact
          emptyMessage="No rules configured."
        />
      </div>
    </div>
  )
}
