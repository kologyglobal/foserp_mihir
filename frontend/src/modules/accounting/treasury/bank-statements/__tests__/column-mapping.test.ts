/**
 * Phase 5A2 — column mapping mapper unit checks.
 */
import { buildMappingConfig, flattenMappingConfig } from '../mappers/column-mapping.mapper.ts'
import { defaultMappingForHeaders, inferImportFormat } from '../utils/bankStatementUi.ts'

let passed = 0
let failed = 0

function check(label: string, ok: boolean) {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.log(`✗ ${label}`)
  }
}

export function runColumnMappingMapperTests() {
  const built = buildMappingConfig('DEBIT_CREDIT_COLUMNS', { transactionDate: 'Date', debitAmount: 'Debit' }, 'DD/MM/YYYY')
  check('buildMappingConfig amountMode', built.amountMode === 'DEBIT_CREDIT_COLUMNS')
  check('buildMappingConfig date column', built.columns.transactionDate?.column === 'Date')
  check('buildMappingConfig dateFormat', built.dateFormat === 'DD/MM/YYYY')

  const flat = flattenMappingConfig(built)
  check('flattenMappingConfig roundtrip', flat.transactionDate === 'Date')

  const inferred = defaultMappingForHeaders(['Date', 'Description', 'Debit', 'Credit', 'Balance'])
  check('defaultMapping infers date', inferred.columns.transactionDate?.column === 'Date')
  check('defaultMapping infers debit', inferred.columns.debitAmount?.column === 'Debit')

  check('inferImportFormat csv', inferImportFormat('statement.csv') === 'CSV')
  check('inferImportFormat xlsx', inferImportFormat('book.xlsx') === 'XLSX')
  check('inferImportFormat mt940', inferImportFormat('export.mt940') === 'MT940')
  check('inferImportFormat sta', inferImportFormat('bank.sta') === 'MT940')
  check('inferImportFormat camt xml', inferImportFormat('camt053.xml') === 'CAMT_053')
  check('inferImportFormat txt auto', inferImportFormat('stmt.txt') === 'AUTO_DETECT')
  check('inferImportFormat invalid', inferImportFormat('notes.pdf') === null)

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('column-mapping.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Bank Statements — column mapping')
  console.log('═══════════════════════════════════════\n')
  const result = runColumnMappingMapperTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
