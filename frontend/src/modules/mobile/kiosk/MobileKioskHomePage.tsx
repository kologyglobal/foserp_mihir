import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, Factory, RefreshCw } from 'lucide-react'
import { MobilePageTitle } from '@/components/mobile'
import { isApiMode } from '@/config/apiConfig'
import { getShopfloorKioskSummary } from '@/services/api/manufacturingApi'
import { getQcKioskSummary } from '@/services/api/qualityApi'
import { kioskTileClass } from './kioskCss'

/** Tablet / phone kiosk hub — Shopfloor production + QC. */
export function MobileKioskHomePage() {
  const [shopOpen, setShopOpen] = useState<number | null>(null)
  const [qcOpen, setQcOpen] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!isApiMode()) return
    setLoading(true)
    try {
      const [shop, qc] = await Promise.all([
        getShopfloorKioskSummary().catch(() => null),
        getQcKioskSummary().catch(() => null),
      ])
      setShopOpen(shop?.data.openCount ?? 0)
      setQcOpen(qc?.data.openCount ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mob-kiosk">
      <div className="flex items-start justify-between gap-2">
        <MobilePageTitle
          title="Shopfloor Kiosk"
          subtitle={isApiMode() ? 'Live production & quality' : 'Demo mode — enable API for live data'}
        />
        {isApiMode() ? (
          <button
            type="button"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[#edebe9] bg-white"
            onClick={() => void load()}
            aria-label="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="grid gap-3">
        <Link to="/m/shop-floor" className={kioskTileClass}>
          <Factory className="h-10 w-10 text-[#0078d4]" aria-hidden />
          <div>
            <p className="text-xl font-bold text-[#242424]">Shopfloor</p>
            <p className="mt-1 text-sm text-[#605e5c]">
              Start · Hold · Resume · Complete
              {shopOpen != null ? ` · ${shopOpen} open` : ''}
            </p>
          </div>
        </Link>
        <Link to="/m/qc" className={kioskTileClass}>
          <ClipboardCheck className="h-10 w-10 text-emerald-700" aria-hidden />
          <div>
            <p className="text-xl font-bold text-[#242424]">Quality / QC</p>
            <p className="mt-1 text-sm text-[#605e5c]">
              Pass · Rework · Reject
              {qcOpen != null ? ` · ${qcOpen} open` : ''}
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}
