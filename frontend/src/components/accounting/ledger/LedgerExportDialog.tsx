import { useState } from 'react'
import { LedgerConfirmModal } from './LedgerDrawerShell'
import type { LedgerExportFormat, LedgerExportScope } from '@/types/ledgerEntries'

const SCOPE_OPTIONS: { value: LedgerExportScope; label: string; description: string }[] = [
  { value: 'current_view', label: 'Current view', description: 'Rows matching active filters and columns' },
  { value: 'selected', label: 'Selected rows', description: 'Only checked entries on the current page' },
  { value: 'general', label: 'General ledger', description: 'Full general ledger extract' },
  { value: 'account', label: 'Account ledger', description: 'Account-scoped ledger lines' },
  { value: 'voucher', label: 'Voucher entries', description: 'Voucher-wise entry listing' },
  { value: 'party', label: 'Party ledger', description: 'Party sub-ledger extract' },
  { value: 'cost_centre', label: 'Cost centre', description: 'Cost centre allocation lines' },
  { value: 'project', label: 'Project', description: 'Project-wise ledger lines' },
  { value: 'manufacturing', label: 'Manufacturing', description: 'Manufacturing cost ledger lines' },
  { value: 'audit', label: 'Audit pack', description: 'Entries with audit metadata' },
]

const FORMAT_OPTIONS: { value: LedgerExportFormat; label: string }[] = [
  { value: 'excel', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
]

export function LedgerExportDialog({
  open,
  onClose,
  onConfirm,
  defaultScope = 'current_view',
  defaultFormat = 'excel',
}: {
  open: boolean
  onClose: () => void
  onConfirm: (scope: LedgerExportScope, format: LedgerExportFormat) => void
  defaultScope?: LedgerExportScope
  defaultFormat?: LedgerExportFormat
}) {
  const [scope, setScope] = useState<LedgerExportScope>(defaultScope)
  const [format, setFormat] = useState<LedgerExportFormat>(defaultFormat)

  function handleConfirm() {
    onConfirm(scope, format)
    onClose()
  }

  return (
    <LedgerConfirmModal
      open={open}
      onClose={onClose}
      title="Export ledger entries"
      description="Choose the export scope and file format. Demo export only — no file is written to disk in this build."
      confirmLabel="Export"
      onConfirm={handleConfirm}
    >
      <div className="mt-4 space-y-4">
        <fieldset>
          <legend className="text-[12px] font-semibold text-erp-text">Scope</legend>
          <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
            {SCOPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-erp-border px-3 py-2 hover:bg-erp-surface-alt/50"
              >
                <input
                  type="radio"
                  name="ledger-export-scope"
                  value={opt.value}
                  checked={scope === opt.value}
                  onChange={() => setScope(opt.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-[12px] font-semibold text-erp-text">{opt.label}</span>
                  <span className="block text-[11px] text-erp-muted">{opt.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[12px] font-semibold text-erp-text">Format</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {FORMAT_OPTIONS.map((opt) => (
              <label key={opt.value} className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-erp-text">
                <input
                  type="radio"
                  name="ledger-export-format"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={() => setFormat(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </LedgerConfirmModal>
  )
}
