import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { decStatutory } from './wage-basis.service.js'
import type { RegisterQuery } from './statutory.schemas.js'

export const REGISTER_CODES = {
  pf: ['PF_EMPLOYEE', 'PF_EMPLOYER'],
  esic: ['ESIC_EMPLOYEE', 'ESIC_EMPLOYER'],
  pt: ['PT'],
  tds: ['TDS'],
  lwf: ['LWF_EMPLOYEE', 'LWF_EMPLOYER'],
} as const

export type RegisterKind = keyof typeof REGISTER_CODES

function registerScopeWhere(scope: UserDataScope): Prisma.HrEmployeeWhereInput {
  if (scope.unrestricted) return {}
  const and: Prisma.HrEmployeeWhereInput[] = []
  if (scope.legalEntities.length > 0) {
    and.push({ legalEntityId: { in: scope.legalEntities.map((x) => x.legalEntityId) } })
  }
  if (scope.branches.length > 0) {
    and.push({ branchId: { in: scope.branches.map((x) => x.branchId) } })
  }
  return and.length > 0 ? { AND: and } : {}
}

const registerRowInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      displayName: true,
      statutoryDetail: { select: { uan: true, esicNumber: true, pan: true } },
    },
  },
  run: { select: { id: true, code: true, legalEntityId: true, branchId: true, payrollPeriodId: true } },
  components: true,
} satisfies Prisma.HrPayrollEmployeeResultInclude

type RegisterRow = Prisma.HrPayrollEmployeeResultGetPayload<{ include: typeof registerRowInclude }>

async function loadRows(
  tenantId: string,
  kind: RegisterKind,
  scope: UserDataScope,
  query: Pick<RegisterQuery, 'payrollPeriodId' | 'legalEntityId' | 'branchId'>,
): Promise<RegisterRow[]> {
  const codes = REGISTER_CODES[kind] as unknown as string[]

  const where: Prisma.HrPayrollEmployeeResultWhereInput = {
    tenantId,
    status: { in: ['CALCULATED', 'FINALIZED'] },
    ...(query.payrollPeriodId ? { payrollPeriodId: query.payrollPeriodId } : {}),
    run: {
      deletedAt: null,
      ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
    },
    employee: registerScopeWhere(scope),
    components: { some: { componentCode: { in: codes } } },
  }

  const rows = await prisma.hrPayrollEmployeeResult.findMany({
    where,
    include: { ...registerRowInclude, components: { where: { componentCode: { in: codes } } } },
  })

  return rows.sort((a, b) => a.employee.employeeCode.localeCompare(b.employee.employeeCode))
}

function paginate<T>(rows: T[], query: RegisterQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const start = (page - 1) * limit
  return { items: rows.slice(start, start + limit), total: rows.length, page, limit }
}

function componentAmount(row: RegisterRow, code: string): number {
  return decStatutory(row.components.find((c) => c.componentCode === code)?.amount) ?? 0
}

function mapPfRow(row: RegisterRow) {
  return {
    employeeId: row.employee.id,
    employeeCode: row.employee.employeeCode,
    employeeName: row.employee.displayName,
    uan: row.employee.statutoryDetail?.uan ?? null,
    payrollRunId: row.run.id,
    payrollRunCode: row.run.code,
    employeeAmount: componentAmount(row, 'PF_EMPLOYEE'),
    employerAmount: componentAmount(row, 'PF_EMPLOYER'),
  }
}

function mapEsicRow(row: RegisterRow) {
  return {
    employeeId: row.employee.id,
    employeeCode: row.employee.employeeCode,
    employeeName: row.employee.displayName,
    esicNumber: row.employee.statutoryDetail?.esicNumber ?? null,
    payrollRunId: row.run.id,
    payrollRunCode: row.run.code,
    employeeAmount: componentAmount(row, 'ESIC_EMPLOYEE'),
    employerAmount: componentAmount(row, 'ESIC_EMPLOYER'),
  }
}

function mapPtRow(row: RegisterRow) {
  return {
    employeeId: row.employee.id,
    employeeCode: row.employee.employeeCode,
    employeeName: row.employee.displayName,
    payrollRunId: row.run.id,
    payrollRunCode: row.run.code,
    amount: componentAmount(row, 'PT'),
  }
}

function mapTdsRow(row: RegisterRow) {
  const component = row.components.find((c) => c.componentCode === 'TDS')
  return {
    employeeId: row.employee.id,
    employeeCode: row.employee.employeeCode,
    employeeName: row.employee.displayName,
    pan: row.employee.statutoryDetail?.pan ?? null,
    payrollRunId: row.run.id,
    payrollRunCode: row.run.code,
    amount: decStatutory(component?.amount) ?? 0,
    reviewRequired: (component?.notes ?? '').toLowerCase().includes('review') || (component?.notes ?? '').toLowerCase().includes('pending'),
    notes: component?.notes ?? null,
  }
}

function mapLwfRow(row: RegisterRow) {
  return {
    employeeId: row.employee.id,
    employeeCode: row.employee.employeeCode,
    employeeName: row.employee.displayName,
    payrollRunId: row.run.id,
    payrollRunCode: row.run.code,
    employeeAmount: componentAmount(row, 'LWF_EMPLOYEE'),
    employerAmount: componentAmount(row, 'LWF_EMPLOYER'),
  }
}

const ROW_MAPPERS: Record<RegisterKind, (row: RegisterRow) => Record<string, unknown>> = {
  pf: mapPfRow,
  esic: mapEsicRow,
  pt: mapPtRow,
  tds: mapTdsRow,
  lwf: mapLwfRow,
}

export async function getRegister(tenantId: string, kind: RegisterKind, scope: UserDataScope, query: RegisterQuery) {
  const rows = await loadRows(tenantId, kind, scope, query)
  const mapped = rows.map(ROW_MAPPERS[kind])
  return paginate(mapped, query)
}

function csvEscape(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export async function getRegisterCsv(
  tenantId: string,
  kind: RegisterKind,
  scope: UserDataScope,
  query: Pick<RegisterQuery, 'payrollPeriodId' | 'legalEntityId' | 'branchId'>,
): Promise<string> {
  const rows = await loadRows(tenantId, kind, scope, query)
  const mapped = rows.map(ROW_MAPPERS[kind])
  if (mapped.length === 0) return ''

  const headers = Object.keys(mapped[0])
  const lines = [headers.join(',')]
  for (const row of mapped) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','))
  }
  return lines.join('\n')
}
