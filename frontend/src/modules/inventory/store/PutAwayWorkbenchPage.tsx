import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Package, RefreshCw, ScanLine, Truck } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { listPutAwayQueue, type PutAwayCard } from '@/services/inventory/putAwayService'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { isApiMode } from '@/config/apiConfig'

function PutAwayCardView({
  card,
  onTransfer,
  onScan,
}: {
  card: PutAwayCard
  onTransfer: (href: string) => void
  onScan: (href: string) => void
}) {
  const isReady = card.kind === 'ready_for_putaway'
  return (
    <div className={isReady ? 'store-action-card' : 'store-action-card store-action-card--warning'}>
      <div className="store-action-card__top">
        <span className="store-action-card__severity">{isReady ? 'PUT AWAY' : 'POST STOCK'}</span>
        <span className="store-action-card__domain">{card.status}</span>
      </div>
      <div className="store-action-card__title font-mono">{card.grnNumber}</div>
      <div className="store-action-card__detail">
        {formatDate(card.documentDate)} · {card.vendorName}
      </div>
      <div className="store-action-card__detail">
        WH {card.warehouseName}
        {card.receivingLocation ? ` · Receiving: ${card.receivingLocation}` : ''}
      </div>
      {card.lines.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-erp-border pt-2 text-[12px]">
          {card.lines.slice(0, 6).map((l) => (
            <li key={l.lineId} className="flex flex-wrap justify-between gap-2">
              <span>
                <span className="font-mono text-[11px] text-erp-muted">{l.itemCode}</span> {l.itemName}
                {l.bin ? <span className="text-erp-muted"> · bin {l.bin}</span> : null}
                {l.batchNumber ? <span className="text-erp-muted"> · lot {l.batchNumber}</span> : null}
                {l.serialNumber ? <span className="text-erp-muted"> · sn {l.serialNumber}</span> : null}
              </span>
              <span className="font-mono">{formatNumber(l.qty)}</span>
            </li>
          ))}
          {card.lines.length > 6 ? (
            <li className="text-erp-muted">+{card.lines.length - 6} more lines</li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-erp-muted">No quantity lines yet — open GRN to complete receive.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={card.openGrnHref} className="erp-btn erp-btn-secondary h-10 px-3 text-[13px] inline-flex items-center">
          Open GRN
        </Link>
        {isReady ? (
          <>
            <button
              type="button"
              className="erp-btn erp-btn-primary h-10 px-3 text-[13px] inline-flex items-center gap-1"
              onClick={() => onTransfer(card.putAwayTransferHref)}
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              Transfer to storage
            </button>
            <button
              type="button"
              className="erp-btn erp-btn-secondary h-10 px-3 text-[13px] inline-flex items-center gap-1"
              onClick={() => onScan(card.scanHref)}
            >
              <ScanLine className="h-4 w-4" aria-hidden />
              Scan put-away
            </button>
          </>
        ) : (
          <Link to={card.openGrnHref} className="erp-btn erp-btn-primary h-10 px-3 text-[13px] inline-flex items-center gap-1">
            <Truck className="h-4 w-4" aria-hidden />
            Complete GRN / post stock
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * Store put-away workbench.
 * Step 1: GRN inventory post (ledger truth).
 * Step 2: Transfer / scan into storage bin via inventory transfer engine.
 */
export function PutAwayWorkbenchPage() {
  const navigate = useNavigate()
  const [awaiting, setAwaiting] = useState<PutAwayCard[]>([])
  const [ready, setReady] = useState<PutAwayCard[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)

  const load = useCallback(async () => {
    void token
    setLoading(true)
    try {
      const q = await listPutAwayQueue()
      setAwaiting(q.awaitingStockPost)
      setReady(q.readyForPutAway)
    } catch {
      setAwaiting([])
      setReady([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title="Put Away"
      description="Complete GRN stock post first, then move to storage with the transfer/scan engine. No second put-away ledger."
      backLink={{ to: '/inventory', label: 'Store Dashboard' }}
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Put Away' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/store/put-away"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[12px] text-erp-muted">
          Flow: <strong>GRN post</strong> (inventory ledger) → <strong>Transfer / scan</strong> into storage bin.
          Serials and bins stay on the GRN/transfer documents.
          {!isApiMode() ? ' Demo GRNs appear when purchase demo data is loaded.' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="erp-btn erp-btn--ghost erp-btn--sm inline-flex items-center gap-1.5"
            onClick={() => setToken((n) => n + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </button>
          <Link to="/inventory/movements/transfers?create=1" className="erp-btn erp-btn--secondary erp-btn--sm">
            New transfer
          </Link>
          <Link to="/inventory/scan/transfer" className="erp-btn erp-btn--secondary erp-btn--sm inline-flex items-center gap-1.5">
            <ScanLine className="h-3.5 w-3.5" aria-hidden />
            Scan transfer
          </Link>
        </div>
      </div>

      {loading ? <LoadingState variant="dashboard" /> : null}

      {!loading ? (
        <div className="store-ops-page max-w-none">
          <section className="store-section">
            <div className="store-section__head">
              <h2 className="store-section__title">1 · Awaiting stock post</h2>
              <span className="text-[12px] text-erp-muted">{awaiting.length}</span>
            </div>
            {awaiting.length === 0 ? (
              <EmptyState icon={Package} title="None waiting" description="No GRNs need inventory posting right now." />
            ) : (
              <ul className="store-card-list">
                {awaiting.map((c) => (
                  <li key={c.grnId}>
                    <PutAwayCardView
                      card={c}
                      onTransfer={(h) => navigate(h)}
                      onScan={(h) => navigate(h)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="store-section">
            <div className="store-section__head">
              <h2 className="store-section__title">2 · Ready for put-away</h2>
              <span className="text-[12px] text-erp-muted">{ready.length}</span>
            </div>
            {ready.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="No posted GRNs in queue"
                description="After a GRN is inventory-posted, use Transfer to storage or Scan put-away here."
              />
            ) : (
              <ul className="store-card-list">
                {ready.map((c) => (
                  <li key={c.grnId}>
                    <PutAwayCardView
                      card={c}
                      onTransfer={(h) => navigate(h)}
                      onScan={(h) => navigate(h)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
