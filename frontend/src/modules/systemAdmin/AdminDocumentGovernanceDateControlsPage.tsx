/**
 * Admin Document Governance — Date Controls (configuration only).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
  adminBreadcrumbs,
} from '../../components/admin'
import { Badge } from '../../components/ui/Badge'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { Select } from '../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import {
  activateDateControlApi,
  createDateControlApi,
  deactivateDateControlApi,
  fetchDateControlApi,
  fetchDateControlsApi,
  fetchDocumentGovernanceProfilesApi,
  fetchDocumentGovernanceTypesApi,
  resetDateControlApi,
  updateDateControlApi,
  type DocumentDateControlRow,
  type DocumentGovernanceDocumentType,
  type DocumentGovernanceProfile,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import {
  PermissionDeniedPage,
} from '../../components/system/PermissionDeniedPage'

const DATE_MODES = [
  { value: 'CURRENT_BEHAVIOUR', label: 'Current behaviour' },
  { value: 'ALLOW', label: 'Allow' },
  { value: 'BLOCK', label: 'Block' },
  { value: 'REQUIRE_APPROVAL', label: 'Require approval' },
] as const

type Draft = {
  moduleKey: string
  documentType: string
  policyEnabled: boolean
  futureDateMode: string
  pastDateMode: string
  maxFutureDays: string
  maxBackDateDays: string
  approvalRequired: boolean
  allowEmergencyOverride: boolean
  profileId: string
  effectiveFrom: string
  effectiveTo: string
  active: boolean
}

const emptyDraft = (): Draft => ({
  moduleKey: '',
  documentType: '',
  policyEnabled: false,
  futureDateMode: 'CURRENT_BEHAVIOUR',
  pastDateMode: 'CURRENT_BEHAVIOUR',
  maxFutureDays: '',
  maxBackDateDays: '',
  approvalRequired: false,
  allowEmergencyOverride: false,
  profileId: '',
  effectiveFrom: '',
  effectiveTo: '',
  active: true,
})

function modeLabel(mode: string) {
  return DATE_MODES.find((m) => m.value === mode)?.label ?? mode
}

export function AdminDocumentGovernanceDateControlsPage() {
  const canView = canAdminPermission('platform.document_governance.view')
  const canManage = canAdminPermission('platform.document_governance.manage')
  const canActivate = canAdminPermission('platform.document_governance.activate')

  const [rows, setRows] = useState<DocumentDateControlRow[]>([])
  const [docTypes, setDocTypes] = useState<DocumentGovernanceDocumentType[]>([])
  const [profiles, setProfiles] = useState<DocumentGovernanceProfile[]>([])
  const [moduleFilter, setModuleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const modules = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of docTypes) map.set(d.moduleKey, d.moduleLabel)
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
  }, [docTypes])

  const filteredDocTypes = useMemo(
    () => (draft.moduleKey ? docTypes.filter((d) => d.moduleKey === draft.moduleKey) : docTypes),
    [docTypes, draft.moduleKey],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isApiMode()) {
        setRows([])
        setDocTypes([])
        setProfiles([])
        return
      }
      const [listRes, typesRes, profilesRes] = await Promise.all([
        fetchDateControlsApi({
          moduleKey: moduleFilter || undefined,
          active: statusFilter,
        }),
        fetchDocumentGovernanceTypesApi(),
        fetchDocumentGovernanceProfilesApi(),
      ])
      setRows(listRes.data)
      setDocTypes(typesRes.data.items)
      setProfiles(profilesRes.data)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [moduleFilter, statusFilter])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  function openCreate() {
    setEditingId(null)
    setDraft(emptyDraft())
    setDrawerOpen(true)
  }

  async function openEdit(id: string) {
    setBusyId(id)
    try {
      const res = await fetchDateControlApi(id)
      const r = res.data
      setEditingId(id)
      setDraft({
        moduleKey: r.moduleKey,
        documentType: r.documentType,
        policyEnabled: r.policyEnabled,
        futureDateMode: r.futureDateMode,
        pastDateMode: r.pastDateMode,
        maxFutureDays: r.maxFutureDays != null ? String(r.maxFutureDays) : '',
        maxBackDateDays: r.maxBackDateDays != null ? String(r.maxBackDateDays) : '',
        approvalRequired: r.approvalRequired,
        allowEmergencyOverride: r.allowEmergencyOverride,
        profileId: r.profileId ?? '',
        effectiveFrom: r.effectiveFrom ? r.effectiveFrom.slice(0, 10) : '',
        effectiveTo: r.effectiveTo ? r.effectiveTo.slice(0, 10) : '',
        active: r.active,
      })
      setDrawerOpen(true)
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusyId(null)
    }
  }

  async function saveDraft() {
    if (!canManage) return
    if (!draft.moduleKey || !draft.documentType) {
      notify.error('Module and document type are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        moduleKey: draft.moduleKey,
        documentType: draft.documentType,
        policyEnabled: draft.policyEnabled,
        futureDateMode: draft.futureDateMode,
        pastDateMode: draft.pastDateMode,
        maxFutureDays: draft.maxFutureDays === '' ? null : Number(draft.maxFutureDays),
        maxBackDateDays: draft.maxBackDateDays === '' ? null : Number(draft.maxBackDateDays),
        approvalRequired: draft.approvalRequired,
        allowEmergencyOverride: draft.allowEmergencyOverride,
        profileId: draft.profileId || null,
        effectiveFrom: draft.effectiveFrom || null,
        effectiveTo: draft.effectiveTo || null,
        active: draft.active,
      }
      if (editingId) {
        await updateDateControlApi(editingId, payload)
        notify.success('Date control updated')
      } else {
        await createDateControlApi(payload)
        notify.success('Date control created')
      }
      setDrawerOpen(false)
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function runAction(
    id: string,
    action: 'activate' | 'deactivate' | 'reset',
  ) {
    setBusyId(id)
    try {
      if (action === 'activate') {
        if (!canActivate) return
        await activateDateControlApi(id)
        notify.success('Policy activated (still inactive on documents until integrated)')
      } else if (action === 'deactivate') {
        if (!canActivate) return
        await deactivateDateControlApi(id)
        notify.success('Policy deactivated')
      } else {
        if (!canManage) return
        await resetDateControlApi(id)
        notify.success('Reset to current behaviour')
      }
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusyId(null)
    }
  }

  if (!canView) {
    return (
      <PermissionDeniedPage
        pageName="Document Governance"
        requiredPermission="platform.document_governance.view"
        reason="You need platform.document_governance.view to open Date Controls."
      />
    )
  }

  const enabledCount = rows.filter((r) => r.policyEnabled).length
  const activeCount = rows.filter((r) => r.active).length

  return (
    <AdminWorkspaceShell
      title="Date Controls"
      workspace="document-governance"
      breadcrumbs={adminBreadcrumbs(
        { label: 'Document Governance', to: '/admin/document-governance/date-controls' },
        { label: 'Date Controls' },
      )}
      description="Configure document date policies. Existing document behaviour is unchanged until a policy is enabled and integrated."
      favoritePath="/admin/document-governance/date-controls"
      pageGuide={{
        purpose:
          'Tenant-scoped date control configuration for CRM and Purchase document types. Defaults preserve current behaviour.',
        nextStep:
          'Create or edit a policy, leave policy disabled for zero impact, then enable and integrate per document type later.',
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            canManage
              ? {
                  id: 'new',
                  label: 'New date control',
                  onClick: openCreate,
                }
              : {
                  id: 'refresh',
                  label: 'Refresh',
                  icon: RefreshCw,
                  onClick: () => void load(),
                  disabled: loading,
                }
          }
          secondaryActions={
            canManage
              ? [
                  {
                    id: 'refresh',
                    label: 'Refresh',
                    icon: RefreshCw,
                    onClick: () => void load(),
                    disabled: loading,
                  },
                ]
              : []
          }
        />
      }
    >

      <div className="mb-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 flex gap-2 items-start">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-sky-700" aria-hidden />
        <p>
          Document Governance is currently configuration-only. Existing document behavior remains
          unchanged until this policy is enabled and integrated.
        </p>
      </div>

      <AdminSummaryStrip>
        <AdminSummaryCard label="Policies" value={String(rows.length)} />
        <AdminSummaryCard label="Active rows" value={String(activeCount)} />
        <AdminSummaryCard label="Policy enabled" value={String(enabledCount)} />
        <AdminSummaryCard label="Profiles" value={String(profiles.length)} />
      </AdminSummaryStrip>

      <ErpCardSection title="Filters" className="mb-3">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="block text-xs text-slate-500 mb-1">Module</span>
            <Select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="min-w-[10rem]"
            >
              <option value="">All</option>
              {modules.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-slate-500 mb-1">Status</span>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'true' | 'false')}
              className="min-w-[10rem]"
            >
              <option value="all">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </label>
        </div>
      </ErpCardSection>

      {loading ? <AdminSkeleton rows={6} /> : null}
      {error ? (
        <AdminErrorState
          title="Could not load date controls"
          description={error}
          action={
            <ErpButton type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </ErpButton>
          }
        />
      ) : null}
      {!loading && !error && !isApiMode() ? (
        <AdminEmptyState
          title="API mode required"
          description="Document Governance Date Controls are available when VITE_USE_API=true."
        />
      ) : null}
      {!loading && !error && isApiMode() && rows.length === 0 ? (
        <AdminEmptyState
          title="No date controls yet"
          description="Create a policy per module and document type. Defaults leave current document behaviour unchanged."
        />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Document Type</th>
                <th className="px-3 py-2">Policy Enabled</th>
                <th className="px-3 py-2">Future Date Rule</th>
                <th className="px-3 py-2">Max Future Days</th>
                <th className="px-3 py-2">Back Date Rule</th>
                <th className="px-3 py-2">Max Back Days</th>
                <th className="px-3 py-2">Approval</th>
                <th className="px-3 py-2">Emergency Override</th>
                <th className="px-3 py-2">Effective From</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-medium capitalize">{r.moduleKey}</td>
                  <td className="px-3 py-2">{r.documentType}</td>
                  <td className="px-3 py-2">
                    <Badge color={r.policyEnabled ? 'green' : 'gray'}>
                      {r.policyEnabled ? 'Yes' : 'No'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{modeLabel(r.futureDateMode)}</td>
                  <td className="px-3 py-2">{r.maxFutureDays ?? '—'}</td>
                  <td className="px-3 py-2">{modeLabel(r.pastDateMode)}</td>
                  <td className="px-3 py-2">{r.maxBackDateDays ?? '—'}</td>
                  <td className="px-3 py-2">{r.approvalRequired ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{r.allowEmergencyOverride ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">
                    {r.effectiveFrom ? r.effectiveFrom.slice(0, 10) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge color={r.active ? 'blue' : 'gray'}>{r.active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {canManage ? (
                        <ErpButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === r.id}
                          onClick={() => void openEdit(r.id)}
                        >
                          Edit
                        </ErpButton>
                      ) : null}
                      {canActivate && !r.policyEnabled ? (
                        <ErpButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === r.id}
                          onClick={() => void runAction(r.id, 'activate')}
                        >
                          Activate
                        </ErpButton>
                      ) : null}
                      {canActivate && r.policyEnabled ? (
                        <ErpButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === r.id}
                          onClick={() => void runAction(r.id, 'deactivate')}
                        >
                          Deactivate
                        </ErpButton>
                      ) : null}
                      {canManage ? (
                        <ErpButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyId === r.id}
                          onClick={() => void runAction(r.id, 'reset')}
                        >
                          Reset
                        </ErpButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl p-4">
            <h2 className="text-lg font-semibold mb-1">
              {editingId ? 'Edit date control' : 'New date control'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Inactive policies and CURRENT_BEHAVIOUR modes do not affect documents.
            </p>

            <div className="space-y-3">
              <label className="block text-sm">
                Module
                <Select
                  value={draft.moduleKey}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, moduleKey: e.target.value, documentType: '' }))
                  }
                  disabled={Boolean(editingId)}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {modules.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm">
                Document type
                <Select
                  value={draft.documentType}
                  onChange={(e) => setDraft((d) => ({ ...d, documentType: e.target.value }))}
                  disabled={Boolean(editingId)}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {filteredDocTypes.map((d) => (
                    <option key={`${d.moduleKey}:${d.documentType}`} value={d.documentType}>
                      {d.documentLabel}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.policyEnabled}
                  onChange={(e) => setDraft((d) => ({ ...d, policyEnabled: e.target.checked }))}
                />
                Policy enabled (no live enforcement until integrated)
              </label>
              <label className="block text-sm">
                Future date rule
                <Select
                  value={draft.futureDateMode}
                  onChange={(e) => setDraft((d) => ({ ...d, futureDateMode: e.target.value }))}
                >
                  {DATE_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm">
                Max future days
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={draft.maxFutureDays}
                  onChange={(e) => setDraft((d) => ({ ...d, maxFutureDays: e.target.value }))}
                  placeholder="Optional"
                />
              </label>
              <label className="block text-sm">
                Back date rule
                <Select
                  value={draft.pastDateMode}
                  onChange={(e) => setDraft((d) => ({ ...d, pastDateMode: e.target.value }))}
                >
                  {DATE_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm">
                Max back days
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={draft.maxBackDateDays}
                  onChange={(e) => setDraft((d) => ({ ...d, maxBackDateDays: e.target.value }))}
                  placeholder="Optional"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.approvalRequired}
                  onChange={(e) => setDraft((d) => ({ ...d, approvalRequired: e.target.checked }))}
                />
                Approval required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.allowEmergencyOverride}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, allowEmergencyOverride: e.target.checked }))
                  }
                />
                Allow emergency override
              </label>
              <label className="block text-sm">
                Profile
                <Select
                  value={draft.profileId}
                  onChange={(e) => setDraft((d) => ({ ...d, profileId: e.target.value }))}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm">
                Effective from
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={draft.effectiveFrom}
                  onChange={(e) => setDraft((d) => ({ ...d, effectiveFrom: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                Effective to
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                  value={draft.effectiveTo}
                  onChange={(e) => setDraft((d) => ({ ...d, effectiveTo: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <ErpButton type="button" variant="secondary" onClick={() => setDrawerOpen(false)}>
                Cancel
              </ErpButton>
              <ErpButton type="button" onClick={() => void saveDraft()} disabled={saving || !canManage}>
                {saving ? 'Saving…' : 'Save'}
              </ErpButton>
            </div>
          </div>
        </div>
      ) : null}
    </AdminWorkspaceShell>
  )
}
