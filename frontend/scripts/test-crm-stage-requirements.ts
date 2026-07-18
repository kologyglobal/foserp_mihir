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

check(1, 'lead contacted requires contact identity', getLeadStageRequirements('contacted').includes('mobile'))
check(2, 'lead requirement_collected requires productRequirement', getLeadStageRequirements('requirement_collected')[0] === 'productRequirement')
check(3, 'legacy disqualified maps to not_qualified', getLeadStageRequirements('disqualified').includes('notQualifiedReason'))
check(4, 'opp requirement_discussion matches funnel', getOpportunityStageRequirements('requirement_discussion').includes('expectedCloseDate'))
check(5, 'all lead stages keyed', Object.keys(LEAD_STAGE_REQUIREMENTS).length === 7)
check(6, 'all opp stages keyed', Object.keys(OPPORTUNITY_STAGE_REQUIREMENTS).length === 10)

const incompleteLead = { leadNo: 'L-1', prospectName: '', contactPerson: '', mobile: '' }
const missingContacted = getMissingLeadStageFields(incompleteLead, 'contacted')
check(7, 'missing lead fields include labels', missingContacted.some((m) => m.field === 'mobile' && m.label === 'Mobile'))

const completeLead = {
  leadNo: 'L-2',
  prospectName: 'Acme',
  contactPerson: 'Riya',
  mobile: '9876543210',
  productRequirement: '40ft trailer',
  customerId: 'cust-1',
  expectedValue: 1_500_000,
}
check(8, 'complete lead can advance to qualified', canAdvanceToLeadStage(completeLead, 'qualified'))
check(9, 'incomplete lead blocked from qualified', !canAdvanceToLeadStage(incompleteLead, 'qualified'))

const thinOpp = { opportunityName: 'Deal', customerId: 'c1', ownerId: 'u1' }
check(10, 'new_lead ok with identity', canAdvanceToOpportunityStage(thinOpp, 'new_lead'))
check(
  11,
  'technical_review needs lines',
  getMissingOpportunityStageFields(thinOpp, 'technical_review').some((m) => m.field === 'lines'),
)

const withLines = {
  ...thinOpp,
  productRequirement: 'ISO tank',
  lines: [{ productOrItem: 'ISO Tank 26KL', itemCode: 'IT-1', productId: 'p1' }],
}
check(12, 'technical_review passes with scope + lines', canAdvanceToOpportunityStage(withLines, 'technical_review'))

check(
  13,
  'getMissingStageFields disambiguates qualified via leadNo',
  getMissingStageFields({ leadNo: 'L-3', productRequirement: '' }, 'qualified').some((m) => m.field === 'productRequirement'),
)
check(
  14,
  'getMissingStageFields uses opp map for qualified without lead keys',
  getMissingStageFields({ opportunityName: 'X', productRequirement: '' }, 'qualified').some((m) => m.field === 'expectedCloseDate'),
)


const leadNewCompleteness = getLeadStageCompleteness({}, 'new')
check(15, 'lead new stage 0 reqs → 100%', leadNewCompleteness.percent === 100 && leadNewCompleteness.isComplete)

const contactedIncomplete = getLeadStageCompleteness(incompleteLead, 'contacted')
check(
  16,
  'lead contacted incomplete percent',
  contactedIncomplete.requiredCount === 3
    && contactedIncomplete.percent < 100
    && !contactedIncomplete.isComplete,
  `percent=${contactedIncomplete.percent}`,
)

const oppTechIncomplete = getOpportunityStageCompleteness(thinOpp, 'technical_review')
check(
  17,
  'opp technical_review incomplete',
  !oppTechIncomplete.isComplete && oppTechIncomplete.percent < 100,
)

const oppTechComplete = getOpportunityStageCompleteness(withLines, 'technical_review')
check(18, 'opp technical_review complete when lines ok', oppTechComplete.isComplete && oppTechComplete.percent === 100)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
