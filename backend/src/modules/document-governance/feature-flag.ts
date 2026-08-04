import { env } from '../../config/env.js'
import { DOCUMENT_GOVERNANCE_DATE_CONTROL_FLAG } from './document-governance.constants.js'

/**
 * Master integration flag. When OFF, evaluate* always reports currentBehavior
 * and module document flows must not change — this phase never wires them.
 */
export function isDocumentGovernanceDateControlEnabled(): boolean {
  return env.DOCUMENT_GOVERNANCE_DATE_CONTROL === true
}

export function documentGovernanceFeatureFlagStatus() {
  return {
    flag: DOCUMENT_GOVERNANCE_DATE_CONTROL_FLAG,
    enabled: isDocumentGovernanceDateControlEnabled(),
  }
}
