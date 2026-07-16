import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { TaxComplianceShell, TaxStatusBadge } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getGstReturnPrep,
  loadPeriodFilter,
  markReturnFiledExternally,
} from '@/services/accounting/taxComplianceService'
import type { GstReturnPrep, PeriodFilterState } from '@/types/taxCompliance'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'

function GstReturnPrepPage({ returnType }: { returnType: 'GSTR-1' | 'GSTR-3B' }) {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [data, setData] = useState<GstReturnPrep | null>(null)
  const [loading, setLoading] = useState(true)
  const [ack, setAck] = useState('')
  const [filedOn, setFiledOn] = useState('')
  const [remarks, setRemarks] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getGstReturnPrep(returnType, filter))
    } finally {
      setLoading(false)
    }
  }, [filter, returnType])

  useEffect(() => {
    void load()
  }, [load])

  const markFiled = async () => {
    if (!perms.canGstMarkFiled) {
      notify.error('Permission denied to mark return filed externally.')
      return
    }
    try {
      const updated = await markReturnFiledExternally(returnType, {
        acknowledgmentRef: ack,
        filedOnPortalDate: filedOn,
        remarks,
      })
      setData(updated)
      notify.success(`${returnType} marked filed externally (demo status only — not submitted to GST portal).`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not update status')
    }
  }

  return (
    <TaxComplianceShell
      title={returnType}
      description={`${returnType} preparation workspace — frontend preview totals only.`}
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'export',
              label: 'Export Preview',
              icon: Download,
              onClick: () => notify.info(`${returnType} JSON/CSV export is a placeholder until the filing engine ships.`),
            },
          ]}
        />
      }
    >
      {loading || !data ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <TaxStatusBadge status={data.status} />
            <span className="text-[12px] text-erp-muted">Period {data.periodKey}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Outward taxable" value={formatCurrency(data.outwardTaxable)} />
            <Metric label="Tax liability preview" value={formatCurrency(data.taxLiability)} />
            <Metric label="ITC available preview" value={formatCurrency(data.itcAvailable)} />
            <Metric label="Net payable preview" value={formatCurrency(data.netPayable)} />
          </div>
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">Mark Filed Externally</h2>
            <p className="mt-1 text-[12px] text-erp-muted">
              Use after you file on the GST portal outside FOS. This only updates demo workflow status — it does not file the return.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
                Acknowledgment / ARN
                <input className="h-8 rounded border border-erp-border px-2 text-[12px] font-normal" value={ack} onChange={(e) => setAck(e.target.value)} />
              </label>
              <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
                Portal filing date
                <input type="date" className="h-8 rounded border border-erp-border px-2 text-[12px] font-normal" value={filedOn} onChange={(e) => setFiledOn(e.target.value)} />
              </label>
              <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted sm:col-span-2">
                Remarks
                <input className="h-8 rounded border border-erp-border px-2 text-[12px] font-normal" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </label>
            </div>
            <button
              type="button"
              className="erp-btn erp-btn-primary mt-3 h-8 px-3 text-[12px]"
              disabled={!perms.canGstMarkFiled}
              onClick={() => void markFiled()}
            >
              Mark Filed Externally
            </button>
            {data.acknowledgmentRef ? (
              <p className="mt-2 text-[12px] text-erp-muted">
                Last marked: {data.acknowledgmentRef} on {data.filedOnPortalDate} by {data.markedFiledBy}
              </p>
            ) : null}
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-erp-border p-2">
      <div className="text-[11px] text-erp-muted">{label}</div>
      <div className="text-[14px] font-semibold">{value}</div>
    </div>
  )
}

export function Gstr1Page() {
  return <GstReturnPrepPage returnType="GSTR-1" />
}

export function Gstr3bPage() {
  return <GstReturnPrepPage returnType="GSTR-3B" />
}
