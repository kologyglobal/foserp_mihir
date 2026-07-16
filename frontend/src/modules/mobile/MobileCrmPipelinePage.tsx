import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Handshake, FileText, ShoppingCart, Target } from 'lucide-react'
import { MobilePageTitle } from '../../components/mobile'
import { MobileCrmPipelineNav } from '../../components/mobile/MobileCrmPipelineNav'
import {
  buildMobileCrmPipelineMetrics,
  buildMobileCrmPipelineStages,
} from '../../utils/mobileCrmPipeline'
import { formatCrmCurrency } from '../../utils/crmMetrics'

export function MobileCrmPipelinePage() {
  const navigate = useNavigate()
  const metrics = useMemo(() => buildMobileCrmPipelineMetrics(), [])
  const stages = useMemo(() => buildMobileCrmPipelineStages(metrics), [metrics])

  return (
    <div className="mobile-page space-y-4 p-4">
      <MobilePageTitle
        title="CRM Pipeline"
        subtitle="Lead → Opportunity → Quotation → Sales Order"
      />
      <MobileCrmPipelineNav />

      <div className="grid grid-cols-2 gap-2">
        <div className="mob-card">
          <p className="text-[11px] font-semibold uppercase text-[#605e5c]">Open pipeline</p>
          <p className="mt-1 text-xl font-bold text-[#0078d4]">{formatCrmCurrency(metrics.pipelineValue)}</p>
          <p className="text-xs text-[#605e5c]">{metrics.openOpportunities} opportunities</p>
        </div>
        <div className="mob-card">
          <p className="text-[11px] font-semibold uppercase text-[#605e5c]">Action needed</p>
          <p className="mt-1 text-xl font-bold text-[#d83b01]">{metrics.followUpsDue + metrics.quotationsPendingApproval}</p>
          <p className="text-xs text-[#605e5c]">Follow-ups + quote approvals</p>
        </div>
      </div>

      <div className="space-y-2">
        {stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            className="mob-card w-full text-left"
            onClick={() => navigate(stage.path)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[#242424]">{stage.label}</p>
                <p className="text-xs text-[#605e5c] truncate">{stage.hint}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {stage.count > 0 ? (
                  <span className="rounded-full bg-[#0078d4]/10 px-2 py-0.5 text-sm font-bold text-[#0078d4]">
                    {stage.count}
                  </span>
                ) : null}
                <ArrowRight className="h-4 w-4 text-[#605e5c]" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mob-card">
        <p className="text-sm font-semibold mb-2">Pipeline flow</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#605e5c]">
          <span className="inline-flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Lead</span>
          <ArrowRight className="h-3 w-3" />
          <span className="inline-flex items-center gap-1"><Handshake className="h-3.5 w-3.5" /> Opportunity</span>
          <ArrowRight className="h-3 w-3" />
          <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Quotation</span>
          <ArrowRight className="h-3 w-3" />
          <span className="inline-flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" /> Sales Order</span>
        </div>
        <button type="button" className="mob-btn mob-btn-secondary mt-3 w-full" onClick={() => navigate('/crm')}>
          Open Desktop CRM
        </button>
      </div>
    </div>
  )
}
