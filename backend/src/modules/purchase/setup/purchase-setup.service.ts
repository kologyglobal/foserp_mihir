import type { CodeSeriesEntity, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import {
  ensureCodeSeries,
  previewNextCode,
} from '../../../services/codeSeries.service.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  PurchaseSetupValidationError,
  PurchaseSetupVersionConflictError,
} from './purchase-setup.errors.js'
import {
  docTypeFromApi,
  gstFromApi,
  mapPurchasePlantSettingsToDto,
  mapPurchaseSettingsToDto,
  NUMBER_SERIES_ENTITY_MAP,
  orientationFromApi,
  paperFromApi,
  roleFromApi,
  roundOffFromApi,
  type NumberSeriesDto,
  type NumberSeriesKey,
} from './purchase-setup.mapper.js'
import * as repo from './purchase-setup.repository.js'
import {
  emptyToNull,
  type PatchPurchaseSetupInput,
  type UpsertPurchasePlantSetupInput,
  type UpsertPurchaseSetupInput,
} from './purchase-setup.validation.js'

async function assertActivePlant(tenantId: string, plantId: string | null | undefined, field: string) {
  if (!plantId) return null
  const plant = await prisma.masterPlant.findFirst({
    where: { id: plantId, ...tenantActiveFilter(tenantId), status: 'ACTIVE' },
  })
  if (!plant) {
    throw new PurchaseSetupValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.SETUP_VALIDATION_FAILED),
      PURCHASE_ERROR_CODE.SETUP_VALIDATION_FAILED,
      [{ field, message: 'Plant not found or inactive' }],
    )
  }
  return plant
}

async function assertActiveWarehouse(
  tenantId: string,
  warehouseId: string | null | undefined,
  field: string,
  plantId?: string | null,
) {
  if (!warehouseId) return null
  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { id: warehouseId, ...tenantActiveFilter(tenantId), status: 'ACTIVE' },
  })
  if (!warehouse) {
    throw new PurchaseSetupValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.SETUP_WAREHOUSE_INACTIVE),
      PURCHASE_ERROR_CODE.SETUP_WAREHOUSE_INACTIVE,
      [{ field, message: purchaseMessage(PURCHASE_ERROR_CODE.SETUP_WAREHOUSE_INACTIVE) }],
    )
  }
  if (plantId && warehouse.plantId && warehouse.plantId !== plantId) {
    throw new PurchaseSetupValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.SETUP_PLANT_WAREHOUSE_MISMATCH),
      PURCHASE_ERROR_CODE.SETUP_PLANT_WAREHOUSE_MISMATCH,
      [{ field, message: purchaseMessage(PURCHASE_ERROR_CODE.SETUP_PLANT_WAREHOUSE_MISMATCH) }],
    )
  }
  return warehouse
}

async function assertLocationUnderWarehouse(
  tenantId: string,
  locationId: string | null | undefined,
  warehouseId: string | null | undefined,
  field: string,
) {
  if (!locationId) return null
  if (!warehouseId) {
    throw new PurchaseSetupValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.SETUP_LOCATION_WAREHOUSE_MISMATCH),
      PURCHASE_ERROR_CODE.SETUP_LOCATION_WAREHOUSE_MISMATCH,
      [{ field, message: 'Set a default warehouse before selecting a storage location.' }],
    )
  }
  const location = await prisma.masterLocation.findFirst({
    where: {
      id: locationId,
      warehouseId,
      ...tenantActiveFilter(tenantId),
      status: 'ACTIVE',
    },
  })
  if (!location) {
    throw new PurchaseSetupValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.SETUP_LOCATION_WAREHOUSE_MISMATCH),
      PURCHASE_ERROR_CODE.SETUP_LOCATION_WAREHOUSE_MISMATCH,
      [{ field, message: purchaseMessage(PURCHASE_ERROR_CODE.SETUP_LOCATION_WAREHOUSE_MISMATCH) }],
    )
  }
  return location
}

