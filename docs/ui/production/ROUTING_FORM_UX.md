# Routing Form UX (FORM 29/30)

Routes: `/manufacturing/setup/routings`, `/manufacturing/setup/routings/:routingId`,
`/manufacturing/setup/routing-versions/:versionId`.

## Header (FORM 29)

- Essential: Routing Name, Output Item/Profile, Version, Effective From/To, Status,
  Execution Mode.
- Lifecycle: Save Draft → Validate → Activate → Create Revision; activated versions
  read-only.

## Stage / Operation editor (FORM 30)

- Stage fields: name, sequence, stage group, work centre, dependencies, quality checkpoint.
- Operation fields: name, sequence, work centre, machine, internal vs job work,
  estimated setup/run time, instructions.
- **Dependencies are selected from stage lists — users never type dependency IDs.**
- Server validation before activation (orphan stages, invalid dependencies, missing work
  centres) with human-readable errors.

## Snapshot rule

Work order release locks `routingSnapshot`; execution stages on the WO are derived from
the snapshot, never live masters.
