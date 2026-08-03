import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle, Plus, RefreshCw, Scale } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { appConfirm } from '@/store/confirmDialogStore'
import {
  activateStatutoryRule,
  createStatutoryRule,
  listStatutoryRules,
  putStatutoryPtSlabs,
  putStatutoryWageBasis,
  type HrStatutoryRule,
  type HrStatutoryRuleType,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { HrEmptyState, HrRegisterShell, HrStatusChip } from '@/modules/hrms/components'
import '../hrms-ui.css'

const ROUTE_TO_TYPE: Record<string, HrStatutoryRuleType> = {
  pf: 'PF',
  esic: 'ESIC',
  pt: 'PROFESSIONAL_TAX',
  tds: 'TDS',
  lwf: 'LWF',
}

const TITLES: Record<string, string> = {
  pf: 'PF Rules',
  esic: 'ESIC Rules',
  pt: 'Professional Tax',
  tds: 'Salary TDS Foundation',
  lwf: 'LWF Rules',
}

export function StatutoryTypePage() {
  const { kind = 'pf' } = useParams<{ kind: string }>()
  const type = ROUTE_TO_TYPE[kind]
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrStatutoryRule[]>([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [employeeRate, setEmployeeRate] = useState('')
  const [employerRate, setEmployerRate] = useState('')
  const [wageCeiling, setWageCeiling] = useState('')
  const [eligCeiling, setEligCeiling] = useState('')
  const [wageBasis, setWageBasis] = useState('BASIC')
  const [ptFrom, setPtFrom] = useState('0')
  const [ptTo, setPtTo] = useState('')
  const [ptTax, setPtTax] = useState('')

  const load = async () => {
    if (!type) return
    setLoading(true)
    try {
      const res = await listStatutoryRules({ type, limit: 100 })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load rules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [kind])

  if (!type) {
    return (
      <OperationalPageShell title="Statutory" breadcrumbs={[{ label: 'Statutory', to: '/hrms/payroll/statutory' }]}>
        <p className="text-sm">Unknown statutory type.</p>
      </OperationalPageShell>
    )
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!perms.canManageStatutory || !effectiveFrom) return
    try {
      const res = await createStatutoryRule({
        type,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        effectiveFrom,
        stateCode: type === 'PROFESSIONAL_TAX' || type === 'LWF' ? stateCode.trim().toUpperCase() || null : null,
        employeeRatePct: type === 'PF' || type === 'ESIC' ? (employeeRate ? Number(employeeRate) : null) : null,
        employerRatePct: type === 'PF' || type === 'ESIC' ? (employerRate ? Number(employerRate) : null) : null,
        employeeFixedAmount: type === 'LWF' ? (employeeRate ? Number(employeeRate) : null) : null,
        employerFixedAmount: type === 'LWF' ? (employerRate ? Number(employerRate) : null) : null,
        wageCeiling: wageCeiling ? Number(wageCeiling) : null,
        eligibilityWageCeiling: eligCeiling ? Number(eligCeiling) : null,
        frequency: type === 'LWF' ? 'MONTHLY' : null,
      })
      const id = res.data?.id
      if (id && (type === 'PF' || type === 'ESIC') && wageBasis.trim()) {
        await putStatutoryWageBasis(
          id,
          wageBasis
            .split(',')
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean)
            .map((componentCode, i) => ({ componentCode, include: true, sequence: (i + 1) * 10 })),
        )
      }
      if (id && type === 'PROFESSIONAL_TAX' && ptTax) {
        await putStatutoryPtSlabs(id, [
          {
            fromAmount: Number(ptFrom || 0),
            toAmount: ptTo ? Number(ptTo) : null,
            taxAmount: Number(ptTax),
            sequence: 10,
          },
        ])
      }
      notify.success('Draft rule created')
      setCode('')
      setName('')
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Create failed')
    }
  }

  const activate = async (ruleId: string) => {
    if (!perms.canManageStatutory) return
    const ok = await appConfirm({
      title: 'Activate rule',
      description: 'Active rules become the effective statutory configuration for overlapping dates.',
    })
    if (!ok) return
    try {
      await activateStatutoryRule(ruleId)
      notify.success('Rule activated')
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Activate failed')
    }
  }

  const rateSummary = (r: HrStatutoryRule) => {
    if (type === 'PROFESSIONAL_TAX') {
      const n = r.ptSlabs?.length ?? 0
      return `${r.stateCode ?? '—'} · ${n} slab(s)`
    }
    if (type === 'TDS') return 'Foundation / review'
    if (type === 'LWF') {
      return `Emp ₹${r.employeeFixedAmount ?? r.employeeRatePct ?? '—'} · ${r.frequency ?? '—'}`
    }
    return `Emp ${r.employeeRatePct ?? '—'}% · Er ${r.employerRatePct ?? '—'}% · Cap ${r.wageCeiling ?? '—'}`
  }

  return (
    <OperationalPageShell
      title={TITLES[kind] ?? type}
      description="Compact effective-dated rules. Payroll resolves getEffectiveStatutoryRule — never hardcodes rates."
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Statutory', to: '/hrms/payroll/statutory' },
        { label: TITLES[kind] ?? type },
      ]}
    >
      <ErpCommandBar
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />

      {perms.canManageStatutory ? (
        <form
          onSubmit={create}
          className="mb-4 grid grid-cols-1 gap-2 rounded border border-erp-border bg-white p-3 md:grid-cols-4 md:items-end"
        >
          <FormField label="Code" required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} required />
          </FormField>
          <FormField label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="Effective from" required>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
          </FormField>
          {(type === 'PROFESSIONAL_TAX' || type === 'LWF') && (
            <FormField label="State code" required>
              <Input value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="MH" required />
            </FormField>
          )}
          {(type === 'PF' || type === 'ESIC') && (
            <>
              <FormField label="Employee %">
                <Input value={employeeRate} onChange={(e) => setEmployeeRate(e.target.value)} />
              </FormField>
              <FormField label="Employer %">
                <Input value={employerRate} onChange={(e) => setEmployerRate(e.target.value)} />
              </FormField>
              <FormField label="Wage ceiling">
                <Input value={wageCeiling} onChange={(e) => setWageCeiling(e.target.value)} />
              </FormField>
              {type === 'ESIC' ? (
                <FormField label="Eligibility ceiling">
                  <Input value={eligCeiling} onChange={(e) => setEligCeiling(e.target.value)} />
                </FormField>
              ) : null}
              <FormField label="Wage basis codes">
                <Input
                  value={wageBasis}
                  onChange={(e) => setWageBasis(e.target.value)}
                  placeholder="BASIC,DA"
                />
              </FormField>
            </>
          )}
          {type === 'PROFESSIONAL_TAX' ? (
            <>
              <FormField label="Slab from">
                <Input value={ptFrom} onChange={(e) => setPtFrom(e.target.value)} />
              </FormField>
              <FormField label="Slab to">
                <Input value={ptTo} onChange={(e) => setPtTo(e.target.value)} placeholder="open" />
              </FormField>
              <FormField label="Tax amount">
                <Input value={ptTax} onChange={(e) => setPtTax(e.target.value)} />
              </FormField>
            </>
          ) : null}
          {type === 'LWF' ? (
            <>
              <FormField label="Employee fixed ₹">
                <Input value={employeeRate} onChange={(e) => setEmployeeRate(e.target.value)} />
              </FormField>
              <FormField label="Employer fixed ₹">
                <Input value={employerRate} onChange={(e) => setEmployerRate(e.target.value)} />
              </FormField>
            </>
          ) : null}
          {type === 'TDS' ? (
            <p className="md:col-span-4 text-xs text-erp-muted">
              TDS foundation: create an ACTIVE rule as a marker. Monthly amounts use authorized manual input or
              REVIEW_REQUIRED — no fake IT slab engine.
            </p>
          ) : null}
          <button type="submit" className="btn btn--primary btn--sm">
            <Plus className="mr-1 h-4 w-4" />
            Add draft
          </button>
        </form>
      ) : null}

      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState icon={Scale} title="No rules" description="Create an effective-dated draft, then activate." />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Effective</th>
                <th>Rate / slab</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.code}</td>
                  <td>{r.name}</td>
                  <td>
                    {r.effectiveFrom}
                    {r.effectiveTo ? ` → ${r.effectiveTo}` : ''}
                  </td>
                  <td>{rateSummary(r)}</td>
                  <td>
                    <HrStatusChip status={r.status} domain="statutoryRule" />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {perms.canManageStatutory && r.status === 'DRAFT' ? (
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => void activate(r.id)}>
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Activate
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HrRegisterShell>

      <p className="mt-3 text-xs text-erp-muted">
        <Link className="text-erp-primary" to="/hrms/payroll/statutory">
          All statutory types
        </Link>
        {' · '}
        <Link className="text-erp-primary" to="/hrms/payroll/runs">
          Payroll runs
        </Link>
      </p>
    </OperationalPageShell>
  )
}
