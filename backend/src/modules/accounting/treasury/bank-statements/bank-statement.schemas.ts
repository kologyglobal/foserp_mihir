import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../../legal-entities/legal-entity.validation.js'

export const bankStatementMappingConfigSchema = z.object({
  amountMode: z.enum(['DEBIT_CREDIT_COLUMNS', 'SIGNED_AMOUNT', 'AMOUNT_WITH_DIRECTION']),
  columns: z
    .object({
      transactionDate: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      valueDate: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      description: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      referenceNumber: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      debitAmount: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      creditAmount: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      signedAmount: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      amount: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      direction: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      runningBalance: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      counterpartyName: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      counterpartyAccount: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      utrReference: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      chequeNumber: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      transactionCode: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      externalLineId: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      externalTransactionId: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
    })
    .default({}),
  header: z
    .object({
      openingBalance: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      closingBalance: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      statementReference: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      periodStartDate: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      periodEndDate: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
      statementDate: z.object({ column: z.union([z.string(), z.number()]) }).optional(),
    })
    .optional(),
  dateFormat: z.string().trim().max(32).optional(),
  directionValues: z
    .object({
      credit: z.array(z.string()).optional(),
      debit: z.array(z.string()).optional(),
    })
    .optional(),
})

export const bankStatementParsingConfigSchema = z.object({
  delimiter: z.string().max(8).optional(),
  encoding: z.string().max(32).optional(),
  sheetName: z.string().max(120).optional(),
  headerRowNumber: z.coerce.number().int().min(1).optional(),
  dataStartRowNumber: z.coerce.number().int().min(1).optional(),
})

export const listBankStatementsQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema).extend({
  treasuryAccountId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'IMPORTED', 'VALIDATION_FAILED', 'VALIDATED', 'CANCELLED']).optional(),
  importBatchId: z.string().uuid().optional(),
})

export const createStatementLineSchema = z.object({
  transactionDate: z.string().date(),
  valueDate: z.string().date().nullable().optional(),
  direction: z.enum(['CREDIT', 'DEBIT']),
  amount: z.coerce.number().positive(),
  description: z.string().trim().max(500).optional(),
  referenceNumber: z.string().trim().max(128).optional(),
  utrReference: z.string().trim().max(128).optional(),
  chequeNumber: z.string().trim().max(64).optional(),
  transactionCode: z.string().trim().max(64).optional(),
  counterpartyName: z.string().trim().max(200).optional(),
  counterpartyAccount: z.string().trim().max(40).optional(),
  expectedUpdatedAt: z.string().datetime(),
})

export const createManualStatementSchema = z.object({
  legalEntityId: z.string().uuid(),
  treasuryAccountId: z.string().uuid(),
  statementReference: z.string().trim().min(1).max(64),
  statementDate: z.string().date(),
  periodStartDate: z.string().date(),
  periodEndDate: z.string().date(),
  currencyCode: z.string().trim().max(8).default('INR'),
  openingBalance: z.coerce.number(),
  closingBalance: z.coerce.number(),
  totalCreditAmount: z.coerce.number().min(0).default(0),
  totalDebitAmount: z.coerce.number().min(0).default(0),
  lines: z.array(createStatementLineSchema.omit({ expectedUpdatedAt: true })).optional(),
})

export const updateBankStatementSchema = z.object({
  statementReference: z.string().trim().min(1).max(64).optional(),
  statementDate: z.string().date().optional(),
  periodStartDate: z.string().date().optional(),
  periodEndDate: z.string().date().optional(),
  openingBalance: z.coerce.number().optional(),
  closingBalance: z.coerce.number().optional(),
  totalCreditAmount: z.coerce.number().min(0).optional(),
  totalDebitAmount: z.coerce.number().min(0).optional(),
  expectedUpdatedAt: z.string().datetime(),
})

export const bankStatementLifecycleSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  reason: z.string().trim().max(500).optional(),
})

export const updateStatementLineSchema = createStatementLineSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime(),
})

export type ListBankStatementsQuery = z.infer<typeof listBankStatementsQuerySchema>
export type CreateManualStatementInput = z.infer<typeof createManualStatementSchema>
export type UpdateBankStatementInput = z.infer<typeof updateBankStatementSchema>
export type BankStatementLifecycleInput = z.infer<typeof bankStatementLifecycleSchema>
export type CreateStatementLineInput = z.infer<typeof createStatementLineSchema>
export type UpdateStatementLineInput = z.infer<typeof updateStatementLineSchema>
