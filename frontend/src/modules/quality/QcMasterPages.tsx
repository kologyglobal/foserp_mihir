import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { DataGrid } from '../../components/design-system/DataGrid'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/forms/Inputs'
import { TableLink } from '../../components/ui/AppLink'
import { DetailLayout, DetailSection, DetailGrid, DetailField } from '../../components/masters/MasterLayouts'
import { useQualityStore } from '../../store/qualityStore'
import { useMasterStore } from '../../store/masterStore'
import type { QcParameterMaster, QcParameterType, QcParameterSeverity, QcPassFailRule } from '../../types/qcParameters'
import type { QcInspectionCategory } from '../../types/quality'

const PARAM_TYPES: QcParameterType[] = ['boolean', 'numeric', 'text', 'dropdown', 'photo_required']
const SEVERITIES: QcParameterSeverity[] = ['minor', 'major', 'critical']
const PASS_RULES: QcPassFailRule[] = ['boolean_true', 'boolean_false', 'numeric_tolerance', 'manual']
const QC_STAGES: QcInspectionCategory[] = ['incoming', 'in_process', 'final', 'subcontract_return']

export function QcParameterMasterPage() {
  const navigate = useNavigate()
  const allParameters = useQualityStore((s) => s.qcParameters)
  const parameters = useMemo(() => allParameters.filter((p) => p.active !== false), [allParameters])

  return (
    <OperationalPageShell
      title="QC Parameter Master"
      description="Reusable inspection parameters — type, tolerance, severity, and pass/fail rules."
      badge={`${parameters.length} parameters`}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={Plus} label="New Parameter" primary onClick={() => navigate('/quality/parameters/new')} />
          </CommandBarGroup>
        </CommandBar>
      }
    >
      <DataGrid
        data={parameters}
        columns={[
          {
            accessorKey: 'parameterCode',
            header: 'Code',
            cell: ({ row }) => (
              <TableLink to={`/quality/parameters/${row.original.id}`}>{row.original.parameterCode}</TableLink>
            ),
          },
          { accessorKey: 'parameterName', header: 'Name' },
          { accessorKey: 'parameterType', header: 'Type', cell: ({ row }) => <StatusBadge status={row.original.parameterType} /> },
          { accessorKey: 'uomCode', header: 'UOM', cell: ({ row }) => row.original.uomCode ?? '—' },
          { accessorKey: 'minValue', header: 'Min', cell: ({ row }) => row.original.minValue ?? '—' },
          { accessorKey: 'maxValue', header: 'Max', cell: ({ row }) => row.original.maxValue ?? '—' },
          { accessorKey: 'targetValue', header: 'Target', cell: ({ row }) => row.original.targetValue ?? '—' },
          { accessorKey: 'mandatory', header: 'Mandatory', cell: ({ row }) => (row.original.mandatory ? 'Yes' : 'No') },
          { accessorKey: 'severity', header: 'Severity', cell: ({ row }) => <StatusBadge status={row.original.severity} /> },
          { accessorKey: 'passFailRule', header: 'Auto Fail Rule' },
        ]}
        compact
        emptyMessage="No QC parameters defined. Create your first parameter."
      />
    </OperationalPageShell>
  )
}

