# Manufacturing ↔ CRM Theme Mapping

How Manufacturing forms reuse the CRM/ERP shared library (no visual forks).

| Concern | CRM / shared source | Manufacturing usage |
|---|---|---|
| Page shell | `components/design-system/OperationalPageShell.tsx` (`variant="dynamics"`, `layout="enterprise"`) | `ProductionPageHeader`, `ManufacturingDocumentShell` |
| Command bar / primary action | `components/erp/ErpCommandBar.tsx` | one primary lifecycle action + More overflow on every document page |
| Status chips | `components/dynamics/DynamicsStatusChip.tsx` + `design-system/constants/status.ts` | `WorkOrderStatusBadge`, `WorkOrderHealthBadge`, `JobWorkStatusBadge` via `modules/manufacturing/ui/productionStatus.ts` |
| Form fields | `components/forms/FormField.tsx`, `components/forms/Inputs.tsx` (`erp-input`, `erp-form-label`) | all create/edit forms and drawers |
| Buttons | `components/ui/Button.tsx`, `design-system/components/Button.tsx` | all actions |
| Modals / drawers | `design-system/components/Modal.tsx`, `components/crm/CrmDrawerShell.tsx` | posting drawers, hold/resume/complete dialogs |
| Confirms | `appConfirm` / `appPromptNote` (`store/confirmDialogStore.ts`) | daily-update submit, runtime change reject/cancel |
| Loading | `design-system/components/LoadingState.tsx` | skeletons matching final layout |
| Empty states | `components/ui/EmptyState.tsx` via `ProductionEmptyState` | all queues/tabs |
| Tables | `erp-table` utility classes / `DataGrid` | registers, materials, ledger |
| Theme tokens | Tailwind `erp-*` colors, `rounded-erp`, `styles/dynamics-components.css` | no page-specific CSS added |
| Icons | Lucide line icons | consistent 3.5/4 h-w sizing |
| Semantic colors | emerald=success, amber=warning, rose=danger, sky=info (border-*-200 / bg-*-50 / text-*-900 pattern) | banners, readiness, validation |

## Manufacturing-specific extensions (justified)

These live in `frontend/src/modules/manufacturing/ui/` and compose (never replace) shared parts:

- `ManufacturingDocumentShell` — document page architecture (header, summary strip, alerts, 8+4 grid).
- `DocumentSummaryStrip` — operational facts strip (Planned/Good/Remaining…).
- `DocumentInfoPanel` — collapsible General/Dates/Source/Setup/Audit side panel.
- `ReadinessChecklist` — Ready/Missing/Attention/Recommended/Overridden states.
- `ValidationSummary` — blockers + warnings before lifecycle actions.
- `NextBestActionBanner` — single guided next action.
- `PostingImpactPanel` — Accounting-style posting result preview.
- `AdvancedSection` / `DocumentFormSection` — progressive disclosure primitives.

None of these define new colors, radii, shadows, or typography — they use `erp-*` tokens only.