async function assertPaymentTerm(
  tenantId: string,
  code: string | null | undefined,
  name: string | null | undefined,
) {
  if (!code) return { code: null, name: null }
  const term = await prisma.crmMaster.findFirst({
    where: {
      tenantId,
      kind: 'payment-terms',
      code,
      deletedAt: null,
      status: 'active',
    },
  })
  if (!term) {
    throw new PurchaseSetupValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.SETUP_PAYMENT_TERM_INVALID),
      PURCHASE_ERROR_CODE.SETUP_PAYMENT_TERM_INVALID,
      [
        {
          field: 'general.defaultPaymentTermCode',
          message: purchaseMessage(PURCHASE_ERROR_CODE.SETUP_PAYMENT_TERM_INVALID),
        },
      ],
    )
  }
  return { code: term.code, name: name?.trim() || term.name }
}

function validateApprovalBands(
  tiers: NonNullable<UpsertPurchaseSetupInput['approvalMatrix']>,
) {
  const active = [...tiers].filter((t) => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  for (const tier of active) {
    if (tier.maxAmount != null && tier.maxAmount < tier.minAmount) {
      throw new PurchaseSetupValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.SETUP_VALIDATION_FAILED),
        PURCHASE_ERROR_CODE.SETUP_VALIDATION_FAILED,
        [
          {
            field: 'approvalMatrix',
            message: `Tier "${tier.label}" has maxAmount less than minAmount.`,
          },
        ],
      )
    }
  }
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!
      const b = active[j]!
      const aMax = a.maxAmount ?? Number.POSITIVE_INFINITY
      const bMax = b.maxAmount ?? Number.POSITIVE_INFINITY
      const overlaps = a.minAmount <= bMax && b.minAmount <= aMax
      if (overlaps && (a.documentType ?? 'all') === (b.documentType ?? 'all')) {
        throw new PurchaseSetupValidationError(
          purchaseMessage(PURCHASE_ERROR_CODE.SETUP_VALIDATION_FAILED),
          PURCHASE_ERROR_CODE.SETUP_VALIDATION_FAILED,
          [
            {
              field: 'approvalMatrix',
              message: `Approval tiers "${a.label}" and "${b.label}" overlap for the same document type.`,
            },
          ],
        )
      }
    }
  }
}

async function loadNumberSeriesDto(tenantId: string): Promise<NumberSeriesDto> {
  const entries = Object.entries(NUMBER_SERIES_ENTITY_MAP) as Array<[NumberSeriesKey, CodeSeriesEntity]>
  const result = {} as NumberSeriesDto
  for (const [key, entityType] of entries) {
    await ensureCodeSeries(tenantId, entityType)
    const series = await prisma.codeSeries.findUnique({
      where: { tenantId_entityType: { tenantId, entityType } },
    })
    const nextPreview = await previewNextCode(tenantId, entityType)
    const nextNumber = series ? series.currentValue + 1 : 1
    result[key] = {
      prefix: series?.prefix ?? nextPreview.split('-')[0] ?? key,
      padLength: series?.padLength ?? 6,
      nextNumber,
    }
  }
  return result
}

async function applyNumberSeriesUpdates(
  tenantId: string,
  numberSeries: UpsertPurchaseSetupInput['numberSeries'],
  tx: Prisma.TransactionClient,
) {
  if (!numberSeries) return
  for (const [key, config] of Object.entries(numberSeries) as Array<
    [NumberSeriesKey, { prefix: string; padLength: number } | undefined]
  >) {
    if (!config) continue
    const entityType = NUMBER_SERIES_ENTITY_MAP[key]
    await ensureCodeSeries(tenantId, entityType, tx)
    const existing = await tx.codeSeries.findUnique({
      where: { tenantId_entityType: { tenantId, entityType } },
    })
    if (!existing) continue
    // Never rewind currentValue — only prefix / padLength are editable.
    await tx.codeSeries.update({
      where: { id: existing.id },
      data: {
        prefix: config.prefix.trim().toUpperCase(),
        padLength: config.padLength,
      },
    })
  }
}

