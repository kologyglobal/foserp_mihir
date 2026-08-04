# Purchase Requisition Versioning

PR versioning mirrors PO revision tracking: each revise increments `revisionNo`, archives the prior header/lines, and writes field-level change rows.

## Setup

| Flag | Default | Effect |
|------|---------|--------|
| `requireApprovalOnPrRevision` | **true** | After revise, PR returns to pending approval |
| `requireApprovalOnPrRevision` **off** | — | PR keeps current approved status after revise |

Configure under **Purchase → Setup → General**.

## Workflow

1. Approved PR with **no ordered PO quantity** on any line may be revised.
2. User opens **Revise** from PR detail (`/purchase/requisitions/:id/revise`).
3. `POST /api/v1/t/:tenant/purchase/requisitions/:id/revise` with reason + optional header/line patches.
4. Prior state stored in `purchase_requisition_revisions` + archived tables.
5. `GET .../revisions` lists revision history for the PR detail **Change History** panel.

## Permissions

- View revisions: `purchase.pr.view`
- Revise: `purchase.pr.revise`

## Blocks

- PR lines with `orderedQuantity > 0` cannot be revised (PO traceability guard).
- Demo mode (`VITE_USE_API=false`): revise UI/API not available — use API mode.
