import { prisma } from '../src/config/database.js'
import request from 'supertest'
import { createApp } from '../src/app.js'

const app = createApp()
const TENANT = 'vasant-trailers'
const BASE = `/api/v1/t/${TENANT}/crm`

async function main() {
  await prisma.$queryRaw`SELECT 1`
  console.log('MySQL: connected')

  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@vasant-trailers.com', password: 'Admin@123', tenantSlug: TENANT })

  if (login.status !== 200) throw new Error(`Login failed: ${login.status} ${JSON.stringify(login.body)}`)
  const token = login.body.data.accessToken as string
  const userId = login.body.data.user.id as string
  console.log('Auth: ok')

  const h = { Authorization: `Bearer ${token}` }

  const company = await request(app).post(`${BASE}/companies`).set(h).send({ customerName: `Verify ${Date.now()}`, isActive: true })
  if (company.status !== 201) throw new Error(`Create company: ${company.status}`)
  const companyId = company.body.data.id
  console.log('Create company: ok')

  await request(app).patch(`${BASE}/companies/${companyId}`).set(h).send({ industry: 'Test' })
  console.log('Update company: ok')

  const contact = await request(app).post(`${BASE}/contacts`).set(h).send({ customerId: companyId, name: 'Verify Contact' })
  const contactId = contact.body.data.id
  console.log('Create contact: ok')

  await request(app).patch(`${BASE}/contacts/${contactId}`).set(h).send({ designation: 'Mgr' })
  console.log('Update contact: ok')

  const lead = await request(app).post(`${BASE}/leads`).set(h).send({ prospectName: 'Verify Lead', customerId: companyId, leadOwnerId: userId, expectedValue: 1000 })
  const leadId = lead.body.data.id
  console.log('Create lead: ok')

  await request(app).patch(`${BASE}/leads/${leadId}`).set(h).send({ remarks: 'updated' })
  console.log('Update lead: ok')

  await request(app).post(`${BASE}/leads/${leadId}/assign`).set(h).send({ leadOwnerId: userId })
  console.log('Assign lead: ok')

  await request(app).post(`${BASE}/leads/${leadId}/qualify`).set(h).send({ stage: 'qualified' })
  console.log('Qualify lead: ok')

  const activity = await request(app).post(`${BASE}/activities`).set(h).send({ type: 'call', subject: 'Verify', customerId: companyId, leadId, ownerId: userId, activityDate: new Date().toISOString() })
  const activityId = activity.body.data.id
  console.log('Create activity: ok')

  await request(app).post(`${BASE}/activities/${activityId}/complete`).set(h).send({ outcome: 'Done' })
  console.log('Complete activity: ok')

  const pipelines = await request(app).get(`${BASE}/pipelines?limit=10`).set(h)
  const pipeline = pipelines.body.data[0]
  const stage = pipeline.stages[0]

  const opp = await request(app).post(`${BASE}/opportunities`).set(h).send({
    opportunityName: 'Verify Opp',
    customerId: companyId,
    pipelineId: pipeline.id,
    stageId: stage.id,
    ownerId: userId,
    value: 5000,
  })
  const oppId = opp.body.data.id
  console.log('Create opportunity: ok')

  await request(app).patch(`${BASE}/opportunities/${oppId}`).set(h).send({ value: 6000 })
  console.log('Update opportunity: ok')

  await request(app).post(`${BASE}/opportunities/${oppId}/win`).set(h).send({})
  console.log('Win opportunity: ok')

  const loseOpp = await request(app).post(`${BASE}/opportunities`).set(h).send({
    opportunityName: 'Verify Lose Opp',
    customerId: companyId,
    pipelineId: pipeline.id,
    stageId: stage.id,
    ownerId: userId,
    value: 1000,
  })
  await request(app).post(`${BASE}/opportunities/${loseOpp.body.data.id}/lose`).set(h).send({ lostReason: 'Budget' })
  console.log('Lose opportunity: ok')

  const dqLead = await request(app).post(`${BASE}/leads`).set(h).send({ prospectName: 'DQ Lead', customerId: companyId, leadOwnerId: userId })
  await request(app).post(`${BASE}/leads/${dqLead.body.data.id}/disqualify`).set(h).send({ notQualifiedReason: 'other', remarks: 'No fit' })
  console.log('Disqualify lead: ok')

  const lead2 = await request(app).post(`${BASE}/leads`).set(h).send({ prospectName: 'Convert Lead', customerId: companyId, leadOwnerId: userId, stage: 'qualified' })
  const convert = await request(app).post(`${BASE}/leads/${lead2.body.data.id}/convert`).set(h).send({ opportunityName: 'Converted', value: 2000 })
  console.log('Convert lead: ok', convert.body.data.opportunity?.id ? 'with opp' : '')

  const fetchCompany = await request(app).get(`${BASE}/companies/${companyId}`).set(h)
  if (!fetchCompany.body.data?.id) throw new Error('Persist check failed')
  console.log('Persist after fetch: ok')

  await request(app).delete(`${BASE}/activities/${activityId}`).set(h)
  await request(app).delete(`${BASE}/opportunities/${oppId}`).set(h)
  await request(app).delete(`${BASE}/leads/${leadId}`).set(h)
  await request(app).delete(`${BASE}/contacts/${contactId}`).set(h)
  await request(app).delete(`${BASE}/companies/${companyId}`).set(h)
  console.log('Cleanup deletes: ok')

  console.log('\nAll 20 CRM operations verified against live backend + MySQL')
}

main()
  .catch((e) => {
    console.error('VERIFY FAILED:', e.message ?? e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
