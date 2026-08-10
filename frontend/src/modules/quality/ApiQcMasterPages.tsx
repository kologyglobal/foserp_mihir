import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CircleOff,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { ErpButton } from '@/components/erp/ErpButton'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { ErpCardFormPage, ErpCardSection, ErpStickySaveBar } from '@/components/erp/card-form'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { TableLink } from '@/components/ui/AppLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  StoreRegisterListPage,
  type StoreRegisterFilters,
} from '@/modules/inventory/shared/StoreRegisterListPage'
import { appConfirm } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  activateQcParameter,
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

const PARAM_TYPE_LABELS: Record<QualityParameterType, string> = {
  BOOLEAN: 'Boolean (pass / fail)',
  NUMERIC: 'Numeric',
  TEXT: 'Text',
  DROPDOWN: 'Dropdown',
  PHOTO_REQUIRED: 'Photo required',
}

const PARAM_DEFAULT_FILTERS: StoreRegisterFilters = {
  search: '',
  status: 'ACTIVE',
  parameterType: '',
  severity: '',
}

const PARAM_SORT_OPTIONS = [
  { value: 'code_asc', label: 'Code A→Z' },
  { value: 'code_desc', label: 'Code Z→A' },
  { value: 'name_asc', label: 'Name A→Z' },
  { value: 'type_asc', label: 'Type' },
  { value: 'severity_asc', label: 'Severity' },
]

