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
  let companyName = ''
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
  let quotationTemplateId = ''
  let duplicatedTemplateId = ''

  it('creates CRM company', async () => {
    companyName = `E2E Co ${Date.now()}`
    const res = await authPost(`${BASE}/companies`, {
      customerName: companyName,
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

  it('updates CRM activity (timeline edit)', async () => {
    const res = await authPatch(`${BASE}/activities/${activityId}`, {
      subject: 'E2E discovery call (edited)',
      description: 'Updated from Lead 360 timeline',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.subject).toBe('E2E discovery call (edited)')
  })

  it('creates, updates, and deletes CRM follow-up', async () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const dueDate = future.toISOString().slice(0, 10)
    const dueTime = `${String(future.getUTCHours()).padStart(2, '0')}:${String(future.getUTCMinutes()).padStart(2, '0')}`
    const createRes = await authPost(`${BASE}/follow-ups`, {
      followUpType: 'call',
      leadId,
      customerId: companyId,
      assignedTo: userId,
      dueDate,
      dueTime,
      priority: 'medium',
      notes: 'E2E follow-up',
    })
    expect(createRes.status).toBe(201)
    const followUpId = createRes.body.data.id as string

    const patchRes = await authPatch(`${BASE}/follow-ups/${followUpId}`, {
      notes: 'E2E follow-up edited',
      priority: 'high',
    })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.notes).toBe('E2E follow-up edited')
    expect(patchRes.body.data.priority).toBe('high')

    const delRes = await authDelete(`${BASE}/follow-ups/${followUpId}`)
    expect(delRes.status).toBe(200)
  })

  it('rejects follow-up create with past due date/time', async () => {
    const createRes = await authPost(`${BASE}/follow-ups`, {
      followUpType: 'call',
      leadId,
      customerId: companyId,
      assignedTo: userId,
      dueDate: '2020-01-01',
      dueTime: '10:00',
      priority: 'medium',
      notes: 'Past follow-up should fail',
    })
    expect(createRes.status).toBe(400)
    expect(String(createRes.body.message ?? createRes.body.error ?? '')).toMatch(/future/i)
  })

  it('sync ensures opportunity-stages and document-types', async () => {
    const res = await authGet(`${BASE}/masters/sync`)
    expect(res.status).toBe(200)
    const rows = res.body.data as Array<{ kind: string; code: string }>
    const stages = rows.filter((r) => r.kind === 'opportunity-stages')
    expect(stages.length).toBeGreaterThanOrEqual(10)
    expect(stages.some((s) => s.code === 'quotation_sent')).toBe(true)
    expect(stages.some((s) => s.code === 'on_hold')).toBe(true)
    const docTypes = rows.filter((r) => r.kind === 'document-types')
    expect(docTypes.some((d) => d.code === 'general')).toBe(true)
  })

  it('lists seeded locations master', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/masters/locations?limit=50`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const items = res.body.data as Array<{ code: string }>
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items.some((l) => l.code === 'HO' || l.code === 'AHMD-PLT')).toBe(true)
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

  it('returns sales forecast rollup for open opportunities', async () => {
    const res = await authGet(`${BASE}/forecast`)
    expect(res.status).toBe(200)
    const data = res.body.data as {
      openCount: number
      pipelineValue: number
      weightedForecast: number
      byMonth: unknown[]
      byOwner: unknown[]
      byStage: unknown[]
      atRisk: unknown[]
    }
    expect(data.openCount).toBeGreaterThanOrEqual(1)
    expect(typeof data.pipelineValue).toBe('number')
    expect(typeof data.weightedForecast).toBe('number')
    expect(data.weightedForecast).toBeLessThanOrEqual(data.pipelineValue + 0.001)
    expect(Array.isArray(data.byMonth)).toBe(true)
    expect(Array.isArray(data.byOwner)).toBe(true)
    expect(Array.isArray(data.byStage)).toBe(true)
    expect(Array.isArray(data.atRisk)).toBe(true)

    const filtered = await authGet(`${BASE}/forecast?ownerId=${userId}`)
    expect(filtered.status).toBe(200)
    expect(filtered.body.data.openCount).toBeGreaterThanOrEqual(1)
  })

  it('searches CRM companies, contacts, leads, and opportunities', async () => {
    const missingQ = await authGet(`${BASE}/search`)
    expect(missingQ.status).toBe(400)

    const emptyQ = await authGet(`${BASE}/search?q=`)
    expect(emptyQ.status).toBe(400)

    const uniqueMobile = `9${String(Date.now()).slice(-9)}`
    const contactPatch = await authPatch(`${BASE}/contacts/${contactId}`, { phone: uniqueMobile })
    expect(contactPatch.status).toBe(200)

    const companyRes = await authGet(`${BASE}/search?q=${encodeURIComponent(companyName)}`)
    expect(companyRes.status).toBe(200)
    const companies = companyRes.body.data.companies as Array<{ id: string; name: string }>
    expect(companies.some((c) => c.id === companyId && c.name === companyName)).toBe(true)

    const contactRes = await authGet(`${BASE}/search?q=${encodeURIComponent(uniqueMobile)}`)
    expect(contactRes.status).toBe(200)
    const contacts = contactRes.body.data.contacts as Array<{ id: string; mobile?: string | null }>
    expect(contacts.some((c) => c.id === contactId && c.mobile === uniqueMobile)).toBe(true)

    const leadRes = await authGet(`${BASE}/search?q=${encodeURIComponent('E2E Prospect')}`)
    expect(leadRes.status).toBe(200)
    const leads = leadRes.body.data.leads as Array<{ id: string; prospectName: string }>
    expect(leads.some((l) => l.id === leadId && l.prospectName === 'E2E Prospect')).toBe(true)

    const oppRes = await authGet(`${BASE}/search?q=${encodeURIComponent('E2E Standalone Opp Updated')}`)
    expect(oppRes.status).toBe(200)
    const opportunities = oppRes.body.data.opportunities as Array<{ id: string; name: string }>
    expect(opportunities.some((o) => o.id === opportunityId && o.name === 'E2E Standalone Opp Updated')).toBe(true)
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
      locationId: '',
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
    expect(res.body.data.locationId == null).toBe(true)
    quotationId = res.body.data.id
    quotationDocId = res.body.data.documents[0].id
    expect(quotationDocId).toBeTruthy()
  })

  it('rejects attachment without documentType and accepts typed upload', async () => {
    const missing = await authPost(`${BASE}/entities/LEAD/${leadId}/attachments`, {
      originalFilename: 'note.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('%PDF-1.4 e2e').toString('base64'),
    })
    expect(missing.status).toBe(400)

    const ok = await authPost(`${BASE}/entities/LEAD/${leadId}/attachments`, {
      originalFilename: 'note.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('%PDF-1.4 e2e').toString('base64'),
      documentType: 'general',
    })
    expect(ok.status).toBe(201)
    expect(ok.body.data.documentType).toBe('general')
    expect(ok.body.data.documentTypeName).toBeTruthy()

    const list = await authGet(`${BASE}/entities/LEAD/${leadId}/attachments`)
    expect(list.status).toBe(200)
    const rows = list.body.data as Array<{ id: string; documentType?: string; documentTypeName?: string }>
    expect(rows.some((r) => r.documentType === 'general' && Boolean(r.documentTypeName))).toBe(true)
  })

  it('creates, lists, updates, and soft-deletes entity notes on LEAD', async () => {
    const createRes = await authPost(`${BASE}/entities/LEAD/${leadId}/notes`, {
      content: 'E2E lead note',
    })
    expect(createRes.status).toBe(201)
    expect(createRes.body.data.content).toBe('E2E lead note')
    expect(createRes.body.data.entityType).toBe('LEAD')
    expect(createRes.body.data.entityId).toBe(leadId)
    const noteId = createRes.body.data.id as string
    expect(noteId).toBeTruthy()

    const listRes = await authGet(`${BASE}/entities/LEAD/${leadId}/notes`)
    expect(listRes.status).toBe(200)
    const listed = listRes.body.data as Array<{ id: string; content: string }>
    expect(listed.some((n) => n.id === noteId && n.content === 'E2E lead note')).toBe(true)

    const patchRes = await authPatch(`${BASE}/entities/notes/${noteId}`, {
      content: 'E2E lead note edited',
    })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.content).toBe('E2E lead note edited')

    const listAfterPatch = await authGet(`${BASE}/entities/LEAD/${leadId}/notes`)
    expect(listAfterPatch.status).toBe(200)
    const patchedRows = listAfterPatch.body.data as Array<{ id: string; content: string }>
    expect(patchedRows.some((n) => n.id === noteId && n.content === 'E2E lead note edited')).toBe(true)

    const deleteRes = await authDelete(`${BASE}/entities/notes/${noteId}`)
    expect(deleteRes.status).toBe(200)

    const listAfterDelete = await authGet(`${BASE}/entities/LEAD/${leadId}/notes`)
    expect(listAfterDelete.status).toBe(200)
    const remaining = listAfterDelete.body.data as Array<{ id: string }>
    expect(remaining.some((n) => n.id === noteId)).toBe(false)

    const deleteAgain = await authDelete(`${BASE}/entities/notes/${noteId}`)
    expect(deleteAgain.status).toBe(404)
  })

  it('creates stage-specific notes additively without overwriting prior stage notes', async () => {
    const stageA = await authPost(`${BASE}/entities/LEAD/${leadId}/notes`, {
      content: 'Qualification context',
      stageCode: 'qualified',
      noteType: 'qualification',
    })
    expect(stageA.status).toBe(201)
    expect(stageA.body.data.stageCode).toBe('qualified')
    expect(stageA.body.data.noteType).toBe('qualification')
    const noteAId = stageA.body.data.id as string

    const stageB = await authPost(`${BASE}/entities/LEAD/${leadId}/notes`, {
      content: 'Requirement details',
      stageCode: 'requirement_collected',
      noteType: 'requirement',
    })
    expect(stageB.status).toBe(201)
    expect(stageB.body.data.stageCode).toBe('requirement_collected')
    expect(stageB.body.data.noteType).toBe('requirement')
    const noteBId = stageB.body.data.id as string
    expect(noteBId).not.toBe(noteAId)

    const allNotes = await authGet(`${BASE}/entities/LEAD/${leadId}/notes`)
    expect(allNotes.status).toBe(200)
    const rows = allNotes.body.data as Array<{
      id: string
      content: string
      stageCode: string | null
      noteType: string | null
    }>
    const a = rows.find((n) => n.id === noteAId)
    const b = rows.find((n) => n.id === noteBId)
    expect(a?.content).toBe('Qualification context')
    expect(a?.stageCode).toBe('qualified')
    expect(a?.noteType).toBe('qualification')
    expect(b?.content).toBe('Requirement details')
    expect(b?.stageCode).toBe('requirement_collected')
    expect(b?.noteType).toBe('requirement')

    const filtered = await authGet(
      `${BASE}/entities/LEAD/${leadId}/notes?stageCode=qualified&noteType=qualification`,
    )
    expect(filtered.status).toBe(200)
    const filteredRows = filtered.body.data as Array<{ id: string; stageCode: string | null }>
    expect(filteredRows.every((n) => n.stageCode === 'qualified')).toBe(true)
    expect(filteredRows.some((n) => n.id === noteAId)).toBe(true)
    expect(filteredRows.some((n) => n.id === noteBId)).toBe(false)

    // Content edit must not wipe stage identity (immutable stageCode / noteType)
    const patchRes = await authPatch(`${BASE}/entities/notes/${noteAId}`, {
      content: 'Qualification context (edited)',
    })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.content).toBe('Qualification context (edited)')
    expect(patchRes.body.data.stageCode).toBe('qualified')
    expect(patchRes.body.data.noteType).toBe('qualification')

    const afterEdit = await authGet(`${BASE}/entities/LEAD/${leadId}/notes`)
    const afterRows = afterEdit.body.data as Array<{ id: string; stageCode: string | null; content: string }>
    expect(afterRows.some((n) => n.id === noteAId && n.stageCode === 'qualified')).toBe(true)
    expect(afterRows.some((n) => n.id === noteBId && n.stageCode === 'requirement_collected')).toBe(true)
  })

  it('creates, lists, gets, updates, duplicates, and soft-deletes quotation template', async () => {
    const stamp = Date.now()
    const templateName = `E2E Template ${stamp}`
    const createRes = await authPost(`${BASE}/quotation-templates`, {
      templateName,
      productFamily: 'Trailer',
      defaultTerms: 'Net 30',
      defaultWarranty: '12 months',
      sections: [
        {
          sectionType: 'intro',
          title: 'Introduction',
          content: 'E2E template intro',
          sequenceNo: 0,
          contentFormat: 'richtext',
        },
      ],
      printLayout: { pageSize: 'A4', showLogo: true },
      isActive: true,
    })
    expect(createRes.status).toBe(201)
    expect(createRes.body.data.templateName).toBe(templateName)
    expect(createRes.body.data.productFamily).toBe('Trailer')
    expect(createRes.body.data.code).toBeTruthy()
    quotationTemplateId = createRes.body.data.id as string
    expect(quotationTemplateId).toBeTruthy()

    const listRes = await authGet(
      `${BASE}/quotation-templates?search=${encodeURIComponent(templateName)}&limit=50`,
    )
    expect(listRes.status).toBe(200)
    const listed = listRes.body.data as Array<{ id: string; templateName: string }>
    expect(listed.some((t) => t.id === quotationTemplateId && t.templateName === templateName)).toBe(true)

    const getRes = await authGet(`${BASE}/quotation-templates/${quotationTemplateId}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.data.id).toBe(quotationTemplateId)
    expect(getRes.body.data.defaultTerms).toBe('Net 30')

    const patchRes = await authPatch(`${BASE}/quotation-templates/${quotationTemplateId}`, {
      templateName: `${templateName} Edited`,
      defaultWarranty: '24 months',
      isActive: true,
    })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.templateName).toBe(`${templateName} Edited`)
    expect(patchRes.body.data.defaultWarranty).toBe('24 months')

    const dupRes = await authPost(`${BASE}/quotation-templates/${quotationTemplateId}/duplicate`, {
      templateName: `${templateName} Copy`,
    })
    expect(dupRes.status).toBe(201)
    expect(dupRes.body.data.templateName).toBe(`${templateName} Copy`)
    expect(dupRes.body.data.id).not.toBe(quotationTemplateId)
    duplicatedTemplateId = dupRes.body.data.id as string

    const deleteRes = await authDelete(`${BASE}/quotation-templates/${quotationTemplateId}`)
    expect(deleteRes.status).toBe(200)

    const getDeleted = await authGet(`${BASE}/quotation-templates/${quotationTemplateId}`)
    expect(getDeleted.status).toBe(404)

    const deleteDup = await authDelete(`${BASE}/quotation-templates/${duplicatedTemplateId}`)
    expect(deleteDup.status).toBe(200)
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
    expect(res.body.data.salesOrder.status).toBe('open')
    expect(res.body.data.salesOrder.grandTotal).toBeGreaterThan(0)

    const opp = await authGet(`${BASE}/opportunities/${quotationOppId}`)
    expect(opp.status).toBe(200)
    expect(String(opp.body.data.status).toLowerCase()).toBe('won')
    expect(opp.body.data.probability).toBe(100)
  })

  it('rejects duplicate quotation to sales order conversion with 409', async () => {
    const res = await authPost(`${BASE}/quotations/${quotationId}/convert-to-sales-order`, {
      documentId: quotationDocId,
      customerPoNumber: 'PO-E2E-002',
    })
    expect(res.status).toBe(409)
    const soIdErr = (res.body.errors as Array<{ field: string; message: string }> | null)?.find(
      (e) => e.field === 'salesOrderId',
    )
    expect(soIdErr?.message).toBe(salesOrderId)
  })

  it('persists sales order after re-fetch', async () => {
    const res = await authGet(`${BASE}/sales-orders/${salesOrderId}`)
    expect(res.status).toBe(200)
    expect(res.body.data.salesOrderNo).toBe(salesOrderNo)
    expect(res.body.data.quotationId).toBe(quotationId)
  })

  it('creates confirms updates and closes a direct sales order', async () => {
    const createRes = await authPost(`${BASE}/sales-orders`, {
      customerId: companyId,
      source: 'direct',
      directSoReason: 'E2E direct SO — urgent frame order',
      customerPoNumber: 'PO-DIRECT-E2E',
      paymentTerms: '30% advance',
      deliveryTerms: 'Ex-works',
      productId: null,
      qty: 1,
      unitPrice: 1500000,
      lines: [
        {
          productOrItem: 'Direct Frame',
          description: 'E2E line',
          qty: 1,
          uom: 'NOS',
          unitPrice: 1500000,
          discountPct: 0,
          taxPct: 18,
        },
      ],
    })
    expect(createRes.status).toBe(201)
    const directId = createRes.body.data.id as string
    expect(createRes.body.data.status).toBe('open')
    expect(createRes.body.data.source).toBe('direct')
    expect(createRes.body.data.directSoReason).toContain('E2E direct')

    const patchRes = await authPatch(`${BASE}/sales-orders/${directId}`, {
      customerPoNumber: 'PO-DIRECT-E2E-UPD',
      internalRemarks: 'patched draft',
    })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.customerPoNumber).toBe('PO-DIRECT-E2E-UPD')

    const confirmRes = await authPost(`${BASE}/sales-orders/${directId}/confirm`)
    expect(confirmRes.status).toBe(200)
    expect(confirmRes.body.data.status).toBe('confirmed')

    const patchBlocked = await authPatch(`${BASE}/sales-orders/${directId}`, {
      customerPoNumber: 'SHOULD-FAIL',
    })
    expect(patchBlocked.status).toBe(422)

    const closeRes = await authPost(`${BASE}/sales-orders/${directId}/close`)
    expect(closeRes.status).toBe(200)
    expect(closeRes.body.data.status).toBe('closed')
  })

  it('soft-deletes draft sales order', async () => {
    const createRes = await authPost(`${BASE}/sales-orders`, {
      customerId: companyId,
      source: 'direct',
      directSoReason: 'delete me',
      customerPoNumber: 'PO-DEL-E2E',
      paymentTerms: 'Net 30',
      deliveryTerms: 'Ex-works',
      lines: [
        {
          productOrItem: 'Delete Line',
          description: '',
          qty: 1,
          uom: 'NOS',
          unitPrice: 100000,
          discountPct: 0,
          taxPct: 18,
        },
      ],
    })
    expect(createRes.status).toBe(201)
    const delId = createRes.body.data.id as string
    const delRes = await authDelete(`${BASE}/sales-orders/${delId}`)
    expect(delRes.status).toBe(200)
    const getRes = await authGet(`${BASE}/sales-orders/${delId}`)
    expect(getRes.status).toBe(404)
  })

  it('blocks quotation convert when opportunity is lost', async () => {
    const pipelines = await authGet(`${BASE}/pipelines?limit=10`)
    const pipeline = pipelines.body.data[0]
    const stage = pipeline.stages[0]
    const oppRes = await authPost(`${BASE}/opportunities`, {
      opportunityName: `E2E Lost Convert Opp ${Date.now()}`,
      customerId: companyId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: userId,
      value: 250000,
    })
    expect(oppRes.status).toBe(201)
    const lostOppId = oppRes.body.data.id as string

    const quoRes = await authPost(`${BASE}/quotations`, {
      customerId: companyId,
      opportunityId: lostOppId,
      qty: 1,
      unitPrice: 250000,
      paymentTerms: '30% advance',
      deliveryTerms: 'Ex-works',
      validityDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      priceLines: [
        {
          productOrItem: 'Lost Opp Trailer',
          description: 'Supply',
          qty: 1,
          uom: 'NOS',
          unitPrice: 250000,
          discountPct: 0,
          taxPct: 18,
        },
      ],
    })
    expect(quoRes.status).toBe(201)
    const lostQuoId = quoRes.body.data.id as string
    const lostDocId = quoRes.body.data.documents[0].id as string

    const submitRes = await authPost(
      `${BASE}/quotations/${lostQuoId}/documents/${lostDocId}/submit-approval`,
      {},
    )
    expect(submitRes.status).toBe(200)

    const loseRes = await authPost(`${BASE}/opportunities/${lostOppId}/lose`, {
      lostReason: 'Budget withdrawn',
    })
    expect(loseRes.status).toBe(200)

    const convertRes = await authPost(`${BASE}/quotations/${lostQuoId}/convert-to-sales-order`, {
      documentId: lostDocId,
    })
    expect(convertRes.status).toBe(422)
    expect(String(convertRes.body.message)).toMatch(/Lost/i)
  })

  it('lists CRM quotations', async () => {
    const res = await authGet(`${BASE}/quotations?limit=50`)
    expect(res.status).toBe(200)
    expect(res.body.data.some((q: { id: string }) => q.id === quotationId)).toBe(true)
  })

  it('dashboard metrics include pending quotation approval panel from DB', async () => {
    const pipelines = await authGet(`${BASE}/pipelines?limit=10`)
    const pipeline = pipelines.body.data[0]
    const stage = pipeline.stages[0]
    const oppRes = await authPost(`${BASE}/opportunities`, {
      opportunityName: 'E2E Approval Panel Opp',
      customerId: companyId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: userId,
      value: 7000000,
    })
    expect(oppRes.status).toBe(201)
    const approvalOppId = oppRes.body.data.id as string

    const createRes = await authPost(`${BASE}/quotations`, {
      customerId: companyId,
      opportunityId: approvalOppId,
      locationId: '',
      qty: 2,
      unitPrice: 3000000,
      paymentTerms: '30% advance',
      deliveryTerms: 'Ex-works',
      validityDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      priceLines: [
        {
          productOrItem: 'High-value Trailer',
          description: 'Above auto-approve threshold',
          qty: 2,
          uom: 'NOS',
          unitPrice: 3000000,
          discountPct: 0,
          taxPct: 18,
        },
      ],
    })
    expect(createRes.status).toBe(201)
    const approvalQuotationId = createRes.body.data.id as string
    const approvalDocId = createRes.body.data.documents[0].id as string
    const quotationCode = createRes.body.data.quotationNo as string

    const submitRes = await authPost(
      `${BASE}/quotations/${approvalQuotationId}/documents/${approvalDocId}/submit-approval`,
      {},
    )
    expect(submitRes.status).toBe(200)
    expect(submitRes.body.data.documents[0].status).toBe('pending_approval')

    const metricsRes = await authGet(`${BASE}/dashboard/metrics?period=month`)
    expect(metricsRes.status).toBe(200)
    const panels = metricsRes.body.data.panels
    expect(typeof panels.pendingApprovalCount).toBe('number')
    expect(panels.pendingApprovalCount).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(panels.pendingApprovalQuotations)).toBe(true)
    const row = panels.pendingApprovalQuotations.find(
      (r: { id: string }) => r.id === approvalDocId,
    ) as {
      id: string
      quotationId: string
      quotationCode: string
      customerName: string
      status: string
      totalAmount: number
      submittedAt: string | null
    }
    expect(row).toBeTruthy()
    expect(row.quotationId).toBe(approvalQuotationId)
    expect(row.quotationCode).toBe(quotationCode)
    expect(row.customerName).toBeTruthy()
    expect(row.status).toBe('pending_approval')
    expect(row.totalAmount).toBeGreaterThan(5_000_000)
    expect(row.submittedAt).toBeTruthy()

    await authPost(`${BASE}/quotations/${approvalQuotationId}/documents/${approvalDocId}/approve`, {
      remarks: 'E2E cleanup approve',
    })
    await authDelete(`${BASE}/quotations/${approvalQuotationId}`)
    await authDelete(`${BASE}/opportunities/${approvalOppId}`)
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
