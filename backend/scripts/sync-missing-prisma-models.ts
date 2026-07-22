/**
 * Append PascalCase Prisma models for tables present in DB but missing from schema.
 * Uses information_schema — does not run db pull.
 *
 * Usage: npx tsx scripts/sync-missing-prisma-models.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '../src/config/database.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA = path.join(ROOT, 'prisma', 'schema.prisma')

function toPascal(snakeOrCamel: string): string {
  return snakeOrCamel
    .replace(/^[a-z]/, (c) => c.toUpperCase())
    .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function tableToModel(table: string): string {
  // inventory_stock_balances -> InventoryStockBalance
  const parts = table.split('_')
  const pascal = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
  // plural heuristic
  if (pascal.endsWith('ies')) return pascal.slice(0, -3) + 'y'
  if (pascal.endsWith('sses')) return pascal.slice(0, -2)
  if (pascal.endsWith('ses') && !pascal.endsWith('Statuses')) return pascal.slice(0, -2)
  if (pascal.endsWith('s') && !pascal.endsWith('Status') && !pascal.endsWith('ss')) return pascal.slice(0, -1)
  return pascal
}

/** Explicit enum names expected by TypeScript (table.column → Prisma enum). */
const ENUM_NAMES: Record<string, string> = {
  'ap_disputes.status': 'ApDisputeStatus',
  'ap_disputes.disputeType': 'ApDisputeType',
  'ap_disputes.priority': 'ApDisputePriority',
  'ar_disputes.status': 'ArDisputeStatus',
  'ar_disputes.disputeType': 'ArDisputeType',
  'ar_disputes.priority': 'ArDisputePriority',
  'inventory_transfers.status': 'InventoryTransferStatus',
  'inventory_stock_counts.status': 'InventoryStockCountStatus',
  'inventory_adjustments.status': 'InventoryAdjustmentStatus',
  'inventory_accounting_events.eventType': 'InventoryAccountingEventType',
  'inventory_accounting_events.status': 'InventoryAccountingEventStatus',
  'inventory_batches.status': 'InventoryBatchStatus',
  'inventory_batch_balances.stockStatus': 'InventoryStockStatus',
  'inventory_serials.stockStatus': 'InventoryStockStatus',
  'inventory_serials.status': 'InventorySerialStatus',
  'inventory_serials.sourceReferenceType': 'InventoryReferenceType',
  'sales_invoice_source_links.sourceType': 'SalesInvoiceSourceLinkSourceType',
  'sales_invoice_source_links.status': 'SalesInvoiceSourceLinkStatus',
}

const declaredEnums = new Set<string>()

function parseMysqlEnumValues(columnType: string): string[] {
  const m = columnType.match(/^enum\((.*)\)$/i)
  if (!m) return []
  return m[1].split(',').map((v) => v.trim().replace(/^'|'$/g, ''))
}

function mysqlTypeToPrisma(
  table: string,
  column: string,
  dataType: string,
  columnType: string,
  isNullable: boolean,
  enumDecls: string[],
): string {
  const nullSuffix = isNullable ? '?' : ''
  const ct = columnType.toLowerCase()
  if (dataType === 'enum') {
    const key = `${table}.${column}`
    const enumName = ENUM_NAMES[key] ?? `${TABLE_MODEL[table] ?? toPascal(table)}${toPascal(column)}`
    if (!declaredEnums.has(enumName) && enumName !== 'InventoryStockStatus' && enumName !== 'InventoryReferenceType') {
      const values = parseMysqlEnumValues(columnType)
      if (values.length) {
        enumDecls.push(`enum ${enumName} {\n${values.map((v) => `  ${v}`).join('\n')}\n}\n`)
        declaredEnums.add(enumName)
      }
    }
    return `${enumName}${nullSuffix}`
  }
  if (dataType === 'json') return `Json${nullSuffix}`
  if (dataType === 'tinyint' && ct === 'tinyint(1)') return `Boolean${nullSuffix}`
  if (['int', 'integer', 'mediumint', 'smallint', 'tinyint', 'year'].includes(dataType)) {
    return `Int${nullSuffix}`
  }
  if (dataType === 'bigint') return `BigInt${nullSuffix}`
  if (['decimal', 'numeric'].includes(dataType)) {
    const m = ct.match(/decimal\((\d+),(\d+)\)/)
    if (m) return `Decimal${nullSuffix} @db.Decimal(${m[1]}, ${m[2]})`
    return `Decimal${nullSuffix}`
  }
  if (['float', 'double', 'real'].includes(dataType)) return `Float${nullSuffix}`
  if (dataType === 'datetime') return `DateTime${nullSuffix}`
  if (dataType === 'date') return `DateTime${nullSuffix} @db.Date`
  if (dataType === 'time') return `DateTime${nullSuffix} @db.Time(0)`
  if (dataType === 'timestamp') return `DateTime${nullSuffix}`
  if (dataType === 'text' || dataType === 'mediumtext' || dataType === 'longtext') {
    return `String${nullSuffix} @db.Text`
  }
  if (dataType === 'varchar') {
    const m = ct.match(/varchar\((\d+)\)/)
    if (m) return `String${nullSuffix} @db.VarChar(${m[1]})`
    return `String${nullSuffix}`
  }
  if (dataType === 'char') {
    const m = ct.match(/char\((\d+)\)/)
    if (m) return `String${nullSuffix} @db.Char(${m[1]})`
    return `String${nullSuffix}`
  }
  return `String${nullSuffix}`
}

