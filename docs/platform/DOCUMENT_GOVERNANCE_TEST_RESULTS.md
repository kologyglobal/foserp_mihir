# Document Governance — Test Results

**Date:** 2026-08-04  
**Scope:** Configuration framework only (no live CRM/Purchase date enforcement)

## Unit suite

Command:

```bash
cd backend && npx vitest run tests/document-governance-date-control.test.ts
```

| Area | Cases | Result |
|------|-------|--------|
| Document registry (CRM + Purchase) | list / isRegistered | **PASS** |
| Default disabled (`policyEnabled=false`) | currentBehaviour | **PASS** |
| Feature flag OFF path (evaluate input) | currentBehaviour | **PASS** |
| Modes CURRENT_BEHAVIOUR | currentBehaviour | **PASS** |
| BLOCK / REQUIRE_APPROVAL / max days (evaluator pure) | expected reason codes | **PASS** |
| LE/Branch scope resolution | branch > LE > tenant | **PASS** |
| Permission catalog includes 5 keys | static | **PASS** |

**Evidence (local 2026-08-04):** `npx vitest run tests/document-governance-date-control.test.ts` → **12/12 PASS**.

## Live CRUD / isolation (optional)

Requires migrate + seed:

- Policy CRUD tenant isolation  
- Duplicate active prevention  
- Role/user allowance validation  
- Permissions on activate  

Not required to prove **zero document impact** (integration absent by design).

## Regression impact

CRM and Purchase modules: **no call sites** to `evaluateDocumentDatePolicy` / `getDocumentDatePolicy` in save/post paths. Flag default OFF.

## Verdict

**DOCUMENT GOVERNANCE CONFIGURATION: READY WITH CONDITIONS**

Conditions:

1. Apply migration + `db:sync-permissions` on each environment before using Admin API/UI  
2. Do not set `DOCUMENT_GOVERNANCE_DATE_CONTROL=true` until deliberate per-document integration  
3. Live policy CRUD smoke optional after migrate  
