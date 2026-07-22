/**
 * CRM stage requirements config — pure helper smoke test.
 * Run: npx tsx scripts/test-crm-stage-requirements.ts
 */
import {
  canAdvanceToLeadStage,
  canAdvanceToOpportunityStage,
  getLeadStageRequirements,
  getMissingLeadStageFields,
  getMissingOpportunityStageFields,
  getMissingStageFields,
  getLeadStageCompleteness,
  getOpportunityStageCompleteness,
  getOpportunityStageRequirements,
  LEAD_STAGE_REQUIREMENTS,
  OPPORTUNITY_STAGE_REQUIREMENTS,
} from '../src/config/crmStageRequirements'

let pass = 0
let fail = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\nCRM Stage Requirements\n')

check(1, 'lead contacted has no mandatory fields', getLeadStageRequirements('contacted').length === 0)
check(2, 'lead requirement_collected has no mandatory fields', getLeadStageRequirements('requirement_collected').length === 0)
check(3, 'lead qualified has no mandatory fields', getLeadStageRequirements('qualified').length === 0)
check(4, 'lead not_qualified has no mandatory reason', getLeadStageRequirements('not_qualified').length === 0)
check(5, 'lead closed has no mandatory reason', getLeadStageRequirements('closed').length === 0)
check(6, 'convert still requires linked company', getLeadStageRequirements('converted_to_opportunity').includes('customerId'))
check(7, 'opp requirement_discussion matches funnel', getOpportunityStageRequirements('requirement_discussion').includes('expectedCloseDate'))
check(8, 'all lead stages keyed', Object.keys(LEAD_STAGE_REQUIREMENTS).length === 7)
check(9, 'all opp stages keyed', Object.keys(OPPORTUNITY_STAGE_REQUIREMENTS).length === 10)

const thinLead = { leadNo: 'L-1', prospectName: 'Acme' }
check(10, 'thin lead can advance to contacted', canAdvanceToLeadStage(thinLead, 'contacted'))
check(11, 'thin lead can advance to qualified', canAdvanceToLeadStage(thinLead, 'qualified'))
check(12, 'thin lead can advance to not_qualified', canAdvanceToLeadStage(thinLead, 'not_qualified'))
check(
  13,
  'convert blocked without customerId',
  getMissingLeadStageFields(thinLead, 'converted_to_opportunity').some((m) => m.field === 'customerId'),
)
check(
  14,
  'convert ok with customerId',
  canAdvanceToLeadStage({ ...thinLead, customerId: 'cust-1' }, 'converted_to_opportunity'),
)

const thinOpp = { opportunityName: 'Deal', customerId: 'c1', ownerId: 'u1' }
check(15, 'new_lead ok with identity', canAdvanceToOpportunityStage(thinOpp, 'new_lead'))
check(
  16,
  'technical_review needs lines',
  getMissingOpportunityStageFields(thinOpp, 'technical_review').some((m) => m.field === 'lines'),
)

const withLines = {
  ...thinOpp,
  productRequirement: 'ISO tank',
  lines: [{ productOrItem: 'ISO Tank 26KL', itemCode: 'IT-1', productId: 'p1' }],
}
check(17, 'technical_review passes with scope + lines', canAdvanceToOpportunityStage(withLines, 'technical_review'))

check(
  18,
  'getMissingStageFields lead qualified has no product gate',
  getMissingStageFields({ leadNo: 'L-3', productRequirement: '' }, 'qualified').length === 0,
)
check(
  19,
  'getMissingStageFields uses opp map for qualified without lead keys',
  getMissingStageFields({ opportunityName: 'X', productRequirement: '' }, 'qualified').some((m) => m.field === 'expectedCloseDate'),
)

const leadNewCompleteness = getLeadStageCompleteness({}, 'new')
check(20, 'lead new stage 0 reqs → 100%', leadNewCompleteness.percent === 100 && leadNewCompleteness.isComplete)

const qualifiedCompleteness = getLeadStageCompleteness(thinLead, 'qualified')
check(
  21,
  'lead qualified incomplete fields do not block',
  qualifiedCompleteness.requiredCount === 0 && qualifiedCompleteness.isComplete,
)

const oppTechIncomplete = getOpportunityStageCompleteness(thinOpp, 'technical_review')
check(
  22,
  'opp technical_review incomplete',
  !oppTechIncomplete.isComplete && oppTechIncomplete.percent < 100,
)

const oppTechComplete = getOpportunityStageCompleteness(withLines, 'technical_review')
check(23, 'opp technical_review complete when lines ok', oppTechComplete.isComplete && oppTechComplete.percent === 100)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
