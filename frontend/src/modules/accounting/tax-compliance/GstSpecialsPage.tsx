import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TaxComplianceShell } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getCompositionGatesInfo,
  getGstAdvanceRegister,
  getGstWithholdingRegister,
  getNilExemptRegister,
  getSpecialsCapabilityMatrix,
  loadPeriodFilter,
} from '@/services/accounting/taxComplianceService'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'

/**
 * Phase 11 — special schemes (nil/exempt, composition, GST TDS/TCS, advances).
 * Books-side only — not FULL GST COMPLIANT / not portal filing.
 */
export function GstSpecialsPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [matrix, setMatrix] = useState<Awaited<ReturnType<typeof getSpecialsCapabilityMatrix>> | null>(null)
  const [nilRows, setNilRows] = useState<Array<Record<string, unknown>>>([])
  const [whRows, setWhRows] = useState<Array<Record<string, unknown>>>([])
  const [advRows, setAdvRows] = useState<Array<Record<string, unknown>>>([])
  const [composition, setComposition] = useState<{ compositionCount: number; eInvoiceBlockedFor: string[] } | null>(
    null,
  )
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, n, w, a, c] = await Promise.all([
        getSpecialsCapabilityMatrix(),
        getNilExemptRegister(filter),
        getGstWithholdingRegister(filter),
        getGstAdvanceRegister(filter),
        getCompositionGatesInfo(),
      ])
      setMatrix(m)
      setNilRows(n.items ?? [])
      setWhRows(w.items ?? [])
      setAdvRows(a.items ?? [])
      setComposition({
        compositionCount: Number(c.compositionCount ?? 0),
        eInvoiceBlockedFor: (c.eInvoiceBlockedFor as string[]) ?? [],
      })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load specials')
      setMatrix(null)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <TaxComplianceShell
      title="Special schemes"
      description="Nil/exempt classification, composition gates, GST TDS/TCS & advance books prep — not portal filing, not FULL GST COMPLIANT."
      bannerVariant="filing-demo"
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void load(),
            },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState label="Loading special schemes…" />
      ) : (
        <div className="space-y-6">
          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Capability matrix</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Verdict: {matrix?.verdict ?? '—'} · Full GST compliant?{' '}
              {matrix?.notFullGstCompliant === false ? 'Yes' : 'No (honest label)'} · Mode:{' '}
              {perms.isApiMode ? 'API' : 'Demo'}
            </p>
            <ul className="mt-3 divide-y divide-erp-border text-sm">
              {(matrix?.capabilities ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-2 py-2">
                  <span className="font-medium">{c.label}</span>
                  <span className="rounded bg-erp-surface-muted px-1.5 py-0.5 text-xs text-erp-muted">{c.status}</span>
                  <span className="w-full text-xs text-erp-muted">{c.notes}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Composition gates</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Composition registrations: {composition?.compositionCount ?? 0}
              {(composition?.eInvoiceBlockedFor?.length ?? 0) > 0
                ? ` · IRN blocked for: ${composition!.eInvoiceBlockedFor.join(', ')}`
                : ' · No composition GSTINs active'}
            </p>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Nil / exempt / non-GST ledger</h2>
            <p className="mt-1 text-xs text-erp-muted">{nilRows.length} row(s) in selected period.</p>
            {nilRows.length > 0 && (
              <div className="mt-2 overflow-x-auto text-xs">
                <table className="min-w-full">
                  <thead>
                    <tr className="text-left text-erp-muted">
                      <th className="py-1 pr-3">Doc</th>
                      <th className="py-1 pr-3">Class</th>
                      <th className="py-1 pr-3">Taxable</th>
                      <th className="py-1">Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nilRows.slice(0, 20).map((r) => (
                      <tr key={String(r.id)} className="border-t border-erp-border">
                        <td className="py-1 pr-3">{String(r.documentNumber ?? '—')}</td>
                        <td className="py-1 pr-3">{String(r.supplyClass ?? '—')}</td>
                        <td className="py-1 pr-3">{String(r.taxableValue ?? '—')}</td>
                        <td className="py-1">{String(r.taxAmount ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">GST TDS / TCS (books)</h2>
            <p className="mt-1 text-xs text-erp-muted">
              {whRows.length} entry(ies). Not GSTR-7/8 portal · not Income-tax TDS.
            </p>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Customer advances</h2>
            <p className="mt-1 text-xs text-erp-muted">
              {advRows.length} entry(ies). Books prep only — not full GSTR-1 Table 11.
            </p>
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}
