const fs = require('fs')
const path = 'prisma/schema.prisma'
let s = fs.readFileSync(path, 'utf8')

const tenantNeedle =
  '  financeFeatureControls                 FinanceFeatureControl[]\n  financeApprovalRules                   FinanceApprovalRule[]'
const tenantInsert =
  '  financeFeatureControls                 FinanceFeatureControl[]\n  tallyConnectorConfigs                  TallyConnectorConfig[]\n  tallyLedgerMappings                    TallyLedgerMapping[]\n  tallyExportOutbox                      TallyExportOutbox[]\n  financeApprovalRules                   FinanceApprovalRule[]'

if ((s.match(/tallyConnectorConfigs/g) || []).length === 0) {
  const i = s.indexOf(tenantNeedle)
  if (i < 0) {
    console.error('tenant needle not found')
    process.exit(1)
  }
  s = s.slice(0, i) + tenantInsert + s.slice(i + tenantNeedle.length)
  console.log('Tenant relations added')
}

const leNeedle =
  '  financeSettings                        FinanceSettings?\n  costCentres                            CostCentre[]\n  financeFeatureControls                 FinanceFeatureControl[]\n  financeApprovalRules                   FinanceApprovalRule[]'
const leInsert =
  '  financeSettings                        FinanceSettings?\n  costCentres                            CostCentre[]\n  financeFeatureControls                 FinanceFeatureControl[]\n  tallyConnectorConfigs                  TallyConnectorConfig[]\n  tallyLedgerMappings                    TallyLedgerMapping[]\n  tallyExportOutbox                      TallyExportOutbox[]\n  financeApprovalRules                   FinanceApprovalRule[]'

if ((s.match(/tallyConnectorConfigs/g) || []).length < 2) {
  if (!s.includes(leNeedle)) {
    console.error('LE needle not found')
    process.exit(1)
  }
  s = s.replace(leNeedle, leInsert)
  console.log('LegalEntity relations added')
}

if (!s.includes('tallyLedgerMappings                          TallyLedgerMapping[]')) {
  const accNeedle = '  mappings                                    DefaultAccountMapping[]'
  if (!s.includes(accNeedle)) {
    console.error('account needle missing')
    process.exit(1)
  }
  s = s.replace(accNeedle, `${accNeedle}\n  tallyLedgerMappings                          TallyLedgerMapping[]`)
  console.log('Account relation added')
}

if (!s.includes('model TallyConnectorConfig')) {
  const models = `

enum TallyConnectorStatus {
  DISABLED
  ENABLED
  ERROR
}

enum TallyExportOutboxStatus {
  PENDING
  RENDERING
  READY
  EXPORTED
  FAILED
  CANCELLED
}

/// Tally export connector — one config per legal entity (Phase Tally-1: XML download/outbox, no live HTTP).
model TallyConnectorConfig {
  id            String               @id @default(uuid())
  tenantId      String
  legalEntityId String               @unique
  code          String               @db.VarChar(32)
  name          String               @db.VarChar(200)
  status        TallyConnectorStatus @default(DISABLED)

  /// Non-secret: companyName, gstin, host/port hints, exportVoucherTypes[], etc.
  configJson Json?

  lastExportAt      DateTime?
  lastExportStatus  String?   @db.VarChar(32)
  lastExportMessage String?   @db.VarChar(500)

  createdBy String?
  updatedBy String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  tenant      Tenant               @relation(fields: [tenantId], references: [id])
  legalEntity LegalEntity          @relation(fields: [legalEntityId], references: [id])
  mappings    TallyLedgerMapping[]
  outbox      TallyExportOutbox[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([tenantId, legalEntityId, status])
  @@map("tally_connector_configs")
}

model TallyLedgerMapping {
  id            String  @id @default(uuid())
  tenantId      String
  legalEntityId String
  connectorId   String
  accountId     String

  tallyLedgerName  String  @db.VarChar(300)
  tallyParentGroup String? @db.VarChar(200)
  tallyGuid        String? @db.VarChar(64)
  isActive         Boolean @default(true)

  createdBy String?
  updatedBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant      Tenant               @relation(fields: [tenantId], references: [id])
  legalEntity LegalEntity          @relation(fields: [legalEntityId], references: [id])
  connector   TallyConnectorConfig @relation(fields: [connectorId], references: [id], onDelete: Cascade)
  account     Account              @relation(fields: [accountId], references: [id])

  @@unique([connectorId, accountId])
  @@index([tenantId])
  @@index([tenantId, legalEntityId])
  @@map("tally_ledger_mappings")
}

model TallyExportOutbox {
  id             String                  @id @default(uuid())
  tenantId       String
  legalEntityId  String
  connectorId    String
  voucherId      String
  status         TallyExportOutboxStatus @default(PENDING)
  idempotencyKey String                  @db.VarChar(200)

  payloadJson Json?
  xmlBody     String? @db.LongText
  xmlHash     String? @db.VarChar(64)

  attemptCount  Int       @default(0)
  lastAttemptAt DateTime?
  exportedAt    DateTime?
  errorCode     String?   @db.VarChar(64)
  errorMessage  String?   @db.VarChar(500)

  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant      Tenant               @relation(fields: [tenantId], references: [id])
  legalEntity LegalEntity          @relation(fields: [legalEntityId], references: [id])
  connector   TallyConnectorConfig @relation(fields: [connectorId], references: [id], onDelete: Cascade)
  voucher     AccountingVoucher    @relation(fields: [voucherId], references: [id])

  @@unique([tenantId, legalEntityId, idempotencyKey])
  @@unique([connectorId, voucherId])
  @@index([tenantId])
  @@index([tenantId, legalEntityId, status, createdAt])
  @@index([voucherId])
  @@map("tally_export_outbox")
}
`
  s = s.trimEnd() + '\n' + models + '\n'
  console.log('Models appended')
}

fs.writeFileSync(path, s)
console.log('done, tallyConnectorConfigs count=', (s.match(/tallyConnectorConfigs/g) || []).length)
console.log('has model=', s.includes('model TallyConnectorConfig'))
console.log('has TALLY_EXPORT=', s.includes('TALLY_EXPORT'))
console.log('has voucher outbox=', s.includes('tallyExportOutbox                TallyExportOutbox[]'))
