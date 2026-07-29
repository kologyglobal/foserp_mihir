# Moving Average UI

Route: `/inventory/costing/average` (alias `/moving-average`)

Current MA state from `InventoryStockBalance` (`avgRate`, qty, value) via `GET …/moving-average`. History opens MA-filtered cost entries for the item — no React re-derivation.