export function QcParameterFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useQualityStore((s) => (id ? s.getQcParameter(id) : undefined))
  const addQcParameter = useQualityStore((s) => s.addQcParameter)
  const updateQcParameter = useQualityStore((s) => s.updateQcParameter)
  const deactivateQcParameter = useQualityStore((s) => s.deactivateQcParameter)

  const [form, setForm] = useState<Omit<QcParameterMaster, 'id'>>(() =>
    existing ?? {
      parameterCode: '',
      parameterName: '',
      parameterType: 'boolean',
      uomCode: null,
      minValue: null,
      maxValue: null,
      targetValue: null,
      mandatory: true,
      severity: 'major',
      passFailRule: 'boolean_true',
      dropdownOptions: null,
      active: true,
    },
  )
  const [dropdownText, setDropdownText] = useState(existing?.dropdownOptions?.join(', ') ?? '')
  const [error, setError] = useState<string | null>(null)

  function save() {
    const dropdownOptions =
      form.parameterType === 'dropdown'
        ? dropdownText.split(',').map((s) => s.trim()).filter(Boolean)
        : null
    const payload = { ...form, dropdownOptions }
    if (id && existing) {
      const r = updateQcParameter(id, payload)
      if (!r.ok) { setError(r.error ?? 'Update failed'); return }
    } else {
      const r = addQcParameter(payload)
      if (!r.ok) { setError(r.error ?? 'Create failed'); return }
    }
    navigate('/quality/parameters')
  }

  return (
    <DetailLayout
      backTo="/quality/parameters"
      backLabel="Parameter Master"
      title={existing ? existing.parameterCode : 'New QC Parameter'}
      subtitle={existing?.parameterName ?? 'Define inspection parameter'}
    >
      <DetailSection title="Parameter Definition">
        <div className="grid max-w-2xl gap-4">
          <label className="block text-sm">
            <span className="font-medium">Parameter Code</span>
            <input className="erp-input mt-1 w-full" value={form.parameterCode} onChange={(e) => setForm({ ...form, parameterCode: e.target.value.toUpperCase() })} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Parameter Name</span>
            <input className="erp-input mt-1 w-full" value={form.parameterName} onChange={(e) => setForm({ ...form, parameterName: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="font-medium">Type</span>
              <Select wrapClassName="mt-1 w-full" value={form.parameterType} onChange={(e) => setForm({ ...form, parameterType: e.target.value as QcParameterType })}>
                {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">UOM</span>
              <input className="erp-input mt-1 w-full" value={form.uomCode ?? ''} onChange={(e) => setForm({ ...form, uomCode: e.target.value || null })} />
            </label>
          </div>
          {form.parameterType === 'numeric' && (
            <div className="grid grid-cols-3 gap-4">
              <label className="block text-sm"><span className="font-medium">Min</span><input type="number" className="erp-input mt-1 w-full" value={form.minValue ?? ''} onChange={(e) => setForm({ ...form, minValue: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              <label className="block text-sm"><span className="font-medium">Max</span><input type="number" className="erp-input mt-1 w-full" value={form.maxValue ?? ''} onChange={(e) => setForm({ ...form, maxValue: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              <label className="block text-sm"><span className="font-medium">Target</span><input type="number" className="erp-input mt-1 w-full" value={form.targetValue ?? ''} onChange={(e) => setForm({ ...form, targetValue: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            </div>
          )}
          {form.parameterType === 'dropdown' && (
            <label className="block text-sm">
              <span className="font-medium">Dropdown Options (comma-separated)</span>
              <input className="erp-input mt-1 w-full" value={dropdownText} onChange={(e) => setDropdownText(e.target.value)} placeholder="Excellent, Acceptable, Reject" />
            </label>
          )}
          <div className="grid grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="font-medium">Severity</span>
              <Select wrapClassName="mt-1 w-full" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as QcParameterSeverity })}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Auto Fail Rule</span>
              <Select wrapClassName="mt-1 w-full" value={form.passFailRule} onChange={(e) => setForm({ ...form, passFailRule: e.target.value as QcPassFailRule })}>
                {PASS_RULES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </label>
            <label className="flex items-end gap-2 text-sm pb-2">
              <input type="checkbox" checked={form.mandatory} onChange={(e) => setForm({ ...form, mandatory: e.target.checked })} />
              Mandatory
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>{existing ? 'Save Changes' : 'Create Parameter'}</Button>
            {existing && (
              <Button size="sm" variant="danger" onClick={() => { deactivateQcParameter(existing.id); navigate('/quality/parameters') }}>
                Deactivate
              </Button>
            )}
          </div>
        </div>
      </DetailSection>
    </DetailLayout>
  )
}

export function InspectionPlanMasterPage() {
  const navigate = useNavigate()
  const plans = useQualityStore((s) => s.dynamicInspectionPlans)

  return (
    <OperationalPageShell
      title="Inspection Plan Master"
      description="Process-wise QC plans — product, operation, work center, item, and stage assignment."
      badge={`${plans.length} plans`}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={Plus} label="New Plan" primary onClick={() => navigate('/quality/inspection-plans/new')} />
          </CommandBarGroup>
        </CommandBar>
      }
    >
      <DataGrid
        data={plans}
        columns={[
          {
            accessorKey: 'planCode',
            header: 'Plan Code',
            cell: ({ row }) => (
              <TableLink to={`/quality/inspection-plans/${row.original.id}`}>{row.original.planCode}</TableLink>
            ),
          },
          { accessorKey: 'planName', header: 'Plan Name' },
          { accessorKey: 'category', header: 'QC Stage', cell: ({ row }) => <StatusBadge status={row.original.category} /> },
          { accessorKey: 'productId', header: 'Product', cell: ({ row }) => row.original.productId ?? '—' },
          { accessorKey: 'operationName', header: 'Operation', cell: ({ row }) => row.original.operationName ?? '—' },
          { accessorKey: 'workCenterId', header: 'Work Center', cell: ({ row }) => row.original.workCenterId ?? '—' },
          { accessorKey: 'itemId', header: 'Item', cell: ({ row }) => row.original.itemId ?? '—' },
          { accessorKey: 'revision', header: 'Rev', cell: ({ row }) => row.original.revision ?? 'A' },
          { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
          { id: 'lines', header: 'Lines', cell: ({ row }) => row.original.lines.length },
        ]}
        compact
        emptyMessage="No inspection plans defined."
      />
    </OperationalPageShell>
  )
}

export function InspectionPlanDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const allPlans = useQualityStore((s) => s.dynamicInspectionPlans)
  const plan = useMemo(() => allPlans.find((p) => p.id === id), [allPlans, id])
  const allParameters = useQualityStore((s) => s.qcParameters)
  const parameters = useMemo(() => allParameters.filter((p) => p.active !== false), [allParameters])
  const addInspectionPlan = useQualityStore((s) => s.addInspectionPlan)
  const updateInspectionPlan = useQualityStore((s) => s.updateInspectionPlan)
  const addPlanLine = useQualityStore((s) => s.addPlanLine)
  const removePlanLine = useQualityStore((s) => s.removePlanLine)
  const activateInspectionPlan = useQualityStore((s) => s.activateInspectionPlan)
  const deactivateInspectionPlan = useQualityStore((s) => s.deactivateInspectionPlan)
  const products = useMasterStore((s) => s.products)

  const isNew = id === 'new'
  const [header, setHeader] = useState(() =>
    plan ?? {
      planCode: '',
      planName: '',
      category: 'in_process' as QcInspectionCategory,
      productId: null as string | null,
      itemId: null as string | null,
      itemCategoryId: null as string | null,
      operationName: null as string | null,
      workCenterId: null as string | null,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: null as string | null,
      revision: 'A',
      status: 'draft' as const,
    },
  )
  const [newParamId, setNewParamId] = useState(parameters[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)

  const lines = useMemo(() => plan?.lines ?? [], [plan?.lines])
  const paramLookup = useMemo(() => new Map(parameters.map((p) => [p.id, p])), [parameters])

  if (!isNew && !plan) {
    return (
      <div className="p-8 text-center text-erp-muted">
        Plan not found. <Link to="/quality/inspection-plans" className="text-erp-primary">Back</Link>
      </div>
    )
  }

  function saveHeader() {
    if (isNew) {
      const r = addInspectionPlan({ ...header, lines: [] })
      if (!r.ok) { setError(r.error ?? 'Create failed'); return }
      navigate(`/quality/inspection-plans/${r.id}`)
      return
    }
    if (plan) {
      const r = updateInspectionPlan(plan.id, header)
      if (!r.ok) setError(r.error ?? 'Update failed')
    }
  }

  function addLine() {
    if (!plan || !newParamId) return
    addPlanLine(plan.id, { parameterId: newParamId, sortOrder: (lines.length + 1) * 10, mandatoryOverride: null, minValueOverride: null, maxValueOverride: null, targetValueOverride: null })
  }

  return (
    <DetailLayout
      backTo="/quality/inspection-plans"
      backLabel="Inspection Plans"
      title={isNew ? 'New Inspection Plan' : plan!.planCode}
      subtitle={isNew ? 'Define plan scope and parameters' : plan!.planName}
      badges={plan ? <StatusBadge status={plan.status} /> : undefined}
    >
      <DetailSection title="Plan Header">
        <div className="grid max-w-3xl gap-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm"><span className="font-medium">Plan Code</span><input className="erp-input mt-1 w-full" value={header.planCode} onChange={(e) => setHeader({ ...header, planCode: e.target.value })} /></label>
            <label className="block text-sm"><span className="font-medium">Plan Name</span><input className="erp-input mt-1 w-full" value={header.planName} onChange={(e) => setHeader({ ...header, planName: e.target.value })} /></label>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="font-medium">QC Stage</span>
              <Select wrapClassName="mt-1 w-full" value={header.category} onChange={(e) => setHeader({ ...header, category: e.target.value as QcInspectionCategory })}>
                {QC_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Product</span>
              <Select wrapClassName="mt-1 w-full" value={header.productId ?? ''} onChange={(e) => setHeader({ ...header, productId: e.target.value || null })}>
                <option value="">—</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.productCode}</option>)}
              </Select>
            </label>
            <label className="block text-sm"><span className="font-medium">Operation</span><input className="erp-input mt-1 w-full" value={header.operationName ?? ''} onChange={(e) => setHeader({ ...header, operationName: e.target.value || null })} /></label>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <label className="block text-sm"><span className="font-medium">Work Center ID</span><input className="erp-input mt-1 w-full" value={header.workCenterId ?? ''} onChange={(e) => setHeader({ ...header, workCenterId: e.target.value || null })} /></label>
            <label className="block text-sm"><span className="font-medium">Item ID</span><input className="erp-input mt-1 w-full" value={header.itemId ?? ''} onChange={(e) => setHeader({ ...header, itemId: e.target.value || null })} /></label>
            <label className="block text-sm"><span className="font-medium">Revision</span><input className="erp-input mt-1 w-full" value={header.revision ?? 'A'} onChange={(e) => setHeader({ ...header, revision: e.target.value })} /></label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveHeader}>{isNew ? 'Create Plan' : 'Save Header'}</Button>
            {plan && plan.status !== 'active' && (
              <Button size="sm" variant="secondary" onClick={() => activateInspectionPlan(plan.id)}>Activate</Button>
            )}
            {plan && plan.status === 'active' && (
              <Button size="sm" variant="secondary" onClick={() => deactivateInspectionPlan(plan.id)}>Deactivate</Button>
            )}
          </div>
        </div>
      </DetailSection>

      {plan && (
        <DetailSection title="Plan Lines">
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="block text-sm">
              <span className="font-medium">Add Parameter</span>
              <Select wrapClassName="mt-1 min-w-[200px]" value={newParamId} onChange={(e) => setNewParamId(e.target.value)}>
                {parameters.map((p) => <option key={p.id} value={p.id}>{p.parameterCode} — {p.parameterName}</option>)}
              </Select>
            </label>
            <Button size="sm" onClick={addLine}>Add Line</Button>
          </div>
          <DataGrid
            data={[...lines].sort((a, b) => a.sortOrder - b.sortOrder)}
            columns={[
              { id: 'seq', header: 'Seq', cell: ({ row }) => row.original.sortOrder },
              { id: 'param', header: 'Parameter', cell: ({ row }) => paramLookup.get(row.original.parameterId)?.parameterName ?? row.original.parameterId },
              { id: 'code', header: 'Code', cell: ({ row }) => paramLookup.get(row.original.parameterId)?.parameterCode ?? '—' },
              { id: 'type', header: 'Type', cell: ({ row }) => paramLookup.get(row.original.parameterId)?.parameterType ?? '—' },
              { id: 'sev', header: 'Severity', cell: ({ row }) => row.original.severityOverride ?? paramLookup.get(row.original.parameterId)?.severity ?? '—' },
              {
                id: 'actions',
                header: '',
                cell: ({ row }) => (
                  <button type="button" className="text-[12px] text-erp-danger hover:underline" onClick={() => removePlanLine(plan.id, row.original.id)}>
                    Remove
                  </button>
                ),
              },
            ]}
            compact
            emptyMessage="No parameters in this plan. Add lines above."
          />
        </DetailSection>
      )}

      {plan && (
        <DetailSection title="Plan Scope Summary">
          <DetailGrid>
            <DetailField label="QC Stage" value={plan.category} />
            <DetailField label="Product" value={plan.productId ?? 'Any'} />
            <DetailField label="Operation" value={plan.operationName ?? 'Any'} />
            <DetailField label="Work Center" value={plan.workCenterId ?? 'Any'} />
            <DetailField label="Item" value={plan.itemId ?? 'Any'} />
            <DetailField label="Category" value={plan.itemCategoryId ?? 'Any'} />
            <DetailField label="Effective From" value={plan.effectiveFrom} />
            <DetailField label="Revision" value={plan.revision ?? 'A'} />
          </DetailGrid>
        </DetailSection>
      )}
    </DetailLayout>
  )
}
