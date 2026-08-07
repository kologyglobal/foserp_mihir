import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Ban,
  Briefcase,
  Check,
  Clock,
  FileText,
  Landmark,
  Package,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { TabStrip, type TabItem } from '@/components/ui/TabStrip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import {
  addExitAssetLine,
  approveExit,
  cancelExit,
  clearExitClearanceLine,
  getExit,
  getFnfSettlement,
  listExitAssetLines,
  listExitClearance,
  seedExitClearance,
  setExitAssetLineStatus,
  submitExit,
  waiveExitClearanceLine,
  type HrAssetLineStatus,
  type HrEmployeeExit,
  type HrExitAssetLine,
  type HrExitClearanceLine,
  type HrFullFinalSettlement,
  type HrNoticeSettlementMode,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { EXIT_TYPE_LABELS, money } from './exitUi'
import {
  HrChecklist,
  HrEmptyState,
  HrStatusChip,
  HrStepIndicator,
  type HrChecklistItem,
  type HrStep,
} from '@/modules/hrms/components'
import '../hrms-ui.css'

type DetailTab = 'overview' | 'notice' | 'clearance' | 'assets' | 'settlement' | 'timeline'

const ASSET_STATUS_OPTIONS: HrAssetLineStatus[] = ['RETURNED', 'NOT_RETURNED', 'DAMAGED', 'WAIVED']

/** Guided progress driven purely by the exit's real lifecycle status — no invented states. */
function exitLifecycleSteps(exit: HrEmployeeExit): HrStep[] {
  if (exit.status === 'CANCELLED') {
    return [{ id: 'cancelled', label: 'Cancelled', done: true, note: exit.rejectedReason ?? undefined }]
  }
  const ORDER = ['DRAFT', 'SUBMITTED', 'APPROVED', 'CLEARANCE_PENDING', 'READY_FOR_SETTLEMENT', 'SETTLED', 'CLOSED']
  const idx = ORDER.indexOf(exit.status)
  return [
    { id: 'approved', label: 'Approved', done: idx >= 2, current: idx === 1 },
    { id: 'clearance', label: 'Clearance', done: idx >= 4, current: idx === 2 || idx === 3 },
    { id: 'settlement', label: 'Settlement', done: idx >= 5, current: idx === 4 },
    { id: 'payment', label: 'Payment', done: idx >= 6, current: idx === 5 },
    { id: 'closed', label: 'Closed', done: idx >= 6, current: false },
  ]
}

