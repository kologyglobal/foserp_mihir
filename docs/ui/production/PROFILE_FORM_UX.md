# Manufacturing Profile Form UX (FORM 31)

Route: `/manufacturing/profiles` (`ProfilesSetupPage.tsx`).

## Fields

- Essential: Product, Plant, default BOM Version, default Routing Version, status.
- Warehouses: Raw Material (production), WIP, Finished Goods, Scrap.
- Policies: execution mode, material consumption method, WIP tracking, output tracking,
  partial completion, over/under-production tolerance, batch/serial/job/heat tracking,
  subcontracting allowed, direct work order allowed.

## Readiness

**Check Readiness** action calls `GET /profiles/:id/readiness` and shows:

- Ready / Not ready headline,
- per-check list (default BOM version present + active, routing version present + active,
  production/WIP/FG/scrap warehouses configured),
- explicit "Missing" list.

The same readiness feeds the **Create Work Order** context panel
(`ManufacturingReadinessPanel`), so planners see profile gaps before creating a draft —
"missing setup blocks release, not draft creation".

## Lifecycle

Activate / Deactivate with permission `manufacturing.profile.manage`; deactivated
profiles stop recommending defaults but do not affect released work orders (snapshots).
