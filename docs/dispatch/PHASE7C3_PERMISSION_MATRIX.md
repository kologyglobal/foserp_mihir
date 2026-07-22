# Phase 7C3 Permission Matrix

| Permission | Purpose |
|------------|---------|
| `dispatch.packing.view` | View sessions / workbench packing |
| `dispatch.packing.create` | Create session from picked Dispatch |
| `dispatch.packing.edit` | Edit session metadata / package types |
| `dispatch.packing.start` | Start session |
| `dispatch.packing.complete` | Complete session |
| `dispatch.packing.verify` | Verify session |
| `dispatch.packing.reopen` | Reopen session |
| `dispatch.packing.cancel` | Cancel session |
| `dispatch.package.view` | View packages |
| `dispatch.package.create` | Create package |
| `dispatch.package.edit` | Edit weight/dimensions/seal |
| `dispatch.package.pack` | Pack action |
| `dispatch.package.unpack` | Unpack action |
| `dispatch.package.move` | Move between packages |
| `dispatch.package.complete` | Complete package |
| `dispatch.package.verify` | Verify package |
| `dispatch.package.reopen` | Reopen package |
| `dispatch.package.cancel` | Cancel package |
| `dispatch.packing_shortage.view` | View shortages |
| `dispatch.packing_shortage.report` | Report shortage |
| `dispatch.packing_shortage.resolve` | Resolve shortage |
| `dispatch.packing_reports.view` | Reconciliation / reports |
| `dispatch.packing_reports.export` | Export packing reports |

## Suggested roles

| Role | Access |
|------|--------|
| Dispatch Manager | Full packing + verify/reopen/cancel + shortage resolve |
| Dispatch User | Create session/packages, pack/unpack/move, complete |
| Store Manager | Start, pack, unpack, report shortage, verify where configured |
| Store User | Assigned pack work, pack, unpack (if permitted), report shortage |
| Sales Manager | View only |
| Quality / Finance | View readiness blockers only |
| Operator | No packing access |

Backend `requirePermission` on every route is mandatory.
