import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DataGrid } from '@/components/design-system/DataGrid'
import { CommandBar, CommandBarButton, CommandBarGroup } from '@/components/ui/CommandBar'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { TableLink } from '@/components/ui/AppLink'
import { DetailLayout, DetailSection } from '@/components/masters/MasterLayouts'
import { LoadingState } from '@/design-system/components/LoadingState'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  createInspectionPlan,
  createQcParameter,
  deactivateInspectionPlan,
  deactivateQcParameter,
  getInspectionPlan,
  getQcParameter,
  listInspectionPlans,
  listQcParameters,
  updateInspectionPlan,
  updateQcParameter,
  type CreateParameterPayload,
  type QualityInspectionCategory,
  type QualityInspectionPlan,
  type QualityParameter,
  type QualityParameterType,
  type QualityPassFailRule,
  type QualityParameterSeverity,
} from '@/services/api/qualityApi'

const PARAM_TYPES: QualityParameterType[] = ['BOOLEAN', 'NUMERIC', 'TEXT', 'DROPDOWN', 'PHOTO_REQUIRED']
const SEVERITIES: QualityParameterSeverity[] = ['MINOR', 'MAJOR', 'CRITICAL']
const PASS_RULES: QualityPassFailRule[] = ['BOOLEAN_TRUE', 'BOOLEAN_FALSE', 'NUMERIC_TOLERANCE', 'MANUAL']
const QC_STAGES: QualityInspectionCategory[] = ['INCOMING', 'IN_PROCESS', 'FINAL', 'SUBCONTRACT_RETURN']

const QC_STAGE_LABELS: Record<QualityInspectionCategory, string> = {
  INCOMING: 'Incoming',
  IN_PROCESS: 'In process',
  FINAL: 'Final',
  SUBCONTRACT_RETURN: 'Subcontract return',
}

function PlanSection({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="sales-invoice-zoho-form__section mi-create-section qc-plan-section rounded-md border border-erp-border bg-white">
      <header className="sales-invoice-zoho-form__section-header mi-create-section__header flex flex-wrap items-center justify-between gap-2 border-b border-erp-border">
        <h3 className="m-0 text-[11px] font-bold uppercase tracking-wide text-erp-text">{title}</h3>
        {actions}
      </header>
      <div className="mi-create-section__body">{children}</div>
    </section>
  )
}

function PlanField({
  label,
  required,
  children,
  hint,
}: {
  label: string
  required?: boolean
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="qc-plan-field block min-w-0">
      <span className="qc-plan-field__label mb-1 block text-[11px] font-semibold text-erp-muted">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-0.5 block text-[11px] text-erp-muted">{hint}</span> : null}
    </label>
  )
}

export function ApiQcParameterMasterPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<QualityParameter[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listQcParameters({ active: true, limit: 200 })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load parameters')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      title="QC Parameter Master"
      description="Reusable inspection parameters (API)."
      badge={`${rows.length} parameters`}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => void load()} />
            <CommandBarButton icon={Plus} label="New Parameter" primary onClick={() => navigate('/quality/parameters/new')} />
          </CommandBarGroup>
        </CommandBar>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <DataGrid
          data={rows}
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
            { accessorKey: 'mandatory', header: 'Mandatory', cell: ({ row }) => (row.original.mandatory ? 'Yes' : 'No') },
            { accessorKey: 'severity', header: 'Severity', cell: ({ row }) => <StatusBadge status={row.original.severity} /> },
          ]}
          compact
          emptyMessage="No QC parameters defined."
        />
      )}
    </OperationalPageShell>
  )
}

