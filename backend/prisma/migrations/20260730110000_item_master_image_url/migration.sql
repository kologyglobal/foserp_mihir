-- Item Master product image (relative path in uploads/items)
ALTER TABLE `master_items`
  ADD COLUMN `imageUrl` VARCHAR(500) NULL AFTER `subAssemblyRule`;
