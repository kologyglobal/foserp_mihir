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
    phase: '2A',
    modelsPresent: true,
    postingEngine: false,
    tables: [...LEDGER_TABLES],
  }
}
