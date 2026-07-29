# Inventory Reconciliation UI

Route: `/inventory/costing/reconciliation`

Compares physical `InventoryStockBalance` to OPEN cost layers. Summary includes stock qty, inventory value, uncosted movements, GL N/A when accounting TB deferred.

**Run Reconciliation** → `POST …/reconciliation/run` refreshes read model; does **not** force-balance or mutate posted costs.

Reason codes (humanized): `COSTED_QTY_MISMATCH`, `FIFO_LAYER_MISMATCH`, `NEGATIVE_STOCK_COST_PENDING`, …
