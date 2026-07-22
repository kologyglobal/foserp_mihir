ALTER TABLE `vendor_payments` ADD COLUMN `paymentUniquenessKey` VARCHAR(512) NULL;
CREATE UNIQUE INDEX `vendor_payments_paymentUniquenessKey_key` ON `vendor_payments`(`paymentUniquenessKey`);
