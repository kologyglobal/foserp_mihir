/**

 * Purchase Planning Consolidation — buyers plan by Item; system tracks by PR documents.

 *

 * ## Principle

 * - Never merge Purchase Requisition documents.

 * - Operational view (default): one row per Item + UOM + Delivery location.

 * - Expanding a row shows each contributing PR line and qty.

 * - Allocation may split qty across vendors; Σ allocation qty must be > 0 and ≤ required qty

 *   (partial raise allowed). Unallocated residual stays open on planning / PR.

 * - Create PO: one draft PO per vendor, consolidated line qty, with `purchase_order_line_pr_sources`

 *   linking PO line → PR line(s) / planning rows (FIFO by required date).

 * - On partial create: planning row → `PARTIALLY_ORDERED`, `netPurchaseQuantity` reduced to residual;

 *   PR → `PARTIALLY_CONVERTED` until all lines fully ordered (`PO_CREATED`).

 * - GRN / invoice / inventory posting are unchanged (per PO).

 *

 * ## Setup

 * Purchase Setup → General → **Planning consolidation (product demand view — default on)**

 * (`planningConsolidationEnabled`, default **true** = product-centric sheet).

 * Planning Sheet has an on-page toggle: **Product demand** | **Document lines**.

 * The page defaults to Product demand regardless of prior classic UI so same item from multiple PRs appears as one row.

 *

 * ## API

 * Sheet list endpoints always return **document-level** planning rows (one PPS row per PR line).

 * Consolidation is applied in the FE (and helpers in BE create-PO path). There is no server-side

 * “consolidated list” payload — grouping is UI / allocation-time only.

 *

 * ## Migrate

 * `npx tsx scripts/prisma-cli.ts migrate deploy` (or env equivalent).

 * Migrations: `20260804140000_purchase_planning_consolidation`,

 * `20260804160000_planning_consolidation_default_on`.

 */



export {}
