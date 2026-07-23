import { AlertTriangle } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'

/** Always-visible honesty banner for compliance screens */
export function TaxCompliancePreviewBanner({
  dense,
  variant = 'auto',
}: {
  dense?: boolean
  /** Force demo / extract-live messaging */
  variant?: 'auto' | 'demo' | 'extract-live' | 'filing-demo'
}) {
  const mode =
    variant === 'auto'
      ? isApiMode()
        ? 'filing-demo'
        : 'demo'
      : variant

  const copy =
    mode === 'extract-live'
      ? (
          <>
            <span className="font-semibold">Live GST extract + simulated e-invoice / e-way.</span> Outward/inward
            registers and IRN/EWB registers use the accounting API. NIC calls are <strong>SIMULATED</strong> (no
            GST portal). GSTR auto-submit and challans remain disconnected.
          </>
        )
      : mode === 'filing-demo' ? (
          <>
            <span className="font-semibold">Extract live; filing preview demo.</span> Register totals may come
            from posted invoices. Mark-filed / portal / challan actions are demo-only and do not submit to GST
            Portal, Income Tax, or TRACES. E-invoice / e-way use a simulated NIC adapter when generated in API
            mode.
          </>
        ) : (
          <>
            <span className="font-semibold">Frontend compliance preview based on demo data.</span> Not connected
            to GST Portal, Income Tax, or TRACES. Returns, challans, certificates, e-invoice, and e-way were not
            filed or generated with government systems.
          </>
        )

  return (
    <div
      role="status"
      className={
        dense
          ? 'flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-950'
          : 'flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950'
      }
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
      <p>{copy}</p>
    </div>
  )
}
