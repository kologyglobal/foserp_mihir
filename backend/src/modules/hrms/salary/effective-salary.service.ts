import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { toDateOnly } from '../shared/shift-time.util.js'
import { decSalaryAmount } from './salary-component.service.js'
import type { PreviewSalaryInput } from './salary.schemas.js'

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function applyCap(amount: number, monthlyCap: number | null): number {
  if (monthlyCap != null && amount > monthlyCap) return monthlyCap
  return Math.round(amount * 100) / 100
}

const LINKED_NOTES: Record<string, string> = {
  ATTENDANCE_LINKED: 'Resolved at payroll from attendance',
  OT_LINKED: 'Resolved at payroll from overtime',
  STATUTORY: 'Resolved at payroll from statutory rules',
}

interface ResolvedLine {
  salaryComponentId: string
  componentCode: string
  componentName: string
  componentType: string
  calculationType: string
  sequence: number
  amount: number | null
  note: string | null
}

function resolvePreviewLines(
  lines: Array<{
    salaryComponentId: string
    sequence: number
    calculationType: string
    fixedAmount: Prisma.Decimal | null
    percentage: Prisma.Decimal | null
    percentageOfComponentId: string | null
    monthlyCap: Prisma.Decimal | null
    isActive: boolean
    salaryComponent: { code: string; name: string; type: string }
  }>,
): ResolvedLine[] {
  const activeLines = lines.filter((l) => l.isActive).sort((a, b) => a.sequence - b.sequence)
  const amounts = new Map<string, number>()
  const results: ResolvedLine[] = []

  for (const line of activeLines) {
    const base = {
      salaryComponentId: line.salaryComponentId,
      componentCode: line.salaryComponent.code,
      componentName: line.salaryComponent.name,
      componentType: line.salaryComponent.type,
      calculationType: line.calculationType,
      sequence: line.sequence,
      amount: null as number | null,
      note: null as string | null,
    }

    if (line.calculationType === 'FIXED') {
      const fixed = decSalaryAmount(line.fixedAmount) ?? 0
      const amount = applyCap(fixed, decSalaryAmount(line.monthlyCap))
      amounts.set(line.salaryComponentId, amount)
      results.push({ ...base, amount })
    } else if (line.calculationType === 'PERCENTAGE') {
      const pct = decSalaryAmount(line.percentage) ?? 0
      const ofId = line.percentageOfComponentId
      if (!ofId) {
        results.push({ ...base, note: 'Missing percentage base component' })
        continue
      }
      const baseAmount = amounts.get(ofId)
      if (baseAmount == null) {
        results.push({ ...base, note: 'Base component amount not yet resolved' })
        continue
      }
      const raw = (baseAmount * pct) / 100
      const amount = applyCap(raw, decSalaryAmount(line.monthlyCap))
      amounts.set(line.salaryComponentId, amount)
      results.push({ ...base, amount })
    } else {
      results.push({ ...base, note: LINKED_NOTES[line.calculationType] ?? 'Not calculated in preview' })
    }
  }

  return results
}

