import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/constants/permissions.js'

const app = createApp()
const TENANT_SLUG = 'vasant-trailers'
const BASE = `/api/v1/t/${TENANT_SLUG}/crm`

let dbAvailable = false
let token = ''
let userId = ''

const runLive = process.env.RUN_CRM_E2E === 'true'

async function ensureCrmPermissions(): Promise<void> {
  const permissionMap = new Map<string, string>()
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    const perm = await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    })
    permissionMap.set(name, perm.id)
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) return

  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: roleName } })
    if (!role) continue
    for (const permName of ROLE_PERMISSIONS[roleName] ?? []) {
      const permissionId = permissionMap.get(permName)
      if (!permissionId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      })
    }
  }
}

beforeAll(async () => {
  if (!runLive) return
  try {
    await prisma.$queryRaw`SELECT 1`
    dbAvailable = true
  } catch {
    dbAvailable = false
    if (runLive) {
      throw new Error('RUN_CRM_E2E=true but MySQL test database is not reachable. Configure DATABASE_URL and run migrations.')
    }
    return
  }

  await ensureCrmPermissions()

  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@vasant-trailers.com', password: 'Admin@123', tenantSlug: TENANT_SLUG })

  expect(login.status).toBe(200)
  token = login.body.data.accessToken
  userId = login.body.data.user.id
})

