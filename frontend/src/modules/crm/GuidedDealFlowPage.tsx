import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Handshake,
  Route,
  ShoppingCart,
  UserPlus,
} from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { ErpButton, ErpButtonGroup } from '../../components/erp/ErpButton'
import { QuickLeadDrawer } from '../../components/crm/quick-create/QuickLeadDrawer'
import { NewOpportunityDrawer } from '../../components/crm/CrmQuickCreateDrawers'
import { useSalesStore } from '../../store/salesStore'
import { useCrmStore } from '../../store/crmStore'
import { resolveLeadConvertToOpportunityGate } from '../../utils/leadUtils'
import { resolveOpportunityCreateSalesOrderGate } from '../../utils/opportunitySalesOrderDraft'
import { buildBlankSalesOrderNewUrl, buildSalesOrderNewUrl } from '../../utils/crmSalesOrderNavigation'
import { crmModuleBreadcrumbs } from '../../utils/crmNavigation'
import { resolveStoreAction } from '../../store/storeAction'
import { notify } from '../../store/toastStore'
import { cn } from '../../utils/cn'

type GuidedStep = 'lead' | 'qualify' | 'opportunity' | 'quote' | 'order'

const STEPS: { id: GuidedStep; label: string; icon: typeof Route }[] = [
  { id: 'lead', label: 'Lead', icon: UserPlus },
  { id: 'qualify', label: 'Qualify', icon: CheckCircle2 },
  { id: 'opportunity', label: 'Opportunity', icon: Handshake },
  { id: 'quote', label: 'Quote', icon: FileText },
  { id: 'order', label: 'Order', icon: ShoppingCart },
]

function parseStep(raw: string | null): GuidedStep {
  if (raw && STEPS.some((s) => s.id === raw)) return raw as GuidedStep
  return 'lead'
}

