/**
 * Phase 9 — multi-GSTIN registration map + transfer policy service.
 */
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import { prisma } from '../../../config/prisma.js'
import { AuthorizationError, NotFoundError, AppError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../shared/finance.helpers.js'
import {
  buildSeriesPrefixHint,
  detectGstinContamination,
  resolveBranchTransferTaxTreatment,
  type BranchTransferTaxPolicy,
} from './gst-registration-scope.util.js'

function hasPerm(req: Request, ...codes: string[]): boolean {
  const perms = req.context?.permissions ?? []
  if (perms.includes('tenant.manage')) return true
  return codes.some((c) => perms.includes(c))
}

function assertAny(req: Request, ...codes: string[]): void {
  if (!hasPerm(req, ...codes)) throw new AuthorizationError(`Missing permission: ${codes.join(' | ')}`)
}

export async function listGstRegistrations(
  req: Request,
  tenantId: string,
  legalEntityId: string,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.setup.manage')
  const le = await getLegalEntityOrThrow(tenantId, legalEntityId)

  const [branches, regs] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId, legalEntityId, isActive: true },
      orderBy: [{ isHeadOffice: 'desc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        gstin: true,
        stateCode: true,
        isHeadOffice: true,
        isDefault: true,
      },
    }),
    prisma.gstRegistration.findMany({
      where: { tenantId, legalEntityId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { gstin: 'asc' }],
    }),
  ])

  const fromMaster = [
    ...(le.gstin
      ? [
          {
            source: 'LEGAL_ENTITY' as const,
            id: le.id,
            legalEntityId: le.id,
            branchId: null as string | null,
            gstin: le.gstin,
            stateCode: le.stateCode,
            isPrimary: true,
            seriesPrefix: buildSeriesPrefixHint({ legalEntityCode: le.code }),
            label: le.displayName || le.legalName,
          },
        ]
      : []),
    ...branches
      .filter((b) => b.gstin)
      .map((b) => ({
        source: 'BRANCH' as const,
        id: b.id,
        legalEntityId: le.id,
        branchId: b.id,
        gstin: b.gstin!,
        stateCode: b.stateCode,
        isPrimary: b.isHeadOffice || b.isDefault,
        seriesPrefix: buildSeriesPrefixHint({
          legalEntityCode: le.code,
          branchCode: b.code,
        }),
        label: `${b.code} · ${b.name}`,
      })),
    ...regs.map((r) => ({
      source: 'REGISTRATION' as const,
      id: r.id,
      legalEntityId: r.legalEntityId,
      branchId: r.branchId,
      gstin: r.gstin,
      stateCode: r.stateCode,
      isPrimary: r.isPrimary,
      seriesPrefix: r.seriesPrefix,
      label: r.gstin,
      registrationType: r.registrationType,
      placeOfSupplyDefault: r.placeOfSupplyDefault,
    })),
  ]

  const contamination = detectGstinContamination(fromMaster.map((m) => m.gstin))

  return {
    legalEntityId: le.id,
    legalEntityCode: le.code,
    branchTransferTaxPolicy: le.branchTransferTaxPolicy as BranchTransferTaxPolicy,
    multiGstin: contamination.distinct.length > 1,
    contamination,
    registrations: fromMaster,
    hardIsolation: process.env.GST_MULTI_GSTIN_ALLOW_LEGACY_ORPHANS !== 'true',
    note: 'Phase 9: ledger/registers/returns filter by companyGstin hard isolation. Branch transfers use LE policy only.',
  }
}

