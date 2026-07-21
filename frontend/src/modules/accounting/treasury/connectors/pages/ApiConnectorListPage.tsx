import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Power, PowerOff, RefreshCw, PlugZap, KeyRound } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { notify } from '@/store/toastStore'
import { formatApiError } from '@/services/api/apiErrors'
import { appConfirm } from '@/store/confirmDialogStore'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { useTreasuryConnectorPermissions } from '@/utils/permissions/treasuryConnector'
import { useTreasuryAccountOptions } from '../../transfers/hooks/useTreasuryAccountOptions'
import {
  createBankConnector,
  disableBankConnector,
  enableBankConnector,
  fetchBankConnectors,
  revokeBankConnectorConsent,
  startBankConnectorConsent,
  syncBankConnector,
  testBankConnectorConnection,
  updateBankConnector,
} from '../api/bank-connector.api'
import type { BankConnectorDto } from '../api/bank-connector.types'
import { PROVIDER_LABELS } from '../api/bank-connector.types'
import {
  ConnectorFormDrawer,
  EMPTY_CONNECTOR_FORM,
  connectorToFormValues,
  type ConnectorFormValues,
} from '../components/ConnectorFormDrawer'
import { ConnectorWorkspaceShell } from '../components/ConnectorWorkspaceShell'

