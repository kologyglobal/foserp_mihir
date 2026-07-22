# Quality Inspection Plan Rules (Phase 7B)

## Plan lifecycle

- **DRAFT** — editable; cannot auto-create required inspections.
- **ACTIVE** — eligible for plan resolution.
- **INACTIVE / ARCHIVED** — not selected for new inspections.

## Revisions

- Inspections bind to an **immutable plan revision snapshot** (parameters/lines + sampling + certificate flags).
- Activating a new revision **supersedes** the prior ACTIVE revision; historical inspections keep their snapshot.
- Do not edit an ACTIVE revision in place after inspections reference it — create a new revision.

## Resolution order (`QualityPlanResolver` / `resolveInspectionPlan`)

1. Explicit `inspectionPlanId`
2. Item + category (+ operation/stage hints when present)
3. Category-level / profile `defaultQualityPlanRef` code
4. Null (ad-hoc inspection allowed with permission)

## Sampling

| Method | Sample qty |
|--------|------------|
| FULL_INSPECTION | = inspection qty |
| FIXED_SAMPLE | configured fixed size (capped at inspection qty) |
| PERCENTAGE | round(pct × inspection qty), min 1 when qty > 0 |
| MANUAL_SAMPLE | user-entered (validated > 0 and ≤ inspection qty) |

## Certificates

When `certificateRequired` on the resolved revision/plan: PASS is blocked until a verified (or waived) certificate is linked — see QUALITY_CERTIFICATE_RULES.md.
