import fs from 'fs'

const p = 'prisma/schema.prisma'
let text = fs.readFileSync(p, 'utf8')

if (!text.includes('hrSalaryComponents')) {
  text = text.replace(
    '  hrOvertimeRecords             HrOvertimeRecord[]\n',
    `  hrOvertimeRecords             HrOvertimeRecord[]
  hrSalaryComponents            HrSalaryComponent[]
  hrSalaryStructures            HrSalaryStructure[]
  hrSalaryStructureVersions     HrSalaryStructureVersion[]
  hrSalaryStructureLines        HrSalaryStructureLine[]
  hrEmployeeSalaryAssignments   HrEmployeeSalaryAssignment[]
`,
  )
}

if (!text.includes('hrSalaryStructures') || !text.includes('LegalEntity')) {
  // LE relation
  if (!text.includes('hrSalaryStructures     HrSalaryStructure[]')) {
    text = text.replace(
      '  hrOvertimePolicies HrOvertimePolicy[]\n\n  @@unique([tenantId, code])',
      `  hrOvertimePolicies HrOvertimePolicy[]
  hrSalaryStructures HrSalaryStructure[]
  hrSalaryComponents HrSalaryComponent[]

  @@unique([tenantId, code])`,
    )
  }
}

if (!text.includes('salaryAssignments')) {
  text = text.replace(
    '  overtimeRecords   HrOvertimeRecord[]\n\n  @@unique([tenantId, employeeCode])',
    `  overtimeRecords   HrOvertimeRecord[]
  salaryAssignments HrEmployeeSalaryAssignment[]

  @@unique([tenantId, employeeCode])`,
  )
}

const block = `

// HRMS Phase 6 — Salary Components + Structures (config only; no payroll calc)

enum HrSalaryComponentType {
  EARNING
  DEDUCTION
  EMPLOYER_CONTRIBUTION
}

enum HrSalaryCalculationType {
  FIXED
  PERCENTAGE
  ATTENDANCE_LINKED
  OT_LINKED
  STATUTORY
}

enum HrSalaryStructureVersionStatus {
  DRAFT
  ACTIVE
  SUPERSEDED
}

enum HrEmployeeSalaryAssignmentStatus {
  DRAFT
  ACTIVE
  CLOSED
  CANCELLED
}

model HrSalaryComponent {
  id               String                   @id @default(uuid())
  tenantId         String
  legalEntityId    String?
  code             String                   @db.VarChar(32)
  name             String                   @db.VarChar(150)
  type             HrSalaryComponentType
  calculationType  HrSalaryCalculationType
  taxable          Boolean                  @default(true)
  affectsGross     Boolean                  @default(true)
  affectsNet       Boolean                  @default(true)
  isActive         Boolean                  @default(true)

  createdBy String?
  updatedBy String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  tenant      Tenant       @relation(fields: [tenantId], references: [id])
  legalEntity LegalEntity? @relation(fields: [legalEntityId], references: [id], onDelete: SetNull)
  structureLines HrSalaryStructureLine[] @relation("StructureLineComponent")
  percentageOfLines HrSalaryStructureLine[] @relation("StructureLinePercentageOf")

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([tenantId, legalEntityId])
  @@index([tenantId, deletedAt])
  @@map("hr_salary_components")
}

model HrSalaryStructure {
  id                String            @id @default(uuid())
  tenantId          String
  legalEntityId     String?
  code              String            @db.VarChar(32)
  name              String            @db.VarChar(150)
  description       String?           @db.VarChar(500)
  workerCategory    HrWorkerCategory?
  isActive          Boolean           @default(true)

  createdBy String?
  updatedBy String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  tenant      Tenant       @relation(fields: [tenantId], references: [id])
  legalEntity LegalEntity? @relation(fields: [legalEntityId], references: [id], onDelete: SetNull)
  versions    HrSalaryStructureVersion[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([tenantId, legalEntityId])
  @@index([tenantId, deletedAt])
  @@map("hr_salary_structures")
}

model HrSalaryStructureVersion {
  id                 String                         @id @default(uuid())
  tenantId           String
  salaryStructureId  String
  versionNo          Int
  effectiveFrom      DateTime                       @db.Date
  effectiveTo        DateTime?                      @db.Date
  status             HrSalaryStructureVersionStatus @default(DRAFT)
  createdBy          String?
  approvedByUserId   String?
  approvedAt         DateTime?
  updatedBy          String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  deletedAt          DateTime?

  tenant    Tenant            @relation(fields: [tenantId], references: [id])
  structure HrSalaryStructure @relation(fields: [salaryStructureId], references: [id], onDelete: Cascade)
  lines     HrSalaryStructureLine[]
  assignments HrEmployeeSalaryAssignment[]

  @@unique([salaryStructureId, versionNo])
  @@index([tenantId])
  @@index([tenantId, salaryStructureId])
  @@index([tenantId, status])
  @@index([tenantId, deletedAt])
  @@map("hr_salary_structure_versions")
}

model HrSalaryStructureLine {
  id                       String                   @id @default(uuid())
  tenantId                 String
  versionId                String
  salaryComponentId        String
  sequence                 Int                      @default(10)
  calculationType          HrSalaryCalculationType
  fixedAmount              Decimal?                 @db.Decimal(14, 2)
  percentage               Decimal?                 @db.Decimal(8, 4)
  percentageOfComponentId  String?
  monthlyCap               Decimal?                 @db.Decimal(14, 2)
  annualCap                Decimal?                 @db.Decimal(14, 2)
  isActive                 Boolean                  @default(true)

  createdBy String?
  updatedBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  tenant              Tenant                 @relation(fields: [tenantId], references: [id])
  version             HrSalaryStructureVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  salaryComponent     HrSalaryComponent      @relation("StructureLineComponent", fields: [salaryComponentId], references: [id])
  percentageOfComponent HrSalaryComponent?   @relation("StructureLinePercentageOf", fields: [percentageOfComponentId], references: [id], onDelete: SetNull)

  @@unique([versionId, salaryComponentId])
  @@index([tenantId])
  @@index([tenantId, versionId])
  @@index([tenantId, deletedAt])
  @@map("hr_salary_structure_lines")
}

model HrEmployeeSalaryAssignment {
  id                       String                           @id @default(uuid())
  tenantId                 String
  employeeId               String
  salaryStructureVersionId String
  effectiveFrom            DateTime                         @db.Date
  effectiveTo              DateTime?                        @db.Date
  annualCtc                Decimal?                         @db.Decimal(14, 2)
  monthlyGross             Decimal?                         @db.Decimal(14, 2)
  remarks                  String?                          @db.VarChar(500)
  status                   HrEmployeeSalaryAssignmentStatus @default(ACTIVE)

  createdBy String?
  updatedBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  tenant  Tenant                   @relation(fields: [tenantId], references: [id])
  employee HrEmployee              @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  version  HrSalaryStructureVersion @relation(fields: [salaryStructureVersionId], references: [id])

  @@index([tenantId])
  @@index([tenantId, employeeId])
  @@index([tenantId, employeeId, effectiveFrom])
  @@index([tenantId, salaryStructureVersionId])
  @@index([tenantId, status])
  @@index([tenantId, deletedAt])
  @@map("hr_employee_salary_assignments")
}
`

if (!text.includes('model HrSalaryComponent')) {
  text = text.trimEnd() + block + '\n'
}

fs.writeFileSync(p, text)
console.log('phase6 schema patched')