export function ApiConnectorListPage() {
  const perms = useTreasuryConnectorPermissions()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const { accounts } = useTreasuryAccountOptions(legalEntityId)
  const bankAccounts = useMemo(() => accounts.filter((a) => a.accountType === 'BANK'), [accounts])

  const [items, setItems] = useState<BankConnectorDto[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingUpdatedAt, setEditingUpdatedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [values, setValues] = useState<ConnectorFormValues>(EMPTY_CONNECTOR_FORM)

  const load = useCallback(async () => {
    if (!perms.canView || !legalEntityId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetchBankConnectors({ legalEntityId, limit: 100 })
      setItems(res.items)
    } catch (e) {
      notify.error(formatApiError(e))
    } finally {
      setLoading(false)
    }
  }, [perms.canView, legalEntityId])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setEditingUpdatedAt(null)
    setValues(EMPTY_CONNECTOR_FORM)
    setDrawerOpen(true)
  }

  const openEdit = (row: BankConnectorDto) => {
    setEditingId(row.id)
    setEditingUpdatedAt(row.updatedAt)
    setValues(connectorToFormValues(row))
    setDrawerOpen(true)
  }

  const save = async () => {
    if (!values.code.trim() || !values.name.trim() || !values.treasuryAccountId) {
      notify.error('Code, name and treasury account are required')
      return
    }
    setSaving(true)
    try {
      const configJson = {
        mode: values.mode,
        expectedFormat: values.expectedFormat,
        remotePath: values.remotePath.trim() || undefined,
        fileNamePattern: values.fileNamePattern.trim() || undefined,
        sandboxRoot: values.mode === 'SANDBOX' ? values.sandboxRoot.trim() || undefined : undefined,
        credentialEnvKey:
          values.mode === 'LIVE' ? values.credentialEnvKey.trim() || undefined : undefined,
        notes: values.notes.trim() || undefined,
      }
      if (editingId && editingUpdatedAt) {
        await updateBankConnector(editingId, {
          name: values.name.trim(),
          treasuryAccountId: values.treasuryAccountId,
          baseUrl: values.baseUrl.trim() || null,
          configJson,
          expectedUpdatedAt: editingUpdatedAt,
        })
        notify.success('Connector updated')
      } else {
        await createBankConnector({
          legalEntityId,
          treasuryAccountId: values.treasuryAccountId,
          code: values.code.trim(),
          name: values.name.trim(),
          provider: values.provider,
          baseUrl: values.baseUrl.trim() || null,
          configJson,
        })
        notify.success('Connector created (Disabled / Not connected)')
      }
      setDrawerOpen(false)
      void load()
    } catch (e) {
      notify.error(formatApiError(e))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (row: BankConnectorDto) => {
    if (!perms.canManage) return
    const enabling = row.status === 'DISABLED'
    const ok = await appConfirm({
      title: enabling ? `Enable “${row.name}”?` : `Disable “${row.name}”?`,
      description: enabling
        ? 'Enables the connector. Run Test connection, then Sync to pull MT940/CAMT files (sandbox or allow-listed REST). PSD2 OAuth remains deferred.'
        : 'The connector will be marked Disabled.',
      confirmLabel: enabling ? 'Enable' : 'Disable',
    })
    if (!ok) return
    setBusyId(row.id)
    try {
      if (enabling) await enableBankConnector(row.id, row.updatedAt)
      else await disableBankConnector(row.id, row.updatedAt)
      notify.success(enabling ? 'Enabled — run Test connection to verify' : 'Disabled')
      void load()
    } catch (e) {
      notify.error(formatApiError(e))
    } finally {
      setBusyId(null)
    }
  }

  const runTest = async (row: BankConnectorDto) => {
    if (!perms.canManage) return
    setBusyId(row.id)
    try {
      const result = await testBankConnectorConnection(row.id)
      notify.success(result.message || 'Connection probe OK')
      void load()
    } catch (e) {
      notify.error(formatApiError(e) || 'Connection probe failed')
      void load()
    } finally {
      setBusyId(null)
    }
  }

  const runSync = async (row: BankConnectorDto) => {
    if (!perms.canSync) return
    setBusyId(row.id)
    try {
      const result = await syncBankConnector(row.id)
      const created = result.statementsCreated ?? 0
      const skipped = result.statementsSkipped ?? 0
      notify.success(
        result.message ||
          `Sync complete — created ${created}, skipped ${skipped}`,
      )
      void load()
    } catch (e) {
      notify.error(formatApiError(e) || 'Sync failed')
      void load()
    } finally {
      setBusyId(null)
    }
  }

  const runStartConsent = async (row: BankConnectorDto) => {
    if (!perms.canManage || row.provider !== 'OPEN_BANKING') return
    setBusyId(row.id)
    try {
      const redirectUri = `${window.location.origin}/accounting/bank-cash/connectors`
      const result = await startBankConnectorConsent(row.id, redirectUri)
      notify.success(
        result.consent.status === 'PENDING'
          ? 'Consent started (AIS pull still not live). Open the authorization URL from the connector row.'
          : 'Consent updated',
      )
      if (result.authorizationUrl) {
        window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer')
      }
      void load()
    } catch (e) {
      notify.error(formatApiError(e) || 'Consent start failed')
    } finally {
      setBusyId(null)
    }
  }

  const runRevokeConsent = async (row: BankConnectorDto) => {
    if (!perms.canManage || row.provider !== 'OPEN_BANKING') return
    const ok = await appConfirm({
      title: 'Revoke Open Banking consent?',
      description: 'Clears the stored encrypted token. AIS statement download remains unimplemented.',
      confirmLabel: 'Revoke',
    })
    if (!ok) return
    setBusyId(row.id)
    try {
      await revokeBankConnectorConsent(row.id)
      notify.success('Consent revoked')
      void load()
    } catch (e) {
      notify.error(formatApiError(e))
    } finally {
      setBusyId(null)
    }
  }

  if (!perms.canView) {
    return (
      <ConnectorWorkspaceShell title="Bank connectors">
        <p className="text-[13px] text-erp-muted">You do not have permission to view bank connectors.</p>
      </ConnectorWorkspaceShell>
    )
  }

  return (
    <ConnectorWorkspaceShell
      title="Bank connectors"
      actions={
        <>
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
          {perms.canManage ? (
            <ErpButton icon={Plus} onClick={openCreate}>
              New connector
            </ErpButton>
          ) : null}
        </>
      }
    >
      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[13px] text-sky-950">
        Phase 5D3 — sandbox FS, allow-listed REST, and live SFTP can pull MT940/CAMT into Bank Statements
        (source BANK_API). Open Banking supports consent start/callback/revoke only — AIS statement download is
        not live yet. Secrets use env key refs only (never stored in DB).
      </div>

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <p className="text-[13px] text-erp-muted">
          No bank connectors. Create a scaffold connector to prepare for future bank API / SFTP / Open Banking pull.
        </p>
      ) : (
        <EnterpriseRegisterTableShell>
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-erp-border bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Provider</th>
                <th className="px-3 py-2 font-semibold">Format</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Connection</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-erp-border/70">
                  <td className="px-3 py-2 font-medium text-erp-text">{row.code}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{PROVIDER_LABELS[row.provider]}</td>
                  <td className="px-3 py-2">{row.configJson?.expectedFormat ?? '—'}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 text-erp-muted">
                    {row.provider === 'OPEN_BANKING' && row.consent
                      ? `Consent: ${row.consent.status}`
                      : row.connectionLabel}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {perms.canManage ? (
                        <ErpButton size="sm" variant="secondary" icon={Pencil} onClick={() => openEdit(row)}>
                          Edit
                        </ErpButton>
                      ) : null}
                      {perms.canManage ? (
                        <ErpButton
                          size="sm"
                          variant="secondary"
                          icon={row.status === 'DISABLED' ? Power : PowerOff}
                          loading={busyId === row.id}
                          onClick={() => void toggleStatus(row)}
                        >
                          {row.status === 'DISABLED' ? 'Enable' : 'Disable'}
                        </ErpButton>
                      ) : null}
                      {perms.canManage && row.provider === 'OPEN_BANKING' ? (
                        <ErpButton
                          size="sm"
                          variant="secondary"
                          icon={KeyRound}
                          loading={busyId === row.id}
                          onClick={() => void runStartConsent(row)}
                        >
                          Start consent
                        </ErpButton>
                      ) : null}
                      {perms.canManage &&
                      row.provider === 'OPEN_BANKING' &&
                      row.consent &&
                      row.consent.status !== 'REVOKED' ? (
                        <ErpButton
                          size="sm"
                          variant="secondary"
                          loading={busyId === row.id}
                          onClick={() => void runRevokeConsent(row)}
                        >
                          Revoke
                        </ErpButton>
                      ) : null}
                      {perms.canManage && row.provider !== 'OPEN_BANKING' ? (
                        <ErpButton
                          size="sm"
                          variant="secondary"
                          icon={PlugZap}
                          loading={busyId === row.id}
                          onClick={() => void runTest(row)}
                        >
                          Test
                        </ErpButton>
                      ) : null}
                      {perms.canSync && row.provider !== 'OPEN_BANKING' ? (
                        <ErpButton
                          size="sm"
                          variant="secondary"
                          icon={RefreshCw}
                          loading={busyId === row.id}
                          onClick={() => void runSync(row)}
                        >
                          Sync
                        </ErpButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </EnterpriseRegisterTableShell>
      )}

      <ConnectorFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Edit bank connector' : 'New bank connector'}
        values={values}
        onChange={setValues}
        onSave={() => void save()}
        saving={saving}
        bankAccounts={bankAccounts}
        isEdit={Boolean(editingId)}
      />
    </ConnectorWorkspaceShell>
  )
}
