-- Purchase Setup: persist in-app/email notification event toggles
ALTER TABLE `purchase_settings`
  ADD COLUMN `notificationPreferences` JSON NULL;
