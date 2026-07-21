import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../../types/request-context.js'
import { asyncHandler } from '../../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../../utils/response.js'
import * as readRepo from '../../bank-reconciliation/bank-reconciliation-read.repository.js'
import * as repo from './bank-posting-rule.repository.js'
import { classifyStatementLine } from './bank-posting-rule-classifier.service.js'
import type { ListBankPostingRulesQuery } from './bank-posting-rule.schemas.js'

export const listBankPostingRules = asyncHandler(async (req: Request, res: Response) => {
  const result = await repo.listRules(getTenantId(req), req.query as unknown as ListBankPostingRulesQuery)
  return sendPaginated(res, 'bank posting rules listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createBankPostingRule = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'bank posting rule created', await repo.createRule(getTenantId(req), req.body, req.context?.userId)))

export const getBankPostingRule = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'bank posting rule fetched', await repo.findRuleByIdOrThrow(getTenantId(req), getRouteParam(req, 'id'))))

export const updateBankPostingRule = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'bank posting rule updated', await repo.updateRule(getTenantId(req), getRouteParam(req, 'id'), req.body, req.context?.userId)))

export const deactivateBankPostingRule = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'bank posting rule deactivated', await repo.deactivateRule(getTenantId(req), getRouteParam(req, 'id'), req.context?.userId)))

export const classifyStatementLineHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'statementId')
  const lineId = getRouteParam(req, 'lineId')
  const statement = await readRepo.getStatementOrThrow(tenantId, statementId)
  const line = await readRepo.getStatementLineOrThrow(tenantId, statementId, lineId)
  const result = await classifyStatementLine(tenantId, req.body.legalEntityId, statement.treasuryAccountId, line)
  return sendSuccess(res, 'statement line classified', {
    ruleId: result.rule.id,
    ruleName: result.rule.name,
    matchedKeywords: result.matchedKeywords,
    adjustmentType: result.adjustmentType,
    lineTemplate: { ...result.lineTemplate, amount: line.amount.toString() },
    candidateCount: result.candidates.length,
  })
})