export function ApiQcParameterFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)
  const [dropdownText, setDropdownText] = useState('')
  const [form, setForm] = useState<CreateParameterPayload>({
    parameterCode: '',
    parameterName: '',
    parameterType: 'BOOLEAN',
    uomCode: null,
    minValue: null,
    maxValue: null,
    targetValue: null,
    mandatory: true,
    severity: 'MAJOR',
    passFailRule: 'BOOLEAN_TRUE',
    dropdownOptions: null,
    active: true,
  })

  useEffect(() => {
    if (isNew) return
    void (async () => {
      try {
        const res = await getQcParameter(id!)
        const p = res.data
        setForm({
          parameterCode: p.parameterCode,
          parameterName: p.parameterName,
          parameterType: p.parameterType,
          uomCode: p.uomCode,
          minValue: p.minValue,
          maxValue: p.maxValue,
          targetValue: p.targetValue,
          mandatory: p.mandatory,
          severity: p.severity,
          passFailRule: p.passFailRule,
          dropdownOptions: p.dropdownOptions,
          active: p.active,
        })
        setDropdownText(p.dropdownOptions?.join(', ') ?? '')
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to load parameter')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, isNew])

  async function save() {
    setError(null)
    const dropdownOptions =
      form.parameterType === 'DROPDOWN'
        ? dropdownText.split(',').map((s) => s.trim()).filter(Boolean)
        : null
    const payload = { ...form, dropdownOptions }
    try {
      if (isNew) await createQcParameter(payload)
      else await updateQcParameter(id!, payload)
      notify.success(isNew ? 'Parameter created' : 'Parameter updated')
      navigate('/quality/parameters')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function deactivate() {
    if (!id || isNew) return
    try {
      await deactivateQcParameter(id)
      notify.success('Parameter deactivated')
      navigate('/quality/parameters')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Deactivate failed')
    }
  }

  if (loading) return <LoadingState variant="card" />

  return (
    <DetailLayout
      backTo="/quality/parameters"
      backLabel="Parameter Master"
      title={isNew ? 'New QC Parameter' : form.parameterCode}
      subtitle={form.parameterName || 'Define inspection parameter'}
    >
      <DetailSection title="Parameter Definition">
        <div className="grid max-w-2xl gap-4">
          <label className="block text-sm">
            <span className="font-medium">Parameter Code</span>
            <input
              className="erp-input mt-1 w-full"
              value={form.parameterCode}
              onChange={(e) => setForm({ ...form, parameterCode: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Parameter Name</span>
            <input
              className="erp-input mt-1 w-full"
              value={form.parameterName}
              onChange={(e) => setForm({ ...form, parameterName: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="font-medium">Type</span>
              <Select
                wrapClassName="mt-1 w-full"
                value={form.parameterType}
                onChange={(e) => setForm({ ...form, parameterType: e.target.value as QualityParameterType })}
              >
                {PARAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">UOM</span>
              <input
                className="erp-input mt-1 w-full"
                value={form.uomCode ?? ''}
                onChange={(e) => setForm({ ...form, uomCode: e.target.value || null })}
              />
            </label>
          </div>
          {form.parameterType === 'NUMERIC' && (
            <div className="grid grid-cols-3 gap-4">
              <label className="block text-sm">
                <span className="font-medium">Min</span>
                <input
                  type="number"
                  className="erp-input mt-1 w-full"
                  value={form.minValue ?? ''}
                  onChange={(e) => setForm({ ...form, minValue: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Max</span>
                <input
                  type="number"
                  className="erp-input mt-1 w-full"
                  value={form.maxValue ?? ''}
                  onChange={(e) => setForm({ ...form, maxValue: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Target</span>
                <input
                  type="number"
                  className="erp-input mt-1 w-full"
                  value={form.targetValue ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, targetValue: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
              </label>
            </div>
          )}
          {form.parameterType === 'DROPDOWN' && (
            <label className="block text-sm">
              <span className="font-medium">Dropdown Options (comma-separated)</span>
              <input className="erp-input mt-1 w-full" value={dropdownText} onChange={(e) => setDropdownText(e.target.value)} />
            </label>
          )}
          <div className="grid grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="font-medium">Severity</span>
              <Select
                wrapClassName="mt-1 w-full"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as QualityParameterSeverity })}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Pass/Fail Rule</span>
              <Select
                wrapClassName="mt-1 w-full"
                value={form.passFailRule}
                onChange={(e) => setForm({ ...form, passFailRule: e.target.value as QualityPassFailRule })}
              >
                {PASS_RULES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.mandatory ?? true}
                onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
              />
              Mandatory
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void save()}>
              {isNew ? 'Create Parameter' : 'Save Changes'}
            </Button>
            {!isNew && (
              <Button size="sm" variant="danger" onClick={() => void deactivate()}>
                Deactivate
              </Button>
            )}
          </div>
        </div>
      </DetailSection>
    </DetailLayout>
  )
}

export function ApiInspectionPlanMasterPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<QualityInspectionPlan[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listInspectionPlans({ limit: 200 })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load plans')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      title="Inspection Plan Master"
      description="Process-wise QC plans (API)."
      badge={`${rows.length} plans`}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => void load()} />
            <CommandBarButton icon={Plus} label="New Plan" primary onClick={() => navigate('/quality/inspection-plans/new')} />
          </CommandBarGroup>
        </CommandBar>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <DataGrid
          data={rows}
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
            { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
            { id: 'lines', header: 'Lines', cell: ({ row }) => row.original.lines.length },
          ]}
          compact
          emptyMessage="No inspection plans defined."
        />
      )}
    </OperationalPageShell>
  )
}

export function ApiInspectionPlanDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [parameters, setParameters] = useState<QualityParameter[]>([])
  const [planCode, setPlanCode] = useState('')
  const [planName, setPlanName] = useState('')
  const [category, setCategory] = useState<QualityInspectionCategory>('INCOMING')
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'INACTIVE'>('DRAFT')
  const [lineParamIds, setLineParamIds] = useState<string[]>([])
  const [addParamId, setAddParamId] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const params = await listQcParameters({ active: true, limit: 200 })
        setParameters(params.data)
        if (!isNew) {
          const res = await getInspectionPlan(id!)
          const p = res.data
          setPlanCode(p.planCode)
          setPlanName(p.planName)
          setCategory(p.category)
          setStatus(p.status)
          setLineParamIds(p.lines.map((l) => l.parameterId))
        }
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to load plan')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, isNew])

  const lines = useMemo(
    () =>
      lineParamIds.map((pid, index) => {
        const p = parameters.find((x) => x.id === pid)
        return {
          id: pid,
          index,
          code: p?.parameterCode ?? pid.slice(0, 8),
          name: p?.parameterName ?? 'Unknown parameter',
          type: p?.parameterType ?? '—',
          severity: p?.severity ?? '—',
          uom: p?.uomCode ?? '—',
          range:
            p?.parameterType === 'NUMERIC'
              ? `${p.minValue ?? '—'} … ${p.maxValue ?? '—'}`
              : '—',
          mandatory: p?.mandatory ?? false,
          missing: !p,
        }
      }),
    [lineParamIds, parameters],
  )

  const availableParams = useMemo(
    () => parameters.filter((p) => !lineParamIds.includes(p.id)),
    [parameters, lineParamIds],
  )

  const moveLine = (index: number, dir: -1 | 1) => {
    setLineParamIds((ids) => {
      const next = [...ids]
      const j = index + dir
      if (j < 0 || j >= next.length) return ids
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  async function save(closeAfter = true) {
    if (!planCode.trim() || !planName.trim() || lineParamIds.length === 0) {
      notify.error('Code, name, and at least one parameter line are required')
      return
    }
    setSaving(true)
    const payload = {
      planCode: planCode.trim(),
      planName: planName.trim(),
      category,
      status,
      lines: lineParamIds.map((parameterId, sortOrder) => ({ parameterId, sortOrder })),
    }
    try {
      if (isNew) await createInspectionPlan(payload)
      else await updateInspectionPlan(id!, payload)
      notify.success(isNew ? 'Plan created' : 'Plan updated')
      if (closeAfter) navigate('/quality/inspection-plans')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate() {
    if (!id || isNew) return
    try {
      await deactivateInspectionPlan(id)
      notify.success('Plan deactivated')
      navigate('/quality/inspection-plans')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Deactivate failed')
    }
  }

  if (loading) {
    return (
      <OperationalPageShell
        variant="dynamics"
        badge="Quality"
        title="Inspection plan"
        breadcrumbs={[
          { label: 'Quality', to: '/quality' },
          { label: 'Inspection Plans', to: '/quality/inspection-plans' },
          { label: 'Loading' },
        ]}
        autoBreadcrumbs={false}
      >
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  const title = isNew ? 'New Inspection Plan' : planCode || 'Inspection Plan'

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Quality"
      title={title}
      description={planName || 'Define multi-parameter QC template for inspections'}
      favoritePath={isNew ? '/quality/inspection-plans/new' : `/quality/inspection-plans/${id}`}
      breadcrumbs={[
        { label: 'Quality', to: '/quality' },
        { label: 'Inspection Plans', to: '/quality/inspection-plans' },
        { label: isNew ? 'New' : planCode || 'Plan' },
      ]}
      autoBreadcrumbs={false}
      pageGuide={null}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'save',
            label: saving ? 'Saving…' : isNew ? 'Create plan' : 'Save & close',
            icon: Save,
            onClick: () => void save(true),
            disabled: saving,
          }}
          secondaryActions={[
            {
              id: 'save-stay',
              label: 'Save',
              icon: Save,
              onClick: () => void save(false),
              disabled: saving || isNew,
              hidden: isNew,
            },
            {
              id: 'deactivate',
              label: 'Deactivate',
              icon: Trash2,
              onClick: () => void deactivate(),
              hidden: isNew,
              disabled: saving,
            },
            {
              id: 'back',
              label: 'Back',
              icon: ArrowLeft,
              onClick: () => navigate('/quality/inspection-plans'),
            },
          ]}
        />
      }
    >
      <div className="qc-plan-zoho sales-invoice-zoho-form mi-create-form max-w-[1120px]">
        <div className="mi-create-toolbar mb-0">
          <div className="mi-create-toolbar__group flex flex-wrap items-center gap-3">
            <div>
              <p className="mi-create-toolbar__label mb-0.5">Plan</p>
              <p className="m-0 text-[15px] font-bold tracking-tight text-erp-text">
                {isNew ? 'New plan' : planCode}
              </p>
            </div>
            <StatusBadge status={status} />
            <span className="rounded-full border border-erp-border bg-erp-surface-alt px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              {QC_STAGE_LABELS[category] ?? category}
            </span>
          </div>
          <div className="mi-create-toolbar__group text-[12px] text-erp-muted">
            <span className="font-semibold tabular-nums text-erp-text">{lines.length}</span>
            parameter{lines.length === 1 ? '' : 's'}
            {status === 'ACTIVE' ? (
              <span className="text-emerald-700"> · Ready for inspections</span>
            ) : status === 'DRAFT' ? (
              <span className="text-amber-700"> · Activate to use on QC</span>
            ) : null}
          </div>
        </div>

        <p className="mi-create-banner mi-create-banner--info">
          Inspection plans snapshot parameters onto Purchase (INCOMING) and Manufacturing QC. Status{' '}
          <strong>ACTIVE</strong> is required for auto-resolution.
        </p>

        <div className="qc-plan-zoho__grid grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="flex min-w-0 flex-col gap-2.5">
            <PlanSection title="Plan details">
              <div className="grid gap-3 sm:grid-cols-2">
                <PlanField label="Plan code" required>
                  <input
                    className="erp-input h-9 w-full font-mono text-[13px]"
                    value={planCode}
                    onChange={(e) => setPlanCode(e.target.value.toUpperCase())}
                    placeholder="e.g. INC-RM-STD"
                    autoComplete="off"
                  />
                </PlanField>
                <PlanField label="Plan name" required>
                  <input
                    className="erp-input h-9 w-full text-[13px]"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="Incoming raw material standard"
                    autoComplete="off"
                  />
                </PlanField>
                <PlanField label="QC stage / category" required>
                  <Select
                    wrapClassName="w-full"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as QualityInspectionCategory)}
                  >
                    {QC_STAGES.map((c) => (
                      <option key={c} value={c}>
                        {QC_STAGE_LABELS[c]} ({c})
                      </option>
                    ))}
                  </Select>
                </PlanField>
                <PlanField
                  label="Status"
                  required
                  hint={status === 'ACTIVE' ? 'Eligible for plan resolve on inspections' : undefined}
                >
                  <Select
                    wrapClassName="w-full"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ACTIVE' | 'INACTIVE')}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                </PlanField>
              </div>
            </PlanSection>

            <PlanSection
              title="Parameter checklist"
              actions={
                <span className="text-[11px] font-semibold tabular-nums text-erp-muted">
                  {lines.length} line{lines.length === 1 ? '' : 's'}
                </span>
              }
            >
              {lines.length === 0 ? (
                <div className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt/50 px-4 py-8 text-center">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 text-erp-muted" />
                  <p className="m-0 text-[13px] font-semibold text-erp-text">No parameters yet</p>
                  <p className="mt-1 text-[12px] text-erp-muted">
                    Add QC parameters below. Order becomes the inspection checklist sequence.
                  </p>
                </div>
              ) : (
                <div className="qc-plan-lines overflow-x-auto rounded-md border border-erp-border">
                  <table className="erp-table w-full min-w-[720px] text-[12px]">
                    <thead>
                      <tr className="bg-erp-surface-alt/80">
                        <th className="w-10 text-center">#</th>
                        <th>Parameter</th>
                        <th className="w-28">Type</th>
                        <th className="w-24">Severity</th>
                        <th className="w-20">UOM</th>
                        <th className="w-28">Spec / range</th>
                        <th className="w-20 text-center">Mandatory</th>
                        <th className="w-28 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((row) => (
                        <tr
                          key={row.id}
                          className={cn(
                            'border-t border-erp-border hover:bg-erp-primary-soft/30',
                            row.missing && 'bg-amber-50/60',
                          )}
                        >
                          <td className="text-center font-mono tabular-nums text-erp-muted">
                            {row.index + 1}
                          </td>
                          <td>
                            <div className="font-mono text-[11px] font-semibold text-erp-primary">
                              {row.code}
                            </div>
                            <div className="text-[12px] text-erp-text">{row.name}</div>
                          </td>
                          <td>
                            <StatusBadge status={String(row.type)} />
                          </td>
                          <td>
                            <StatusBadge status={String(row.severity)} />
                          </td>
                          <td className="font-mono text-erp-muted">{row.uom}</td>
                          <td className="font-mono tabular-nums text-erp-muted">{row.range}</td>
                          <td className="text-center">
                            {row.mandatory ? (
                              <span className="text-[11px] font-semibold text-emerald-700">Yes</span>
                            ) : (
                              <span className="text-[11px] text-erp-muted">No</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                className="rounded p-1 text-erp-muted hover:bg-white hover:text-erp-text disabled:opacity-30"
                                disabled={row.index === 0}
                                onClick={() => moveLine(row.index, -1)}
                                title="Move up"
                                aria-label="Move up"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1 text-erp-muted hover:bg-white hover:text-erp-text disabled:opacity-30"
                                disabled={row.index === lines.length - 1}
                                onClick={() => moveLine(row.index, 1)}
                                title="Move down"
                                aria-label="Move down"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1 text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  setLineParamIds((ids) => ids.filter((x) => x !== row.id))
                                }
                                title="Remove"
                                aria-label="Remove parameter"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-erp-border pt-3">
                <PlanField label="Add parameter">
                  <Select
                    wrapClassName="min-w-[min(100%,22rem)]"
                    value={addParamId}
                    onChange={(e) => setAddParamId(e.target.value)}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {availableParams.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.parameterCode} — {p.parameterName} ({p.parameterType})
                      </option>
                    ))}
                  </Select>
                </PlanField>
                <ErpButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={Plus}
                  disabled={!addParamId}
                  onClick={() => {
                    if (!addParamId) return
                    setLineParamIds((ids) => [...ids, addParamId])
                    setAddParamId('')
                  }}
                >
                  Add line
                </ErpButton>
                <Link
                  to="/quality/parameters/new"
                  className="mb-1 text-[12px] font-semibold text-erp-primary hover:underline"
                >
                  + New parameter master
                </Link>
              </div>
              {availableParams.length === 0 && parameters.length > 0 ? (
                <p className="mt-2 text-[11px] text-erp-muted">
                  All active parameters are already on this plan.
                </p>
              ) : null}
            </PlanSection>
          </div>

          <aside className="qc-plan-zoho__rail flex flex-col gap-2.5">
            <div className="rounded-md border border-erp-border bg-white p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-erp-muted">
                Summary
              </p>
              <dl className="m-0 space-y-2 text-[12px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-erp-muted">Status</dt>
                  <dd className="m-0 font-semibold">
                    <StatusBadge status={status} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-erp-muted">Stage</dt>
                  <dd className="m-0 font-semibold text-erp-text">{QC_STAGE_LABELS[category]}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-erp-muted">Parameters</dt>
                  <dd className="m-0 font-semibold tabular-nums">{lines.length}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-erp-muted">Mandatory</dt>
                  <dd className="m-0 font-semibold tabular-nums">
                    {lines.filter((l) => l.mandatory).length}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="rounded-md border border-erp-border bg-erp-surface-alt/40 p-3 text-[11px] leading-relaxed text-erp-muted">
              <p className="mb-1 font-bold uppercase tracking-wide text-erp-text">Usage</p>
              <ul className="m-0 list-disc space-y-1 pl-3.5">
                <li>
                  <strong>INCOMING</strong> → Purchase QI / GRN QC
                </li>
                <li>
                  <strong>IN_PROCESS / FINAL</strong> → Manufacturing QI
                </li>
                <li>Checklist is snapshotted at inspection create</li>
              </ul>
            </div>
          </aside>
        </div>

        <div className="sales-invoice-zoho-form__sticky-footer qc-plan-zoho__footer mt-2 flex flex-wrap items-center justify-between gap-2 border border-erp-border bg-white px-3 py-2.5">
          <button
            type="button"
            className="text-[12px] font-semibold text-erp-muted hover:text-erp-text"
            onClick={() => navigate('/quality/inspection-plans')}
          >
            Cancel
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {!isNew ? (
              <ErpButton
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void deactivate()}
              >
                Deactivate
              </ErpButton>
            ) : null}
            <ErpButton
              type="button"
              size="sm"
              variant="primary"
              icon={Save}
              disabled={saving}
              onClick={() => void save(true)}
            >
              {saving ? 'Saving…' : isNew ? 'Create plan' : 'Save & close'}
            </ErpButton>
          </div>
        </div>
      </div>
    </OperationalPageShell>
  )
}