async function validateSetupRefs(
  tenantId: string,
  input: UpsertPurchaseSetupInput,
  current: Awaited<ReturnType<typeof repo.findPurchaseSettings>>,
) {
  const g = input.general
  const plantId =
    g?.defaultPlantId !== undefined
      ? emptyToNull(g.defaultPlantId)
      : current?.defaultPlantId ?? null
  const warehouseId =
    g?.defaultWarehouseId !== undefined
      ? emptyToNull(g.defaultWarehouseId)
      : current?.defaultWarehouseId ?? null

  await assertActivePlant(tenantId, plantId, 'general.defaultPlantId')
  await assertActiveWarehouse(tenantId, warehouseId, 'general.defaultWarehouseId', plantId)

  const requisitionWarehouseId =
    input.requisition?.defaultWarehouseId !== undefined
      ? emptyToNull(input.requisition.defaultWarehouseId)
      : current?.defaultRequisitionWarehouseId ?? null
  await assertActiveWarehouse(
    tenantId,
    requisitionWarehouseId,
    'requisition.defaultWarehouseId',
  )

  const receivingId =
    input.receiving?.defaultReceivingLocationId !== undefined
      ? emptyToNull(input.receiving.defaultReceivingLocationId)
      : current?.defaultReceivingLocationId ?? null
  const qcHoldId =
    input.quality?.defaultQualityHoldLocationId !== undefined
      ? emptyToNull(input.quality.defaultQualityHoldLocationId)
      : current?.defaultQualityHoldLocationId ?? null
  const rejectedId =
    input.quality?.defaultRejectedLocationId !== undefined
      ? emptyToNull(input.quality.defaultRejectedLocationId)
      : current?.defaultRejectedLocationId ?? null
  const vendorReturnId =
    input.quality?.defaultVendorReturnLocationId !== undefined
      ? emptyToNull(input.quality.defaultVendorReturnLocationId)
      : current?.defaultVendorReturnLocationId ?? null

  await assertLocationUnderWarehouse(
    tenantId,
    receivingId,
    warehouseId,
    'receiving.defaultReceivingLocationId',
  )
  await assertLocationUnderWarehouse(
    tenantId,
    qcHoldId,
    warehouseId,
    'quality.defaultQualityHoldLocationId',
  )
  await assertLocationUnderWarehouse(
    tenantId,
    rejectedId,
    warehouseId,
    'quality.defaultRejectedLocationId',
  )
  await assertLocationUnderWarehouse(
    tenantId,
    vendorReturnId,
    warehouseId,
    'quality.defaultVendorReturnLocationId',
  )

  if (g?.defaultPaymentTermCode !== undefined) {
    await assertPaymentTerm(
      tenantId,
      emptyToNull(g.defaultPaymentTermCode),
      g.defaultPaymentTerms ?? current?.defaultPaymentTermName,
    )
  }

  const buyerId =
    g?.defaultBuyerId !== undefined ? emptyToNull(g.defaultBuyerId) : current?.defaultBuyerId
  if (buyerId) {
    const user = await prisma.user.findFirst({
      where: { id: buyerId, tenantId, deletedAt: null, status: 'ACTIVE' },
    })
    if (!user) {
      throw new PurchaseSetupValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.SETUP_VALIDATION_FAILED),
        PURCHASE_ERROR_CODE.SETUP_VALIDATION_FAILED,
        [{ field: 'general.defaultBuyerId', message: 'Buyer user not found or inactive' }],
      )
    }
  }

  if (input.approvalMatrix) validateApprovalBands(input.approvalMatrix)
}

