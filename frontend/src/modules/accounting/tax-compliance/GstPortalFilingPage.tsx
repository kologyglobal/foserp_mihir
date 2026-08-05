import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TaxComplianceShell, TaxStatusBadge } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  approveGstrFilingChecker,
  captureGstrFilingArn,
  createGstrFilingPackage,
  getGstrFilingCapability,
  listGstrFilingSessions,
  loadPeriodFilter,
  markGstrFilingFiled,
  submitGstrFilingSession,
} from '@/services/accounting/taxComplianceService'
import type { GstrFilingCapabilityDto, GstrFilingSessionDto } from '@/services/api/taxComplianceApi'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'

/**
 * Phase 12 — GSTR portal filing foundation.
 * SIMULATED submit by default; packages require locked GSTR-1/3B (Phase 5). Not FULL GST COMPLIANT.
 */
export function GstPortalFilingPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [capability, setCapability] = useState<GstrFilingCapabilityDto | null>(null)
  const [items, setItems] = useState<GstrFilingSessionDto[]>([])
  const [returnType, setReturnType] = useState<'GSTR-1' | 'GSTR-3B'>('GSTR-1')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cap, list] = await Promise.all([getGstrFilingCapability(), listGstrFilingSessions(filter)])
      setCapability(cap)
      setItems(list)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load filing sessions')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

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

  const canFile = perms.isApiMode
    ? perms.canGstFileReturn
    : perms.canGstPrepareReturn || perms.canGstMarkFiled

  return (
    <TaxComplianceShell
      title="Portal filing"
      description="Package locked GSTR-1 / GSTR-3B and submit via SIMULATED path (default). Capture ARN and mark filed reuses Phase 5. Not LIVE GSTN / not FULL GST COMPLIANT."
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
              id: 'pkg-g1',
              label: 'Package GSTR-1',
              onClick: () =>
                void run(
                  () => createGstrFilingPackage('GSTR-1', undefined, filter),
                  'Filing package created from locked GSTR-1 snapshot (SIMULATED path).',
                ),
              disabled: busy || !perms.isApiMode || !canFile,
            },
            {
              id: 'pkg-g3',
              label: 'Package GSTR-3B',
              onClick: () =>
                void run(
                  () => createGstrFilingPackage('GSTR-3B', undefined, filter),
                  'Filing package created from locked GSTR-3B snapshot (SIMULATED path).',
                ),
              disabled: busy || !perms.isApiMode || !canFile,
            },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState label="Loading portal filing…" />
      ) : (
        <div className="space-y-4">
          <section className="rounded border border-erp-border bg-white p-4 text-[13px]">
            <h2 className="text-sm font-semibold">Capability</h2>
            <p className="mt-1 text-erp-muted">
              Mode: {capability?.providerMode ?? '—'} · Verdict: {capability?.verdict ?? '—'} · Full GST
              compliant? {capability?.notFullGstCompliant === false ? 'Yes' : 'No (honest label)'}
            </p>
            <p className="mt-2 text-[12px] text-erp-muted">{capability?.note}</p>
            {(capability?.liveBlockers?.length ?? 0) > 0 && (
              <ul className="mt-2 list-disc pl-5 text-[12px] text-erp-muted">
                {capability!.liveBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-[12px] text-erp-muted" htmlFor="filing-return-type">
                Package type
              </label>
              <select
                id="filing-return-type"
                className="rounded border border-erp-border px-2 py-1 text-[12px]"
                value={returnType}
                onChange={(e) => setReturnType(e.target.value as 'GSTR-1' | 'GSTR-3B')}
              >
                <option value="GSTR-1">GSTR-1</option>
                <option value="GSTR-3B">GSTR-3B</option>
              </select>
              <button
                type="button"
                className="rounded border border-erp-border px-2 py-1 text-[12px] disabled:opacity-50"
                disabled={busy || !perms.isApiMode || !canFile}
                onClick={() =>
                  void run(
                    () => createGstrFilingPackage(returnType, undefined, filter),
                    `${returnType} filing package created.`,
                  )
                }
              >
                Create package
              </button>
            </div>
          </section>

          {!items.length ? (
            <div className="rounded border border-erp-border bg-white p-6 text-[13px] text-erp-muted">
              {perms.isApiMode
                ? 'No filing sessions for this period. Lock GSTR-1/3B Prep first, then create a package.'
                : 'Demo shows a seed SIMULATED session. Switch to API mode for live sessions.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-erp-border bg-white">
              <table className="w-full text-left text-[12px]">
                <thead className="border-b border-erp-border bg-erp-surface text-erp-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Period</th>
                    <th className="px-3 py-2 font-semibold">GSTIN</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Mode</th>
                    <th className="px-3 py-2 font-semibold">ARN</th>
                    <th className="px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-b border-erp-border/60">
                      <td className="px-3 py-2">{r.returnType}</td>
                      <td className="px-3 py-2">{r.returnPeriod}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{r.companyGstin}</td>
                      <td className="px-3 py-2">
                        <TaxStatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2">{r.providerMode}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{r.acknowledgmentRef ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.status === 'PENDING_CHECKER' && perms.isApiMode && canFile && (
                            <button
                              type="button"
                              className="rounded border border-erp-border px-2 py-0.5 disabled:opacity-50"
                              disabled={busy}
                              onClick={() =>
                                void run(() => approveGstrFilingChecker(r.id), 'Checker approved')
                              }
                            >
                              Approve
                            </button>
                          )}
                          {(r.status === 'PACKAGE_READY' ||
                            r.status === 'FAILED' ||
                            r.status === 'LIVE_BLOCKED') &&
                            perms.isApiMode &&
                            canFile && (
                              <button
                                type="button"
                                className="rounded border border-erp-border px-2 py-0.5 disabled:opacity-50"
                                disabled={busy}
                                onClick={() =>
                                  void run(
                                    () => submitGstrFilingSession(r.id),
                                    'Submit processed (SIMULATED / LIVE-gated)',
                                  )
                                }
                              >
                                Submit
                              </button>
                            )}
                          {perms.isApiMode && canFile && r.status !== 'MARKED_FILED' && (
                            <button
                              type="button"
                              className="rounded border border-erp-border px-2 py-0.5 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => {
                                void (async () => {
                                  const arn = await appPromptNote({
                                    title: 'ARN / acknowledgment',
                                    description: 'Enter portal ARN (or leave SIM-ARN if already filled).',
                                    note: {
                                      label: 'ARN',
                                      required: true,
                                      defaultValue: r.acknowledgmentRef ?? '',
                                    },
                                  })
                                  if (!arn?.trim()) return
                                  const filedOn = await appPromptNote({
                                    title: 'Filed on portal date',
                                    description: 'Enter portal filed date as YYYY-MM-DD.',
                                    note: {
                                      label: 'Date (YYYY-MM-DD)',
                                      required: true,
                                      defaultValue:
                                        r.filedOnPortalDate ?? new Date().toISOString().slice(0, 10),
                                    },
                                  })
                                  if (!filedOn?.trim()) return
                                  await run(
                                    () =>
                                      captureGstrFilingArn(r.id, {
                                        acknowledgmentRef: arn.trim(),
                                        filedOnPortalDate: filedOn.trim(),
                                      }),
                                    'ARN captured',
                                  )
                                })()
                              }}
                            >
                              Capture ARN
                            </button>
                          )}
                          {perms.isApiMode &&
                            perms.canGstMarkFiled &&
                            r.acknowledgmentRef &&
                            r.status !== 'MARKED_FILED' && (
                              <button
                                type="button"
                                className="rounded border border-erp-border px-2 py-0.5 disabled:opacity-50"
                                disabled={busy}
                                onClick={() =>
                                  void run(
                                    () => markGstrFilingFiled(r.id),
                                    'Return marked filed (Phase 5 ledger FILED)',
                                  )
                                }
                              >
                                Mark filed
                              </button>
                            )}
                        </div>
                        {r.failureMessage && (
                          <p className="mt-1 max-w-xs text-[11px] text-red-700">{r.failureMessage}</p>
                        )}
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
