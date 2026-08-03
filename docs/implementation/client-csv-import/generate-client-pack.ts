/**
 * Generates the client-facing FOS ERP data-collection pack:
 * - One multi-sheet Excel workbook (questionnaire + import sheets)
 * - Matching CSV files (headers + sample rows)
 *
 * Run from backend/:
 *   npx tsx ../docs/implementation/client-csv-import/generate-client-pack.ts
 */
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = __dirname
const require = createRequire(path.resolve(__dirname, '../../../backend/package.json'))
const ExcelJS = require('exceljs') as typeof import('exceljs')

type SheetSpec = {
  csvFile: string
  excelName: string
  liveImport: boolean
  notes: string
  headers: string[]
  samples: string[][]
}

const IMPORT_SHEETS: SheetSpec[] = [
  {
    csvFile: '00_prerequisites_reference.csv',
    excelName: '00_Prerequisites',
    liveImport: false,
    notes: 'Create in UI before Items/HSN import. Not a live CSV importer.',
    headers: ['master_type', 'code', 'name', 'notes'],
    samples: [
      ['uom', 'NOS', 'Numbers', 'Base UOM for count items'],
      ['uom', 'KG', 'Kilogram', 'Base UOM for weight items'],
      ['item_category', 'CAT-RAW', 'Raw Material', 'Category Code on Items sheet'],
      ['item_category', 'CAT-FG', 'Finished Goods', 'Category Code on Items sheet'],
      ['gst_group', 'GG18', 'GST 18%', 'GST Group Code on HSN + Items'],
      ['warehouse', 'RM-WH', 'Raw Material Warehouse', 'Optional; BOM source_warehouse_code'],
      ['warehouse', 'WH-RM', 'Pilot Raw Material', 'Alternate warehouse code example'],
      ['country', 'IN', 'India', 'Geography — vendor Country Code'],
      ['state', 'MH', 'Maharashtra', 'Geography — vendor State Code'],
    ],
  },
  {
    csvFile: '01_items.csv',
    excelName: '01_Items',
    liveImport: true,
    notes: 'Live: Masters → Items → Import. Required: Item Code, Item Name, Category Code, Base UOM Code.',
    headers: [
      'Item Code',
      'Item Name',
      'Category Code',
      'Base UOM Code',
      'Item Type',
      'Product Type',
      'HSN Code',
      'GST Group Code',
      'Standard Rate',
      'Status',
    ],
    samples: [
      ['RM-001', 'Steel Plate 6mm', 'CAT-RAW', 'KG', 'raw', 'raw_material', '72085100', 'GG18', '1250.00', 'ACTIVE'],
      ['FG-001', '40ft Trailer', 'CAT-FG', 'NOS', 'finished', 'finished_good', '87163900', 'GG18', '0', 'ACTIVE'],
    ],
  },
  {
    csvFile: '02_vendors.csv',
    excelName: '02_Vendors',
    liveImport: true,
    notes: 'Live: Masters → Vendors → Import. Required: Vendor Code, Vendor Name.',
    headers: [
      'Vendor Code',
      'Vendor Name',
      'Search Name',
      'Vendor Type',
      'City',
      'State',
      'Country',
      'Country Code',
      'State Code',
      'City Name',
      'GSTIN',
      'Contact Person',
      'Contact Phone',
      'Payment Terms Days',
      'Status',
    ],
    samples: [
      [
        'VND-001',
        'Acme Steel Supplies',
        'ACME STEEL',
        'manufacturer',
        'Pune',
        'Maharashtra',
        'India',
        'IN',
        'MH',
        'Pune',
        '27AAAAA0000A1Z5',
        'Rajesh Kumar',
        '9876543210',
        '30',
        'ACTIVE',
      ],
    ],
  },
  {
    csvFile: '03_hsn_sac.csv',
    excelName: '03_HSN_SAC',
    liveImport: true,
    notes: 'Live: Masters → HSN/SAC → Import. Required: HSN Code, GST Group Code, Description. Load before Items that reference HSN.',
    headers: ['HSN Code', 'GST Group Code', 'Description', 'Status'],
    samples: [
      ['72085100', 'GG18', 'Flat-rolled steel products', 'ACTIVE'],
      ['87163900', 'GG18', 'Trailers and semi-trailers', 'ACTIVE'],
    ],
  },
  {
    csvFile: '04_companies.csv',
    excelName: '04_Companies',
    liveImport: true,
    notes: 'Live: CRM → Companies → Import. Company Name required; Company Code recommended for Contacts.',
    headers: [
      'Company Code',
      'Company Name',
      'Type',
      'Industry',
      'Address Line 1',
      'City',
      'State',
      'Pincode',
      'Country',
      'GSTIN',
      'PAN',
      'Contact Person',
      'Mobile',
      'Email',
      'Credit Days',
      'Credit Limit',
      'Sales Territory',
      'Active',
    ],
    samples: [
      [
        'CUST-0042',
        'Acme Logistics Pvt Ltd',
        'corporate',
        'Cement',
        'Plot 12',
        'Mumbai',
        'Maharashtra',
        '400001',
        'India',
        '27AAAAA0000A1Z5',
        '',
        'Rajesh Kumar',
        '9876543210',
        'rajesh@acme.com',
        '30',
        '500000',
        'West',
        'true',
      ],
    ],
  },
  {
    csvFile: '05_contacts.csv',
    excelName: '05_Contacts',
    liveImport: true,
    notes: 'Live: CRM → Contacts → Import. Name + Company Code or Company Name required.',
    headers: [
      'Contact Code',
      'Company Code',
      'Company Name',
      'Name',
      'Designation',
      'Department',
      'Email',
      'Phone',
      'Primary',
      'Active',
    ],
    samples: [[ '', 'CUST-0042', '', 'Rajesh Kumar', 'Director', 'Sales', 'rajesh@acme.com', '9876543210', 'true', 'true']],
  },
  {
    csvFile: '06_leads.csv',
    excelName: '06_Leads',
    liveImport: true,
    notes: 'Live: CRM → Leads → Import. Lead Owner Email must match an invited user.',
    headers: [
      'Prospect Name',
      'Company Name',
      'Source',
      'Industry',
      'Email',
      'Mobile',
      'Contact Person',
      'Expected Value',
      'Stage',
      'Priority',
      'Lead Owner Email',
      'Remarks',
    ],
    samples: [
      [
        'New Trailer Inquiry',
        'Acme Logistics',
        'website',
        'Cement',
        'inquiry@acme.com',
        '9876543210',
        'Rajesh Kumar',
        '2500000',
        'new',
        'medium',
        'admin@example.com',
        'Needs 40ft trailer',
      ],
    ],
  },
  {
    csvFile: '07_bom_combined.csv',
    excelName: '07_BOM',
    liveImport: true,
    notes:
      'Live: Manufacturing → BOM combined CSV import. All item/UOM codes must already exist. One row per component line.',
    headers: [
      'bom_code',
      'bom_name',
      'output_item_code',
      'output_quantity',
      'output_uom_code',
      'line_ref',
      'parent_line_ref',
      'component_item_code',
      'component_quantity',
      'component_uom_code',
      'sequence',
      'revision_note',
      'effective_from',
      'effective_to',
      'scrap_percentage',
      'yield_percentage',
      'source_warehouse_code',
      'operation_code',
      'make_buy',
      'line_type',
      'quantity_basis',
      'consumption_method',
      'is_optional',
      'substitute_allowed',
      'quality_required',
      'certificate_required',
      'child_production_order_required',
      'stocked_semi_finished',
      'phantom_assembly',
      'remarks',
    ],
    samples: [
      [
        'BOM-FG-001',
        '40ft Trailer BOM',
        'FG-001',
        '1',
        'NOS',
        'L10',
        '',
        'RM-001',
        '500',
        'KG',
        '10',
        'Initial',
        '',
        '',
        '2',
        '100',
        'RM-WH',
        'FAB',
        'BUY',
        'RAW_MATERIAL',
        'PER_UNIT',
        'ACTUAL',
        'false',
        'false',
        'false',
        'false',
        'false',
        'false',
        'false',
        'Steel for chassis',
      ],
    ],
  },
  {
    csvFile: '08_chart_of_accounts.csv',
    excelName: '08_Chart_of_Accounts',
    liveImport: true,
    notes:
      'Live API CSV import (Accounting → Chart of Accounts → Import). Scoped to legal entity. Account Type: Group|Posting. Category: Asset|Liability|Equity|Income|Expense. Parent by Account Code. Duplicate mode: skip|update|reject.',
    headers: [
      'Account Code',
      'Account Name',
      'Account Type',
      'Category',
      'Parent Account Code',
      'Normal Balance',
      'Direct Posting',
      'Control Account',
      'Active',
    ],
    samples: [
      ['1000', 'Assets', 'Group', 'Asset', '', 'Debit', 'N', 'N', 'Y'],
      ['1100', 'Current Assets', 'Group', 'Asset', '1000', 'Debit', 'N', 'N', 'Y'],
      ['1110', 'Cash and Bank', 'Posting', 'Asset', '1100', 'Debit', 'Y', 'N', 'Y'],
    ],
  },
  {
    csvFile: '09_warehouses.csv',
    excelName: '09_Warehouses',
    liveImport: false,
    notes: 'Setup sheet — create warehouses in UI/API before opening stock / BOM warehouse codes.',
    headers: ['code', 'name', 'warehouseType', 'plantCode', 'address', 'status'],
    samples: [
      ['WH-RM', 'Raw Material', 'stores', 'PLANT-01', '', 'ACTIVE'],
      ['WH-WIP', 'WIP', 'wip', 'PLANT-01', '', 'ACTIVE'],
      ['WH-FG', 'Finished Goods', 'fg', 'PLANT-01', '', 'ACTIVE'],
    ],
  },
  {
    csvFile: '10_opening_stock.csv',
    excelName: '10_Opening_Stock',
    liveImport: false,
    notes: 'Setup sheet — opening balances by item/warehouse. Load via assisted import / inventory opening (not masters CSV).',
    headers: ['itemCode', 'warehouseCode', 'onHandQty', 'reservedQty', 'movementDate', 'referenceNo', 'notes'],
    samples: [['RM-001', 'WH-RM', '1000', '0', '2026-08-01', 'OPEN-001', 'Go-live opening stock']],
  },
  {
    csvFile: '11_users_roles.csv',
    excelName: '11_Users_Roles',
    liveImport: false,
    notes: 'Setup sheet — users are invited (no passwords in this file). roleName must match tenant roles.',
    headers: ['email', 'firstName', 'lastName', 'mobile', 'designation', 'department', 'status', 'roleName'],
    samples: [
      ['admin@client.com', 'Admin', 'User', '9999999999', 'System Admin', 'IT', 'ACTIVE', 'Admin'],
      ['sales@client.com', 'Sales', 'Manager', '', 'Sales Manager', 'Sales', 'ACTIVE', 'Sales Manager'],
      ['stores@client.com', 'Store', 'Keeper', '', 'Stores', 'Stores', 'ACTIVE', 'Store User'],
      ['production@client.com', 'Prod', 'Planner', '', 'Production Planner', 'Production', 'ACTIVE', 'Production Planner'],
    ],
  },
  {
    csvFile: '12_work_centres.csv',
    excelName: '12_Work_Centres',
    liveImport: false,
    notes: 'Manufacturing setup — create before routing/BOM operation codes if used.',
    headers: [
      'code',
      'name',
      'description',
      'plantCode',
      'departmentRef',
      'capacityPerShift',
      'capacityUomCode',
      'defaultShiftRef',
      'isActive',
    ],
    samples: [
      ['WC-FAB', 'Fabrication', 'Fabrication centre', 'PLANT-01', 'Production', '', '', 'SHIFT-A', 'true'],
      ['WC-ASSY', 'Assembly', 'Assembly centre', 'PLANT-01', 'Production', '', '', 'SHIFT-A', 'true'],
    ],
  },
]

