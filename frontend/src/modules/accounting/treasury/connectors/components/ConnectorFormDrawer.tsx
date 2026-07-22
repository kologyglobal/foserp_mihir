import type { BankConnectorDto, BankConnectorExpectedFormat, BankConnectorProvider } from '../api/bank-connector.types'
import { PROVIDER_LABELS } from '../api/bank-connector.types'
import { BankCashDrawerShell } from '@/components/accounting/bankCash'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import type { TransferAccountSnapshot } from '../../transfers/api/treasury-transfer.types'

export interface ConnectorFormValues {
  code: string
  name: string
  provider: BankConnectorProvider
  treasuryAccountId: string
  expectedFormat: BankConnectorExpectedFormat
  mode: 'SANDBOX' | 'LIVE'
  sandboxRoot: string
  credentialEnvKey: string
  baseUrl: string
  remotePath: string
  fileNamePattern: string
  notes: string
}

export const EMPTY_CONNECTOR_FORM: ConnectorFormValues = {
  code: '',
  name: '',
  provider: 'MT940_SFTP',
  treasuryAccountId: '',
  expectedFormat: 'MT940',
  mode: 'SANDBOX',
  sandboxRoot: '',
  credentialEnvKey: '',
  baseUrl: '',
  remotePath: '',
  fileNamePattern: '*.mt940',
  notes: '',
}

export function connectorToFormValues(c: BankConnectorDto): ConnectorFormValues {
  return {
    code: c.code,
    name: c.name,
    provider: c.provider,
    treasuryAccountId: c.treasuryAccountId,
    expectedFormat: c.configJson?.expectedFormat ?? 'MT940',
    mode: c.configJson?.mode ?? (c.configJson?.sandboxRoot ? 'SANDBOX' : 'LIVE'),
    sandboxRoot: c.configJson?.sandboxRoot ?? '',
    credentialEnvKey: c.configJson?.credentialEnvKey ?? '',
    baseUrl: c.baseUrl ?? '',
    remotePath: c.configJson?.remotePath ?? '',
    fileNamePattern: c.configJson?.fileNamePattern ?? '',
    notes: c.configJson?.notes ?? '',
  }
}

const PROVIDERS = Object.keys(PROVIDER_LABELS) as BankConnectorProvider[]

export function ConnectorFormDrawer({
  open,
  onClose,
  title,
  values,
  onChange,
  onSave,
  saving,
  bankAccounts,
  isEdit,
}: {
  open: boolean
  onClose: () => void
  title: string
  values: ConnectorFormValues
  onChange: (next: ConnectorFormValues) => void
  onSave: () => void
  saving: boolean
  bankAccounts: TransferAccountSnapshot[]
  isEdit: boolean
}) {
  return (
    <BankCashDrawerShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Non-secret config only. Put API secrets in env vars and reference them via credentialEnvKey. PSD2 OAuth still deferred."
      widthClassName="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </ErpButton>
          <ErpButton onClick={onSave} loading={saving}>
            Save
          </ErpButton>
        </div>
      }
    >
      <div className="space-y-3 p-1">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Code</label>
          <Input
            value={values.code}
            disabled={isEdit}
            onChange={(e) => onChange({ ...values, code: e.target.value.toUpperCase() })}
            placeholder="HDFC-MT940-01"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Name</label>
          <Input
            value={values.name}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
            placeholder="HDFC MT940 sandbox"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Provider</label>
          <Select
            className="h-9 text-[13px]"
            value={values.provider}
            disabled={isEdit}
            onChange={(e) => onChange({ ...values, provider: e.target.value as BankConnectorProvider })}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Treasury bank account</label>
          <Select
            className="h-9 text-[13px]"
            value={values.treasuryAccountId}
            onChange={(e) => onChange({ ...values, treasuryAccountId: e.target.value })}
          >
            <option value="">Select account…</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Mode</label>
            <Select
              className="h-9 text-[13px]"
              value={values.mode}
              onChange={(e) => onChange({ ...values, mode: e.target.value as 'SANDBOX' | 'LIVE' })}
            >
              <option value="SANDBOX">Sandbox (filesystem)</option>
              <option value="LIVE">Live REST</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Expected format</label>
            <Select
              className="h-9 text-[13px]"
              value={values.expectedFormat}
              onChange={(e) => onChange({ ...values, expectedFormat: e.target.value as BankConnectorExpectedFormat })}
            >
              <option value="MT940">MT940</option>
              <option value="CAMT053">CAMT.053</option>
              <option value="CSV">CSV</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
        </div>
        {values.mode === 'SANDBOX' ? (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Sandbox root path</label>
              <Input
                value={values.sandboxRoot}
                onChange={(e) => onChange({ ...values, sandboxRoot: e.target.value })}
                placeholder="Absolute path under BANK_CONNECTOR_SANDBOX_ROOTS"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">File name pattern</label>
              <Input
                value={values.fileNamePattern}
                onChange={(e) => onChange({ ...values, fileNamePattern: e.target.value })}
                placeholder="*.mt940"
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Base URL</label>
              <Input
                value={values.baseUrl}
                onChange={(e) => onChange({ ...values, baseUrl: e.target.value })}
                placeholder="https://bank.example/statements"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Credential env key</label>
              <Input
                value={values.credentialEnvKey}
                onChange={(e) => onChange({ ...values, credentialEnvKey: e.target.value.toUpperCase() })}
                placeholder="BANK_CONNECTOR_API_KEY_HDFC"
              />
            </div>
          </>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Remote path (optional)</label>
          <Input
            value={values.remotePath}
            onChange={(e) => onChange({ ...values, remotePath: e.target.value })}
            placeholder="subdir or /outbound/file.sta"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Notes</label>
          <Input
            value={values.notes}
            onChange={(e) => onChange({ ...values, notes: e.target.value })}
            placeholder="Ops notes"
          />
        </div>
      </div>
    </BankCashDrawerShell>
  )
}
