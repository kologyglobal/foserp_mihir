import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  AssetStatusBadge,
  FixedAssetsDemoBanner,
  FixedAssetsEmptyState,
  FixedAssetsSummaryCards,
} from '@/components/accounting/fixedAssets'
import {
  getAssetById,
  getAssetComponents,
  getAssetLedger,
  getAuditTrail,
  getMaintenance,
} from '@/services/accounting/fixedAssetsService'
import type {
  AssetLedgerEntry,
  AssetMaintenance,
  FixedAsset,
  FixedAssetComponent,
  FixedAssetsAuditEntry,
} from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { FIXED_ASSETS_BREADCRUMB } from './fixedAssetsUi'
import { cn } from '@/utils/cn'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

type CardTab =
  | 'general'
  | 'purchase'
  | 'depreciation'
  | 'location'
  | 'insurance'
  | 'maintenance'
  | 'components'
  | 'attachments'
  | 'ledger'
  | 'audit'

const TABS: { id: CardTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'purchase', label: 'Purchase & Capitalization' },
  { id: 'depreciation', label: 'Depreciation Settings' },
  { id: 'location', label: 'Location & Custodian' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'components', label: 'Components' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'ledger', label: 'Asset Ledger' },
  { id: 'audit', label: 'Audit' },
]

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

