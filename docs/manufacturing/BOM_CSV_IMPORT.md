# Manufacturing BOM CSV Import

## Scope

The live Manufacturing Setup BOM register supports one combined CSV containing one or more BOM codes. The feature is API-mode only and does not read or mutate demo BOM stores.

```text
Download template → upload CSV → browser parse → server preview
→ confirm → transactional Draft creation → review → separate activation
```

Imported BOMs are never activated automatically.

## Entry points

- `/manufacturing/setup/boms`: **Download Template** and **Import CSV**
- BOM version editor: **Import as New Draft Revision**, restricted to the opened BOM code

Required permission: `manufacturing.bom.import`.

After deployment, run the standard permission sync (`cd backend && npm run db:sync-permissions`) and re-login so existing sessions receive the new grant.

## API

- `GET /api/v1/t/:tenantSlug/manufacturing/boms/import/template`
- `POST /api/v1/t/:tenantSlug/manufacturing/boms/import/preview`
- `POST /api/v1/t/:tenantSlug/manufacturing/boms/import`

The browser parses CSV and sends `{ rows }`. Confirm sends `{ rows, idempotencyKey }`. The server repeats all validation before persistence; frontend preview is never authoritative.

## Version behavior

- New `bom_code`: create `ManufacturingBom` + Draft Version 1.
- Existing `bom_code`: preserve all existing versions and create the next Draft revision.
- Existing Draft lines are never replaced.
- Active/Superseded versions are never edited.
- The next version is calculated inside a serializable transaction from the highest persisted version number.

Multiple Draft revisions are supported by the current schema and lifecycle. Activation remains an explicit user action and supersedes the prior Active version through the existing activation service.

## Tree rules

- `line_ref` is unique within each BOM.
- Blank `parent_line_ref` means a direct child of the output item.
- A nonblank parent must resolve to `line_ref` in the same BOM.
- Levels are derived from parent references, not accepted from the browser.
- Orphans, cross-BOM references, and circular references block import.
- `sequence` must be unique among siblings; the same sequence may be reused under different parents.

When optional execution fields are blank, parent rows default to `MAKE` / `SUBASSEMBLY`; leaf rows default to `BUY` / `RAW_MATERIAL`. `quantity_basis` defaults to `PER_UNIT`, scrap to 0%, and yield to 100%.

## Code resolution

All lookups are tenant-scoped and active-only:

- `output_item_code` and `component_item_code` → `MasterItem.id`
- output/component UOM codes → `MasterUom.id`
- `operation_code` → a unique active `ManufacturingRoutingOperation.id`
- `source_warehouse_code` is validated against `MasterWarehouse`; BOM lines currently have no warehouse column, so preview reports that it is not persisted

Missing masters are never created automatically. Browser-supplied UUIDs are not part of the template and are not trusted.

## Transaction and audit

Each BOM group is inserted atomically in a Prisma serializable transaction: header (when new), next Draft version, all lines, parent links, and one `CSV_IMPORT` audit event. A failed BOM tree leaves no partial lines for that BOM. The confirmation UUID is recorded in the audit event and safely replays completed BOM groups after a client retry.

The official reference file is [`docs/templates/bom-combined-import-template.csv`](../templates/bom-combined-import-template.csv).
