# Phase 7C4 — Permission Matrix

Backend enforcement via `requirePermission` on Phase 7C4 routes.

| Permission | Purpose |
|------------|---------|
| `dispatch.challan.view` | List/detail/workbench/reconciliation |
| `dispatch.challan.create` | Create Draft from Dispatch |
| `dispatch.challan.edit` | Edit Draft document fields / refresh |
| `dispatch.challan.submit` | Ready for review |
| `dispatch.challan.approve` | Approve / send back |
| `dispatch.challan.issue` | Issue (number + snapshot + document) |
| `dispatch.challan.print` | Preview / draft print |
| `dispatch.challan.download` | Download issued document |
| `dispatch.challan.cancel` | Cancel |
| `dispatch.challan.supersede` | Supersede issued |
| `dispatch.challan.transport_edit` | Transport field edits (where gated) |
| `dispatch.challan.override_warning` | Soft warning override (not hard blockers) |
| `dispatch.challan.reports` | Challan reports |
| `dispatch.challan.export` | Export |

## Suggested roles

| Role | Access |
|------|--------|
| Dispatch Manager | Full challan set including approve/issue/cancel/supersede |
| Dispatch User | create/edit/submit/preview/print Draft |
| Store Manager | view packages/challan; no issue by default |
| Sales Manager | view + download issued; no issue |
| Quality / Finance / Operator | view or deny per matrix above |

Hard quantity / tenant / tracking blockers cannot be overridden by permission alone.