function mergeScalarData(
  input: UpsertPurchaseSetupInput,
  payment: { code: string | null; name: string | null },
  forCreate: boolean,
): Prisma.PurchaseSettingsUncheckedCreateInput | Prisma.PurchaseSettingsUncheckedUpdateInput {
  const g = input.general
  const r = input.requisition
  const recv = input.receiving
  const q = input.quality
  const tax = input.tax
  const match = input.invoiceMatchTolerances
  const print = input.print
  const defaults = repo.SERVER_DEFAULT_SETUP

  const data: Record<string, unknown> = {}

  const set = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value
  }

  if (forCreate) {
    Object.assign(data, {
      defaultPlantId: emptyToNull(g?.defaultPlantId) ?? defaults.defaultPlantId,
      defaultWarehouseId: emptyToNull(g?.defaultWarehouseId) ?? defaults.defaultWarehouseId,
      defaultRequisitionWarehouseId:
        emptyToNull(r?.defaultWarehouseId) ?? defaults.defaultRequisitionWarehouseId,
      defaultReceivingLocationId:
        emptyToNull(recv?.defaultReceivingLocationId) ?? defaults.defaultReceivingLocationId,
      defaultQualityHoldLocationId:
        emptyToNull(q?.defaultQualityHoldLocationId) ?? defaults.defaultQualityHoldLocationId,
      defaultRejectedLocationId:
        emptyToNull(q?.defaultRejectedLocationId) ?? defaults.defaultRejectedLocationId,
      defaultVendorReturnLocationId:
        emptyToNull(q?.defaultVendorReturnLocationId) ?? defaults.defaultVendorReturnLocationId,
      defaultCurrencyCode: g?.defaultCurrency ?? defaults.defaultCurrencyCode,
      defaultPaymentTermCode: payment.code,
      defaultPaymentTermName: payment.name,
      defaultDeliveryTerms: g?.defaultDeliveryTerms ?? defaults.defaultDeliveryTerms,
      defaultBuyerId: emptyToNull(g?.defaultBuyerId) ?? defaults.defaultBuyerId,
      defaultRfqRequired: r?.skipRfq != null ? !r.skipRfq : defaults.defaultRfqRequired,
      allowDirectPo: g?.allowDirectPo ?? defaults.allowDirectPo,
      requirePrBeforePo: g?.requirePrBeforePo ?? defaults.requirePrBeforePo,
      requireRfqAboveAmount:
        g?.requireRfqAboveAmountInr != null && g.requireRfqAboveAmountInr > 0
          ? g.requireRfqAboveAmountInr
          : null,
      minimumRfqVendorCount: g?.minimumRfqVendorCount ?? defaults.minimumRfqVendorCount,
      requireQuotationComparison:
        g?.requireQuotationComparison ?? defaults.requireQuotationComparison,
      requirePoWarehouse: g?.requirePoWarehouse ?? defaults.requirePoWarehouse,
      requireExpectedDeliveryDate:
        g?.requireExpectedDeliveryDate ?? defaults.requireExpectedDeliveryDate,
      requirePaymentTerms: g?.requirePaymentTerms ?? defaults.requirePaymentTerms,
      allowOverReceipt: g?.allowOverReceipt ?? defaults.allowOverReceipt,
      overReceiptTolerancePct: g?.overReceiptTolerancePct ?? defaults.overReceiptTolerancePct,
      allowShortClose: g?.allowShortClose ?? defaults.allowShortClose,
      requireVendorChallan: recv?.requireVendorChallan ?? defaults.requireVendorChallan,
      requireVehicleNumber: recv?.requireVehicleNumber ?? defaults.requireVehicleNumber,
      requireGateEntry: recv?.requireGateEntry ?? defaults.requireGateEntry,
      requireBatch: recv?.requireBatch ?? defaults.requireBatch,
      requireSerial: recv?.requireSerial ?? defaults.requireSerial,
      requireExpiry: recv?.requireExpiry ?? defaults.requireExpiry,
      duplicateChallanPolicy: recv?.duplicateChallanPolicy ?? defaults.duplicateChallanPolicy,
      autoCreateQualityInspection:
        recv?.autoCreateInspection ?? defaults.autoCreateQualityInspection,
      autoCompleteRef: r?.autoCompleteRef ?? defaults.autoCompleteRef,
      allowAcceptanceUnderDeviation:
        q?.allowAcceptanceUnderDeviation ?? defaults.allowAcceptanceUnderDeviation,
      deviationApproverRole: q?.deviationApproverRole
        ? roleFromApi(q.deviationApproverRole)
        : defaults.deviationApproverRole,
      allowRejectedStockInQuarantine:
        q?.allowRejectedStockInQuarantine ?? defaults.allowRejectedStockInQuarantine,
      allowDirectInvoice: input.allowDirectInvoice ?? defaults.allowDirectInvoice,
      requirePoMatch: match?.requirePoMatch ?? defaults.requirePoMatch,
      requireGrnMatch: match?.requireGrnMatch ?? defaults.requireGrnMatch,
      quantityTolerancePct: match?.quantityTolerancePct ?? defaults.quantityTolerancePct,
      rateTolerancePct: match?.rateTolerancePct ?? defaults.rateTolerancePct,
      amountToleranceInr: match?.amountToleranceInr ?? defaults.amountToleranceInr,
      amountTolerancePct: match?.amountTolerancePct ?? defaults.amountTolerancePct,
      taxToleranceInr: match?.taxToleranceInr ?? defaults.taxToleranceInr,
      taxTolerancePct: match?.taxTolerancePct ?? defaults.taxTolerancePct,
      allowAuthorizedOverride:
        match?.allowAuthorizedOverride ?? defaults.allowAuthorizedOverride,
      defaultGstScheme: tax?.defaultGstScheme
        ? gstFromApi(tax.defaultGstScheme)
        : defaults.defaultGstScheme,
      placeOfSupplyState: tax?.placeOfSupplyState ?? defaults.placeOfSupplyState,
      placeOfSupplyStateCode: tax?.placeOfSupplyStateCode ?? defaults.placeOfSupplyStateCode,
      reverseChargeDefault: tax?.reverseChargeDefault ?? defaults.reverseChargeDefault,
      tcsEnabled: tax?.tcsEnabled ?? defaults.tcsEnabled,
      tdsEnabled: tax?.tdsEnabled ?? defaults.tdsEnabled,
      roundOffRule: tax?.roundOffRule ? roundOffFromApi(tax.roundOffRule) : defaults.roundOffRule,
      printCompanyName: print?.companyName ?? defaults.printCompanyName,
      printLogoUrl:
        emptyToNull(print?.logoUrl ?? print?.logoPlaceholderUrl) ?? defaults.printLogoUrl,
      showTermsOnPo: print?.showTermsOnPo ?? defaults.showTermsOnPo,
      showTermsOnGrn: print?.showTermsOnGrn ?? defaults.showTermsOnGrn,
      showTermsOnInvoice: print?.showTermsOnInvoice ?? defaults.showTermsOnInvoice,
      printDefaultCopies: print?.defaultCopies ?? defaults.printDefaultCopies,
      printPaperSize: print?.paperSize ? paperFromApi(print.paperSize) : defaults.printPaperSize,
      printOrientation: print?.orientation
        ? orientationFromApi(print.orientation)
        : defaults.printOrientation,
      selfApprovalPolicy: input.selfApprovalPolicy ?? defaults.selfApprovalPolicy,
    })
    return data
  }

  if (g) {
    if (g.defaultPlantId !== undefined) set('defaultPlantId', emptyToNull(g.defaultPlantId))
    if (g.defaultWarehouseId !== undefined)
      set('defaultWarehouseId', emptyToNull(g.defaultWarehouseId))
    if (g.defaultBuyerId !== undefined) set('defaultBuyerId', emptyToNull(g.defaultBuyerId))
    if (g.defaultCurrency !== undefined) set('defaultCurrencyCode', g.defaultCurrency)
    if (g.defaultDeliveryTerms !== undefined) set('defaultDeliveryTerms', g.defaultDeliveryTerms)
    if (g.allowDirectPo !== undefined) set('allowDirectPo', g.allowDirectPo)
    if (g.requirePrBeforePo !== undefined) set('requirePrBeforePo', g.requirePrBeforePo)
    if (g.requireRfqAboveAmountInr !== undefined) {
      set(
        'requireRfqAboveAmount',
        g.requireRfqAboveAmountInr > 0 ? g.requireRfqAboveAmountInr : null,
      )
    }
    if (g.minimumRfqVendorCount !== undefined)
      set('minimumRfqVendorCount', g.minimumRfqVendorCount)
    if (g.requireQuotationComparison !== undefined)
      set('requireQuotationComparison', g.requireQuotationComparison)
    if (g.allowOverReceipt !== undefined) set('allowOverReceipt', g.allowOverReceipt)
    if (g.overReceiptTolerancePct !== undefined)
      set('overReceiptTolerancePct', g.overReceiptTolerancePct)
    if (g.allowShortClose !== undefined) set('allowShortClose', g.allowShortClose)
    if (g.requirePoWarehouse !== undefined) set('requirePoWarehouse', g.requirePoWarehouse)
    if (g.requireExpectedDeliveryDate !== undefined)
      set('requireExpectedDeliveryDate', g.requireExpectedDeliveryDate)
    if (g.requirePaymentTerms !== undefined) set('requirePaymentTerms', g.requirePaymentTerms)
  }
  set('defaultPaymentTermCode', payment.code)
  set('defaultPaymentTermName', payment.name)

  if (r) {
    if (r.defaultWarehouseId !== undefined)
      set('defaultRequisitionWarehouseId', emptyToNull(r.defaultWarehouseId))
    if (r.skipRfq !== undefined) set('defaultRfqRequired', !r.skipRfq)
    if (r.autoCompleteRef !== undefined) set('autoCompleteRef', r.autoCompleteRef)
  }
  if (recv) {
    if (recv.requireGateEntry !== undefined) set('requireGateEntry', recv.requireGateEntry)
    if (recv.requireVendorChallan !== undefined)
      set('requireVendorChallan', recv.requireVendorChallan)
    if (recv.requireVehicleNumber !== undefined)
      set('requireVehicleNumber', recv.requireVehicleNumber)
    if (recv.requireBatch !== undefined) set('requireBatch', recv.requireBatch)
    if (recv.requireSerial !== undefined) set('requireSerial', recv.requireSerial)
    if (recv.requireExpiry !== undefined) set('requireExpiry', recv.requireExpiry)
    if (recv.autoCreateInspection !== undefined)
      set('autoCreateQualityInspection', recv.autoCreateInspection)
    if (recv.defaultReceivingLocationId !== undefined)
      set('defaultReceivingLocationId', emptyToNull(recv.defaultReceivingLocationId))
    if (recv.duplicateChallanPolicy !== undefined)
      set('duplicateChallanPolicy', recv.duplicateChallanPolicy)
  }
  if (q) {
    if (q.allowAcceptanceUnderDeviation !== undefined)
      set('allowAcceptanceUnderDeviation', q.allowAcceptanceUnderDeviation)
    if (q.deviationApproverRole !== undefined)
      set('deviationApproverRole', roleFromApi(q.deviationApproverRole))
    if (q.allowRejectedStockInQuarantine !== undefined)
      set('allowRejectedStockInQuarantine', q.allowRejectedStockInQuarantine)
    if (q.defaultQualityHoldLocationId !== undefined)
      set('defaultQualityHoldLocationId', emptyToNull(q.defaultQualityHoldLocationId))
    if (q.defaultRejectedLocationId !== undefined)
      set('defaultRejectedLocationId', emptyToNull(q.defaultRejectedLocationId))
    if (q.defaultVendorReturnLocationId !== undefined)
      set('defaultVendorReturnLocationId', emptyToNull(q.defaultVendorReturnLocationId))
  }
  if (input.allowDirectInvoice !== undefined) set('allowDirectInvoice', input.allowDirectInvoice)
  if (match) {
    if (match.requirePoMatch !== undefined) set('requirePoMatch', match.requirePoMatch)
    if (match.requireGrnMatch !== undefined) set('requireGrnMatch', match.requireGrnMatch)
    if (match.quantityTolerancePct !== undefined)
      set('quantityTolerancePct', match.quantityTolerancePct)
    if (match.rateTolerancePct !== undefined) set('rateTolerancePct', match.rateTolerancePct)
    if (match.amountToleranceInr !== undefined) set('amountToleranceInr', match.amountToleranceInr)
    if (match.amountTolerancePct !== undefined) set('amountTolerancePct', match.amountTolerancePct)
    if (match.taxToleranceInr !== undefined) set('taxToleranceInr', match.taxToleranceInr)
    if (match.taxTolerancePct !== undefined) set('taxTolerancePct', match.taxTolerancePct)
    if (match.allowAuthorizedOverride !== undefined)
      set('allowAuthorizedOverride', match.allowAuthorizedOverride)
  }
  if (tax) {
    if (tax.defaultGstScheme !== undefined) set('defaultGstScheme', gstFromApi(tax.defaultGstScheme))
    if (tax.placeOfSupplyState !== undefined) set('placeOfSupplyState', tax.placeOfSupplyState)
    if (tax.placeOfSupplyStateCode !== undefined)
      set('placeOfSupplyStateCode', tax.placeOfSupplyStateCode)
    if (tax.reverseChargeDefault !== undefined)
      set('reverseChargeDefault', tax.reverseChargeDefault)
    if (tax.tcsEnabled !== undefined) set('tcsEnabled', tax.tcsEnabled)
    if (tax.tdsEnabled !== undefined) set('tdsEnabled', tax.tdsEnabled)
    if (tax.roundOffRule !== undefined) set('roundOffRule', roundOffFromApi(tax.roundOffRule))
  }
  if (print) {
    if (print.companyName !== undefined) set('printCompanyName', print.companyName)
    if (print.logoUrl !== undefined || print.logoPlaceholderUrl !== undefined) {
      set('printLogoUrl', emptyToNull(print.logoUrl ?? print.logoPlaceholderUrl))
    }
    if (print.showTermsOnPo !== undefined) set('showTermsOnPo', print.showTermsOnPo)
    if (print.showTermsOnGrn !== undefined) set('showTermsOnGrn', print.showTermsOnGrn)
    if (print.showTermsOnInvoice !== undefined) set('showTermsOnInvoice', print.showTermsOnInvoice)
    if (print.defaultCopies !== undefined) set('printDefaultCopies', print.defaultCopies)
    if (print.paperSize !== undefined) set('printPaperSize', paperFromApi(print.paperSize))
    if (print.orientation !== undefined)
      set('printOrientation', orientationFromApi(print.orientation))
  }
  if (input.selfApprovalPolicy !== undefined) set('selfApprovalPolicy', input.selfApprovalPolicy)

  return data
}