export function ExitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const perms = useHrmsPermissions()

  const [tab, setTab] = useState<DetailTab>('overview')
  const [exit, setExit] = useState<HrEmployeeExit | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [clearanceLines, setClearanceLines] = useState<HrExitClearanceLine[]>([])
  const [clearanceLoading, setClearanceLoading] = useState(false)

  const [assetLines, setAssetLines] = useState<HrExitAssetLine[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)

  const [settlement, setSettlement] = useState<HrFullFinalSettlement | null>(null)
  const [settlementLoading, setSettlementLoading] = useState(false)

  const [showApprove, setShowApprove] = useState(false)
  const [approvedLwd, setApprovedLwd] = useState('')
  const [approveNoticeMode, setApproveNoticeMode] = useState<HrNoticeSettlementMode>('recover')
  const [approveRemarks, setApproveRemarks] = useState('')

  const [showAddAsset, setShowAddAsset] = useState(false)
  const [assetDescription, setAssetDescription] = useState('')
  const [assetCategory, setAssetCategory] = useState('')
  const [assetRecoveryAmount, setAssetRecoveryAmount] = useState('')
  const [assetRemarks, setAssetRemarks] = useState('')

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getExit(id)
      setExit(res.data ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load exit')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadClearance = async () => {
    if (!id) return
    setClearanceLoading(true)
    try {
      const res = await listExitClearance(id)
      setClearanceLines(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load clearance')
    } finally {
      setClearanceLoading(false)
    }
  }

  const loadAssets = async () => {
    if (!id) return
    setAssetsLoading(true)
    try {
      const res = await listExitAssetLines(id)
      setAssetLines(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load asset lines')
    } finally {
      setAssetsLoading(false)
    }
  }

  const loadSettlement = async () => {
    if (!id) return
    setSettlementLoading(true)
    try {
      const res = await getFnfSettlement(id)
      setSettlement(res.data ?? null)
    } catch {
      setSettlement(null)
    } finally {
      setSettlementLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'clearance') void loadClearance()
    if (tab === 'assets') void loadAssets()
    if (tab === 'settlement') void loadSettlement()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id])

  const doSubmit = async () => {
    if (!id || !perms.canCreateExit) return
    setBusy(true)
    try {
      await submitExit(id)
      notify.success('Submitted for approval')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  const openApprove = () => {
    if (!exit) return
    setApprovedLwd(exit.requestedLastWorkingDate)
    setApproveNoticeMode(exit.noticeSettlementMode)
    setApproveRemarks('')
    setShowApprove(true)
  }

  const doApprove = async () => {
    if (!id || !perms.canApproveExit) return
    setBusy(true)
    try {
      await approveExit(id, {
        approvedLastWorkingDate: approvedLwd || undefined,
        noticeSettlementMode: approveNoticeMode,
        remarks: approveRemarks.trim() || undefined,
      })
      notify.success('Exit approved — clearance checklist seeded')
      setShowApprove(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  const doCancel = async () => {
    if (!id) return
    const reason = await appPromptNote({
      title: 'Cancel exit',
      description: 'This exit request will no longer be actionable.',
      note: { required: false, label: 'Reason' },
    })
    if (reason == null) return
    setBusy(true)
    try {
      await cancelExit(id, reason.trim() || undefined)
      notify.success('Exit cancelled')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  const doSeedClearance = async () => {
    if (!id || !perms.canManageExitClearance) return
    setBusy(true)
    try {
      const res = await seedExitClearance(id)
      setClearanceLines(res.data ?? [])
      notify.success('Clearance checklist seeded')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Seed failed')
    } finally {
      setBusy(false)
    }
  }

  const doClearLine = async (lineId: string) => {
    if (!id || !perms.canManageExitClearance) return
    setBusy(true)
    try {
      const res = await clearExitClearanceLine(id, lineId)
      notify.success('Clearance line cleared')
      await loadClearance()
      if (res.data?.exitStatus && res.data.exitStatus !== exit?.status) await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Clear failed')
    } finally {
      setBusy(false)
    }
  }

  const doWaiveLine = async (lineId: string) => {
    if (!id || !perms.canManageExitClearance) return
    const reason = await appPromptNote({
      title: 'Waive clearance line',
      description: 'Provide a waiver reason.',
      note: { required: true, label: 'Reason' },
    })
    if (reason == null) return
    setBusy(true)
    try {
      const res = await waiveExitClearanceLine(id, lineId, reason.trim())
      notify.success('Clearance line waived')
      await loadClearance()
      if (res.data?.exitStatus && res.data.exitStatus !== exit?.status) await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Waive failed')
    } finally {
      setBusy(false)
    }
  }

  const openAddAsset = () => {
    setAssetDescription('')
    setAssetCategory('')
    setAssetRecoveryAmount('')
    setAssetRemarks('')
    setShowAddAsset(true)
  }

  const doAddAsset = async () => {
    if (!id || !perms.canManageExitClearance) return
    if (!assetDescription.trim()) {
      notify.error('Enter an asset description')
      return
    }
    setBusy(true)
    try {
      await addExitAssetLine(id, {
        description: assetDescription.trim(),
        assetCategory: assetCategory.trim() || undefined,
        recoveryAmount: assetRecoveryAmount ? Number(assetRecoveryAmount) : undefined,
        remarks: assetRemarks.trim() || undefined,
      })
      notify.success('Asset line added')
      setShowAddAsset(false)
      await loadAssets()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Add asset failed')
    } finally {
      setBusy(false)
    }
  }

  const doSetAssetStatus = async (assetLineId: string, status: HrAssetLineStatus, currentRecovery: number) => {
    if (!id || !perms.canManageExitClearance) return
    let recoveryAmount: number | undefined
    if (status === 'NOT_RETURNED' || status === 'DAMAGED') {
      const raw = await appPromptNote({
        title: status === 'DAMAGED' ? 'Mark asset damaged' : 'Mark asset not returned',
        description: 'Confirm the recovery amount to charge the employee.',
        note: { required: false, label: 'Recovery amount', defaultValue: String(currentRecovery || 0) },
      })
      if (raw == null) return
      const parsed = Number(raw)
      recoveryAmount = Number.isFinite(parsed) && parsed >= 0 ? parsed : currentRecovery
    } else {
      const ok = await appConfirm({
        title: status === 'RETURNED' ? 'Mark asset returned' : 'Waive asset recovery',
        description: 'This will update the asset line status.',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const res = await setExitAssetLineStatus(id, assetLineId, { status, recoveryAmount })
      notify.success('Asset status updated')
      await loadAssets()
      if (res.data?.exitStatus && res.data.exitStatus !== exit?.status) await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const pendingClearanceCount = useMemo(() => clearanceLines.filter((l) => l.status === 'PENDING').length, [clearanceLines])
  const pendingAssetCount = useMemo(() => assetLines.filter((l) => l.status === 'PENDING').length, [assetLines])

  if (loading || !exit) {
    return (
      <OperationalPageShell title="Exit" breadcrumbs={[{ label: 'HRMS' }, { label: 'Exits' }]}>
        <LoadingState />
      </OperationalPageShell>
    )
  }

  const canAddAsset = perms.canManageExitClearance && ['DRAFT', 'SUBMITTED', 'APPROVED', 'CLEARANCE_PENDING'].includes(exit.status)

  const tabs: TabItem<DetailTab>[] = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'notice', label: 'Notice', icon: Clock },
    { id: 'clearance', label: 'Clearance', icon: ShieldCheck },
    { id: 'assets', label: 'Assets', icon: Package },
    { id: 'settlement', label: 'Settlement', icon: Landmark },
    { id: 'timeline', label: 'Timeline', icon: Briefcase },
  ]

  return (
    <OperationalPageShell
      title={`${exit.code} — ${exit.employee?.displayName ?? exit.employeeId}`}
      description={`${EXIT_TYPE_LABELS[exit.exitType] ?? exit.exitType} · ${exit.employee?.employeeCode ?? ''}`}
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Exits', to: '/hrms/exits' },
        { label: exit.code },
      ]}
    >
      <ErpCommandBar
        primaryAction={
          exit.status === 'DRAFT' && perms.canCreateExit
            ? { id: 'submit', label: 'Submit', icon: Send, onClick: () => void doSubmit(), disabled: busy }
            : exit.status === 'SUBMITTED' && perms.canApproveExit
              ? { id: 'approve', label: 'Approve', icon: Check, onClick: openApprove, disabled: busy }
              : undefined
        }
        secondaryActions={[
          ...(canAddAsset ? [{ id: 'add-asset', label: 'Add Asset', icon: Package, onClick: openAddAsset }] : []),
          ...(exit.status === 'CLEARANCE_PENDING' && perms.canManageExitClearance
            ? [{ id: 'seed', label: 'Seed Clearance', icon: ShieldCheck, onClick: () => void doSeedClearance(), disabled: busy }]
            : []),
          ...(['CLEARANCE_PENDING', 'READY_FOR_SETTLEMENT', 'SETTLED', 'CLOSED'].includes(exit.status) && perms.canViewFnf
            ? [{ id: 'view-fnf', label: 'View Settlement', icon: Landmark, onClick: () => navigate(`/hrms/fnf/${exit.id}`) }]
            : []),
          { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
        ]}
        destructiveActions={
          !['SETTLED', 'CLOSED', 'CANCELLED'].includes(exit.status) && (perms.canCreateExit || perms.canApproveExit)
            ? [{ id: 'cancel', label: 'Cancel', icon: Ban, onClick: () => void doCancel() }]
            : []
        }
      />

      <div className="mb-3 flex items-center justify-between">
        <HrStatusChip status={exit.status} domain="exit" />
        <span className="text-xs text-erp-muted">
          {EXIT_TYPE_LABELS[exit.exitType] ?? exit.exitType} · LWD {exit.approvedLastWorkingDate ?? exit.requestedLastWorkingDate} · Notice{' '}
          {exit.noticeServedDays != null ? `${exit.noticeServedDays}/${exit.noticePeriodDays}d` : `${exit.noticePeriodDays}d`}
        </span>
      </div>

      <HrStepIndicator steps={exitLifecycleSteps(exit)} className="mb-4" />

      <TabStrip tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-erp-border bg-white p-4 text-sm">
            <h3 className="mb-3 font-semibold">Employee &amp; Exit</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-erp-muted">Employee</div>
                <div>{exit.employee?.displayName}</div>
                <div className="text-xs text-erp-muted">{exit.employee?.employeeCode}</div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Exit type</div>
                <div>{EXIT_TYPE_LABELS[exit.exitType] ?? exit.exitType}</div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Legal entity</div>
                <div>{exit.legalEntity?.displayName ?? '-'}</div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Branch</div>
                <div>{exit.branch?.name ?? '-'}</div>
              </div>
              {exit.reason ? (
                <div className="col-span-2">
                  <div className="text-xs text-erp-muted">Reason</div>
                  <div>{exit.reason}</div>
                </div>
              ) : null}
              {exit.remarks ? (
                <div className="col-span-2">
                  <div className="text-xs text-erp-muted">Remarks</div>
                  <div>{exit.remarks}</div>
                </div>
              ) : null}
              {exit.rejectedReason ? (
                <div className="col-span-2">
                  <div className="text-xs text-erp-muted">Cancellation reason</div>
                  <div>{exit.rejectedReason}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded border border-erp-border bg-white p-4 text-sm">
            <h3 className="mb-3 font-semibold">Progress</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-erp-muted">Clearance</div>
                <div>
                  {['CLEARANCE_PENDING', 'READY_FOR_SETTLEMENT', 'SETTLED', 'CLOSED'].includes(exit.status)
                    ? exit.status === 'CLEARANCE_PENDING'
                      ? 'In progress'
                      : 'Cleared'
                    : 'Not started'}
                </div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Approved by</div>
                <div>{exit.approvedAt ? new Date(exit.approvedAt).toLocaleString() : '-'}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'notice' ? (
        <div className="rounded border border-erp-border bg-white p-4 text-sm">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <div className="text-xs text-erp-muted">Notice period (days)</div>
              <div className="text-lg font-semibold">{exit.noticePeriodDays}</div>
            </div>
            <div>
              <div className="text-xs text-erp-muted">Served (days)</div>
              <div className="text-lg font-semibold">{exit.noticeServedDays ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-erp-muted">Shortfall (days)</div>
              <div className="text-lg font-semibold">{exit.noticeShortfallDays ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-erp-muted">Excess (days)</div>
              <div className="text-lg font-semibold">{exit.noticeExcessDays ?? '-'}</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-erp-muted">Settlement mode</div>
            <div className="capitalize">
              {exit.noticeSettlementMode === 'recover'
                ? 'Recover shortfall'
                : exit.noticeSettlementMode === 'pay'
                  ? 'Pay in lieu'
                  : 'None'}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'clearance' ? (
        <div className="space-y-3">
          {clearanceLoading ? (
            <LoadingState />
          ) : clearanceLines.length === 0 ? (
            <HrEmptyState
              icon={ShieldCheck}
              title="No clearance checklist"
              description={
                exit.status === 'CLEARANCE_PENDING'
                  ? 'Seed the clearance checklist to begin department sign-off.'
                  : 'The clearance checklist is seeded automatically when the exit is approved.'
              }
              primaryAction={
                exit.status === 'CLEARANCE_PENDING' && perms.canManageExitClearance
                  ? { label: 'Seed Clearance', onClick: () => void doSeedClearance() }
                  : undefined
              }
            />
          ) : (
            <div className="rounded border border-erp-border bg-white p-4">
              <HrChecklist
                items={clearanceLines.map<HrChecklistItem>((l) => ({
                  id: l.id,
                  title: l.name,
                  subtitle: l.remarks || undefined,
                  state: l.status === 'CLEARED' ? 'done' : l.status === 'WAIVED' ? 'waived' : 'pending',
                  actions:
                    l.status === 'PENDING' && perms.canManageExitClearance ? (
                      <div className="flex gap-1">
                        <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={() => void doClearLine(l.id)}>
                          Clear
                        </button>
                        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void doWaiveLine(l.id)}>
                          Waive
                        </button>
                      </div>
                    ) : undefined,
                }))}
              />
              {pendingClearanceCount > 0 ? (
                <div className="mt-3 border-t border-erp-border pt-2 text-xs text-erp-muted">
                  {pendingClearanceCount} line(s) pending
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'assets' ? (
        <div className="space-y-3">
          {assetsLoading ? (
            <LoadingState />
          ) : assetLines.length === 0 ? (
            <HrEmptyState
              icon={Package}
              title="No asset lines"
              description="Track company assets issued to this employee that must be returned or recovered."
              primaryAction={canAddAsset ? { label: 'Add Asset', onClick: openAddAsset } : undefined}
            />
          ) : (
            <div className="overflow-x-auto rounded border border-erp-border bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-erp-surface text-left text-xs uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Recovery</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Remarks</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {assetLines.map((a) => (
                    <tr key={a.id} className="border-t border-erp-border">
                      <td className="px-3 py-2 font-medium">{a.description}</td>
                      <td className="px-3 py-2">{a.assetCategory ?? '-'}</td>
                      <td className="px-3 py-2 tabular-nums">{money(a.recoveryAmount)}</td>
                      <td className="px-3 py-2">
                        <HrStatusChip status={a.status} domain="assetLine" />
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-xs text-erp-muted">{a.remarks || '-'}</td>
                      <td className="px-3 py-2 text-right">
                        {a.status === 'PENDING' && perms.canManageExitClearance ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            {ASSET_STATUS_OPTIONS.map((s) => (
                              <button
                                key={s}
                                type="button"
                                className="btn btn--ghost btn--sm"
                                disabled={busy}
                                onClick={() => void doSetAssetStatus(a.id, s, a.recoveryAmount)}
                              >
                                {s === 'NOT_RETURNED' ? 'Not Returned' : s.charAt(0) + s.slice(1).toLowerCase()}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pendingAssetCount > 0 ? (
                <div className="border-t border-erp-border px-3 py-2 text-xs text-erp-muted">{pendingAssetCount} line(s) pending</div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'settlement' ? (
        <div className="space-y-3">
          {settlementLoading ? (
            <LoadingState />
          ) : !settlement ? (
            <HrEmptyState
              icon={Landmark}
              title="No settlement yet"
              description={
                exit.approvedLastWorkingDate
                  ? 'Calculate the full & final settlement from the Full & Final Settlement page.'
                  : 'The exit must be approved (last working date locked) before a settlement can be calculated.'
              }
              primaryAction={
                exit.approvedLastWorkingDate && perms.canViewFnf
                  ? { label: 'Go to Full & Final Settlement', onClick: () => navigate(`/hrms/fnf/${exit.id}`) }
                  : undefined
              }
            />
          ) : (
            <div className="rounded border border-erp-border bg-white p-4 text-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-erp-muted">Settlement</div>
                  <div className="text-lg font-semibold">{settlement.code}</div>
                </div>
                <HrStatusChip status={settlement.status} domain="fnf" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-erp-muted">Earnings</div>
                  <div className="font-medium">{money(settlement.earningsTotal)}</div>
                </div>
                <div>
                  <div className="text-xs text-erp-muted">Deductions</div>
                  <div className="font-medium">{money(settlement.deductionsTotal)}</div>
                </div>
                <div>
                  <div className="text-xs text-erp-muted">Net</div>
                  <div className={`font-semibold ${settlement.netSettlement < 0 ? 'text-erp-danger-fg' : ''}`}>
                    {money(settlement.netSettlement)}
                  </div>
                </div>
              </div>
              {perms.canViewFnf ? (
                <button type="button" className="btn btn--secondary mt-3" onClick={() => navigate(`/hrms/fnf/${exit.id}`)}>
                  View Full Details
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'timeline' ? (
        <div className="rounded border border-erp-border bg-white p-4 text-sm">
          <ul className="space-y-3 border-l border-erp-border pl-4">
            <li>
              <div className="font-medium">Created</div>
              <div className="text-xs text-erp-muted">{new Date(exit.createdAt).toLocaleString()}</div>
            </li>
            {exit.approvedAt ? (
              <li>
                <div className="font-medium">Approved</div>
                <div className="text-xs text-erp-muted">{new Date(exit.approvedAt).toLocaleString()}</div>
              </li>
            ) : null}
            {exit.status === 'CANCELLED' ? (
              <li>
                <div className="font-medium">Cancelled</div>
                <div className="text-xs text-erp-muted">{new Date(exit.updatedAt).toLocaleString()}</div>
                {exit.rejectedReason ? <div className="text-xs">{exit.rejectedReason}</div> : null}
              </li>
            ) : null}
            {['SETTLED', 'CLOSED'].includes(exit.status) ? (
              <li>
                <div className="font-medium">Settled &amp; Closed</div>
                <div className="text-xs text-erp-muted">{new Date(exit.updatedAt).toLocaleString()}</div>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {showApprove ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setShowApprove(false)}>
          <div className="flex h-full w-full max-w-md flex-col border-l border-erp-border bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-erp-border px-4 py-3">
              <div className="font-medium">Approve Exit</div>
              <div className="text-sm text-erp-muted">{exit.employee?.displayName}</div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <FormField label="Approved last working date" hint={`Requested: ${exit.requestedLastWorkingDate}`}>
                <Input type="date" value={approvedLwd} onChange={(e) => setApprovedLwd(e.target.value)} />
              </FormField>
              <FormField label="Notice settlement mode">
                <Select value={approveNoticeMode} onChange={(e) => setApproveNoticeMode(e.target.value as HrNoticeSettlementMode)}>
                  <option value="recover">Recover shortfall</option>
                  <option value="pay">Pay in lieu</option>
                  <option value="none">None</option>
                </Select>
              </FormField>
              <FormField label="Remarks">
                <Textarea value={approveRemarks} onChange={(e) => setApproveRemarks(e.target.value)} rows={3} />
              </FormField>
            </div>
            <div className="flex gap-2 border-t border-erp-border p-4">
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void doApprove()}>
                Approve
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowApprove(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAddAsset ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setShowAddAsset(false)}>
          <div className="flex h-full w-full max-w-md flex-col border-l border-erp-border bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-erp-border px-4 py-3">
              <div className="font-medium">Add Asset Line</div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <FormField label="Description" required>
                <Input value={assetDescription} onChange={(e) => setAssetDescription(e.target.value)} required />
              </FormField>
              <FormField label="Category">
                <Input value={assetCategory} onChange={(e) => setAssetCategory(e.target.value)} />
              </FormField>
              <FormField label="Recovery amount" hint="Charged only if the asset is not returned or damaged">
                <Input type="number" min={0} step="0.01" value={assetRecoveryAmount} onChange={(e) => setAssetRecoveryAmount(e.target.value)} />
              </FormField>
              <FormField label="Remarks">
                <Textarea value={assetRemarks} onChange={(e) => setAssetRemarks(e.target.value)} rows={2} />
              </FormField>
            </div>
            <div className="flex gap-2 border-t border-erp-border p-4">
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void doAddAsset()}>
                Add
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowAddAsset(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
