-- Inventory Transaction Type Registry: reserve two real gaps identified in the
-- reference-type classification (customer Sales Return, generic Requisition Issue).
-- Additive only — no posting caller wired yet, matching how DISPATCH/WIP_RECEIVE/
-- MOVE_TO_WIP/MOVE_FROM_WIP already exist as declared-but-unused values.

ALTER TABLE `inventory_stock_movements`
  MODIFY `referenceType` ENUM(
    'OPN','INW','ISS','ADJ','GRN','ISSUE_TO_WO','RETURN_FROM_WO','WIP_RECEIVE',
    'WIP_TRANSFER','MOVE_TO_WIP','MOVE_FROM_WIP','SA_RECEIPT','FG_RECEIPT',
    'DISPATCH','FG_DISPATCH','SUBCON_OUT','SUBCON_IN','QUALITY_RELEASE',
    'QUALITY_HOLD','QUALITY_REJECT','TRANSFER_DISPATCH','TRANSFER_RECEIPT',
    'TRANSFER_REVERSAL','STOCK_COUNT','STOCK_COUNT_REVERSAL',
    'CONTROLLED_ADJUSTMENT','ADJUSTMENT_REVERSAL','ISSUE_TO_MAINTENANCE',
    'SALES_RETURN','REQUISITION_ISSUE'
  ) NOT NULL;
