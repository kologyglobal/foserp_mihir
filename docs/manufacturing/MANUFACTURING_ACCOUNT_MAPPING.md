# Manufacturing Account Mapping

Source: `backend/src/modules/manufacturing/costing/manufacturing-account-mapping-readiness.service.ts`, `accounting-readiness.service.ts`, `accounting/manufacturing-accounting-builder.service.ts`. Model `DefaultAccountMapping`.

Manufacturing accounting resolves **all** GL accounts through the finance **`DefaultAccountMapping`** table, keyed per `(tenantId, legalEntityId, mappingKey)`. **There is no `ManufacturingAccountMapping` table** (ADR-039).

---

## Core mandatory keys (always)

| Key | Blocker if missing / invalid |
|-----|------------------------------|
| `WIP_INVENTORY` | `WIP_ACCOUNT_NOT_CONFIGURED` |
| `FINISHED_GOODS_INVENTORY` | `FINISHED_GOODS_ACCOUNT_NOT_CONFIGURED` |
| `PRODUCTION_VARIANCE` | `PRODUCTION_VARIANCE_ACCOUNT_NOT_CONFIGURED` |

---

## Conditional keys (when cost/event type enabled)

| Product name | Existing `DefaultAccountMappingKey` | Default required? | Blocker |
|--------------|-------------------------------------|-------------------|---------|
| RAW_MATERIAL_INVENTORY | `RAW_MATERIAL_INVENTORY` | Yes (material issue) | via `MISSING_ACCOUNT_MAPPINGS` |
| MATERIAL_CONSUMPTION | `MATERIAL_CONSUMPTION` | No (not MappingReady yet) | — |
| DIRECT_LABOUR_ABSORPTION | `LABOUR_ABSORPTION` | Yes | `LABOUR_ACCOUNT_NOT_CONFIGURED` |
| MACHINE_COST_ABSORPTION | `MACHINE_ABSORPTION` | Yes | `MACHINE_ACCOUNT_NOT_CONFIGURED` |
| JOB_WORK_COST | `JOB_WORK_ABSORPTION` | Yes | `JOB_WORK_ACCOUNT_NOT_CONFIGURED` |
| MANUFACTURING_OVERHEAD | `PRODUCTION_OVERHEAD_ABSORPTION` | When costing policy `overheadMethod !== NONE` | `OVERHEAD_ACCOUNT_NOT_CONFIGURED` |
| SCRAP_EXPENSE | `SCRAP_LOSS` | Yes | `SCRAP_ACCOUNT_NOT_CONFIGURED` |
| REWORK_COST | *(no enum key)* | Not validated separately | — |
| PRODUCTION_CLEARING | *(no enum key)* | Not validated | — |
| WIP_ADJUSTMENT | `STOCK_ADJUSTMENT` | No (not MappingReady yet) | — |
| FG_CAPITALISATION | `FINISHED_GOODS_INVENTORY` | Covered by core FG | — |

Any missing required key also sets `MISSING_ACCOUNT_MAPPINGS`. Readiness returns `mappingKeys.missing`.

---

## Account validation rules (per mapped key)

For each required mapping the readiness service checks:

1. Mapping exists for the legal entity  
2. Linked account exists  
3. Account is active (`isActive`)  
4. Account belongs to the same tenant + legal entity  
5. Account is allowed for posting (`!isGroup`; system mfg posts do not require `allowManualPosting`)  
6. Account is not blocked (`isActive === true` — `Account` has no separate `isBlocked` flag)  
7. No duplicate conflicting `DefaultAccountMapping` rows for the same key (`@@unique` + readiness check)  

Invalid rows appear under `mappingKeys.invalid` and count toward `mappingKeys.missing`.

---

## Resolution flow

1. `resolveManufacturingLegalEntityId` — default active legal entity, else the first active one.  
2. `validateManufacturingAccountMappings` — core + policy-driven conditional keys, account quality.  
3. `getManufacturingAccountingReadiness` — merges mapping blockers with period / events / sign-offs.  
4. On post, `buildManufacturingPostingRequest` puts `accountMappingKey` on each voucher line; finance `post()` resolves key → account.

---

## Why no parallel table (ADR-039)

Adding a `ManufacturingAccountMapping` table would fork the account-mapping source of truth. Reusing `DefaultAccountMapping` keeps one mapping surface, one validation path, and one posting engine.
