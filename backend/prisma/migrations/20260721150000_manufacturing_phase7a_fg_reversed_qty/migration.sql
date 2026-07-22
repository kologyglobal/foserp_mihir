-- Phase 7A — track cumulative reversed qty on FG receipts (original qty immutable)

ALTER TABLE `production_finished_goods_receipts`
  ADD COLUMN `reversedQuantity` DECIMAL(18, 4) NOT NULL DEFAULT 0 AFTER `acceptedQuantity`;
