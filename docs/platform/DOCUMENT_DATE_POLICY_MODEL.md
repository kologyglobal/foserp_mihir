# Document Date Policy Model

Platform-level configuration for document date controls. **Storage + evaluation only** in this phase.

## `DocumentDatePolicy`

| Field | Notes |
|-------|--------|
| tenantId | Required multi-tenant scope |
| legalEntityId / branchId | Optional scope (branch > LE > tenant resolution) |
| moduleKey / documentType | Must exist in document registry |
| policyEnabled | Default `false` — master switch |
| futureDateMode / pastDateMode | `CURRENT_BEHAVIOUR` \| `ALLOW` \| `BLOCK` \| `REQUIRE_APPROVAL` |
| maxFutureDays / maxBackDateDays | Nullable; ≥ 0 when set |
| approvalRequired | Config flag for future wiring |
| allowEmergencyOverride | Config flag for future wiring |
| policyProfile / profileId | Optional template reference |
| effectiveFrom / effectiveTo | Optional window on business date |
| active | Soft lifecycle; deactivate turns off `policyEnabled` |

### Resolution order

1. Active policies for `tenantId + moduleKey + documentType`  
2. Effective-date window vs optional `businessDate`  
3. Highest scope score: **branch (300) > legal entity (200) > tenant (100)**  

### Evaluation result

`evaluateDocumentDatePolicy` returns:

- `currentBehavior`, `allowed`, `requiresApproval`, `blocked`  
- `reasonCode`, `maxAllowedDate`, `minAllowedDate`, `overrideAvailable`  

If `featureFlagEnabled=false` or `policyEnabled=false` or modes are `CURRENT_BEHAVIOUR` → **current behaviour pass-through**.

## Document registry

Code registry (not module hardcoding) — CRM: Quotation, Sales Order, Proforma Invoice, Tax Invoice; Purchase: PR, RFQ, PO, GRN, Purchase Invoice, Purchase Return.

## Profiles

`DocumentDatePolicyProfile` — reusable STRICT / STANDARD / RELAXED / CUSTOM (or tenant codes). **Not auto-assigned.**

## Allowances

`DocumentDatePolicyAllowance.kind`:

- `ALLOWED_ROLE` / `ALLOWED_USER`  
- `APPROVER_ROLE` / `OVERRIDE_ROLE`  

RBAC is **not** changed; structure only for future enforcement.

## Exception requests

`DocumentDateExceptionRequest` — PENDING/APPROVED/REJECTED/CANCELLED for future FUTURE_DATE / BACK_DATE exceptions. **Not** integrated into save/post.

## Feature flag

Env: `DOCUMENT_GOVERNANCE_DATE_CONTROL=true|false` (default false).  
