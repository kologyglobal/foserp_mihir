import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardCheck, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { FixedAssetsDemoBanner, VerificationStatusBadge } from '@/components/accounting/fixedAssets'
import { getVerificationById } from '@/services/accounting/fixedAssetsService'
import type { PhysicalVerification } from '@/types/fixedAssets'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import { FIXED_ASSETS_BREADCRUMB } from './fixedAssetsUi'

const LINE_TONE: Record<string, string> = {
  Verified: 'text-emerald-700',
  Pending: 'text-erp-muted',
  'Not Found': 'text-rose-700 font-semibold',
  Damaged: 'text-amber-700 font-semibold',
  Excess: 'text-sky-700 font-semibold',
}

export function PhysicalVerificationDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [verification, setVerification] = useState<PhysicalVerification | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const found = await getVerificationById(id)
      if (!found) {
        setError('Verification cycle not found')
      }
      setVerification(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load verification')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const breadcrumbs = [...FIXED_ASSETS_BREADCRUMB, { label: 'Physical Verification', to: '/accounting/fixed-assets/verification' }, { label: verification?.verificationNumber ?? 'Cycle' }]

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Physical Verification" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!verification || error) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState
          icon={ClipboardCheck}
          title="Verification cycle not found"
          description={error ?? undefined}
          action={<Link to="/accounting/fixed-assets/verification" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]">Back to Verification</Link>}
        />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={`${verification.verificationNumber} — ${verification.plant}`}
      description="Physical verification cycle detail with per-asset line results — demo data only."
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/fixed-assets/verification/${verification.id}`}
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'back', label: 'Back', icon: ArrowLeft, onClick: () => navigate('/accounting/fixed-assets/verification') },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="mb-4">
        <FixedAssetsDemoBanner variant="partial" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-erp-border bg-white px-4 py-3">
        <VerificationStatusBadge status={verification.status} />
        <span className="text-[12px] text-erp-muted">
          {verification.plant}{verification.department ? ` · ${verification.department}` : ''} · {formatDate(verification.verificationDate)}
        </span>
        <span className="ml-auto text-[12px] text-erp-muted">
          Conducted by <span className="font-medium text-erp-text">{verification.conductedBy}</span>
          {verification.completedAt ? ` · completed ${formatDateTime(verification.completedAt)}` : ''}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
        <div className="rounded-md bg-erp-surface px-3 py-2">
          <p className="text-erp-muted">Total assets</p>
          <p className="text-[15px] font-semibold tabular-nums">{verification.totalAssets}</p>
        </div>
        <div className="rounded-md bg-emerald-50 px-3 py-2">
          <p className="text-erp-muted">Verified</p>
          <p className="text-[15px] font-semibold tabular-nums text-emerald-800">{verification.verifiedCount}</p>
        </div>
        <div className="rounded-md bg-rose-50 px-3 py-2">
          <p className="text-erp-muted">Not found</p>
          <p className="text-[15px] font-semibold tabular-nums text-rose-800">{verification.notFoundCount}</p>
        </div>
        <div className="rounded-md bg-amber-50 px-3 py-2">
          <p className="text-erp-muted">Damaged</p>
          <p className="text-[15px] font-semibold tabular-nums text-amber-800">{verification.damagedCount}</p>
        </div>
      </div>

      <div className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Verification lines</h3>
        {verification.lines.length === 0 ? (
          <p className="text-[13px] text-erp-muted">No line items recorded for this verification cycle.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-erp-border">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead className="bg-erp-surface text-left text-[11px] uppercase text-erp-muted">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Expected Location</th>
                  <th className="px-3 py-2">Found Location</th>
                  <th className="px-3 py-2">Condition</th>
                  <th className="px-3 py-2">Verified By</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {verification.lines.map((l) => (
                  <tr key={l.id} className="border-t border-erp-border">
                    <td className="px-3 py-2">
                      <Link to={`/accounting/fixed-assets/register/${l.assetId}`} className="font-medium text-erp-primary hover:underline">
                        {l.assetNumber}
                      </Link>
                      <p className="text-[11px] text-erp-muted">{l.assetName}</p>
                    </td>
                    <td className="px-3 py-2">{l.expectedLocation}</td>
                    <td className="px-3 py-2">{l.foundLocation ?? '—'}</td>
                    <td className="px-3 py-2">{l.condition ?? '—'}</td>
                    <td className="px-3 py-2">{l.verifiedBy ?? '—'}</td>
                    <td className={cn('px-3 py-2', LINE_TONE[l.status])}>{l.status}</td>
                    <td className="px-3 py-2 text-erp-muted">{l.remarks ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </OperationalPageShell>
  )
}
