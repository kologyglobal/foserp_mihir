# Database Entity Map — Frontend ↔ Backend

## Audit columns (all tenant-owned tables)

| DB column | Frontend equivalent |
|-----------|---------------------|
| `createdBy` | `createdById` |
| `updatedBy` | `modifiedById` |
| `createdAt` | `createdAt` |
| `updatedAt` | `modifiedAt` |
| `deletedAt` | soft delete (exclude from lists) |

User names resolved at API layer → `createdByName`, `modifiedByName`.

## CRM Companies ↔ Customer

| DB (`crm_companies`) | Frontend (`Customer`) |
|----------------------|----------------------|
| `companyCode` | `customerCode` |
| `name` | `customerName` |
| `customerType` | `customerType` |
| `industry` | `industry` |
| `addressLine1/2` | `addressLine1/2` |
| `city, state, pincode, country` | same |
| `gstin, pan` | same |
| `contactPerson, contactPhone, contactEmail` | same |
| *(side effect)* non-empty `contactPerson` on create/update | upserts primary `crm_contacts` row (`companyId`, name/phone/email) |
| `ownerId` | `ownerId` (+ resolved `ownerName`) |
| `creditDays, creditLimit` | same |
| `salesTerritory` | `salesTerritory` |
| `isActive` | `isActive` |
| `ownerId` | — (CRM owner) |

## CRM Contacts ↔ CrmContact

| DB | Frontend |
|----|----------|
| `contactCode` | `contactCode` |
| `companyId` | `customerId` |
| `firstName + lastName` | `name` (concatenated) |
| `designation, department` | same |
| `email` | `email` |
| `mobile` | `phone` |
| `isPrimary` | `isPrimary` |
| `masterContactId` | `masterContactId` |

## CRM Leads ↔ Lead

| DB | Frontend |
|----|----------|
| `leadCode` | `leadNo` |
| `prospectName` | `prospectName` |
| `companyId` | `customerId` |
| `contactId` | — |
| `source, industry` | same |
| `email, mobile` | same |
| `contactPerson` | `contactPerson` |
| `productRequirement` | `productRequirement` |
| `expectedQty` | `expectedQty` |
| `expectedValue` | `expectedValue` |
| `probability` | `probability` |
| `stage` | `stage` (LeadStage enum) |
| `priority` | `priority` |
| `lifecycleStatus` | `lifecycleStatus` |
| `activityStatus` | `activityStatus` |
| `assignedTo` | `leadOwnerId` |
| `ownerId` | `leadOwnerId` |
| `nextFollowUpAt` | `nextFollowUpDate` |
| `expectedCloseDate` | `expectedCloseDate` |
| `notQualifiedReason` | `notQualifiedReason` |
| `closedReason` | `closedReason` |
| `opportunityId` | `opportunityId` |
| `remarks` | `remarks` |

## CRM Opportunities ↔ Opportunity

| DB | Frontend |
|----|----------|
| `opportunityCode` | `opportunityNo` |
| `name` | `opportunityName` |
| `companyId` | `customerId` |
| `contactId` | `contactId` |
| `leadId` | `leadId` |
| `stageId` → stage slug | `stage` (OpportunityStage) |
| `amount` | `value` |
| `probability` | `probability` |
| `expectedCloseDate` | `expectedCloseDate` |
| `ownerId` | `ownerId` |
| `status` | `status` |
| `lostReason` | `lostReason` |
| `requirement` | `productRequirement` |
| `healthScore` | `healthScore` |

## CRM Activities ↔ CrmActivity

| DB | Frontend |
|----|----------|
| `activityType` | `type` |
| `subject, description` | same |
| `companyId` | `customerId` |
| `leadId, contactId, opportunityId` | same |
| `assignedTo` | `ownerId` |
| `scheduledAt` | `activityDate` |
| `outcome` | `outcome` |
| `status` | derived |

## Pipelines

- DB: `crm_pipelines` + `crm_pipeline_stages`
- Frontend: opportunity `stage` values seeded to match default pipeline stages
- Stage slug maps to frontend `OpportunityStage` enum

## Code Series

| Entity type | Prefix | Frontend field |
|-------------|--------|----------------|
| LEAD | LEAD- | `leadNo` |
| CONTACT | CON- | `contactCode` |
| CRM_COMPANY | CRMCO- | `customerCode` |
| OPPORTUNITY | OPP- | `opportunityNo` |
| USER | USR- | — |
