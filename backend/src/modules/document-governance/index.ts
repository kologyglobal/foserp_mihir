/**
 * Document Governance — public service surface for future module integration.
 * Do not call from live CRM/Purchase save/post flows until DOCUMENT_GOVERNANCE_DATE_CONTROL is ON
 * and the specific document type is intentionally wired.
 */
export {
  evaluateDocumentDatePolicy,
  resolveEffectivePolicyFromCandidates,
  defaultCurrentBehaviourPolicy,
  mapRowToEffective,
  scorePolicyScope,
} from './document-date-policy.service.js'
export {
  getDocumentDatePolicy,
  evaluatePolicyForDocument,
  listDateControls,
  createDateControl,
} from './document-governance.service.js'
export { isDocumentGovernanceDateControlEnabled } from './feature-flag.js'
export {
  DOCUMENT_GOVERNANCE_REGISTRY,
  listDocumentTypes,
  isRegisteredDocument,
} from './document-registry.js'
export type {
  EffectiveDocumentDatePolicy,
  DocumentDatePolicyEvaluation,
  GetDocumentDatePolicyInput,
  EvaluateDocumentDatePolicyInput,
} from './document-date-policy.types.js'