const QUESTIONNAIRE: { section: string; question: string; example: string; notes: string }[] = [
  { section: 'A. Company & legal', question: 'Legal company name', example: 'Acme Trailers Pvt Ltd', notes: 'As on GST certificate' },
  { section: 'A. Company & legal', question: 'Trade / brand name', example: 'Acme Trailers', notes: '' },
  { section: 'A. Company & legal', question: 'Preferred tenant slug (URL)', example: 'acme-trailers', notes: 'Lowercase, hyphens only' },
  { section: 'A. Company & legal', question: 'GSTIN', example: '27AAAAA0000A1Z5', notes: '' },
  { section: 'A. Company & legal', question: 'PAN', example: 'AAAAA0000A', notes: '' },
  { section: 'A. Company & legal', question: 'Registered address', example: 'Plot 12, MIDC, Pune…', notes: '' },
  { section: 'A. Company & legal', question: 'Billing address (if different)', example: '', notes: '' },
  { section: 'A. Company & legal', question: 'Number of legal entities', example: '1', notes: 'Start with 1 for pilot' },
  { section: 'A. Company & legal', question: 'Number of plants / branches (Wave 1)', example: '1', notes: 'Pilot = one plant' },
  { section: 'A. Company & legal', question: 'Plant / branch name + city', example: 'Pune Plant', notes: '' },
  { section: 'A. Company & legal', question: 'Financial year start', example: '01-Apr', notes: 'India typically Apr' },
  { section: 'A. Company & legal', question: 'Books / ERP go-live date', example: '2026-09-01', notes: 'Opening stock as-of this date' },
  { section: 'A. Company & legal', question: 'Base currency', example: 'INR', notes: '' },

  { section: 'B. Scope (Wave 1)', question: 'Modules in Wave 1', example: 'CRM + Items + Stock + Manufacturing', notes: 'Tick agreed scope' },
  { section: 'B. Scope (Wave 1)', question: 'Purchase / GRN in Wave 1?', example: 'No', notes: 'Yes / No' },
  { section: 'B. Scope (Wave 1)', question: 'Dispatch in Wave 1?', example: 'No', notes: 'Yes / No' },
  { section: 'B. Scope (Wave 1)', question: 'Full Finance (AR/AP/Bank) in Wave 1?', example: 'No', notes: 'Yes / Partial / No' },
  { section: 'B. Scope (Wave 1)', question: 'Pilot finished goods (3–5 product codes)', example: 'FG-001, FG-002…', notes: 'List codes or names' },

  { section: 'C. Process decisions', question: 'Inventory costing method', example: 'FIFO', notes: 'FIFO / Average / Standard / Specific' },
  { section: 'C. Process decisions', question: 'Items with serial tracking', example: 'FG only / None', notes: '' },
  { section: 'C. Process decisions', question: 'Items with lot tracking', example: 'RM paint / None', notes: '' },
  { section: 'C. Process decisions', question: 'QC required on which items?', example: 'Incoming steel / FG final', notes: '' },
  { section: 'C. Process decisions', question: 'Allow partial dispatch?', example: 'Yes', notes: '' },
  { section: 'C. Process decisions', question: 'Allow over-dispatch?', example: 'No', notes: '' },
  { section: 'C. Process decisions', question: 'Default payment terms', example: 'Net 30', notes: '' },
  { section: 'C. Process decisions', question: 'Default delivery / Incoterms', example: 'Ex-Works', notes: '' },
  { section: 'C. Process decisions', question: 'Document number series preferences', example: 'SO-, PO-, WO-, INV-', notes: '' },

  { section: 'D. People', question: 'Primary admin name + email', example: 'admin@client.com', notes: 'First invite' },
  { section: 'D. People', question: 'Master-data owner', example: 'Name / email', notes: 'Items, vendors, BOM' },
  { section: 'D. People', question: 'Approx. named users (Wave 1)', example: '12', notes: 'Fill sheet 11_Users_Roles' },
  { section: 'D. People', question: 'PR/PO approval limits needed?', example: 'Yes — by amount', notes: '' },

  { section: 'E. Cutover', question: 'Opening stock date', example: '2026-08-31', notes: 'Fill sheet 10_Opening_Stock' },
  { section: 'E. Cutover', question: 'Migrate historical SO/PO?', example: 'No — start fresh', notes: 'Usually start fresh in Wave 1' },
  { section: 'E. Cutover', question: 'Opening AR/AP balances?', example: 'No / Yes (summary)', notes: 'If finance in scope' },
  { section: 'E. Cutover', question: 'Parallel run period (Excel + ERP)', example: '2 weeks', notes: '' },
  { section: 'E. Cutover', question: 'UAT sign-off contact', example: 'Name / email / phone', notes: '' },
]