async function toDto(tenantId: string, row: repo.PurchaseSettingsWithRelations | null) {
  const numberSeries = await loadNumberSeriesDto(tenantId)
  return mapPurchaseSettingsToDto(row, numberSeries, { isConfigured: Boolean(row) })
}

export async function getPurchaseSetup(tenantId: string) {
  const row = await repo.findPurchaseSettings(tenantId)
  return toDto(tenantId, row)
}

export async function upsertPurchaseSetup(
  tenantId: string,
  actorId: string,
  input: UpsertPurchaseSetupInput,
) {
  const existing = await repo.findPurchaseSettings(tenantId)
  await validateSetupRefs(tenantId, input, existing)

  const paymentCode =
    input.general?.defaultPaymentTermCode !== undefined
      ? emptyToNull(input.general.defaultPaymentTermCode)
      : existing?.defaultPaymentTermCode ?? null
  const payment =
    input.general?.defaultPaymentTermCode !== undefined
      ? await assertPaymentTerm(
          tenantId,
          paymentCode,
          input.general.defaultPaymentTerms ?? existing?.defaultPaymentTermName,
        )
      : {
          code: existing?.defaultPaymentTermCode ?? null,
          name: existing?.defaultPaymentTermName ?? null,
        }

  if (!existing) {
    const created = await prisma.$transaction(async (tx) => {
      const row = await repo.createPurchaseSettings(
        tenantId,
        actorId,
        mergeScalarData(input, payment, true) as Prisma.PurchaseSettingsUncheckedCreateInput,
        tx,
      )
      if (input.approvalMatrix) {
        await repo.replaceApprovalTiers(
          tenantId,
          row.id,
          input.approvalMatrix.map((t) => ({
            minAmount: t.minAmount,
            maxAmount: t.maxAmount,
            sortOrder: t.sortOrder,
            isActive: t.isActive,
            label: t.label,
            documentType: docTypeFromApi(t.documentType),
            roles: t.requiredRoles.map(roleFromApi),
          })),
          tx,
        )
      }
      if (input.quality?.inspectionRequiredCategories) {
        await repo.replaceInspectionCategories(
          tenantId,
          row.id,
          input.quality.inspectionRequiredCategories,
          tx,
        )
      }
      await applyNumberSeriesUpdates(tenantId, input.numberSeries, tx)
      return repo.findPurchaseSettings(tenantId, tx)
    })
    if (!created) throw new PurchaseSetupVersionConflictError()
    const dto = await toDto(tenantId, created)
    await writePurchaseAudit({
      tenantId,
      actorId,
      entity: PURCHASE_AUDIT_ENTITY.SETUP,
      entityId: created.id,
      action: PURCHASE_AUDIT_ACTION.SETUP_CREATED,
      newValue: dto,
    })
    return dto
  }

  if (input.version != null && input.version !== existing.version) {
    throw new PurchaseSetupVersionConflictError()
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await repo.updatePurchaseSettings(
      tenantId,
      actorId,
      existing.version,
      mergeScalarData(input, payment, false),
      tx,
    )
    if (!row) return null
    if (input.approvalMatrix) {
      await repo.replaceApprovalTiers(
        tenantId,
        row.id,
        input.approvalMatrix.map((t) => ({
          minAmount: t.minAmount,
          maxAmount: t.maxAmount,
          sortOrder: t.sortOrder,
          isActive: t.isActive,
          label: t.label,
          documentType: docTypeFromApi(t.documentType),
          roles: t.requiredRoles.map(roleFromApi),
        })),
        tx,
      )
    }
    if (input.quality?.inspectionRequiredCategories) {
      await repo.replaceInspectionCategories(
        tenantId,
        row.id,
        input.quality.inspectionRequiredCategories,
        tx,
      )
    }
    await applyNumberSeriesUpdates(tenantId, input.numberSeries, tx)
    return repo.findPurchaseSettings(tenantId, tx)
  })
  if (!updated) throw new PurchaseSetupVersionConflictError()

  const previousDto = await toDto(tenantId, existing)
  const dto = await toDto(tenantId, updated)
  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.SETUP,
    entityId: updated.id,
    action: PURCHASE_AUDIT_ACTION.SETUP_UPDATED,
    previousValue: previousDto,
    newValue: dto,
  })
  return dto
}