export function ApiQcParameterMasterPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<QualityParameter[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filters, setFilters] = useState<StoreRegisterFilters>(PARAM_DEFAULT_FILTERS)
  const [sortBy, setSortBy] = useState('code_asc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Load all (active + inactive) so Status filter can show both.
      const res = await listQcParameters({ limit: 200 })
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

  const setActive = useCallback(
    async (row: QualityParameter, active: boolean) => {
      if (active) {
        setBusyId(row.id)
        try {
          await activateQcParameter(row.id)
          notify.success(`${row.parameterCode} activated`)
          await load()
        } catch (e) {
          notify.error(e instanceof Error ? e.message : 'Activate failed')
        } finally {
          setBusyId(null)
        }
        return
      }
      const ok = await appConfirm({
        title: 'Deactivate QC parameter?',
        description: `${row.parameterCode} will no longer appear when adding lines to inspection plans.`,
        confirmLabel: 'Deactivate',
        tone: 'danger',
      })
      if (!ok) return
      setBusyId(row.id)
      try {
        await deactivateQcParameter(row.id)
        notify.success(`${row.parameterCode} deactivated`)
        await load()
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Deactivate failed')
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const filterFields = useMemo(
    () => [
      { type: 'section' as const, label: 'Status & type' },
      {
        type: 'select' as const,
        key: 'status',
        label: 'Status',
        options: [
          { value: '', label: 'All statuses' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
        ],
      },
      {
        type: 'select' as const,
        key: 'parameterType',
        label: 'Type',
        options: [
          { value: '', label: 'All types' },
          ...PARAM_TYPES.map((t) => ({ value: t, label: PARAM_TYPE_LABELS[t] })),
        ],
      },
      {
        type: 'select' as const,
        key: 'severity',
        label: 'Severity',
        options: [
          { value: '', label: 'All severities' },
          ...SEVERITIES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })),
        ],
      },
    ],
    [],
  )

  const chipLabelResolver = useCallback((key: string, value: string) => {
    if (!value) return undefined
    if (key === 'status') return `Status: ${value === 'ACTIVE' ? 'Active' : 'Inactive'}`
    if (key === 'parameterType') {
      return `Type: ${PARAM_TYPE_LABELS[value as QualityParameterType] ?? value}`
    }
    if (key === 'severity') return `Severity: ${value}`
    return undefined
  }, [])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    let list = rows.filter((r) => {
      if (filters.status === 'ACTIVE' && !r.active) return false
      if (filters.status === 'INACTIVE' && r.active) return false
      if (filters.parameterType && r.parameterType !== filters.parameterType) return false
      if (filters.severity && r.severity !== filters.severity) return false
      if (!q) return true
      const options = r.dropdownOptions?.join(' ').toLowerCase() ?? ''
      return (
        r.parameterCode.toLowerCase().includes(q) ||
        r.parameterName.toLowerCase().includes(q) ||
        r.parameterType.toLowerCase().includes(q) ||
        options.includes(q)
      )
    })
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'code_desc':
          return cmp(b.parameterCode, a.parameterCode)
        case 'name_asc':
          return cmp(a.parameterName, b.parameterName)
        case 'type_asc':
          return cmp(a.parameterType, b.parameterType)
        case 'severity_asc':
          return cmp(a.severity, b.severity)
        case 'code_asc':
        default:
          return cmp(a.parameterCode, b.parameterCode)
      }
    })
    return list
  }, [rows, filters, sortBy])

  const columns = useMemo<ColumnDef<QualityParameter, unknown>[]>(
    () => [
      {
        id: 'parameterCode',
        accessorKey: 'parameterCode',
        header: 'Code',
        enableHiding: false,
        cell: ({ row }) => (
          <TableLink to={`/quality/parameters/${row.original.id}`}>{row.original.parameterCode}</TableLink>
        ),
      },
      { id: 'parameterName', accessorKey: 'parameterName', header: 'Name' },
      {
        id: 'parameterType',
        accessorKey: 'parameterType',
        header: 'Type',
        cell: ({ row }) => <StatusBadge status={row.original.parameterType} />,
      },
      {
        id: 'options',
        header: 'Dropdown options',
        accessorFn: (r) => (r.parameterType === 'DROPDOWN' ? (r.dropdownOptions ?? []).join(', ') : ''),
        cell: ({ row }) =>
          row.original.parameterType === 'DROPDOWN' ? (
            <span className="text-[12px] text-erp-text" title={(row.original.dropdownOptions ?? []).join(', ')}>
              {(row.original.dropdownOptions ?? []).length > 0
                ? (row.original.dropdownOptions ?? []).slice(0, 3).join(', ')
                  + ((row.original.dropdownOptions ?? []).length > 3
                    ? ` +${(row.original.dropdownOptions ?? []).length - 3}`
                    : '')
                : '-'}
            </span>
          ) : (
            <span className="text-erp-muted">-</span>
          ),
      },
      {
        id: 'uomCode',
        accessorKey: 'uomCode',
        header: 'UOM',
        cell: ({ row }) => <span className="font-mono">{row.original.uomCode || '-'}</span>,
      },
      {
        id: 'mandatory',
        accessorKey: 'mandatory',
        header: 'Mandatory',
        cell: ({ row }) => (row.original.mandatory ? 'Yes' : 'No'),
      },
      {
        id: 'severity',
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => <StatusBadge status={row.original.severity} />,
      },
      {
        id: 'status',
        header: 'Status',
        enableHiding: false,
        accessorFn: (r) => (r.active ? 'ACTIVE' : 'INACTIVE'),
        cell: ({ row }) => (
          <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original
          const busy = busyId === p.id
          const actions: RowActionItem[] = [
            {
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
              to: `/quality/parameters/${p.id}`,
              disabled: busy,
            },
            { id: 'sep', label: '', separator: true },
            p.active
              ? {
                  id: 'deactivate',
                  label: 'Deactivate',
                  icon: CircleOff,
                  danger: true,
                  disabled: busy,
                  onClick: () => void setActive(p, false),
                }
              : {
                  id: 'activate',
                  label: 'Activate',
                  icon: CheckCircle2,
                  disabled: busy,
                  onClick: () => void setActive(p, true),
                },
          ]
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [busyId, setActive],
  )

  return (
    <StoreRegisterListPage
      pageId="/quality/parameters"
      badge="Quality"
      title="QC Parameters"
      description="Reusable inspection parameters — type, tolerance, severity, and pass/fail rules."
      breadcrumbs={[
        { label: 'Quality', to: '/quality' },
        { label: 'QC Parameters' },
      ]}
      rows={filtered}
      totalRowCount={rows.length}
      columns={columns}
      getRowId={(r) => r.id}
      loading={loading}
      searchPlaceholder="Search code, name, type, options…"
      sortOptions={PARAM_SORT_OPTIONS}
      sortBy={sortBy}
      onSortChange={setSortBy}
      filters={filters}
      defaultFilters={PARAM_DEFAULT_FILTERS}
      onFiltersChange={setFilters}
      filterFields={filterFields}
      drawerTitle="Filter QC parameters"
      chipLabelResolver={chipLabelResolver}
      primaryAction={{
        id: 'new',
        label: 'New Parameter',
        icon: Plus,
        onClick: () => navigate('/quality/parameters/new'),
      }}
      secondaryActions={[
        {
          id: 'refresh',
          label: 'Refresh',
          icon: RefreshCw,
          onClick: () => void load(),
        },
      ]}
      emptyIcon={ClipboardList}
      emptyTitle="No QC parameters yet"
      emptyDescription="Create reusable parameters, then add them to Inspection Plans."
      emptyAction={(
        <Button size="sm" onClick={() => navigate('/quality/parameters/new')}>
          New Parameter
        </Button>
      )}
    />
  )
}

const SEVERITY_LABELS: Record<QualityParameterSeverity, string> = {
  MINOR: 'Minor',
  MAJOR: 'Major',
  CRITICAL: 'Critical',
}

const PASS_RULE_LABELS: Record<QualityPassFailRule, string> = {
  BOOLEAN_TRUE: 'Must be true / pass',
  BOOLEAN_FALSE: 'Must be false / fail',
  NUMERIC_TOLERANCE: 'Within numeric tolerance',
  MANUAL: 'Manual decision',
}

export function ApiQcParameterFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
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
    if (isNew) {
      setLoading(false)
      return
    }
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
    if (!form.parameterCode.trim() || !form.parameterName.trim()) {
      notify.error('Parameter code and name are required')
      return
    }
    const dropdownOptions =
      form.parameterType === 'DROPDOWN'
        ? dropdownText.split(',').map((s) => s.trim()).filter(Boolean)
        : null
    if (form.parameterType === 'DROPDOWN' && (!dropdownOptions || dropdownOptions.length === 0)) {
      notify.error('Add at least one dropdown option')
      return
    }
    setSaving(true)
    const payload = { ...form, dropdownOptions }
    try {
      if (isNew) await createQcParameter(payload)
      else await updateQcParameter(id!, payload)
      notify.success(isNew ? 'Parameter created' : 'Parameter updated')
      navigate('/quality/parameters')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate() {
    if (!id || isNew) return
    const ok = await appConfirm({
      title: 'Deactivate QC parameter?',
      description: `${form.parameterCode || 'This parameter'} will no longer be available for new inspection plans.`,
      confirmLabel: 'Deactivate',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deactivateQcParameter(id)
      notify.success('Parameter deactivated')
      navigate('/quality/parameters')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Deactivate failed')
    }
  }

  const title = isNew ? 'New QC Parameter' : form.parameterCode || 'QC Parameter'

  if (loading) {
    return (
      <ErpCardFormPage
        variant="dynamics"
        badge="Quality"
        title="QC Parameter"
        description="Loading…"
        breadcrumbs={[
          { label: 'Quality', to: '/quality' },
          { label: 'QC Parameters', to: '/quality/parameters' },
          { label: 'Loading' },
        ]}
        autoBreadcrumbs={false}
        stickyFooter
        footer={(
          <ErpStickySaveBar
            sticky
            cancelTo="/quality/parameters"
            submitLabel="Save"
            submitDisabled
            isSubmitting
          />
        )}
      >
        <LoadingState variant="card" />
      </ErpCardFormPage>
    )
  }

  return (
    <ErpCardFormPage
      variant="dynamics"
      badge="Quality"
      title={title}
      description={form.parameterName || 'Reusable inspection parameter for QC plans'}
      recordNo={isNew ? undefined : form.parameterCode}
      statusChip={
        <StatusBadge status={form.active === false ? 'INACTIVE' : 'ACTIVE'} />
      }
      favoritePath={isNew ? '/quality/parameters/new' : `/quality/parameters/${id}`}
      breadcrumbs={[
        { label: 'Quality', to: '/quality' },
        { label: 'QC Parameters', to: '/quality/parameters' },
        { label: isNew ? 'New' : form.parameterCode || 'Parameter' },
      ]}
      autoBreadcrumbs={false}
      stickyFooter
      onSaveShortcut={() => void save()}
      footer={(
        <ErpStickySaveBar
          sticky
          cancelTo="/quality/parameters"
          cancelLabel="Cancel"
          submitLabel={isNew ? 'Create parameter' : 'Save & close'}
          isSubmitting={saving}
          onSave={() => void save()}
          hint="Parameters are snapshotted onto inspection plans when a plan line is added."
          actions={
            !isNew ? (
              <ErpButton
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void deactivate()}
              >
                Deactivate
              </ErpButton>
            ) : null
          }
        />
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ErpCardSection title="Parameter definition">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Parameter code" required>
                <input
                  className="erp-input h-9 w-full font-mono text-[13px]"
                  value={form.parameterCode}
                  onChange={(e) => setForm({ ...form, parameterCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. DIM-OD"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="Parameter name" required>
                <input
                  className="erp-input h-9 w-full text-[13px]"
                  value={form.parameterName}
                  onChange={(e) => setForm({ ...form, parameterName: e.target.value })}
                  placeholder="Outer diameter"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="Type" required>
                <Select
                  wrapClassName="w-full"
                  value={form.parameterType}
                  onChange={(e) =>
                    setForm({ ...form, parameterType: e.target.value as QualityParameterType })
                  }
                >
                  {PARAM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PARAM_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="UOM" hint={form.parameterType === 'NUMERIC' ? 'Recommended for numeric checks' : undefined}>
                <input
                  className="erp-input h-9 w-full font-mono text-[13px]"
                  value={form.uomCode ?? ''}
                  onChange={(e) => setForm({ ...form, uomCode: e.target.value || null })}
                  placeholder="e.g. MM"
                  autoComplete="off"
                />
              </FormField>
            </div>
          </ErpCardSection>

          {form.parameterType === 'NUMERIC' ? (
            <ErpCardSection title="Numeric specification">
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="Min">
                  <input
                    type="number"
                    className="erp-input h-9 w-full"
                    value={form.minValue ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, minValue: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                </FormField>
                <FormField label="Max">
                  <input
                    type="number"
                    className="erp-input h-9 w-full"
                    value={form.maxValue ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, maxValue: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                </FormField>
                <FormField label="Target">
                  <input
                    type="number"
                    className="erp-input h-9 w-full"
                    value={form.targetValue ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        targetValue: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </FormField>
              </div>
            </ErpCardSection>
          ) : null}

          {form.parameterType === 'DROPDOWN' ? (
            <ErpCardSection title="Dropdown options">
              <FormField
                label="Options"
                required
                hint="Comma-separated values shown during inspection"
              >
                <input
                  className="erp-input h-9 w-full text-[13px]"
                  value={dropdownText}
                  onChange={(e) => setDropdownText(e.target.value)}
                  placeholder="Excellent, Acceptable, Reject"
                  autoComplete="off"
                />
              </FormField>
            </ErpCardSection>
          ) : null}

          <ErpCardSection title="Evaluation">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Severity" required>
                <Select
                  wrapClassName="w-full"
                  value={form.severity ?? 'MAJOR'}
                  onChange={(e) =>
                    setForm({ ...form, severity: e.target.value as QualityParameterSeverity })
                  }
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {SEVERITY_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Pass / fail rule" required>
                <Select
                  wrapClassName="w-full"
                  value={form.passFailRule ?? 'MANUAL'}
                  onChange={(e) =>
                    setForm({ ...form, passFailRule: e.target.value as QualityPassFailRule })
                  }
                >
                  {PASS_RULES.map((r) => (
                    <option key={r} value={r}>
                      {PASS_RULE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Mandatory">
                <label className="flex h-9 items-center gap-2 text-[13px] text-erp-text">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-erp-border"
                    checked={form.mandatory ?? true}
                    onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
                  />
                  Required on every inspection using this parameter
                </label>
              </FormField>
              <FormField label="Active">
                <label className="flex h-9 items-center gap-2 text-[13px] text-erp-text">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-erp-border"
                    checked={form.active !== false}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  Available for new inspection plans
                </label>
              </FormField>
            </div>
          </ErpCardSection>
        </div>

        <aside className="flex flex-col gap-4">
          <ErpCardSection title="Summary">
            <dl className="m-0 space-y-2 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-erp-muted">Type</dt>
                <dd className="m-0 font-semibold text-erp-text">
                  {PARAM_TYPE_LABELS[form.parameterType]}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-erp-muted">Severity</dt>
                <dd className="m-0">
                  <StatusBadge status={form.severity ?? 'MAJOR'} />
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-erp-muted">Mandatory</dt>
                <dd className="m-0 font-semibold">{form.mandatory ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-erp-muted">UOM</dt>
                <dd className="m-0 font-mono font-semibold">{form.uomCode || '-'}</dd>
              </div>
            </dl>
          </ErpCardSection>
          <ErpCardSection title="Usage">
            <ul className="m-0 list-disc space-y-1 pl-3.5 text-[12px] leading-relaxed text-erp-muted">
              <li>Add this parameter to an Inspection Plan checklist</li>
              <li>Values are snapshotted when a plan line is created</li>
              <li>
                Link from{' '}
                <Link to="/quality/inspection-plans" className="font-semibold text-erp-primary hover:underline">
                  Inspection Plans
                </Link>
              </li>
            </ul>
          </ErpCardSection>
        </aside>
      </div>
    </ErpCardFormPage>
  )
}

const PLAN_DEFAULT_FILTERS: StoreRegisterFilters = { search: '', status: '', category: '' }

const PLAN_SORT_OPTIONS = [
  { value: 'code_asc', label: 'Plan code A→Z' },
  { value: 'code_desc', label: 'Plan code Z→A' },
  { value: 'name_asc', label: 'Plan name A→Z' },
  { value: 'status_asc', label: 'Status' },
  { value: 'category_asc', label: 'QC stage' },
]

export function ApiInspectionPlanMasterPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<QualityInspectionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<StoreRegisterFilters>(PLAN_DEFAULT_FILTERS)
  const [sortBy, setSortBy] = useState('code_asc')

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

  const filterFields = useMemo(
    () => [
      { type: 'section' as const, label: 'Status & workflow' },
      {
        type: 'select' as const,
        key: 'status',
        label: 'Status',
        options: [
          { value: '', label: 'All statuses' },
          { value: 'DRAFT', label: 'Draft' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
        ],
      },
      {
        type: 'select' as const,
        key: 'category',
        label: 'QC stage',
        options: [
          { value: '', label: 'All stages' },
          ...QC_STAGES.map((c) => ({ value: c, label: QC_STAGE_LABELS[c] })),
        ],
      },
    ],
    [],
  )

  const chipLabelResolver = useCallback((key: string, value: string) => {
    if (!value) return undefined
    if (key === 'status') return `Status: ${value}`
    if (key === 'category') return `Stage: ${QC_STAGE_LABELS[value as QualityInspectionCategory] ?? value}`
    return undefined
  }, [])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    let list = rows.filter((r) => {
      if (filters.status && r.status !== filters.status) return false
      if (filters.category && r.category !== filters.category) return false
      if (!q) return true
      return (
        r.planCode.toLowerCase().includes(q) ||
        r.planName.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      )
    })
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'code_desc':
          return cmp(b.planCode, a.planCode)
        case 'name_asc':
          return cmp(a.planName, b.planName)
        case 'status_asc':
          return cmp(a.status, b.status)
        case 'category_asc':
          return cmp(a.category, b.category)
        case 'code_asc':
        default:
          return cmp(a.planCode, b.planCode)
      }
    })
    return list
  }, [rows, filters, sortBy])

  const columns = useMemo<ColumnDef<QualityInspectionPlan, unknown>[]>(
    () => [
      {
        id: 'planCode',
        accessorKey: 'planCode',
        header: 'Plan Code',
        enableHiding: false,
        cell: ({ row }) => (
          <TableLink to={`/quality/inspection-plans/${row.original.id}`}>{row.original.planCode}</TableLink>
        ),
      },
      { id: 'planName', accessorKey: 'planName', header: 'Plan Name' },
      {
        id: 'category',
        accessorKey: 'category',
        header: 'QC Stage',
        cell: ({ row }) => <StatusBadge status={row.original.category} />,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        enableHiding: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'lines',
        header: 'Parameters',
        accessorFn: (r) => r.lines.length,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.lines.length}</span>
        ),
      },
    ],
    [],
  )

  return (
    <StoreRegisterListPage
      pageId="/quality/inspection-plans"
      badge="Quality"
      title="Inspection Plans"
      description="Process-wise QC plan templates for Purchase (incoming) and Manufacturing inspections."
      breadcrumbs={[
        { label: 'Quality', to: '/quality' },
        { label: 'Inspection Plans' },
      ]}
      rows={filtered}
      totalRowCount={rows.length}
      columns={columns}
      getRowId={(r) => r.id}
      loading={loading}
      searchPlaceholder="Search plan code, name, stage…"
      sortOptions={PLAN_SORT_OPTIONS}
      sortBy={sortBy}
      onSortChange={setSortBy}
      filters={filters}
      defaultFilters={PLAN_DEFAULT_FILTERS}
      onFiltersChange={setFilters}
      filterFields={filterFields}
      drawerTitle="Filter inspection plans"
      chipLabelResolver={chipLabelResolver}
      primaryAction={{
        id: 'new',
        label: 'New Plan',
        icon: Plus,
        onClick: () => navigate('/quality/inspection-plans/new'),
      }}
      secondaryActions={[
        {
          id: 'refresh',
          label: 'Refresh',
          icon: RefreshCw,
          onClick: () => void load(),
        },
      ]}
      emptyIcon={ClipboardList}
      emptyTitle="No inspection plans yet"
      emptyDescription="Create a plan with QC parameters to use on Purchase and Manufacturing inspections."
      emptyAction={(
        <Button size="sm" onClick={() => navigate('/quality/inspection-plans/new')}>
          New Plan
        </Button>
      )}
    />
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
          type: p?.parameterType ?? '-',
          severity: p?.severity ?? '-',
          uom: p?.uomCode ?? '-',
          range:
            p?.parameterType === 'NUMERIC'
              ? `${p.minValue ?? '-'} … ${p.maxValue ?? '-'}`
              : '-',
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
      if (isNew) {
        const created = await createInspectionPlan(payload)
        notify.success('Plan created')
        if (closeAfter) navigate('/quality/inspection-plans')
        else navigate(`/quality/inspection-plans/${created.data.id}`, { replace: true })
      } else {
        await updateInspectionPlan(id!, payload)
        notify.success('Plan updated')
        if (closeAfter) navigate('/quality/inspection-plans')
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate() {
    if (!id || isNew) return
    const ok = await appConfirm({
      title: 'Deactivate inspection plan?',
      description: `${planCode || 'This plan'} will no longer resolve onto new inspections.`,
      confirmLabel: 'Deactivate',
      tone: 'danger',
    })
    if (!ok) return
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
      <ErpCardFormPage
        variant="dynamics"
        badge="Quality"
        title="Inspection plan"
        description="Loading…"
        breadcrumbs={[
          { label: 'Quality', to: '/quality' },
          { label: 'Inspection Plans', to: '/quality/inspection-plans' },
          { label: 'Loading' },
        ]}
        autoBreadcrumbs={false}
        stickyFooter
        footer={(
          <ErpStickySaveBar
            sticky
            cancelTo="/quality/inspection-plans"
            submitLabel="Save"
            submitDisabled
            isSubmitting
          />
        )}
      >
        <LoadingState variant="card" />
      </ErpCardFormPage>
    )
  }

  const title = isNew ? 'New Inspection Plan' : planCode || 'Inspection Plan'

  return (
    <ErpCardFormPage
      variant="dynamics"
      badge="Quality"
      title={title}
      description={planName || 'Define multi-parameter QC template for inspections'}
      recordNo={isNew ? undefined : planCode}
      statusChip={<StatusBadge status={status} />}
      favoritePath={isNew ? '/quality/inspection-plans/new' : `/quality/inspection-plans/${id}`}
      breadcrumbs={[
        { label: 'Quality', to: '/quality' },
        { label: 'Inspection Plans', to: '/quality/inspection-plans' },
        { label: isNew ? 'New' : planCode || 'Plan' },
      ]}
      autoBreadcrumbs={false}
      stickyFooter
      onSaveShortcut={() => void save(true)}
      footer={(
        <ErpStickySaveBar
          sticky
          cancelTo="/quality/inspection-plans"
          cancelLabel="Cancel"
          submitLabel={isNew ? 'Create plan' : 'Save & close'}
          isSubmitting={saving}
          onSave={() => void save(true)}
          onSaveDraft={isNew ? undefined : () => void save(false)}
          saveDraftLabel="Save"
          hint="ACTIVE plans resolve onto Purchase (incoming) and Manufacturing QC."
          actions={
            !isNew ? (
              <ErpButton
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void deactivate()}
              >
                Deactivate
              </ErpButton>
            ) : null
          }
        />
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ErpCardSection title="Plan details">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Plan code" required>
                <input
                  className="erp-input h-9 w-full font-mono text-[13px]"
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value.toUpperCase())}
                  placeholder="e.g. INC-RM-STD"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="Plan name" required>
                <input
                  className="erp-input h-9 w-full text-[13px]"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Incoming raw material standard"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="QC stage / category" required>
                <Select
                  wrapClassName="w-full"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as QualityInspectionCategory)}
                >
                  {QC_STAGES.map((c) => (
                    <option key={c} value={c}>
                      {QC_STAGE_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
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
              </FormField>
            </div>
          </ErpCardSection>

          <ErpCardSection
            title="Parameter checklist"
            badge={
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
              <div className="overflow-x-auto rounded-md border border-erp-border">
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
              <FormField label="Add parameter" className="min-w-[min(100%,22rem)]">
                <Select
                  wrapClassName="w-full"
                  value={addParamId}
                  onChange={(e) => setAddParamId(e.target.value)}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {availableParams.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.parameterCode} - {p.parameterName} ({p.parameterType})
                    </option>
                  ))}
                </Select>
              </FormField>
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
          </ErpCardSection>
        </div>

        <aside className="flex flex-col gap-4">
          <ErpCardSection title="Summary">
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
          </ErpCardSection>
          <ErpCardSection title="Usage">
            <ul className="m-0 list-disc space-y-1 pl-3.5 text-[12px] leading-relaxed text-erp-muted">
              <li>
                <strong className="text-erp-text">Incoming</strong> - Purchase QI / GRN QC
              </li>
              <li>
                <strong className="text-erp-text">In process / Final</strong> - Manufacturing QI
              </li>
              <li>Checklist is snapshotted at inspection create</li>
            </ul>
          </ErpCardSection>
        </aside>
      </div>
    </ErpCardFormPage>
  )
}