function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map((c) => escapeCsv(c ?? '')).join(',')).join('\n') + '\n'
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E79' },
  }
  row.alignment = { vertical: 'middle', wrapText: true }
}

function autosize(ws: ExcelJS.Worksheet, colCount: number) {
  for (let i = 1; i <= colCount; i++) {
    let max = 12
    ws.getColumn(i).eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length
      if (len > max) max = Math.min(len + 2, 42)
    })
    ws.getColumn(i).width = max
  }
}

async function main() {
  for (const sheet of IMPORT_SHEETS) {
    const csvPath = path.join(OUT_DIR, sheet.csvFile)
    fs.writeFileSync(csvPath, toCsv(sheet.headers, sheet.samples), 'utf8')
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FOS ERP'
  workbook.created = new Date()
  workbook.title = 'FOS ERP Client Data Collection Pack'

  // —— Instructions ——
  {
    const ws = workbook.addWorksheet('00_Instructions', { properties: { tabColor: { argb: 'FF2E7D32' } } })
    const lines: Array<[string, string]> = [
      ['FOS ERP — Client Data Collection Pack', ''],
      ['How to use', '1) Fill Questionnaire (Client_Answer column). 2) Replace sample rows on data sheets with your data. 3) Keep header row text exactly as provided. 4) Return this Excel OR export each data sheet as CSV.'],
      ['Live CSV imports (upload in product)', 'Items, Vendors, HSN/SAC, Companies, Contacts, Leads, BOM, Chart of Accounts'],
      ['Collection / assisted setup', 'Prerequisites, Warehouses, Opening Stock, Users/Roles, Work Centres'],
      ['Load order', 'Prerequisites (UOM, categories, GST groups, geography) → Legal entity / Chart of Accounts → HSN → Items → Vendors → Companies → Contacts → Leads → Warehouses/WC → BOM → Opening Stock → Users invited'],
      ['Rules', 'UTF-8; no passwords or bank secrets; booleans true/false; Status ACTIVE; codes must match across sheets (e.g. Category Code, Company Code).'],
      ['Limits', 'Masters/CRM import batches: max 500 rows. BOM import: up to 2000 rows. Chart of Accounts import: up to 2000 rows.'],
      ['Mode', 'Product imports require API mode (VITE_USE_API=true) and a provisioned tenant.'],
      ['Generated', new Date().toISOString().slice(0, 10)],
    ]
    ws.addRow(['Topic', 'Detail'])
    styleHeader(ws.getRow(1))
    for (const [a, b] of lines) ws.addRow([a, b])
    ws.getColumn(1).width = 28
    ws.getColumn(2).width = 100
    ws.getRow(2).font = { bold: true, size: 14 }
  }

  // —— Questionnaire ——
  {
    const ws = workbook.addWorksheet('Questionnaire', { properties: { tabColor: { argb: 'FF1565C0' } } })
    ws.addRow(['Section', 'Question', 'Example', 'Client_Answer', 'Notes'])
    styleHeader(ws.getRow(1))
    for (const q of QUESTIONNAIRE) {
      ws.addRow([q.section, q.question, q.example, '', q.notes])
    }
    autosize(ws, 5)
    ws.getColumn(4).width = 36
    ws.getColumn(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFDE7' },
    }
  }

  // —— Import index ——
  {
    const ws = workbook.addWorksheet('Import_Index')
    ws.addRow(['Sheet', 'CSV file', 'Live import?', 'Notes'])
    styleHeader(ws.getRow(1))
    for (const s of IMPORT_SHEETS) {
      ws.addRow([s.excelName, s.csvFile, s.liveImport ? 'YES' : 'NO — setup/collection', s.notes])
    }
    autosize(ws, 4)
    ws.getColumn(4).width = 70
  }

  // —— Data sheets ——
  for (const sheet of IMPORT_SHEETS) {
    const ws = workbook.addWorksheet(sheet.excelName.slice(0, 31), {
      properties: { tabColor: { argb: sheet.liveImport ? 'FF00695C' : 'FF6D4C41' } },
    })
    ws.addRow(['NOTES', sheet.notes])
    ws.mergeCells(1, 1, 1, Math.max(sheet.headers.length, 2))
    ws.getRow(1).font = { italic: true, color: { argb: 'FF424242' } }
    ws.addRow(sheet.headers)
    styleHeader(ws.getRow(2))
    for (const sample of sheet.samples) ws.addRow(sample)
    // Blank template rows for client fill
    for (let i = 0; i < 5; i++) ws.addRow(sheet.headers.map(() => ''))
    autosize(ws, sheet.headers.length)
  }

  const xlsxName = 'FOS_ERP_Client_Data_Collection.xlsx'
  const xlsxPath = path.join(OUT_DIR, xlsxName)
  await workbook.xlsx.writeFile(xlsxPath)

  console.log(`Wrote ${xlsxPath}`)
  console.log(`Wrote ${IMPORT_SHEETS.length} CSV files to ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