export async function patchPurchaseSetup(
  tenantId: string,
  actorId: string,
  input: PatchPurchaseSetupInput,
) {
  return upsertPurchaseSetup(tenantId, actorId, input)
}

export async function listPurchasePlantSetups(tenantId: string) {
  const rows = await repo.listPlantSettings(tenantId)
  return rows.map(mapPurchasePlantSettingsToDto)
}

export async function getPurchasePlantSetup(tenantId: string, plantId: string) {
  await assertActivePlant(tenantId, plantId, 'plantId')
  const row = await repo.findPlantSettings(tenantId, plantId)
  if (!row) {
    return {
      id: null,
      tenantId,
      plantId,
      defaultWarehouseId: null,
      defaultReceivingLocationId: null,
      defaultQualityHoldLocationId: null,
      defaultRejectedLocationId: null,
      defaultVendorReturnLocationId: null,
      isConfigured: false,
      createdAt: null,
      updatedAt: null,
      createdById: null,
      updatedById: null,
    }
  }
  return { ...mapPurchasePlantSettingsToDto(row), isConfigured: true }
}

export async function upsertPurchasePlantSetup(
  tenantId: string,
  plantId: string,
  actorId: string,
  input: UpsertPurchasePlantSetupInput,
) {
  await assertActivePlant(tenantId, plantId, 'plantId')
  const warehouse = await assertActiveWarehouse(
    tenantId,
    input.defaultWarehouseId,
    'defaultWarehouseId',
    plantId,
  )
  const warehouseId = warehouse?.id ?? input.defaultWarehouseId ?? null
  await assertLocationUnderWarehouse(
    tenantId,
    input.defaultReceivingLocationId,
    warehouseId,
    'defaultReceivingLocationId',
  )
  await assertLocationUnderWarehouse(
    tenantId,
    input.defaultQualityHoldLocationId,
    warehouseId,
    'defaultQualityHoldLocationId',
  )
  await assertLocationUnderWarehouse(
    tenantId,
    input.defaultRejectedLocationId,
    warehouseId,
    'defaultRejectedLocationId',
  )
  await assertLocationUnderWarehouse(
    tenantId,
    input.defaultVendorReturnLocationId,
    warehouseId,
    'defaultVendorReturnLocationId',
  )

  const saved = await repo.upsertPlantSettings(tenantId, plantId, actorId, {
    defaultWarehouseId: input.defaultWarehouseId ?? null,
    defaultReceivingLocationId: input.defaultReceivingLocationId ?? null,
    defaultQualityHoldLocationId: input.defaultQualityHoldLocationId ?? null,
    defaultRejectedLocationId: input.defaultRejectedLocationId ?? null,
    defaultVendorReturnLocationId: input.defaultVendorReturnLocationId ?? null,
  })
  return { ...mapPurchasePlantSettingsToDto(saved), isConfigured: true }
}
