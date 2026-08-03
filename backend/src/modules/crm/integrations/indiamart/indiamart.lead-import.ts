import type { IndiaMartConnection, IndiaMartEnquiry, IndiaMartImportStatus } from '@prisma/client'
import { prisma } from '../../../../config/prisma.js'
import { nextCode } from '../../../../services/codeSeries.service.js'
import { createAuditLog } from '../../../../services/audit.service.js'
import * as followUpService from '../../follow-ups/follow-up.service.js'
import * as noteRepo from '../../notes/note.repository.js'
import { IndiaMartError } from './indiamart.errors.js'
import { resolveAssignee } from './indiamart.assignment.js'
import * as repo from './indiamart.repository.js'
import { INDIAMART_EXTERNAL_SOURCE, INDIAMART_LEAD_SOURCE_CODE } from './indiamart.types.js'
import type { IndiaMartConfigurationJson } from './indiamart.types.js'

function sanitizeText(value: string | null | undefined, max = 5000): string | null {
  if (!value) return null
  return value.replace(/[<>]/g, '').trim().slice(0, max) || null
}

async function ensureIndiaMartLeadSource(tenantId: string, userId: string) {
  await prisma.crmMaster.upsert({
    where: {
      tenantId_kind_code: { tenantId, kind: 'lead-sources', code: INDIAMART_LEAD_SOURCE_CODE },
    },
    create: {
      tenantId,
      kind: 'lead-sources',
      code: INDIAMART_LEAD_SOURCE_CODE,
      name: 'IndiaMART',
      sortOrder: 6,
      isSystem: true,
      attributes: { sourceType: 'Digital' },
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: 'IndiaMART',
      updatedBy: userId,
    },
  })
}

async function createFollowUpIfEnabled(
  connection: IndiaMartConnection,
  leadId: string,
  ownerId: string,
  userId: string,
  enquiry: IndiaMartEnquiry,
) {
  const cfg = (connection.configurationJson ?? {}) as IndiaMartConfigurationJson
  if (cfg.autoCreateFollowUp === false) return
  if (cfg.autoCreateFollowUp !== true && cfg.autoCreateFollowUp !== undefined) return

  // Default: enabled when autoCreateFollowUp is true OR undefined with auto-create lead path requesting it
  const enabled = cfg.autoCreateFollowUp === true
  if (!enabled) return

  const dueMinutes = cfg.followUpDueMinutes ?? 30
  const due = new Date(Date.now() + dueMinutes * 60_000)
  const dueDate = due.toISOString().slice(0, 10)
  const dueTime = due.toISOString().slice(11, 16)

  await followUpService.createFollowUp(connection.tenantId, userId, {
    followUpType: cfg.followUpActivityType ?? 'Call',
    leadId,
    assignedTo: ownerId,
    dueDate,
    dueTime,
    priority: (cfg.followUpPriority as 'low' | 'medium' | 'high' | 'critical') ?? 'high',
    notes: cfg.followUpSubject ?? `Contact IndiaMART enquiry ${enquiry.externalEnquiryId}`,
    reminder: true,
  })
}

