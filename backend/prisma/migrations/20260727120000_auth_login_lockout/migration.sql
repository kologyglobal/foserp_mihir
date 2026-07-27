-- A1.5 Account lockout foundation — failed attempt counters on users
ALTER TABLE `users`
  ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lockedUntil` DATETIME(3) NULL;
