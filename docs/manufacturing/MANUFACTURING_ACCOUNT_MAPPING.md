# Manufacturing Account Mapping

Source: `backend/src/modules/manufacturing/costing/accounting-readiness.service.ts`, `accounting/manufacturing-accounting-builder.service.ts`. Model `DefaultAccountMapping`.

Manufacturing accounting resolves **all** GL accounts through the finance **`DefaultAccountMapping`** table, keyed per `(tenantId, legalEntityId, mappingKey)`. **There is no `ManufacturingAccountMapping` table** (ADR-039).

---

## Keys used by manufacturing

Posting pairs reference these `DefaultAccountMappingKey` values:

| Key | Role |
|-----|------|
| `RAW_MATERIAL_INVENTORY` | RM credited on issue / debited on return |
| `WIP_INVENTORY` | Work-in-progress control (debited by inputs, credited by FG/variance) |
| `FINISHED_GOODS_INVENTORY` | FG debited on capitalisation |
| `LABOUR_ABSORPTION` | Labour absorption clearing (credited) |
| `MACHINE_ABSORPTION` | Machine absorption clearing (credited) |
| `JOB_WORK_ABSORPTION` | Job-work absorption clearing (credited) |
| `PRODUCTION_OVERHEAD_ABSORPTION` | Overhead absorption clearing (credited) |
| `PRODUCTION_VARIANCE` | Residual production variance |
| `SCRAP_LOSS` | Scrap loss (used by `SCRAP_RECORDED` mapping; scrap capture not yet wired) |

---

## Required mapping set (readiness)

`REQUIRED_MANUFACTURING_MAPPING_KEYS` — the 8 keys readiness checks must all exist for the resolved legal entity before posting is allowed:

```
RAW_MATERIAL_INVENTORY, WIP_INVENTORY, FINISHED_GOODS_INVENTORY,
LABOUR_ABSORPTION, MACHINE_ABSORPTION, JOB_WORK_ABSORPTION,
PRODUCTION_OVERHEAD_ABSORPTION, PRODUCTION_VARIANCE
```

If any are missing, readiness reports blocker `MISSING_ACCOUNT_MAPPINGS` and lists them under `mappingKeys.missing`. (`SCRAP_LOSS` is used by the scrap mapping pair but is not in the required-set gate.)

---

## Resolution flow

1. `resolveManufacturingLegalEntityId` — default active legal entity, else the first active one.
2. `getManufacturingAccountingReadiness` — loads `DefaultAccountMapping` rows for that LE filtered to the required keys, computes `present` / `missing`.
3. On post, `buildManufacturingPostingRequest` puts the chosen `accountMappingKey` on each voucher line; the finance `post()` engine resolves the key → account for that legal entity.

Because resolution happens inside the shared posting engine, the manufacturing module never looks up account IDs itself and cannot drift from finance's mapping.

---

## Why no parallel table (ADR-039)

Adding a `ManufacturingAccountMapping` table would fork the account-mapping source of truth and risk manufacturing GL diverging from finance. Reusing `DefaultAccountMapping` keeps one mapping surface, one validation path, and one posting engine. The Phase 7E migration only **extends** the `DefaultAccountMappingKey` enum (manufacturing keys were already present) — it creates no mapping table.
