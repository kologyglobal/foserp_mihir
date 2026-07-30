# Inventory Reconciliation UI

Route: `/inventory/costing/reconciliation`

Compares physical `InventoryStockBalance` to OPEN cost layers. Summary includes stock qty, inventory value, uncosted movements. When Inventory Accounting is off, GL = Not Available (not ₹0). When on, RM+FG GL totals come from the FIN-CLOSE-1 Inventory↔GL trial balance (`/accounting/inventory-gl-reconciliation`); Force Balance is never allowed.

**Run Reconciliation** → `POST …/reconciliation/run` refreshes read model; does **not** force-balance or mutate posted costs.

Reason codes (humanized): `COSTED_QTY_MISMATCH`, `FIFO_LAYER_MISMATCH`, `NEGATIVE_STOCK_COST_PENDING`, …