function authGet(path: string) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`)
}

function authPost(path: string, body?: Record<string, unknown>) {
  return request(app).post(path).set('Authorization', `Bearer ${token}`).send(body ?? {})
}

function authPatch(path: string, body?: Record<string, unknown>) {
  return request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body ?? {})
}

function authDelete(path: string) {
  return request(app).delete(path).set('Authorization', `Bearer ${token}`)
}

describe.skipIf(!runLive)('CRM end-to-end operations', () => {
  let companyId = ''
  let contactId = ''
  let leadId = ''
  let activityId = ''
  let opportunityId = ''
  let convertOppId = ''
  let quotationId = ''
  let quotationDocId = ''
  let quotationOppId = ''
  let salesOrderId = ''
  let salesOrderNo = ''

  it('creates CRM company', async () => {
    const res = await authPost(`${BASE}/companies`, {
      customerName: `E2E Co ${Date.now()}`,
      customerType: 'corporate',
      isActive: true,
      addressLine1: 'Plot 12, MIDC Industrial Area',
      city: 'Nashik',
      state: 'Maharashtra',
      pincode: '422010',
      contactPerson: 'E2E Contact',
      contactPhone: '9876543210',
      contactEmail: 'e2e@example.com',
    })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    companyId = res.body.data.id
    expect(companyId).toBeTruthy()
  })

  it('updates CRM company', async () => {
    const res = await authPatch(`${BASE}/companies/${companyId}`, {
      industry: 'Manufacturing',
      remarks: 'Updated via e2e test',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.industry).toBe('Manufacturing')
  })

  it('auto-links CRM contact from company contact fields', async () => {
    const res = await authGet(`${BASE}/contacts?customerId=${companyId}`)
    expect(res.status).toBe(200)
    const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.items ?? [])
    expect(items.length).toBeGreaterThanOrEqual(1)
    const primary = items.find((c: { isPrimary?: boolean; name?: string }) => c.isPrimary) ?? items[0]
    expect(primary.name).toBe('E2E Contact')
    expect(primary.phone).toBe('9876543210')
    contactId = primary.id
  })

  it('updates CRM contact', async () => {
    const res = await authPatch(`${BASE}/contacts/${contactId}`, {
      designation: 'Director',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.designation).toBe('Director')
  })

  it('creates CRM lead', async () => {
    const res = await authPost(`${BASE}/leads`, {
      prospectName: 'E2E Prospect',
      customerId: companyId,
      source: 'website',
      expectedValue: 500000,
      leadOwnerId: userId,
    })
    expect(res.status).toBe(201)
    leadId = res.body.data.id
  })

  it('updates CRM lead', async () => {
    const res = await authPatch(`${BASE}/leads/${leadId}`, {
      remarks: 'Updated lead remarks',
      probability: 40,
    })
    expect(res.status).toBe(200)
    expect(res.body.data.remarks).toBe('Updated lead remarks')
  })

  it('assigns CRM lead', async () => {
    const res = await authPost(`${BASE}/leads/${leadId}/assign`, {
      leadOwnerId: userId,
      notes: 'Assigned in e2e',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.leadOwnerId).toBe(userId)
  })

  it('qualifies CRM lead', async () => {
    const res = await authPost(`${BASE}/leads/${leadId}/qualify`, {
      stage: 'qualified',
      remarks: 'Qualified in e2e',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.stage).toBe('qualified')
  })

  it('creates CRM activity', async () => {
    const res = await authPost(`${BASE}/activities`, {
      type: 'call',
      subject: 'E2E discovery call',
      description: 'Initial call',
      customerId: companyId,
      leadId,
      ownerId: userId,
      activityDate: new Date().toISOString(),
    })
    expect(res.status).toBe(201)
    activityId = res.body.data.id
  })

  it('completes CRM activity', async () => {
    const res = await authPost(`${BASE}/activities/${activityId}/complete`, {
      outcome: 'Positive response',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('completed')
  })

  it('creates standalone CRM opportunity', async () => {
    const pipelines = await authGet(`${BASE}/pipelines?limit=10`)
    const pipeline = pipelines.body.data[0]
    const stage = pipeline.stages[0]
    const res = await authPost(`${BASE}/opportunities`, {
      opportunityName: 'E2E Standalone Opp',
      customerId: companyId,
      contactId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      stage: stage.slug,
      ownerId: userId,
      value: 750000,
      probability: 35,
      expectedCloseDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    })
    expect(res.status).toBe(201)
    opportunityId = res.body.data.id
  })

  it('updates CRM opportunity', async () => {
    const res = await authPatch(`${BASE}/opportunities/${opportunityId}`, {
      opportunityName: 'E2E Standalone Opp Updated',
      value: 800000,
    })
    expect(res.status).toBe(200)
    expect(res.body.data.opportunityName).toBe('E2E Standalone Opp Updated')
  })

  it('marks opportunity as won', async () => {
    const res = await authPost(`${BASE}/opportunities/${opportunityId}/win`, {})
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('won')
  })

  it('creates second lead and converts to opportunity', async () => {
    const leadRes = await authPost(`${BASE}/leads`, {
      prospectName: 'E2E Convert Lead',
      customerId: companyId,
      source: 'referral',
      expectedValue: 300000,
      leadOwnerId: userId,
      stage: 'qualified',
    })
    expect(leadRes.status).toBe(201)
    const convertLeadId = leadRes.body.data.id

    const convertRes = await authPost(`${BASE}/leads/${convertLeadId}/convert`, {
      opportunityName: 'E2E Converted Opp',
      value: 300000,
    })
    expect(convertRes.status).toBe(200)
    expect(convertRes.body.data.lead.stage).toBe('converted_to_opportunity')
    convertOppId = convertRes.body.data.opportunity.id

    const loseRes = await authPost(`${BASE}/opportunities/${convertOppId}/lose`, {
      lostReason: 'Budget constraints',
    })
    expect(loseRes.status).toBe(200)
    expect(loseRes.body.data.status).toBe('lost')
  })

  it('creates CRM quotation with document', async () => {
    const pipelines = await authGet(`${BASE}/pipelines?limit=10`)
    const pipeline = pipelines.body.data[0]
    const stage = pipeline.stages[0]
    const oppRes = await authPost(`${BASE}/opportunities`, {
      opportunityName: 'E2E Quotation Opp',
      customerId: companyId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: userId,
      value: 1000000,
    })
    expect(oppRes.status).toBe(201)
    quotationOppId = oppRes.body.data.id

    const res = await authPost(`${BASE}/quotations`, {
      customerId: companyId,
      opportunityId: quotationOppId,
      qty: 2,
      unitPrice: 500000,
      paymentTerms: '30% advance',
      deliveryTerms: 'Ex-works Nashik',
      validityDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      priceLines: [
        {
          productOrItem: 'Flatbed Trailer',
          description: 'Supply',
          qty: 2,
          uom: 'NOS',
          unitPrice: 500000,
          discountPct: 0,
          taxPct: 18,
        },
      ],
    })
    expect(res.status).toBe(201)
    expect(res.body.data.quotationNo).toBeTruthy()
    quotationId = res.body.data.id
    quotationDocId = res.body.data.documents[0].id
    expect(quotationDocId).toBeTruthy()
  })

  it('updates quotation document sections and price lines', async () => {
    const res = await authPatch(`${BASE}/quotations/${quotationId}/documents/${quotationDocId}`, {
      commercialNotes: 'Updated commercial notes',
      priceLines: [
        {
          productOrItem: 'Flatbed Trailer',
          description: 'Supply updated',
          qty: 2,
          uom: 'NOS',
          unitPrice: 520000,
          discountPct: 0,
          taxPct: 18,
        },
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body.data.documents[0].commercialNotes).toBe('Updated commercial notes')
  })

  it('creates quotation revision', async () => {
    const res = await authPost(`${BASE}/quotations/${quotationId}/revisions`, {
      reason: 'Customer requested price update',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.revisionNo).toBe(2)
    quotationDocId = res.body.data.documents[0].id
  })

  it('submits quotation for approval and auto-approves within threshold', async () => {
    const res = await authPost(`${BASE}/quotations/${quotationId}/documents/${quotationDocId}/submit-approval`, {})
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('approved')
    expect(res.body.data.documents[0].status).toBe('approved')
  })

  it('converts approved quotation to sales order', async () => {
    const res = await authPost(`${BASE}/quotations/${quotationId}/convert-to-sales-order`, {
      documentId: quotationDocId,
      customerPoNumber: 'PO-E2E-001',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.salesOrderId).toBeTruthy()
    expect(res.body.data.salesOrderNo).toMatch(/^SO-/)
    salesOrderId = res.body.data.salesOrderId
    salesOrderNo = res.body.data.salesOrderNo
    expect(res.body.data.quotation.salesOrderId).toBe(salesOrderId)
    expect(res.body.data.quotation.documents[0].status).toBe('converted')
  })

  it('rejects duplicate quotation to sales order conversion', async () => {
    const res = await authPost(`${BASE}/quotations/${quotationId}/convert-to-sales-order`, {
      documentId: quotationDocId,
      customerPoNumber: 'PO-E2E-002',
    })
    expect(res.status).toBe(422)
  })

  it('persists sales order after re-fetch', async () => {
    const res = await authGet(`${BASE}/sales-orders/${salesOrderId}`)
    expect(res.status).toBe(200)
    expect(res.body.data.salesOrderNo).toBe(salesOrderNo)
    expect(res.body.data.quotationId).toBe(quotationId)
  })

  it('lists CRM quotations', async () => {
    const res = await authGet(`${BASE}/quotations?limit=50`)
    expect(res.status).toBe(200)
    expect(res.body.data.some((q: { id: string }) => q.id === quotationId)).toBe(true)
  })

  it('deletes CRM quotation', async () => {
    const res = await authDelete(`${BASE}/quotations/${quotationId}`)
    expect(res.status).toBe(200)
    await authDelete(`${BASE}/opportunities/${quotationOppId}`)
    if (salesOrderId) {
      await prisma.crmSalesOrder.update({
        where: { id: salesOrderId },
        data: { deletedAt: new Date() },
      })
    }
  })

  it('disqualifies a lead', async () => {
    const leadRes = await authPost(`${BASE}/leads`, {
      prospectName: 'E2E Disqualify Lead',
      customerId: companyId,
      source: 'other',
      expectedValue: 10000,
      leadOwnerId: userId,
    })
    expect(leadRes.status).toBe(201)
    const dqLeadId = leadRes.body.data.id
    const res = await authPost(`${BASE}/leads/${dqLeadId}/disqualify`, {
      notQualifiedReason: 'other',
      remarks: 'Not a fit',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.stage).toBe('not_qualified')
    await authDelete(`${BASE}/leads/${dqLeadId}`)
  })

  it('deletes CRM activity', async () => {
    const createRes = await authPost(`${BASE}/activities`, {
      type: 'note',
      subject: 'Delete me',
      customerId: companyId,
      ownerId: userId,
      activityDate: new Date().toISOString(),
    })
    const id = createRes.body.data.id
    const res = await authDelete(`${BASE}/activities/${id}`)
    expect(res.status).toBe(200)
  })

  it('deletes CRM opportunity', async () => {
    const pipelines = await authGet(`${BASE}/pipelines?limit=10`)
    const pipeline = pipelines.body.data[0]
    const stage = pipeline.stages[0]
    const createRes = await authPost(`${BASE}/opportunities`, {
      opportunityName: 'E2E Delete Opp',
      customerId: companyId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: userId,
      value: 1000,
    })
    const id = createRes.body.data.id
    const res = await authDelete(`${BASE}/opportunities/${id}`)
    expect(res.status).toBe(200)
  })

  it('deletes CRM lead', async () => {
    const res = await authDelete(`${BASE}/leads/${leadId}`)
    expect(res.status).toBe(200)
  })

  it('deletes CRM contact', async () => {
    const res = await authDelete(`${BASE}/contacts/${contactId}`)
    expect(res.status).toBe(200)
  })

  it('deletes CRM company', async () => {
    const res = await authDelete(`${BASE}/companies/${companyId}`)
    expect(res.status).toBe(200)
  })

  it('persists company after re-fetch', async () => {
    const name = `Persist Co ${Date.now()}`
    const createRes = await authPost(`${BASE}/companies`, { customerName: name, isActive: true })
    const id = createRes.body.data.id
    const fetchRes = await authGet(`${BASE}/companies/${id}`)
    expect(fetchRes.body.data.customerName).toBe(name)
    await authDelete(`${BASE}/companies/${id}`)
  })
})
