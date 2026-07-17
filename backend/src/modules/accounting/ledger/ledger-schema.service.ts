import type { LedgerSchemaStatus } from './ledger.types.js'

const LEDGER_TABLES = [
  'accounting_vouchers',
  'accounting_voucher_lines',
  'general_ledger_entries',
  'posting_events',
  'posting_rules',
] as const

export function getLedgerSchemaStatus(): LedgerSchemaStatus {
  return {
    phase: '2B',
    modelsPresent: true,
    postingEngine: true,
    publicPostingWorkflow: false,
    journalWorkflow: true,
    reversalWorkflow: false,
    foundationReady: true,
    tables: [...LEDGER_TABLES],
  }
}