export function FixedAssetCardPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = useFixedAssetsPermissions()
  const [asset, setAsset] = useState<FixedAsset | null>(null)
  const [ledger, setLedger] = useState<AssetLedgerEntry[]>([])
  const [maintenance, setMaintenance] = useState<AssetMaintenance[]>([])
  const [components, setComponents] = useState<FixedAssetComponent[]>([])
  const [audit, setAudit] = useState<FixedAssetsAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<CardTab>('general')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const a = await getAssetById(id)
      if (!a) {
        setAsset(null)
        setError('Asset not found')
        setLoading(false)
        return
      }
      setAsset(a)
      const [ledgerRows, maintRows, compRows, auditRows] = await Promise.all([
        getAssetLedger(id),
        getMaintenance(),
        getAssetComponents(id),
        getAuditTrail(undefined, id),
      ])
      setLedger(ledgerRows)
      setMaintenance(maintRows.filter((m) => m.assetId === id))
      setComponents(compRows)
      setAudit(auditRows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load asset')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const breadcrumbs = [
    ...FIXED_ASSETS_BREADCRUMB,
    { label: 'Asset Register', to: '/accounting/fixed-assets/register' },
    { label: asset?.assetNumber ?? 'Asset' },
  ]

  const kpis: EnterpriseKpiItem[] = asset
    ? [
        { id: 'cost', label: 'Acquisition Cost', value: formatCurrency(asset.acquisitionCost), accent: 'blue' },
        { id: 'accum', label: 'Accum. Depreciation', value: formatCurrency(asset.accumulatedDepreciation), accent: 'amber' },
        { id: 'nbv', label: 'Net Book Value', value: formatCurrency(asset.netBookValue), accent: 'green' },
        { id: 'life', label: 'Useful Life', value: `${asset.usefulLifeYears} yrs`, accent: 'slate' },
      ]
    : []

  if (!perms.canViewRegister) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Asset Card" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <FixedAssetsEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Asset Card" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={10} />
      </OperationalPageShell>
    )
  }

  if (!asset || error) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <FixedAssetsEmptyState
          title="Asset not found"
          description={error ?? undefined}
          actions={
            <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]" onClick={() => navigate('/accounting/fixed-assets/register')}>
              <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />Back to register
            </button>
          }
        />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={asset.name}
      description={`${asset.assetNumber} · ${asset.categoryName}`}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/fixed-assets/register/${id}`}
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'back', label: 'Register', icon: ArrowLeft, onClick: () => navigate('/accounting/fixed-assets/register') },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner />
        <div className="flex flex-wrap items-center gap-2">
          <AssetStatusBadge status={asset.status} />
          <span className="text-[12px] text-erp-muted">{asset.plant} · {asset.department}</span>
        </div>
        <FixedAssetsSummaryCards items={kpis} columns={4} />

        <div className="flex flex-wrap gap-1 border-b border-erp-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-t-md px-3 py-2 text-[12px] font-medium transition-colors',
                tab === t.id ? 'border border-b-0 border-erp-border bg-white text-erp-primary' : 'text-erp-muted hover:text-erp-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-md border border-erp-border bg-white p-4">
          {tab === 'general' ? (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Asset Number" value={asset.assetNumber} />
              <Field label="Name" value={asset.name} />
              <Field label="Category" value={asset.categoryName} />
              <Field label="Status" value={<AssetStatusBadge status={asset.status} />} />
              <Field label="Serial Number" value={asset.serialNumber} />
              <Field label="Manufacturer" value={asset.manufacturer} />
              <Field label="Model" value={asset.model} />
              <Field label="Company" value={asset.company} />
              <Field label="Currency" value={asset.currency} />
              <Field label="Created By" value={asset.createdBy} />
              <Field label="Created At" value={formatDateTime(asset.createdAt)} />
              <Field label="Notes" value={asset.notes} />
            </dl>
          ) : null}

          {tab === 'purchase' ? (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Acquisition Date" value={formatDate(asset.acquisitionDate)} />
              <Field label="Capitalization Date" value={asset.capitalizationDate ? formatDate(asset.capitalizationDate) : '—'} />
              <Field label="Acquisition Cost" value={formatCurrency(asset.acquisitionCost)} />
              <Field label="Vendor" value={asset.vendorName} />
              <Field label="PO Number" value={asset.poNumber} />
              <Field label="Invoice Number" value={asset.invoiceNumber} />
              <Field label="Salvage Value" value={formatCurrency(asset.salvageValue)} />
              <Field label="Residual Value" value={formatCurrency(asset.residualValue)} />
              <Field label="Warranty Expiry" value={asset.warrantyExpiry ? formatDate(asset.warrantyExpiry) : '—'} />
            </dl>
          ) : null}

          {tab === 'depreciation' ? (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Depreciation Method" value={asset.depreciationMethod} />
              <Field label="Useful Life (years)" value={asset.usefulLifeYears} />
              <Field label="Accumulated Depreciation" value={formatCurrency(asset.accumulatedDepreciation)} />
              <Field label="Net Book Value" value={formatCurrency(asset.netBookValue)} />
              <Field label="Residual Value" value={formatCurrency(asset.residualValue)} />
              <Field label="Is Component" value={asset.isComponent ? 'Yes' : 'No'} />
              {asset.parentAssetId ? (
                <Field
                  label="Parent Asset"
                  value={
                    <Link className="text-erp-primary hover:underline" to={`/accounting/fixed-assets/register/${asset.parentAssetId}`}>
                      View parent
                    </Link>
                  }
                />
              ) : null}
            </dl>
          ) : null}

          {tab === 'location' ? (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Plant" value={asset.plant} />
              <Field label="Location" value={asset.location} />
              <Field label="Department" value={asset.department} />
              <Field label="Custodian" value={asset.custodian} />
              <Field label="Last Verification" value={asset.lastVerificationDate ? formatDate(asset.lastVerificationDate) : '—'} />
              <Field label="Next Verification" value={asset.nextVerificationDate ? formatDate(asset.nextVerificationDate) : '—'} />
            </dl>
          ) : null}

          {tab === 'insurance' ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Insurance Policy" value={asset.insurancePolicy} />
              <Field label="Insurance Expiry" value={asset.insuranceExpiry ? formatDate(asset.insuranceExpiry) : '—'} />
            </dl>
          ) : null}

          {tab === 'maintenance' ? (
            maintenance.length === 0 ? (
              <FixedAssetsEmptyState title="No maintenance records" description="No maintenance linked to this asset." />
            ) : (
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Number</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Scheduled</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenance.map((m) => (
                    <tr key={m.id} className="border-t border-erp-border/80">
                      <td className="px-3 py-2 font-medium">{m.maintenanceNumber}</td>
                      <td className="px-3 py-2">{m.maintenanceType}</td>
                      <td className="px-3 py-2">{m.status}</td>
                      <td className="px-3 py-2">{formatDate(m.scheduledDate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(m.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}

          {tab === 'components' ? (
            components.length === 0 ? (
              <FixedAssetsEmptyState title="No components" description="This asset has no capitalized components." />
            ) : (
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Asset Number</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">NBV</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((c) => (
                    <tr key={c.id} className="border-t border-erp-border/80">
                      <td className="px-3 py-2">
                        <Link className="font-medium text-erp-primary hover:underline" to={`/accounting/fixed-assets/register/${c.assetId}`}>
                          {c.assetNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.acquisitionCost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.netBookValue)}</td>
                      <td className="px-3 py-2"><AssetStatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}

          {tab === 'attachments' ? (
            <FixedAssetsEmptyState title="No attachments" description="Attachments are not available in demo mode." />
          ) : null}

          {tab === 'ledger' ? (
            ledger.length === 0 ? (
              <FixedAssetsEmptyState title="No ledger entries" />
            ) : (
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Narration</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                    <th className="px-3 py-2 text-right">Running NBV</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="border-t border-erp-border/80">
                      <td className="px-3 py-2">{formatDate(e.entryDate)}</td>
                      <td className="px-3 py-2">{e.entryType}</td>
                      <td className="px-3 py-2">{e.reference}</td>
                      <td className="px-3 py-2 text-erp-muted">{e.narration}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.debitAmount ? formatCurrency(e.debitAmount) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.creditAmount ? formatCurrency(e.creditAmount) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(e.runningNBV)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}

          {tab === 'audit' ? (
            !perms.canViewAudit ? (
              <FixedAssetsEmptyState title="Access denied" description="You cannot view audit trail." />
            ) : audit.length === 0 ? (
              <FixedAssetsEmptyState title="No audit entries" />
            ) : (
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Details</th>
                    <th className="px-3 py-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} className="border-t border-erp-border/80">
                      <td className="px-3 py-2">{formatDateTime(a.performedAt)}</td>
                      <td className="px-3 py-2 font-medium">{a.action}</td>
                      <td className="px-3 py-2 text-erp-muted">{a.details}</td>
                      <td className="px-3 py-2">{a.performedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
