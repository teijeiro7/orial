CREATE TABLE `caffeine_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`caffeine_mg` integer NOT NULL,
	`timestamp` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`modified_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_caffeine_logs_modified_at_ins`
AFTER INSERT ON `caffeine_logs`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `caffeine_logs` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_caffeine_logs_modified_at_upd`
AFTER UPDATE ON `caffeine_logs`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `caffeine_logs` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_caffeine_logs_modified_at` ON `caffeine_logs` (`modified_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_caffeine_logs_timestamp` ON `caffeine_logs` (`timestamp`);
