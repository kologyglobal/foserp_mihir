# BOM Form UX (FORM 27/28)

Routes: `/manufacturing/setup/boms`, `/manufacturing/setup/boms/:bomId`,
`/manufacturing/setup/bom-versions/:versionId` (API mode; legacy demo `/manufacturing/bom/*`
redirects here in API mode).

## Header (FORM 27)

- Essential: Output Item, Output Quantity, UOM, Version, Effective From/To, Status.
- Version lifecycle: Save Draft → Validate → Activate → Create Revision; **activated
  versions are read-only** (server-enforced, UI-labelled).
- Version compare available (`compareBomVersions`).

## Component editor (FORM 28)

- Line grid: Component Item (searchable lookup), Quantity, UOM, Make/Buy, scrap %,
  stage/operation reference, notes — inline editing on draft versions.
- Validation: server `validateBomVersion` (cycle detection, UOM checks, duplicates)
  surfaced as human-readable errors before activation.
- Multilevel tree preview via the BOM tree endpoint.
- No internal relation IDs shown.

## Snapshot rule

Work order release snapshots the active BOM version onto the order
(`bomSnapshot`, shown read-only on WO detail → BOM Snapshot tab with the note that later
master revisions never change the work order).
