# Manufacturing Account Mapping Keys (enablement)

Reuse finance `DefaultAccountMapping` only (ADR-039). No Manufacturing mapping table.

## Core (always)

| Key | Blocker |
|-----|---------|
| `WIP_INVENTORY` | `WIP_ACCOUNT_NOT_CONFIGURED` |
| `FINISHED_GOODS_INVENTORY` | `FINISHED_GOODS_ACCOUNT_NOT_CONFIGURED` |
| `PRODUCTION_VARIANCE` | `PRODUCTION_VARIANCE_ACCOUNT_NOT_CONFIGURED` |

## Conditional (when cost/event type enabled)

| Product alias | Enum key | Default required |
|---------------|----------|------------------|
| RAW_MATERIAL_INVENTORY | `RAW_MATERIAL_INVENTORY` | Yes |
| DIRECT_LABOUR_ABSORPTION | `LABOUR_ABSORPTION` | Yes |
| MACHINE_COST_ABSORPTION | `MACHINE_ABSORPTION` | Yes |
| JOB_WORK_COST | `JOB_WORK_ABSORPTION` | Yes |
| MANUFACTURING_OVERHEAD | `PRODUCTION_OVERHEAD_ABSORPTION` | When overhead ≠ NONE |
| SCRAP_EXPENSE | `SCRAP_LOSS` | Yes |

UI links must open **Finance account mappings** (same legal entity) — never a second Manufacturing form.

See also: `docs/manufacturing/MANUFACTURING_ACCOUNT_MAPPING.md`.
