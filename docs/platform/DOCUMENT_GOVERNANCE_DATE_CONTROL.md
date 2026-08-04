# Document Governance — Date Control

**Status:** Configuration framework only  
**Feature flag:** `DOCUMENT_GOVERNANCE_DATE_CONTROL` (default **OFF**)  
**Verdict:** **READY WITH CONDITIONS** (config ready; live document enforcement **not** integrated)

## Purpose

Provide a centralized, admin-configurable model for future control of:

- post-dated / back-dated documents  
- max future / back days  
- approval requirement  
- emergency override  
- allowed roles/users / approver / override roles  
- closed-period interaction (reserved for later)  

**Current product behaviour must not change** until Admin enables a policy **and** a document type is intentionally wired under the feature flag.

## Safe defaults

| Setting | Default |
|---------|---------|
| `policyEnabled` | `false` |
| `futureDateMode` / `pastDateMode` | `CURRENT_BEHAVIOUR` |
| Feature flag | OFF |

When `policyEnabled=false`, mode=`CURRENT_BEHAVIOUR`, or flag OFF, evaluators report **currentBehaviour** and **allow** the date — no blocking.

## Components

| Layer | Location |
|-------|----------|
| Schema | `DocumentDatePolicy`, `DocumentDatePolicyProfile`, `DocumentDatePolicyAllowance`, `DocumentDateExceptionRequest` |
| Migration | `20260804200000_document_governance_date_control` |
| Registry | `backend/src/modules/document-governance/document-registry.ts` |
| Services | `getDocumentDatePolicy`, `evaluateDocumentDatePolicy` (not called from CRM/Purchase save/post) |
| Admin API | `/api/v1/t/:tenantSlug/admin/document-governance/*` |
| Admin UI | `/admin/document-governance/date-controls` |
| Permissions | `platform.document_governance.*` |

## Explicit stop line (this phase)

Do **not**:

- block future/back dates on live documents  
- trigger approvals from CRM or Purchase  
- change business-date or accounting-period validation  
- audit document date exceptions (config changes only)

## Related docs

- [DOCUMENT_DATE_POLICY_MODEL.md](./DOCUMENT_DATE_POLICY_MODEL.md)  
- [DOCUMENT_GOVERNANCE_ADMIN.md](./DOCUMENT_GOVERNANCE_ADMIN.md)  
- [DOCUMENT_GOVERNANCE_UAT.md](./DOCUMENT_GOVERNANCE_UAT.md)  
- [DOCUMENT_GOVERNANCE_TEST_RESULTS.md](./DOCUMENT_GOVERNANCE_TEST_RESULTS.md)  
