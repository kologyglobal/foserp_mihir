# SOP — Operator My Work

**Audience:** Shop-floor Operator  
**Route:** `/manufacturing/my-work`  
**Permissions:** `manufacturing.operator.my_work` (+ start / pause / complete)

## Purpose

Execute assigned operations and post good / rework / reject / scrap quantities.

## Preconditions

- Operator has active assignment on a **Released** WO.  
- Tablet/browser on API mode; logged in as self.

## Steps

1. Open **My Work** — only your tasks should appear.  
2. Select task → **Start**.  
3. When finished, **Complete** — enter Good, Rework, Reject, Scrap, optional remarks.  
4. Confirm remaining balance looks right; submit once (idempotent — do not double-tap frantically).  
5. **Pause** / **Resume** if interrupted.  
6. **Report Problem** for material/machine/quality blockers (informational — does not create PO/QC/maintenance docs).

## Expected

- Task status advances; WO stage balances update.  
- Supervisor sees progress on Control Room / Daily Update.

## Do not

- Ask for costing, BOM tree, or commercial SO data on this screen.  
- Complete another operator’s work without supervisor reassignment.  
- Use Daily Update unless you are also a supervisor and trained.