export async function getEffectiveSalaryStructure(
  tenantId: string,
  employeeId: string,
  dateInput: string | Date,
) {
  const date = toDateOnly(dateInput)

  // Include CLOSED historical assignments — Payroll Phase 7 resolves by date, not only "current".
  const assignment = await prisma.hrEmployeeSalaryAssignment.findFirst({
    where: {
      tenantId,
      employeeId,
      status: { in: ['ACTIVE', 'CLOSED'] },
      deletedAt: null,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    include: {
      version: {
        include: {
          structure: true,
          lines: {
            where: { deletedAt: null, isActive: true },
            orderBy: [{ sequence: 'asc' }],
            include: {
              salaryComponent: {
                select: { id: true, code: true, name: true, type: true, calculationType: true, isActive: true },
              },
              percentageOfComponent: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
  })

  if (!assignment) {
    throw new NotFoundError('No salary assignment found for employee on the given date')
  }

  const { version } = assignment
  // Historical assignments may still point at SUPERSEDED versions after a later activate.
  if (version.status !== 'ACTIVE' && version.status !== 'SUPERSEDED') {
    throw new ValidationError('Assigned salary structure version is not usable (must be ACTIVE or SUPERSEDED)')
  }

  return {
    employeeId,
    date: formatDateOnly(date),
    assignment: {
      id: assignment.id,
      effectiveFrom: formatDateOnly(assignment.effectiveFrom),
      effectiveTo: assignment.effectiveTo ? formatDateOnly(assignment.effectiveTo) : null,
      annualCtc: decSalaryAmount(assignment.annualCtc),
      monthlyGross: decSalaryAmount(assignment.monthlyGross),
      status: assignment.status,
    },
    structure: {
      id: version.structure.id,
      code: version.structure.code,
      name: version.structure.name,
      legalEntityId: version.structure.legalEntityId,
      workerCategory: version.structure.workerCategory,
    },
    version: {
      id: version.id,
      versionNo: version.versionNo,
      effectiveFrom: formatDateOnly(version.effectiveFrom),
      effectiveTo: version.effectiveTo ? formatDateOnly(version.effectiveTo) : null,
      status: version.status,
    },
    lines: version.lines.map((l) => ({
      id: l.id,
      salaryComponentId: l.salaryComponentId,
      sequence: l.sequence,
      calculationType: l.calculationType,
      fixedAmount: decSalaryAmount(l.fixedAmount),
      percentage: decSalaryAmount(l.percentage),
      percentageOfComponentId: l.percentageOfComponentId,
      monthlyCap: decSalaryAmount(l.monthlyCap),
      annualCap: decSalaryAmount(l.annualCap),
      salaryComponent: l.salaryComponent,
      percentageOfComponent: l.percentageOfComponent,
    })),
  }
}

export async function previewSalary(tenantId: string, input: PreviewSalaryInput) {
  const effectiveDate = toDateOnly(input.effectiveDate)

  const version = await prisma.hrSalaryStructureVersion.findFirst({
    where: { id: input.salaryStructureVersionId, tenantId, deletedAt: null },
    include: {
      structure: true,
      lines: {
        where: { deletedAt: null },
        orderBy: [{ sequence: 'asc' }],
        include: {
          salaryComponent: { select: { code: true, name: true, type: true } },
        },
      },
    },
  })
  if (!version) throw new NotFoundError('Salary structure version not found')

  let assignmentContext: {
    employeeId: string
    annualCtc: number | null
    monthlyGross: number | null
  } | null = null

  if (input.employeeId) {
    const assignment = await prisma.hrEmployeeSalaryAssignment.findFirst({
      where: {
        tenantId,
        employeeId: input.employeeId,
        salaryStructureVersionId: version.id,
        status: 'ACTIVE',
        deletedAt: null,
        effectiveFrom: { lte: effectiveDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveDate } }],
      },
    })
    assignmentContext = {
      employeeId: input.employeeId,
      annualCtc: decSalaryAmount(assignment?.annualCtc ?? null),
      monthlyGross: decSalaryAmount(assignment?.monthlyGross ?? null),
    }
  }

  const components = resolvePreviewLines(version.lines)
  const totalEarnings = components
    .filter((c) => c.componentType === 'EARNING' && c.amount != null)
    .reduce((s, c) => s + (c.amount ?? 0), 0)
  const totalDeductions = components
    .filter((c) => c.componentType === 'DEDUCTION' && c.amount != null)
    .reduce((s, c) => s + (c.amount ?? 0), 0)

  return {
    effectiveDate: formatDateOnly(effectiveDate),
    salaryStructureVersionId: version.id,
    structure: {
      id: version.structure.id,
      code: version.structure.code,
      name: version.structure.name,
    },
    employee: assignmentContext,
    components,
    summary: {
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      estimatedNet: Math.round((totalEarnings - totalDeductions) * 100) / 100,
    },
  }
}
