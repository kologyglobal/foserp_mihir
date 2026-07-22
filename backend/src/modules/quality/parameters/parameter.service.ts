import type { QualityParameter } from '@prisma/client'
import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import * as repo from './parameter.repository.js'
import type { CreateParameterInput, ListParametersQuery, UpdateParameterInput } from './parameter.schemas.js'

function toDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value == null) return null
  return new Prisma.Decimal(value)
}

function dropdownJson(
  options: string[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (options === undefined) return undefined
  if (options === null) return Prisma.JsonNull
  return options
}

export function mapParameter(row: QualityParameter) {
  return {
    id: row.id,
    parameterCode: row.parameterCode,
    parameterName: row.parameterName,
    parameterType: row.parameterType,
    uomCode: row.uomCode,
    minValue: row.minValue != null ? Number(row.minValue) : null,
    maxValue: row.maxValue != null ? Number(row.maxValue) : null,
    targetValue: row.targetValue != null ? Number(row.targetValue) : null,
    mandatory: row.mandatory,
    severity: row.severity,
    passFailRule: row.passFailRule,
    dropdownOptions: Array.isArray(row.dropdownOptions) ? (row.dropdownOptions as string[]) : null,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function validateTypeRules(input: CreateParameterInput | UpdateParameterInput) {
  const type = input.parameterType
  if (type === 'DROPDOWN' && input.dropdownOptions !== undefined) {
    if (!input.dropdownOptions || input.dropdownOptions.length === 0) {
      throw new ValidationError('dropdownOptions required for DROPDOWN parameters')
    }
  }
  if (type === 'NUMERIC' && input.minValue != null && input.maxValue != null && input.minValue > input.maxValue) {
    throw new ValidationError('minValue cannot exceed maxValue')
  }
}

export async function listParameters(tenantId: string, query: ListParametersQuery) {
  const result = await repo.listParameters(tenantId, query)
  return { ...result, items: result.items.map(mapParameter) }
}

export async function getParameter(tenantId: string, id: string) {
  const row = await repo.getParameter(tenantId, id)
  if (!row) throw new NotFoundError('QC parameter not found')
  return mapParameter(row)
}

export async function createParameter(req: Request, tenantId: string, input: CreateParameterInput) {
  const userId = req.context?.userId ?? ''
  validateTypeRules(input)
  const code = input.parameterCode.trim().toUpperCase()
  const existing = await repo.findByCode(tenantId, code)
  if (existing) throw new ConflictError(`Parameter code ${code} already exists`)

  const row = await prisma.$transaction((tx) =>
    repo.createParameter(tx, {
      tenantId,
      parameterCode: code,
      parameterName: input.parameterName.trim(),
      parameterType: input.parameterType,
      uomCode: input.uomCode ?? null,
      minValue: toDecimal(input.minValue),
      maxValue: toDecimal(input.maxValue),
      targetValue: toDecimal(input.targetValue),
      mandatory: input.mandatory ?? true,
      severity: input.severity ?? 'MAJOR',
      passFailRule: input.passFailRule ?? 'MANUAL',
      dropdownOptions: dropdownJson(input.dropdownOptions ?? null),
      active: input.active ?? true,
      createdBy: userId,
    }),
  )
  return mapParameter(row)
}

export async function updateParameter(req: Request, tenantId: string, id: string, input: UpdateParameterInput) {
  const userId = req.context?.userId ?? ''
  const current = await repo.getParameter(tenantId, id)
  if (!current) throw new NotFoundError('QC parameter not found')
  validateTypeRules({
    parameterType: input.parameterType ?? current.parameterType,
    dropdownOptions: input.dropdownOptions,
    minValue: input.minValue ?? (current.minValue != null ? Number(current.minValue) : null),
    maxValue: input.maxValue ?? (current.maxValue != null ? Number(current.maxValue) : null),
  })

  if (input.parameterCode) {
    const code = input.parameterCode.trim().toUpperCase()
    const clash = await repo.findByCode(tenantId, code, id)
    if (clash) throw new ConflictError(`Parameter code ${code} already exists`)
  }

  const row = await prisma.$transaction((tx) =>
    repo.updateParameter(tx, tenantId, id, {
      ...(input.parameterCode !== undefined ? { parameterCode: input.parameterCode.trim().toUpperCase() } : {}),
      ...(input.parameterName !== undefined ? { parameterName: input.parameterName.trim() } : {}),
      ...(input.parameterType !== undefined ? { parameterType: input.parameterType } : {}),
      ...(input.uomCode !== undefined ? { uomCode: input.uomCode } : {}),
      ...(input.minValue !== undefined ? { minValue: toDecimal(input.minValue) } : {}),
      ...(input.maxValue !== undefined ? { maxValue: toDecimal(input.maxValue) } : {}),
      ...(input.targetValue !== undefined ? { targetValue: toDecimal(input.targetValue) } : {}),
      ...(input.mandatory !== undefined ? { mandatory: input.mandatory } : {}),
      ...(input.severity !== undefined ? { severity: input.severity } : {}),
      ...(input.passFailRule !== undefined ? { passFailRule: input.passFailRule } : {}),
      ...(input.dropdownOptions !== undefined ? { dropdownOptions: dropdownJson(input.dropdownOptions) } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      updatedBy: userId,
    }),
  )
  return mapParameter(row)
}

export async function deactivateParameter(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const current = await repo.getParameter(tenantId, id)
  if (!current) throw new NotFoundError('QC parameter not found')
  const row = await prisma.$transaction((tx) => repo.softDeleteParameter(tx, tenantId, id, userId))
  return mapParameter(row)
}
