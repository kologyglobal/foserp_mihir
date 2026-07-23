import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { PeriodCloseShell } from '@/components/accounting/period-close'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getBankCloseSummary,
  getFixedAssetCloseSummary,
  getGstTdsCloseSummary,
  getInventoryCloseSummary,
  getManufacturingCloseSummary,
  loadPeriodCloseFilter,
} from '@/services/accounting/periodCloseService'
import type {
  BankCloseSummary,
  FixedAssetCloseSummary,
  GstTdsCloseSummary,
  InventoryCloseSummary,
  ManufacturingCloseSummary,
  PeriodFilterState,
} from '@/types/periodClose'
import { usePeriodClosePermissions } from '@/utils/permissions/periodClose'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'

function Scorecard({
  items,
  links,
}: {
  items: { label: string; value: string }[]
  links: { label: string; to: string }[]
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <div key={i.label} className="rounded border border-erp-border p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-erp-muted">{i.label}</div>
            <div className="mt-1 text-[16px] font-semibold tabular-nums text-erp-text">{i.value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded border border-erp-border px-2.5 py-1.5 text-[12px] font-semibold text-erp-primary hover:bg-erp-surface"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function usePeriodFilter() {
  return useState<PeriodFilterState>(() => loadPeriodCloseFilter())
}

export function InventoryClosePage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = usePeriodFilter()
  const [data, setData] = useState<InventoryCloseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view period close.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setData(await getInventoryCloseSummary())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PeriodCloseShell
      title="Inventory Close"
      description="Inventory GL event readiness for the close period (live when API mode is on)."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {data ? (
        <Scorecard
          items={[
            { label: 'Inventory Value', value: formatCurrency(data.inventoryValue) },
            { label: 'Negative-stock Items', value: String(data.negativeStockItems) },
            { label: 'Unposted Inventory GL Events', value: String(data.unpostedMovements) },
            { label: 'Pending Transfers', value: String(data.pendingTransfers) },
            { label: 'Pending Adjustment Events', value: String(data.pendingAdjustments) },
            { label: 'Item Ledger vs GL Diff', value: formatCurrency(data.itemLedgerVsGlDiff) },
            { label: 'Cost Adjustment Status', value: data.costAdjustmentStatus },
          ]}
          links={[
            { label: 'Inventory Accounting', to: '/inventory/accounting' },
            { label: 'Open Inventory', to: '/inventory' },
            { label: 'Subledger Reconciliation', to: '/accounting/period-close/subledger-reconciliation' },
          ]}
        />
      ) : null}
    </PeriodCloseShell>
  )
}

export function ManufacturingClosePage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = usePeriodFilter()
  const [data, setData] = useState<ManufacturingCloseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view period close.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setData(await getManufacturingCloseSummary())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PeriodCloseShell
      title="Manufacturing Close"
      description="Production WIP, unposted cost events and close-ready work orders (live when API mode is on)."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {data ? (
        <Scorecard
          items={[
            { label: 'Open / Attention WOs', value: String(data.openProductionOrders) },
            { label: 'Close-Ready Work Orders', value: String(data.completedUnclosedOrders) },
            { label: 'WIP Value', value: formatCurrency(data.wipValue) },
            { label: 'Unposted Mfg Events', value: String(data.unpostedConsumption) },
            { label: 'Provisional Cost Snapshots', value: String(data.missingLabourBooking) },
            { label: 'Failed Mfg Events', value: String(data.missingMachineBooking) },
            { label: 'Unallocated Overhead', value: formatCurrency(data.unallocatedOverhead) },
            { label: 'Reconciliation Difference', value: formatCurrency(data.productionVariance) },
            { label: 'Scrap Variance', value: formatCurrency(data.scrapVariance) },
          ]}
          links={[
            { label: 'Manufacturing Accounting', to: '/accounting/manufacturing' },
            { label: 'Work Orders', to: '/manufacturing/work-orders' },
          ]}
        />
      ) : null}
    </PeriodCloseShell>
  )
}

export function FixedAssetClosePage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = usePeriodFilter()
  const [data, setData] = useState<FixedAssetCloseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view period close.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setData(await getFixedAssetCloseSummary())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PeriodCloseShell
      title="Fixed Asset Close"
      description="Capitalization, depreciation preview and register reconciliation."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {data ? (
        <Scorecard
          items={[
            { label: 'Pending Capitalizations', value: String(data.pendingCapitalizations) },
            { label: 'Depreciation Preview', value: formatCurrency(data.depreciationPreview) },
            { label: 'Pending Disposals', value: String(data.pendingDisposals) },
            { label: 'Register vs GL Diff', value: formatCurrency(data.registerVsGlDiff) },
            {
              label: 'Last Depreciation Run',
              value: data.lastDepreciationRun ? formatDate(data.lastDepreciationRun) : '—',
            },
          ]}
          links={[{ label: 'Subledger Reconciliation', to: '/accounting/period-close/subledger-reconciliation' }]}
        />
      ) : null}
    </PeriodCloseShell>
  )
}

export function BankReconciliationStatusPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = usePeriodFilter()
  const [data, setData] = useState<BankCloseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view period close.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setData(await getBankCloseSummary())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PeriodCloseShell
      title="Bank Reconciliation Status"
      description="Bank and cash close readiness for the selected period (live open recon sessions when API mode is on)."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {data ? (
        <Scorecard
          items={[
            { label: 'Open Recon Sessions (period)', value: String(data.accountsPendingRecon) },
            { label: 'Cash Counts Pending', value: String(data.cashCountsPending) },
            { label: 'Cheques in Transit', value: String(data.chequesInTransit) },
            { label: 'Unidentified Transactions', value: String(data.unidentifiedTransactions) },
            { label: 'Bank vs GL Diff', value: formatCurrency(data.bankVsGlDiff) },
            ...(data.statusMessage
              ? [{ label: 'Readiness', value: data.statusMessage }]
              : []),
          ]}
          links={[
            { label: 'Bank Reconciliation', to: '/accounting/bank-cash/reconciliation' },
            { label: 'Bank & Cash Overview', to: '/accounting/bank-cash' },
          ]}
        />
      ) : null}
    </PeriodCloseShell>
  )
}

export function GstTdsReviewPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = usePeriodFilter()
  const [data, setData] = useState<GstTdsCloseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view period close.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setData(await getGstTdsCloseSummary())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PeriodCloseShell
      title="GST & TDS Review"
      description="Compliance readiness gates for period close (preview only — not portal connected)."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {data ? (
        <Scorecard
          items={[
            { label: 'GST Exceptions Open', value: String(data.gstExceptionsOpen) },
            { label: 'ITC Mismatches', value: String(data.itcMismatches) },
            { label: 'Reverse Charge Pending', value: String(data.reverseChargePending) },
            { label: 'TDS Payable Diff', value: formatCurrency(data.tdsPayableDiff) },
            { label: 'Challans Pending', value: String(data.challansPending) },
          ]}
          links={[
            { label: 'GST & TDS Overview', to: '/accounting/tax-compliance' },
            { label: 'ITC Reconciliation', to: '/accounting/tax-compliance/gst/itc-reconciliation' },
            { label: 'GST Exceptions', to: '/accounting/tax-compliance/gst/exceptions' },
          ]}
        />
      ) : null}
    </PeriodCloseShell>
  )
}