export async function upsertGstRegistration(
  req: Request,
  tenantId: string,
  input: {
    legalEntityId: string
    branchId?: string | null
    gstin: string
    stateCode?: string | null
    registrationType?: string
    isPrimary?: boolean
    seriesPrefix?: string | null
    placeOfSupplyDefault?: string | null
    effectiveFrom: string
    effectiveTo?: string | null
    notes?: string | null
  },
) {
  assertAny(req, 'tax.gst.setup.manage')
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const gstin = input.gstin.trim().toUpperCase()
  if (gstin.length < 15) {
    throw new AppError(422, 'GSTIN must be at least 15 characters', 'GST_REG_INVALID')
  }
  if (input.branchId) {
    const b = await prisma.branch.findFirst({
      where: { id: input.branchId, tenantId, legalEntityId: input.legalEntityId },
    })
    if (!b) throw new NotFoundError('Branch not found for legal entity')
  }

  const row = await prisma.gstRegistration.upsert({
    where: { tenantId_gstin: { tenantId, gstin } },
    create: {
      id: randomUUID(),
      tenantId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      gstin,
      stateCode: input.stateCode ?? null,
      registrationType: input.registrationType ?? 'REGULAR',
      isPrimary: input.isPrimary ?? false,
      seriesPrefix: input.seriesPrefix?.trim() || null,
      placeOfSupplyDefault: input.placeOfSupplyDefault ?? null,
      effectiveFrom: parseDateOnly(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? parseDateOnly(input.effectiveTo) : null,
      notes: input.notes ?? null,
    },
    update: {
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      stateCode: input.stateCode ?? null,
      registrationType: input.registrationType ?? 'REGULAR',
      isPrimary: input.isPrimary ?? false,
      seriesPrefix: input.seriesPrefix?.trim() || null,
      placeOfSupplyDefault: input.placeOfSupplyDefault ?? null,
      effectiveFrom: parseDateOnly(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? parseDateOnly(input.effectiveTo) : null,
      notes: input.notes ?? null,
      isActive: true,
    },
  })
  return row
}

export async function updateBranchTransferPolicy(
  req: Request,
  tenantId: string,
  legalEntityId: string,
  policy: BranchTransferTaxPolicy,
) {
  assertAny(req, 'tax.gst.setup.manage')
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  return prisma.legalEntity.update({
    where: { id: legalEntityId },
    data: { branchTransferTaxPolicy: policy },
    select: {
      id: true,
      code: true,
      branchTransferTaxPolicy: true,
    },
  })
}

export async function evaluateBranchTransfer(
  req: Request,
  tenantId: string,
  input: { legalEntityId: string; fromBranchId: string; toBranchId: string },
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view', 'tax.gst.setup.manage')
  const le = await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const [from, to] = await Promise.all([
    prisma.branch.findFirst({
      where: { id: input.fromBranchId, tenantId, legalEntityId: input.legalEntityId },
    }),
    prisma.branch.findFirst({
      where: { id: input.toBranchId, tenantId, legalEntityId: input.legalEntityId },
    }),
  ])
  if (!from || !to) throw new NotFoundError('Branch not found')
  const treatment = resolveBranchTransferTaxTreatment({
    policy: le.branchTransferTaxPolicy as BranchTransferTaxPolicy,
    fromGstin: from.gstin,
    toGstin: to.gstin,
  })
  return {
    legalEntityId: le.id,
    policy: le.branchTransferTaxPolicy,
    from: { branchId: from.id, code: from.code, gstin: from.gstin },
    to: { branchId: to.id, code: to.code, gstin: to.gstin },
    ...treatment,
  }
}

export async function isolationStatus(
  req: Request,
  tenantId: string,
  legalEntityId: string,
  returnPeriod: string,
) {
  assertAny(req, 'tax.gst.view', 'finance.tax.view')
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  const groups = await prisma.gstLedgerEntry.groupBy({
    by: ['companyGstin'],
    where: { tenantId, legalEntityId, returnPeriod },
    _count: { _all: true },
  })
  const contamination = detectGstinContamination(groups.map((g) => g.companyGstin))
  return {
    legalEntityId,
    returnPeriod,
    groups: groups.map((g) => ({
      companyGstin: g.companyGstin,
      rowCount: g._count._all,
    })),
    contamination,
    hardIsolationDefault: process.env.GST_MULTI_GSTIN_ALLOW_LEGACY_ORPHANS !== 'true',
    note: contamination.contaminated
      ? 'Multiple company GSTINs present in period — always pass companyGstin on registers/returns/payments.'
      : 'Single or unset GSTIN footprint for this period.',
  }
}
