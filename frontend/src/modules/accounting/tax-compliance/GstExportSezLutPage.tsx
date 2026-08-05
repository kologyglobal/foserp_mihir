import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TaxComplianceShell } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getExportRefundClaims,
  getExportSezRegister,
  getGstLuts,
  loadPeriodFilter,
  proposeExportRefundClaim,
  saveGstLut,
} from '@/services/accounting/taxComplianceService'
import type { GstExportRefundClaimDto, GstExportRegisterDocDto, GstLutDto } from '@/services/api/taxComplianceApi'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { formatCurrency } from '@/utils/formatters/currency'
import { appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'

/**
 * Phase 10 — LUT master + Export/SEZ register + refund draft foundation.
 * Books only — not portal LUT filing or RFD submit.
 */
export function GstExportSezLutPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [luts, setLuts] = useState<GstLutDto[]>([])
  const [exports, setExports] = useState<GstExportRegisterDocDto[]>([])
  const [partition, setPartition] = useState({ wpayCount: 0, wopayCount: 0, otherCount: 0 })
  const [refunds, setRefunds] = useState<GstExportRefundClaimDto[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [l, e, r] = await Promise.all([
        getGstLuts(filter),
        getExportSezRegister(filter),
        getExportRefundClaims(filter),
      ])
      setLuts(l)
      setExports(e.items)
      setPartition(e.partition)
      setRefunds(r)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load export / LUT data')
      setLuts([])
      setExports([])
      setRefunds([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const canManage = perms.isApiMode && (perms.canSetup || perms.canGstPrepareReturn)

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      notify.success(ok)
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const addLut = async () => {
    const lutNumber = await appPromptNote({
      title: 'LUT number',
      description: 'Enter letter of undertaking number (books master).',
      note: { defaultValue: '', label: 'LUT number', required: true },
    })
    if (!lutNumber?.trim()) return
    const validFrom = await appPromptNote({
      title: 'Valid from',
      description: 'yyyy-MM-dd',
      note: { defaultValue: new Date().toISOString().slice(0, 10), label: 'Valid from', required: true },
    })
    if (!validFrom?.trim()) return
    await run(
      () =>
        saveGstLut({
          lutNumber: lutNumber.trim(),
          validFrom: validFrom.trim(),
          status: 'ACTIVE',
        }),
      'LUT saved',
    )
  }

  return (
    <TaxComplianceShell
      title="Export / SEZ / LUT"
      description="Zero-rated classification (WPAY / WOPAY), LUT bond master, export register from GST ledger, and refund claim drafts. Not portal LUT filing or RFD submit."
      bannerVariant="filing-demo"
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load(), disabled: busy },
            {
              id: 'add-lut',
              label: 'Add LUT',
              onClick: () => void addLut(),
              disabled: busy || !canManage,
            },
            {
              id: 'propose-refund',
              label: 'Propose IGST refund draft',
              onClick: () =>
                void run(() => proposeExportRefundClaim(filter), 'Refund claim draft proposed from WPAY ledger'),
              disabled: busy || !canManage || !perms.isApiMode,
            },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="space-y-6">
          <p className="text-[12px] text-erp-muted">
            WPAY = zero-rated with payment of IGST · WOPAY = without payment (requires active LUT on books). Post SI with
            tax treatment EXPORT_* / SEZ_*. Hard LUT block on post when GST_EXPORT_LUT_HARD_BLOCK=true.
          </p>

          <section className="rounded border border-erp-border bg-white p-4">
            <h3 className="mb-2 text-[13px] font-semibold text-erp-text">LUT bonds</h3>
            {!luts.length ? (
              <p className="text-[12px] text-erp-muted">No LUT bonds for this legal entity.</p>
            ) : (
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-erp-border text-erp-muted">
                    <th className="py-1 pr-2">Number</th>
                    <th className="py-1 pr-2">GSTIN</th>
                    <th className="py-1 pr-2">Valid</th>
                    <th className="py-1 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {luts.map((l) => (
                    <tr key={l.id} className="border-b border-erp-border/60">
                      <td className="py-1.5 pr-2 font-medium">{l.lutNumber}</td>
                      <td className="py-1.5 pr-2">{l.companyGstin || '—'}</td>
                      <td className="py-1.5 pr-2">
                        {l.validFrom} → {l.validTo || 'open'}
                      </td>
                      <td className="py-1.5 pr-2">
                        {l.status}
                        {!l.isActive ? ' (inactive)' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-erp-text">Export / SEZ register (ledger)</h3>
              <span className="text-[11px] text-erp-muted">
                WPAY {partition.wpayCount} · WOPAY {partition.wopayCount} · other {partition.otherCount}
              </span>
            </div>
            {!exports.length ? (
              <p className="text-[12px] text-erp-muted">
                No export/SEZ ledger rows for this return period. Post export invoices so Phase 10 stamps taxTreatment on
                GST ledger.
              </p>
            ) : (
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-erp-border text-erp-muted">
                    <th className="py-1 pr-2">Document</th>
                    <th className="py-1 pr-2">Date</th>
                    <th className="py-1 pr-2">Treatment</th>
                    <th className="py-1 pr-2">Mode</th>
                    <th className="py-1 pr-2">Taxable</th>
                    <th className="py-1 pr-2">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {exports.map((r) => (
                    <tr key={r.documentId} className="border-b border-erp-border/60">
                      <td className="py-1.5 pr-2 font-medium">{r.documentNumber}</td>
                      <td className="py-1.5 pr-2">{r.documentDate}</td>
                      <td className="py-1.5 pr-2">{r.taxTreatment || r.supplyType || '—'}</td>
                      <td className="py-1.5 pr-2">{r.zeroRatedMode || '—'}</td>
                      <td className="py-1.5 pr-2">{formatCurrency(r.taxableValue)}</td>
                      <td className="py-1.5 pr-2">{formatCurrency(r.totalTax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Refund claim drafts</h3>
            {!refunds.length ? (
              <p className="text-[12px] text-erp-muted">
                No books refund drafts. Propose from export WPAY IGST after ledger posts.
              </p>
            ) : (
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-erp-border text-erp-muted">
                    <th className="py-1 pr-2">Period</th>
                    <th className="py-1 pr-2">Type</th>
                    <th className="py-1 pr-2">IGST</th>
                    <th className="py-1 pr-2">Status</th>
                    <th className="py-1 pr-2">External ARN</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => (
                    <tr key={r.id} className="border-b border-erp-border/60">
                      <td className="py-1.5 pr-2">{r.returnPeriod}</td>
                      <td className="py-1.5 pr-2">{r.claimType}</td>
                      <td className="py-1.5 pr-2">{r.igstAmount}</td>
                      <td className="py-1.5 pr-2">{r.status}</td>
                      <td className="py-1.5 pr-2">{r.externalArn || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}
