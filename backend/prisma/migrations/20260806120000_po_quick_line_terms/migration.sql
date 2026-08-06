-- Purchase Order MVP: free-text quick lines (GOODS|SERVICE) + custom T&C + commercial master refs.

ALTER TABLE `purchase_orders`
  ADD COLUMN `payment_term_id` VARCHAR(36) NULL,
  ADD COLUMN `delivery_term_id` VARCHAR(36) NULL,
  ADD COLUMN `terms_and_conditions` TEXT NULL;

ALTER TABLE `purchase_order_lines`
  ADD COLUMN `line_type` VARCHAR(16) NOT NULL DEFAULT 'GOODS';
