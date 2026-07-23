# Dispatch Permission Matrix (Phase 7C5)

| Action | Permission |
|--------|------------|
| View readiness / reconciliation | `dispatch.view` |
| Export reconciliation CSV | `dispatch.export` |
| Confirm (legacy soft) | `dispatch.post` **or** `dispatch.basic_confirm` |
| Post (hardened) | `dispatch.post` |
| Reverse | `dispatch.post` (override via `dispatch.override`) |
| Reserve / pick / pack / challan | existing 7C2–7C4 permissions |

Granular `dispatch.reverse.*` / `dispatch.reconciliation.*` permission seeds deferred — use existing post/view/export.