async function attachIndiaMartNote(
  tenantId: string,
  leadId: string,
  userId: string,
  enquiry: IndiaMartEnquiry,
) {
  const content = [
    'IndiaMART enquiry received and imported.',
    `External enquiry ID: ${enquiry.externalEnquiryId}`,
    enquiry.productName ? `Product: ${sanitizeText(enquiry.productName, 300)}` : null,
    enquiry.requirementText ? `Requirement: ${sanitizeText(enquiry.requirementText, 2000)}` : null,
    enquiry.quantityText ? `Quantity: ${sanitizeText(enquiry.quantityText, 120)}` : null,
    enquiry.buyerCity || enquiry.buyerState
      ? `Location: ${[enquiry.buyerCity, enquiry.buyerState, enquiry.buyerCountry].filter(Boolean).join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  await noteRepo.createNote(tenantId, 'LEAD', leadId, userId, {
    content,
    noteType: 'general',
  })
}

export async function importEnquiryAsLead(input: {
  tenantId: string
  userId: string
  connection: IndiaMartConnection
  enquiry: IndiaMartEnquiry
  mode: 'AUTO' | 'MANUAL'
  ownerId?: string | null
  force?: boolean
}): Promise<{ leadId: string; importStatus: IndiaMartImportStatus; linked: boolean }> {
  const { tenantId, userId, connection, enquiry } = input

  if (enquiry.createdLeadId && !input.force) {
    return { leadId: enquiry.createdLeadId, importStatus: enquiry.importStatus, linked: true }
  }

  await ensureIndiaMartLeadSource(tenantId, userId)

  // Existing lead match behaviour
  if (
    enquiry.matchedLeadId &&
    (enquiry.matchStatus === 'EXISTING_LEAD' || enquiry.matchStatus === 'EXACT_DUPLICATE') &&
    !input.force
  ) {
    const behaviour = connection.duplicateBehaviour

    if (behaviour === 'SEND_TO_REVIEW') {
      await repo.updateEnquiry(tenantId, enquiry.id, {
        processingStatus: 'READY',
        importStatus: 'NOT_IMPORTED',
      })
      return { leadId: enquiry.matchedLeadId, importStatus: 'NOT_IMPORTED', linked: true }
    }

    if (behaviour === 'CREATE_ACTIVITY_ON_EXISTING_LEAD' || behaviour === 'UPDATE_EXISTING_LEAD') {
      await attachIndiaMartNote(tenantId, enquiry.matchedLeadId, userId, enquiry)
      if (behaviour === 'UPDATE_EXISTING_LEAD') {
        await prisma.crmLead.update({
          where: { id: enquiry.matchedLeadId },
          data: {
            lastContactedAt: null,
            productRequirement: sanitizeText(
              [enquiry.productName, enquiry.requirementText].filter(Boolean).join('\n'),
              5000,
            ),
            updatedBy: userId,
            ...(enquiry.enquiryDate ? { sourceEnquiryDate: enquiry.enquiryDate } : {}),
          },
        })
      }
      await repo.updateEnquiry(tenantId, enquiry.id, {
        processingStatus: 'PROCESSED',
        importStatus: 'LINKED_TO_EXISTING',
        createdLeadId: enquiry.matchedLeadId,
        matchedLeadId: enquiry.matchedLeadId,
        importedAt: new Date(),
        processedAt: new Date(),
      })
      await createAuditLog({
        tenantId,
        userId,
        module: 'crm',
        entity: 'indiamart_enquiry',
        entityId: enquiry.id,
        action: 'LINK_EXISTING_LEAD',
        newValues: { leadId: enquiry.matchedLeadId, behaviour },
      })
      return { leadId: enquiry.matchedLeadId, importStatus: 'LINKED_TO_EXISTING', linked: true }
    }

    if (behaviour === 'CREATE_NEW_LEAD') {
      // fall through
    } else {
      await repo.updateEnquiry(tenantId, enquiry.id, {
        importStatus: 'DUPLICATE_SKIPPED',
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
      })
      return { leadId: enquiry.matchedLeadId, importStatus: 'DUPLICATE_SKIPPED', linked: true }
    }
  }

  const prospectName =
    sanitizeText(enquiry.buyerName, 300) ||
    sanitizeText(enquiry.buyerCompanyName, 300) ||
    'IndiaMART Buyer'

  const ownerId =
    input.ownerId ||
    (await resolveAssignee(connection, enquiry)) ||
    connection.defaultLeadOwnerId ||
    userId

  const leadCode = await nextCode(tenantId, 'LEAD')
  const productRequirement = sanitizeText(
    [enquiry.productName, enquiry.subject, enquiry.requirementText].filter(Boolean).join('\n\n'),
    5000,
  )

  try {
    const lead = await prisma.crmLead.create({
      data: {
        tenantId,
        leadCode,
        prospectName: prospectName!,
        companyName: sanitizeText(enquiry.buyerCompanyName, 300),
        contactPerson: sanitizeText(enquiry.buyerName, 200),
        email: enquiry.normalizedEmail,
        mobile: enquiry.normalizedMobile?.slice(-10) ?? enquiry.buyerMobile,
        source: INDIAMART_LEAD_SOURCE_CODE,
        productRequirement,
        expectedQty:
          enquiry.quantityValue != null ? Math.round(Number(enquiry.quantityValue)) : null,
        expectedValue: enquiry.estimatedOrderValue != null ? Number(enquiry.estimatedOrderValue) : 0,
        priority: connection.defaultPriority ?? 'high',
        stage: 'new',
        lifecycleStatus: 'open',
        activityStatus: 'active',
        assignedTo: ownerId,
        ownerId,
        remarks: `Imported from IndiaMART enquiry ${enquiry.externalEnquiryId}`,
        externalSource: INDIAMART_EXTERNAL_SOURCE,
        externalSourceId: enquiry.externalEnquiryId,
        externalSourceReference: enquiry.sourceType,
        sourceEnquiryDate: enquiry.enquiryDate ?? enquiry.receivedAt ?? enquiry.fetchedAt,
        integrationEnquiryId: enquiry.id,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    await attachIndiaMartNote(tenantId, lead.id, userId, enquiry)

    const cfg = (connection.configurationJson ?? {}) as IndiaMartConfigurationJson
    if (cfg.autoCreateFollowUp === true) {
      try {
        await createFollowUpIfEnabled(connection, lead.id, ownerId, userId, enquiry)
      } catch {
        // Follow-up failure must not roll back lead creation
      }
    }

    const importStatus: IndiaMartImportStatus =
      input.mode === 'AUTO' ? 'AUTO_IMPORTED' : 'MANUALLY_IMPORTED'

    await repo.updateEnquiry(tenantId, enquiry.id, {
      processingStatus: 'PROCESSED',
      importStatus,
      createdLeadId: lead.id,
      assignedUserId: ownerId,
      assignedAt: new Date(),
      importedAt: new Date(),
      processedAt: new Date(),
      failureCode: null,
      failureMessage: null,
    })

    await createAuditLog({
      tenantId,
      userId,
      module: 'crm',
      entity: 'indiamart_enquiry',
      entityId: enquiry.id,
      action: 'CREATE_LEAD',
      newValues: { leadId: lead.id, leadCode: lead.leadCode, mode: input.mode },
    })

    return { leadId: lead.id, importStatus, linked: false }
  } catch (err) {
    const message = (err as Error).message
    await repo.updateEnquiry(tenantId, enquiry.id, {
      processingStatus: 'FAILED',
      importStatus: 'IMPORT_FAILED',
      failureCode: 'CRM_IMPORT_FAILED',
      failureMessage: message,
    })
    throw new IndiaMartError('CRM_IMPORT_FAILED', message, 400)
  }
}

export async function linkEnquiryToLead(input: {
  tenantId: string
  userId: string
  enquiry: IndiaMartEnquiry
  leadId: string
  createActivity?: boolean
}) {
  const lead = await prisma.crmLead.findFirst({
    where: { id: input.leadId, tenantId: input.tenantId, deletedAt: null },
  })
  if (!lead) throw new IndiaMartError('VALIDATION_FAILED', 'Lead not found', 404)

  if (input.createActivity !== false) {
    await attachIndiaMartNote(input.tenantId, lead.id, input.userId, input.enquiry)
  }

  await repo.updateEnquiry(input.tenantId, input.enquiry.id, {
    matchedLeadId: lead.id,
    createdLeadId: lead.id,
    matchStatus: 'EXISTING_LEAD',
    importStatus: 'LINKED_TO_EXISTING',
    processingStatus: 'PROCESSED',
    importedAt: new Date(),
    processedAt: new Date(),
  })

  await createAuditLog({
    tenantId: input.tenantId,
    userId: input.userId,
    module: 'crm',
    entity: 'indiamart_enquiry',
    entityId: input.enquiry.id,
    action: 'LINK_EXISTING_LEAD',
    newValues: { leadId: lead.id },
  })

  return lead
}