export function GuidedDealFlowPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const step = parseStep(searchParams.get('step'))
  const leadId = searchParams.get('leadId') ?? ''
  const opportunityId = searchParams.get('opportunityId') ?? ''
  const quotationDocumentId = searchParams.get('quotationDocumentId') ?? ''

  const lead = useSalesStore((s) => (leadId ? s.getLead(leadId) : undefined))
  const advanceLeadStage = useSalesStore((s) => s.advanceLeadStage)
  const opportunity = useCrmStore((s) => (opportunityId ? s.getOpportunity(opportunityId) : undefined))
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)

  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false)
  const [oppDrawerOpen, setOppDrawerOpen] = useState(false)

  const quoteDoc = useMemo(() => {
    if (quotationDocumentId) {
      return quotationDocuments.find((d) => d.id === quotationDocumentId) ?? null
    }
    if (!opportunityId) return null
    return quotationDocuments
      .filter((d) => d.opportunityId === opportunityId)
      .sort((a, b) => b.revisionNo - a.revisionNo)[0] ?? null
  }, [quotationDocumentId, opportunityId, quotationDocuments])

  const convertGate = resolveLeadConvertToOpportunityGate(lead)
  const soGate = resolveOpportunityCreateSalesOrderGate(opportunityId || undefined, quoteDoc?.id)

  function setProgress(patch: Record<string, string | null | undefined>) {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k)
      else next.set(k, v)
    }
    setSearchParams(next, { replace: true })
  }

  function goStep(next: GuidedStep) {
    setProgress({ step: next })
  }

  async function handleQualify() {
    if (!leadId) return
    const r = await resolveStoreAction(advanceLeadStage(leadId, 'qualified'))
    if (!r.ok) {
      notify.error(r.error ?? 'Could not qualify lead')
      return
    }
    notify.success('Lead qualified')
    goStep('opportunity')
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <OperationalPageShell
      title="Guided Deal"
      description="Lead → Qualify → Opportunity → Quote → Order — capture the minimum at each step"
      badge="CRM"
      favoritePath="/crm/guided-deal"
      variant="dynamics"
      autoBreadcrumbs={false}
      breadcrumbs={crmModuleBreadcrumbs('Guided Deal', '/crm/guided-deal')}
      pageGuide={{
        purpose: 'Opt-in process for larger deals. Quick Create remains available for fast capture.',
        nextStep: 'Complete the current step, then Continue. You can leave and resume via this URL.',
      }}
    >
      <ol className="mb-6 grid gap-2 sm:grid-cols-5" aria-label="Guided deal steps">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < stepIndex || (s.id === 'lead' && Boolean(leadId))
          const active = s.id === step
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goStep(s.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'border-erp-primary bg-erp-primary/5'
                    : done
                      ? 'border-emerald-200 bg-emerald-50/80'
                      : 'border-erp-border bg-erp-surface',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                    active ? 'bg-erp-primary text-white' : done ? 'bg-emerald-600 text-white' : 'bg-erp-surface-alt text-erp-muted',
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-erp-text">
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="rounded-xl border border-erp-border bg-erp-surface p-5">
        {step === 'lead' ? (
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-erp-text">Step 1 — Capture lead</h2>
            <p className="text-[13px] text-erp-muted">
              Minimum data only: prospect, contact path, source, owner. Product and commercial details come later.
            </p>
            {lead ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-[13px] text-emerald-900">
                Linked lead: <strong>{lead.leadNo}</strong> — {lead.prospectName}
              </div>
            ) : null}
            <ErpButtonGroup>
              <ErpButton type="button" variant="primary" icon={UserPlus} onClick={() => setLeadDrawerOpen(true)}>
                {lead ? 'Capture another lead' : 'Quick Create Lead'}
              </ErpButton>
              <ErpButton type="button" variant="secondary" icon={Building2} onClick={() => navigate('/crm/leads/new')}>
                Full lead form
              </ErpButton>
              {leadId ? (
                <ErpButton type="button" variant="secondary" icon={ArrowRight} onClick={() => goStep('qualify')}>
                  Continue to Qualify
                </ErpButton>
              ) : null}
            </ErpButtonGroup>
            <p className="text-[12px] text-erp-muted">
              After Quick Create, choose <strong>Continue Guided</strong> — or paste a lead id via the lead register.
            </p>
          </div>
        ) : null}

        {step === 'qualify' ? (
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-erp-text">Step 2 — Qualify</h2>
            {!leadId || !lead ? (
              <p className="text-[13px] text-erp-muted">Create or select a lead first.</p>
            ) : (
              <>
                <p className="text-[13px] text-erp-muted">
                  Current stage: <strong>{lead.stage}</strong>. Qualification unlocks opportunity conversion.
                  Link a company on the lead if missing.
                </p>
                <ErpButtonGroup>
                  <ErpButton type="button" variant="secondary" onClick={() => navigate(`/crm/leads/${leadId}`)}>
                    Open Lead 360
                  </ErpButton>
                  <ErpButton
                    type="button"
                    variant="primary"
                    icon={CheckCircle2}
                    disabled={lead.stage === 'qualified' || lead.stage === 'converted_to_opportunity'}
                    onClick={() => void handleQualify()}
                  >
                    Mark Qualified
                  </ErpButton>
                  <ErpButton
                    type="button"
                    variant="secondary"
                    icon={ArrowRight}
                    disabled={!convertGate.ok && lead.stage !== 'qualified'}
                    onClick={() => goStep('opportunity')}
                  >
                    Continue to Opportunity
                  </ErpButton>
                </ErpButtonGroup>
                {!convertGate.ok && lead.stage !== 'qualified' ? (
                  <p className="text-[12px] text-amber-800">{convertGate.reason}</p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {step === 'opportunity' ? (
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-erp-text">Step 3 — Opportunity</h2>
            {opportunity ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-[13px] text-emerald-900">
                Linked deal: <strong>{opportunity.opportunityNo}</strong> — {opportunity.opportunityName}
              </div>
            ) : null}
            <ErpButtonGroup>
              <ErpButton
                type="button"
                variant="primary"
                icon={Handshake}
                disabled={!lead?.customerId}
                onClick={() => {
                  if (leadId && lead?.customerId) {
                    navigate(`/crm/opportunities/new?leadId=${leadId}&customerId=${lead.customerId}&guided=1`)
                    return
                  }
                  setOppDrawerOpen(true)
                }}
              >
                Create Opportunity
              </ErpButton>
              {opportunityId ? (
                <ErpButton type="button" variant="secondary" icon={ArrowRight} onClick={() => goStep('quote')}>
                  Continue to Quote
                </ErpButton>
              ) : null}
            </ErpButtonGroup>
            {!lead?.customerId && leadId ? (
              <p className="text-[12px] text-amber-800">Link a company on the lead before converting.</p>
            ) : null}
            <p className="text-[12px] text-erp-muted">
              After creating an opportunity, return here with{' '}
              <code className="rounded bg-slate-100 px-1">?opportunityId=…&step=quote</code>
              {' '}or open{' '}
              <Link className="font-semibold text-erp-primary hover:underline" to="/crm/opportunities">
                Opportunities
              </Link>
              .
            </p>
          </div>
        ) : null}

        {step === 'quote' ? (
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-erp-text">Step 4 — Quotation</h2>
            {quoteDoc ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-[13px] text-emerald-900">
                Quotation document linked — status <strong>{quoteDoc.status}</strong>
              </div>
            ) : null}
            <ErpButtonGroup>
              <ErpButton
                type="button"
                variant="primary"
                icon={FileText}
                disabled={!opportunityId}
                onClick={() => navigate(`/crm/quotations/new?opportunityId=${opportunityId}`)}
              >
                Create Quotation
              </ErpButton>
              {quoteDoc ? (
                <ErpButton
                  type="button"
                  variant="secondary"
                  onClick={() => setProgress({ quotationDocumentId: quoteDoc.id, step: 'order' })}
                >
                  Continue to Order
                </ErpButton>
              ) : (
                <ErpButton
                  type="button"
                  variant="secondary"
                  icon={ArrowRight}
                  disabled={!opportunityId}
                  onClick={() => goStep('order')}
                >
                  Skip to Order (direct SO)
                </ErpButton>
              )}
            </ErpButtonGroup>
            <p className="text-[12px] text-erp-muted">
              Approve and customer-accept the quote when the deal is serious — conversion gates stay in place.
            </p>
          </div>
        ) : null}

        {step === 'order' ? (
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-erp-text">Step 5 — Sales Order</h2>
            <p className="text-[13px] text-erp-muted">
              Prefer Convert from an approved quotation. Direct SO is allowed when customer and items exist.
            </p>
            <ErpButtonGroup>
              {soGate.enabled && soGate.quotationDocumentId ? (
                <ErpButton
                  type="button"
                  variant="primary"
                  icon={ShoppingCart}
                  onClick={() =>
                    navigate(
                      buildSalesOrderNewUrl(opportunityId, soGate.quotationDocumentId, { fromCrm: true }),
                    )
                  }
                >
                  Create from Quotation
                </ErpButton>
              ) : null}
              <ErpButton
                type="button"
                variant={soGate.enabled ? 'secondary' : 'primary'}
                icon={ShoppingCart}
                onClick={() => navigate(buildBlankSalesOrderNewUrl({ fromCrm: true }))}
              >
                Direct Sales Order
              </ErpButton>
              <ErpButton type="button" variant="secondary" onClick={() => navigate('/crm/sales-orders')}>
                Open CRM Sales Orders
              </ErpButton>
            </ErpButtonGroup>
            {!soGate.enabled && soGate.disabledReason ? (
              <p className="text-[12px] text-amber-800">{soGate.disabledReason}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <QuickLeadDrawer
        open={leadDrawerOpen}
        onClose={() => setLeadDrawerOpen(false)}
        onCreated={(id) => {
          setProgress({ leadId: id, step: 'qualify' })
        }}
      />
      <NewOpportunityDrawer
        open={oppDrawerOpen}
        onClose={() => setOppDrawerOpen(false)}
        defaultCustomerId={lead?.customerId}
        navigateOnCreate={false}
        onCreated={(id) => {
          setOppDrawerOpen(false)
          setProgress({ opportunityId: id, step: 'quote' })
        }}
      />
    </OperationalPageShell>
  )
}
