# Reversal Dependency Rules (Phase 5C)

- Prefer **ordered reversal plans** over hidden cascade.
- Progress → blocked by later WIP.
- Material issue → blocked by later material/WIP transfer.
- FG → blocked when free on-hand < reverse qty.
- JW dispatch → blocked by any receipt.
- Open PENDING QC on WO → blocker for progress-related paths.
- Open NCR → warning.

Human-readable messages are returned in preview `blockers` / `dependencies` / `recommendedPlan`.