const FORCE_TABLES = [
  'gate_settings',
  'gate_locations',
  'gate_visitor_profiles',
  'gate_visitor_visits',
  'gate_expected_visitors',
  'gate_vehicles',
  'gate_material_inwards',
  'gate_material_outwards',
  'gate_passes',
  'gate_pass_items',
  'gate_contractors',
  'gate_contractor_entries',
  'gate_courier_entries',
  'gate_approvals',
  'gate_activities',
  'ar_disputes',
  'ap_disputes',
  'sales_invoice_source_links',
  'inventory_transfers',
  'inventory_transfer_lines',
  'inventory_stock_counts',
  'inventory_stock_count_lines',
  'inventory_adjustments',
  'inventory_adjustment_lines',
  'inventory_accounting_events',
  'inventory_lots',
  'inventory_serials',
  'inventory_batches',
  'inventory_batch_balances',
  'manufacturing_settings',
  'labour_rate_cards',
  'overhead_cost_pools',
  'production_order_splits',
  'purchase_quality_inspections',
  'purchase_quality_inspection_lines',
]

// Prefer explicit model names matching TS delegates
const TABLE_MODEL: Record<string, string> = {
  gate_settings: 'GateSettings',
  gate_locations: 'GateLocation',
  gate_visitor_profiles: 'GateVisitorProfile',
  gate_visitor_visits: 'GateVisitorVisit',
  gate_expected_visitors: 'GateExpectedVisitor',
  gate_vehicles: 'GateVehicle',
  gate_material_inwards: 'GateMaterialInward',
  gate_material_outwards: 'GateMaterialOutward',
  gate_passes: 'GatePass',
  gate_pass_items: 'GatePassItem',
  gate_contractors: 'GateContractor',
  gate_contractor_entries: 'GateContractorEntry',
  gate_courier_entries: 'GateCourierEntry',
  gate_approvals: 'GateApproval',
  gate_activities: 'GateActivity',
  ar_disputes: 'ArDispute',
  ap_disputes: 'ApDispute',
  sales_invoice_source_links: 'SalesInvoiceSourceLink',
  inventory_transfers: 'InventoryTransfer',
  inventory_transfer_lines: 'InventoryTransferLine',
  inventory_stock_counts: 'InventoryStockCount',
  inventory_stock_count_lines: 'InventoryStockCountLine',
  inventory_adjustments: 'InventoryAdjustment',
  inventory_adjustment_lines: 'InventoryAdjustmentLine',
  inventory_accounting_events: 'InventoryAccountingEvent',
  inventory_lots: 'InventoryLot',
  inventory_serials: 'InventorySerial',
  inventory_batches: 'InventoryBatch',
  inventory_batch_balances: 'InventoryBatchBalance',
  manufacturing_settings: 'ManufacturingSettings',
  labour_rate_cards: 'LabourRateCard',
  overhead_cost_pools: 'OverheadCostPool',
  production_order_splits: 'ProductionOrderSplit',
  purchase_quality_inspections: 'PurchaseQualityInspection',
  purchase_quality_inspection_lines: 'PurchaseQualityInspectionLine',
}

