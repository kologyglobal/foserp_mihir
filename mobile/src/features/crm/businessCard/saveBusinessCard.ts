/**
 * Create CRM entities from business card + attach original image.
 */

import {
  createCompany,
  createContact,
  createEntityAttachment,
  createLead,
} from '@/api/crmApi'
import { prepareCardImageForUpload } from './ocrEngine'
import { toCompanyPayload, toContactPayload, toLeadPayload } from './mapToCrmPayloads'
import type { BusinessCardFields, BusinessCardSaveMode } from './types'
import { saveOfflineDraft } from '@/features/crm/offlineDrafts'
import { useSessionStore } from '@/store/sessionStore'

export interface SaveBusinessCardResult {
  mode: BusinessCardSaveMode
  leadId?: string
  companyId?: string
  contactId?: string
  offline?: boolean
}

async function uploadCard(
  entityType: string,
  entityId: string,
  imageUri: string,
): Promise<void> {
  const file = await prepareCardImageForUpload(imageUri)
  await createEntityAttachment(entityType, entityId, {
    originalFilename: file.originalFilename,
    mimeType: file.mimeType,
    contentBase64: file.contentBase64,
    documentType: 'BUSINESS_CARD',
  })
}

export async function saveBusinessCard(input: {
  mode: BusinessCardSaveMode
  fields: BusinessCardFields
  imageUri: string
  existingCompanyId?: string | null
  forceCreate?: boolean
}): Promise<SaveBusinessCardResult> {
  const online = useSessionStore.getState().isOnline
  const userId = useSessionStore.getState().profile?.user.id
  const { mode, fields, imageUri, existingCompanyId } = input

  if (!online || mode === 'draft') {
    await saveOfflineDraft(
      'business_card',
      {
        saveMode: mode === 'draft' ? 'draft' : mode,
        fields,
        existingCompanyId: existingCompanyId ?? null,
        imageUri,
      },
      {
        attachments: [
          {
            localUri: imageUri,
            originalFilename: `business_card_${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
            documentType: 'BUSINESS_CARD',
          },
        ],
      },
    )
    return { mode: mode === 'draft' ? 'draft' : mode, offline: true }
  }

  if (mode === 'create_lead') {
    const res = await createLead(toLeadPayload(fields, { leadOwnerId: userId ?? null }))
    const leadId = res.data.id
    await uploadCard('LEAD', leadId, imageUri)
    return { mode, leadId }
  }

  if (mode === 'create_company_contact') {
    const companyRes = await createCompany(toCompanyPayload(fields, { ownerId: userId }))
    const companyId = companyRes.data.id
    await uploadCard('COMPANY', companyId, imageUri)
    let contactId: string | undefined
    if (fields.firstName || fields.lastName || fields.email || fields.mobile) {
      try {
        const contactRes = await createContact(
          toContactPayload(fields, companyId, { ownerId: userId }),
        )
        contactId = contactRes.data.id
        try {
          await uploadCard('CONTACT', contactId, imageUri)
        } catch {
          // company already has card
        }
      } catch {
        // company created; contact optional soft-fail
      }
    }
    return { mode, companyId, contactId }
  }

  if (mode === 'add_contact_existing') {
    if (!existingCompanyId) {
      throw new Error('Select an existing company to add the contact.')
    }
    const contactRes = await createContact(
      toContactPayload(fields, existingCompanyId, { ownerId: userId }),
    )
    const contactId = contactRes.data.id
    await uploadCard('CONTACT', contactId, imageUri)
    try {
      await uploadCard('COMPANY', existingCompanyId, imageUri)
    } catch {
      // ok if company attach fails
    }
    return { mode, companyId: existingCompanyId, contactId }
  }

  throw new Error(`Unsupported save mode: ${mode}`)
}
