import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TaxComplianceShell } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  closeGstPaymentChallan,
  confirmGstPaymentChallan,
  getGstPaymentChallans,
  loadPeriodFilter,
  postGstPaymentChallanGl,
  proposeGstPaymentChallan,
  voidGstPaymentChallan,
} from '@/services/accounting/taxComplianceService'
import type { GstPaymentChallanDto } from '@/services/api/taxComplianceApi'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { formatCurrency } from '@/utils/formatters/currency'
import { appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'

/**
 * Phase 8 — books-side GST liability / PMT-06 style challans.
 * Not portal challan generation.
 */
export function GstPaymentChallansPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [items, setItems] = useState<GstPaymentChallanDto[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await getGstPaymentChallans(filter))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payment challans')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const canPrepare = perms.isApiMode && (perms.canGstPrepareReturn || perms.canSetup || perms.canView)

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      notify.success(ok)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <TaxComplianceShell
      title="GST Payment / PMT-06"
      description="Propose liability from posted GST ledger, record external CPIN/CIN after portal pay, optionally post settlement via central GL. Not portal challan generate."
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
              id: 'propose',
              label: 'Propose from ledger',
              onClick: () =>
                void run(() => proposeGstPaymentChallan(undefined, filter), 'Payment challan proposed from GST ledger'),
              disabled: busy || !perms.isApiMode || !canPrepare,
            },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-erp-muted">
            Books-side only. Confirm after you pay on the GST portal. GL post requires bank account UUID + mapped GST_
            OUTPUT_* / interest accounts.
          </p>
          {!items.length ? (
            <div className="rounded border border-erp-border bg-white p-6 text-[13px] text-erp-muted">
              No challans for this period. Propose after SI/VI GST ledger posts exist.
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-erp-border bg-white">
              <table className="w-full text-left text-[12px]">
                <thead className="border-b border-erp-border bg-erp-surface text-erp-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Period</th>
                    <th className="px-3 py-2 font-semibold">GSTIN</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold text-right">Liability</th>
                    <th className="px-3 py-2 font-semibold text-right">ITC</th>
                    <th className="px-3 py-2 font-semibold text-right">Net tax</th>
                    <th className="px-3 py-2 font-semibold text-right">Interest</th>
                    <th className="px-3 py-2 font-semibold text-right">Total</th>
                    <th className="px-3 py-2 font-semibold">CPIN / CIN</th>
                    <th className="px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-b border-erp-border/60">
                      <td className="px-3 py-2">{r.returnPeriod}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{r.companyGstin}</td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(Number(r.totalLiability))}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(Number(r.totalItc))}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(Number(r.netTaxPayable))}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(Number(r.interestAmount))}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(Number(r.totalPayable))}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{r.cpin || r.challanNumber || '-'}</td>
                      <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                        {perms.isApiMode && (r.status === 'PROPOSED' || r.status === 'DRAFT') ? (
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-erp-primary hover:underline"
                            disabled={busy}
                            onClick={() =>
                              void (async () => {
                                const cpin = await appPromptNote({
                                  title: 'Confirm external payment',
                                  description: 'Record CPIN/CIN after portal payment (not generated by FOS).',
                                  confirmLabel: 'Confirm',
                                  note: { required: false, label: 'CPIN / CIN', placeholder: 'Optional' },
                                })
                                await run(
                                  () =>
                                    confirmGstPaymentChallan(r.id, {
                                      paymentDate: new Date().toISOString().slice(0, 10),
                                      cpin: cpin?.trim() || undefined,
                                    }),
                                  'External payment confirmed',
                                )
                              })()
                            }
                          >
                            Confirm
                          </button>
                        ) : null}
                        {perms.isApiMode && (r.status === 'PROPOSED' || r.status === 'CONFIRMED_EXTERNAL') ? (
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-erp-primary hover:underline"
                            disabled={busy}
                            onClick={() =>
                              void (async () => {
                                const bankAccountId = await appPromptNote({
                                  title: 'Post settlement to GL',
                                  description: 'Central posting engine — enter bank CoA UUID. Requires GST_OUTPUT_* maps.',
                                  confirmLabel: 'Post GL',
                                  note: {
                                    required: true,
                                    label: 'Bank account UUID',
                                    placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
                                  },
                                })
                                if (!bankAccountId?.trim()) return
                                await run(
                                  () => postGstPaymentChallanGl(r.id, bankAccountId.trim()),
                                  'GST payment posted to GL',
                                )
                              })()
                            }
                          >
                            Post GL
                          </button>
                        ) : null}
                        {perms.isApiMode &&
                        (r.status === 'POSTED_GL' || r.status === 'CONFIRMED_EXTERNAL') ? (
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-erp-primary hover:underline"
                            disabled={busy}
                            onClick={() => void run(() => closeGstPaymentChallan(r.id), 'Payment period closed')}
                          >
                            Close
                          </button>
                        ) : null}
                        {perms.isApiMode &&
                        (r.status === 'DRAFT' || r.status === 'PROPOSED' || r.status === 'CONFIRMED_EXTERNAL') ? (
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-rose-700 hover:underline"
                            disabled={busy}
                            onClick={() =>
                              void (async () => {
                                const reason = await appPromptNote({
                                  title: 'Void challan',
                                  description: 'Voids the books-side challan so a new proposal can be created.',
                                  confirmLabel: 'Void',
                                  tone: 'danger',
                                  note: { required: true, label: 'Reason', placeholder: 'Reason…' },
                                })
                                if (!reason?.trim()) return
                                await run(() => voidGstPaymentChallan(r.id, reason.trim()), 'Challan voided')
                              })()
                            }
                          >
                            Void
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </TaxComplianceShell>
  )
}