async function main() {
  let schema = fs.readFileSync(SCHEMA, 'utf8')

  const existingTables = new Set<string>()
  for (const m of schema.matchAll(/@@map\("([^"]+)"\)/g)) existingTables.add(m[1])
  for (const m of schema.matchAll(/model\s+(\w+)/g)) {
    // ignore
  }

  const cols = await prisma.$queryRawUnsafe<
    Array<{
      TABLE_NAME: string
      COLUMN_NAME: string
      DATA_TYPE: string
      COLUMN_TYPE: string
      IS_NULLABLE: string
      COLUMN_KEY: string
      COLUMN_DEFAULT: string | null
      EXTRA: string
    }>
  >(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${FORCE_TABLES.map((t) => `'${t}'`).join(',')})
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
  )

  const byTable = new Map<string, typeof cols>()
  for (const c of cols) {
    const list = byTable.get(c.TABLE_NAME) ?? []
    list.push(c)
    byTable.set(c.TABLE_NAME, list)
  }

  const chunks: string[] = []
  chunks.push('\n// ─── Auto-synced missing models (build fix) ───────────────────────────────\n')

  for (const table of FORCE_TABLES) {
    if (existingTables.has(table)) {
      console.log(`skip existing @@map ${table}`)
      continue
    }
    const tableCols = byTable.get(table)
    if (!tableCols?.length) {
      console.log(`skip missing in DB ${table}`)
      continue
    }
    const model = TABLE_MODEL[table] ?? tableToModel(table)
    if (new RegExp(`model\\s+${model}\\b`).test(schema)) {
      console.log(`skip existing model ${model}`)
      continue
    }

    const lines: string[] = [`model ${model} {`]
    const idCols: string[] = []
    for (const c of tableCols) {
      let field = `  ${c.COLUMN_NAME} `
      const optional = c.IS_NULLABLE === 'YES'
      let typ = mysqlTypeToPrisma(c.DATA_TYPE, c.COLUMN_TYPE, optional)

      // defaults / id
      if (c.COLUMN_KEY === 'PRI') {
        idCols.push(c.COLUMN_NAME)
        if (c.COLUMN_NAME === 'id' && c.DATA_TYPE === 'varchar') {
          typ = typ.replace(/\?$/, '')
          field += `${typ} @id @default(uuid())`
        } else {
          field += `${typ} @id`
        }
      } else if (c.COLUMN_NAME === 'createdAt' && c.DATA_TYPE === 'datetime') {
        field += `DateTime @default(now())`
      } else if (c.COLUMN_NAME === 'updatedAt' && c.DATA_TYPE === 'datetime') {
        field += `DateTime @updatedAt`
      } else if (c.COLUMN_DEFAULT === 'CURRENT_TIMESTAMP(3)' || c.EXTRA.includes('DEFAULT_GENERATED')) {
        field += typ.includes('DateTime') ? `${typ.replace(/\?$/, '')} @default(now())` : typ
      } else if (c.COLUMN_DEFAULT != null && c.COLUMN_DEFAULT !== 'NULL' && !String(c.COLUMN_DEFAULT).includes('CURRENT_TIMESTAMP')) {
        const d = String(c.COLUMN_DEFAULT).replace(/^'|'$/g, '')
        if (typ.startsWith('Boolean')) field += `${typ} @default(${d === '1' || d === 'true'})`
        else if (typ.startsWith('Int') || typ.startsWith('Decimal') || typ.startsWith('Float')) field += `${typ} @default(${d})`
        else if (typ.startsWith('String')) field += `${typ} @default("${d}")`
        else field += typ
      } else {
        field += typ
      }
      lines.push(field)
    }

    // unique indexes from schema info
    const uniques = await prisma.$queryRawUnsafe<Array<{ INDEX_NAME: string; COLUMN_NAME: string; NON_UNIQUE: number }>>(
      `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    )
    const uniqueGroups = new Map<string, string[]>()
    const indexGroups = new Map<string, string[]>()
    for (const u of uniques) {
      if (u.INDEX_NAME === 'PRIMARY') continue
      const map = u.NON_UNIQUE === 0 ? uniqueGroups : indexGroups
      const arr = map.get(u.INDEX_NAME) ?? []
      arr.push(u.COLUMN_NAME)
      map.set(u.INDEX_NAME, arr)
    }
    for (const cols of uniqueGroups.values()) {
      if (cols.length === 1) {
        // add @unique on field if single — already listed; use @@unique
        lines.push(`  @@unique([${cols.join(', ')}])`)
      } else {
        lines.push(`  @@unique([${cols.join(', ')}])`)
      }
    }
    for (const cols of indexGroups.values()) {
      lines.push(`  @@index([${cols.join(', ')}])`)
    }

    lines.push(`  @@map("${table}")`)
    lines.push('}')
    lines.push('')
    chunks.push(lines.join('\n'))
    console.log(`+ model ${model} @@map(${table})`)
  }

  if (chunks.length <= 1) {
    console.log('Nothing to append')
    return
  }

  fs.appendFileSync(SCHEMA, '\n' + chunks.join('\n'))
  console.log('Appended models to schema.prisma')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
