# Phase 7C2 Permission Matrix

| Permission | Dispatch Manager | Dispatch User | Inventory/Store* | Sales view |
|------------|------------------|---------------|------------------|------------|
| `dispatch.reservation.view` | ✓ | ✓ | ✓ | ✓ |
| `dispatch.reservation.create` | ✓ | ✓ | ✓ | |
| `dispatch.reservation.release` | ✓ | | ✓ | |
| `dispatch.reservation.reallocate` | ✓ | | ✓ | |
| `dispatch.reservation.conflicts` | ✓ | ✓ | ✓ | ✓ |
| `dispatch.pick_list.view` | ✓ | ✓ | ✓ | ✓ |
| `dispatch.pick_list.create` | ✓ | ✓ | ✓ | |
| `dispatch.pick_list.release` | ✓ | | ✓ | |
| `dispatch.pick_list.assign` | ✓ | | ✓ | |
| `dispatch.pick_list.start` | ✓ | ✓ | ✓ | |
| `dispatch.pick_list.pick` | ✓ | ✓ | ✓ | |
| `dispatch.pick_list.report_shortage` | ✓ | ✓ | ✓ | |
| `dispatch.pick_list.resolve_shortage` | ✓ | | ✓ | |
| `dispatch.pick_list.unpick` | ✓ | ✓ | ✓ | |
| `dispatch.pick_list.complete` | ✓ | ✓ | ✓ | |
| `dispatch.pick_list.cancel` | ✓ | | ✓ | |
| `dispatch.tracking.view` | ✓ | ✓ | ✓ | ✓ |
| `dispatch.tracking.allocate` | ✓ | ✓ | ✓ | |

\*Granted via Inventory Manager / Dispatch roles in `permissions.ts` where Store-specific roles are not present.

Backend `requirePermission` is mandatory on all routes.
