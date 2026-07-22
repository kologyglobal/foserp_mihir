import type { DefaultAccountMappingKey, ProductionAccountingEventType } from '@prisma/client'
import { ValidationError } from '../../../utils/errors.js'
import { formatForPersistence } from '../../accounting/shared/finance-decimal.js'
import type { PostingRequest } from '../../accounting/posting/posting.types.js'

type MappingPair = { debit: DefaultAccountMappingKey; credit: DefaultAccountMappingKey }

const EVENT_MAPPINGS: Partial<Record<ProductionAccountingEventType, MappingPair>> = {
  MATERIAL_ISSUED: { debit: 'WIP_INVENTORY', credit: 'RAW_MATERIAL_INVENTORY' },
  MATERIAL_RETURNED: { debit: 'RAW_MATERIAL_INVENTORY', credit: 'WIP_INVENTORY' },
  FINISHED_GOODS_RECEIVED: { debit: 'FINISHED_GOODS_INVENTORY', credit: 'WIP_INVENTORY' },
  SCRAP_RECORDED: { debit: 'SCRAP_LOSS', credit: 'WIP_INVENTORY' },
  LABOUR_ABSORPTION: { debit: 'WIP_INVENTORY', credit: 'LABOUR_ABSORPTION' },
  MACHINE_ABSORPTION: { debit: 'WIP_INVENTORY', credit: 'MACHINE_ABSORPTION' },
  OVERHEAD_ABSORPTION: { debit: 'WIP_INVENTORY', credit: 'PRODUCTION_OVERHEAD_ABSORPTION' },
  JOB_WORK_RECEIPT_COST: { debit: 'WIP_INVENTORY', credit: 'JOB_WORK_ABSORPTION' },
  PRODUCTION_VARIANCE: { debit: 'PRODUCTION_VARIANCE', credit: 'WIP_INVENTORY' },
}

export function isPostableManufacturingEvent(eventType: ProductionAccountingEventType): boolean {
  return eventType in EVENT_MAPPINGS || eventType === 'MANUFACTURING_REVERSAL'
}

export function buildManufacturingPostingRequest(args: {
  eventType: ProductionAccountingEventType
  legalEntityId: string
  eventId: string
  idempotencyKey: string
  productionOrderId: string | null
  sourceDocumentType: string
  sourceDocumentId: string
  amount: string
  documentDate: string
  postingDate: string
  narration?: string | null
  payloadJson?: unknown
}): PostingRequest {
  const payload = args.payloadJson && typeof args.payloadJson === 'object'
    ? args.payloadJson as Record<string, unknown>
    : {}
  let pair = EVENT_MAPPINGS[args.eventType]
  if (args.eventType === 'MANUFACTURING_REVERSAL') {
    const debit = payload.debitMappingKey as DefaultAccountMappingKey | undefined
    const credit = payload.creditMappingKey as DefaultAccountMappingKey | undefined
    if (debit && credit) pair = { debit, credit }
  }
  if (!pair) {
    throw new ValidationError(`Event type ${args.eventType} is not MappingReady for GL posting`)
  }

  const negativeVariance =
    args.eventType === 'PRODUCTION_VARIANCE' && Number(payload.varianceAmount ?? args.amount) < 0
  if (negativeVariance) pair = { debit: pair.credit, credit: pair.debit }
  const amount = formatForPersistence(Math.abs(Number(args.amount)).toString(), 4)
  return {
    legalEntityId: args.legalEntityId,
    eventKey: args.idempotencyKey,
    eventType: `MFG_${args.eventType}`,
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: args.documentDate,
    postingDate: args.postingDate,
    narration: args.narration ?? `Manufacturing ${args.eventType}`,
    sourceModule: 'MANUFACTURING',
    sourceDocumentType: args.sourceDocumentType,
    sourceDocumentId: args.sourceDocumentId,
    lines: [
      {
        lineNumber: 1,
        accountMappingKey: pair.debit,
        debitAmount: amount,
        creditAmount: '0',
        referenceDocumentType: args.sourceDocumentType,
        referenceDocumentId: args.sourceDocumentId,
        projectReference: args.productionOrderId,
        lineNarration: `${args.eventType} debit`,
      },
      {
        lineNumber: 2,
        accountMappingKey: pair.credit,
        debitAmount: '0',
        creditAmount: amount,
        referenceDocumentType: args.sourceDocumentType,
        referenceDocumentId: args.sourceDocumentId,
        projectReference: args.productionOrderId,
        lineNarration: `${args.eventType} credit`,
      },
    ],
  }
}
