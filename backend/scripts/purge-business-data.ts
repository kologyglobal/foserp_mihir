/**
 * Purge CRM / transactional business data for a tenant.
 * Keeps: auth users, roles, permissions, tenant, pipeline, CRM lookup masters,
 * code series, and geography (country/state/city).
 *
 * Run: npx tsx scripts/purge-business-data.ts
 * Optional: TENANT_SLUG=vasant-trailers
 */
import { prisma } from '../src/config/database.js'
const slug = process.env.TENANT_SLUG ?? 'vasant-trailers'

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug } })
  if (!tenant) {
    console.error(`Tenant not found: ${slug}`)
    process.exit(1)
  }

  const tenantId = tenant.id
  console.log(`Purging business data for tenant ${slug} (${tenantId})...`)

  const counts: Record<string, number> = {}

  async function wipe(label: string, fn: () => Promise<{ count: number }>) {
    const result = await fn()
    counts[label] = result.count
    console.log(`  ${label}: ${result.count}`)
  }

  // Child / dependent CRM rows first
  await wipe('crm_notes', () => prisma.crmNote.deleteMany({ where: { tenantId } }))
  await wipe('crm_attachments', () => prisma.crmAttachment.deleteMany({ where: { tenantId } }))
  await wipe('crm_opportunity_lines', () => prisma.crmOpportunityLine.deleteMany({ where: { tenantId } }))
  await wipe('crm_opportunity_stage_history', () =>
    prisma.crmOpportunityStageHistory.deleteMany({ where: { tenantId } }),
  )
  await wipe('crm_opportunity_assignment_history', () =>
    prisma.crmOpportunityAssignmentHistory.deleteMany({ where: { tenantId } }),
  )
  await wipe('crm_opportunity_amount_history', () =>
    prisma.crmOpportunityAmountHistory.deleteMany({ where: { tenantId } }),
  )
  await wipe('crm_opportunity_status_history', () =>
    prisma.crmOpportunityStatusHistory.deleteMany({ where: { tenantId } }),
  )
  await wipe('crm_lead_status_history', () => prisma.crmLeadStatusHistory.deleteMany({ where: { tenantId } }))
  await wipe('crm_lead_assignments', () => prisma.crmLeadAssignment.deleteMany({ where: { tenantId } }))
  await wipe('crm_quotation_documents', () => prisma.crmQuotationDocument.deleteMany({ where: { tenantId } }))
  await wipe('crm_quotations', () => prisma.crmQuotation.deleteMany({ where: { tenantId } }))
  await wipe('crm_sales_orders', () => prisma.crmSalesOrder.deleteMany({ where: { tenantId } }))
  await wipe('crm_activities', () => prisma.crmActivity.deleteMany({ where: { tenantId } }))
  await wipe('crm_follow_ups', () => prisma.crmFollowUp.deleteMany({ where: { tenantId } }))
  await wipe('crm_opportunities', () => prisma.crmOpportunity.deleteMany({ where: { tenantId } }))
  await wipe('crm_leads', () => prisma.crmLead.deleteMany({ where: { tenantId } }))
  await wipe('crm_contacts', () => prisma.crmContact.deleteMany({ where: { tenantId } }))
  await wipe('crm_companies', () => prisma.crmCompany.deleteMany({ where: { tenantId } }))

  // Optional test-filled item/vendor masters (geography KEPT)
  await wipe('master_vendors', () => prisma.masterVendor.deleteMany({ where: { tenantId } }))
  await wipe('master_items', () => prisma.masterItem.deleteMany({ where: { tenantId } }))

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log(`\nDone. Removed ${total} business rows.`)
  console.log('Kept: users, roles, permissions, pipeline, CRM masters, code series, geography.')
  console.log('\nNext: hard-refresh the browser (Ctrl+Shift+R) to clear localStorage demo cache.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
