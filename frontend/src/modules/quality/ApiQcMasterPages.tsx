import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DataGrid } from '@/components/design-system/DataGrid'
import { CommandBar, CommandBarButton, CommandBarGroup } from '@/components/ui/CommandBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/forms/Inputs'
import { TableLink } from '@/components/ui/AppLink'
import { DetailLayout, DetailSection } from '@/components/masters/MasterLayouts'
import { LoadingState } from '@/design-system/components/LoadingState'
import { notify } from '@/store/toastStore'
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
  const [parameters, setParameters] = useState<QualityParameter[]>([])
  const [planCode, setPlanCode] = useState('')
  const [planName, setPlanName] = useState('')
  const [category, setCategory] = useState<QualityInspectionCategory>('IN_PROCESS')
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

  const lineLabels = useMemo(
    () =>
      lineParamIds.map((pid) => {
        const p = parameters.find((x) => x.id === pid)
        return { id: pid, label: p ? `${p.parameterCode} — ${p.parameterName}` : pid }
      }),
    [lineParamIds, parameters],
  )

  async function save() {
    if (!planCode.trim() || !planName.trim() || lineParamIds.length === 0) {
      notify.error('Code, name, and at least one parameter line are required')
      return
    }
    const payload = {
      planCode,
      planName,
      category,
      status,
      lines: lineParamIds.map((parameterId, sortOrder) => ({ parameterId, sortOrder })),
    }
    try {
      if (isNew) await createInspectionPlan(payload)
      else await updateInspectionPlan(id!, payload)
      notify.success(isNew ? 'Plan created' : 'Plan updated')
      navigate('/quality/inspection-plans')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
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

  if (loading) return <LoadingState variant="card" />

  return (
    <DetailLayout
      backTo="/quality/inspection-plans"
      backLabel="Inspection Plans"
      title={isNew ? 'New Inspection Plan' : planCode}
      subtitle={planName || 'QC plan definition'}
    >
      <DetailSection title="Plan header">
        <div className="grid max-w-2xl gap-4">
          <label className="block text-sm">
            <span className="font-medium">Plan Code</span>
            <input className="erp-input mt-1 w-full" value={planCode} onChange={(e) => setPlanCode(e.target.value.toUpperCase())} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Plan Name</span>
            <input className="erp-input mt-1 w-full" value={planName} onChange={(e) => setPlanName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="font-medium">Category</span>
              <Select wrapClassName="mt-1 w-full" value={category} onChange={(e) => setCategory(e.target.value as QualityInspectionCategory)}>
                {QC_STAGES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Status</span>
              <Select
                wrapClassName="mt-1 w-full"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ACTIVE' | 'INACTIVE')}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </label>
          </div>
        </div>
      </DetailSection>
      <DetailSection title="Parameter lines">
        <ul className="mb-3 space-y-1 text-sm">
          {lineLabels.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 rounded border border-erp-border px-3 py-2">
              <span>{l.label}</span>
              <Button size="sm" variant="ghost" onClick={() => setLineParamIds((ids) => ids.filter((x) => x !== l.id))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex max-w-xl gap-2">
          <Select wrapClassName="flex-1" value={addParamId} onChange={(e) => setAddParamId(e.target.value)}>
            <option value="">Add parameter…</option>
            {parameters
              .filter((p) => !lineParamIds.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.parameterCode} — {p.parameterName}
                </option>
              ))}
          </Select>
          <Button
            size="sm"
            disabled={!addParamId}
            onClick={() => {
              setLineParamIds((ids) => [...ids, addParamId])
              setAddParamId('')
            }}
          >
            Add
          </Button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => void save()}>
            {isNew ? 'Create Plan' : 'Save Plan'}
          </Button>
          {!isNew && (
            <Button size="sm" variant="danger" onClick={() => void deactivate()}>
              Deactivate
            </Button>
          )}
          <Link to="/quality/inspection-plans" className="text-sm text-erp-muted underline self-center">
            Cancel
          </Link>
        </div>
      </DetailSection>
    </DetailLayout>
  )
}
