ALTER TABLE `body_metrics` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `finance_orders` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `finance_subscriptions` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `finance_wishlist` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `gym_exercises` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `gym_routines` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `gym_sessions` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `gym_sets` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `habit_entries` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `habits` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `nutrition_logs` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sodium_intake` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `supplement_logs` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `supplements` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `whoop_tokens` ADD `modified_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `body_metrics` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `finance_orders` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `finance_subscriptions` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `finance_wishlist` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `gym_exercises` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `gym_routines` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `gym_sessions` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `gym_sets` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `habit_entries` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `habits` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `nutrition_logs` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `sodium_intake` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `supplement_logs` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `supplements` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `tasks` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
UPDATE `whoop_tokens` SET `modified_at` = `created_at` WHERE `modified_at` = 0;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_body_metrics_modified_at_ins`
AFTER INSERT ON `body_metrics`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `body_metrics` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_body_metrics_modified_at_upd`
AFTER UPDATE ON `body_metrics`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `body_metrics` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_finance_orders_modified_at_ins`
AFTER INSERT ON `finance_orders`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `finance_orders` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_finance_orders_modified_at_upd`
AFTER UPDATE ON `finance_orders`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `finance_orders` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_finance_subscriptions_modified_at_ins`
AFTER INSERT ON `finance_subscriptions`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `finance_subscriptions` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_finance_subscriptions_modified_at_upd`
AFTER UPDATE ON `finance_subscriptions`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `finance_subscriptions` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_finance_wishlist_modified_at_ins`
AFTER INSERT ON `finance_wishlist`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `finance_wishlist` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_finance_wishlist_modified_at_upd`
AFTER UPDATE ON `finance_wishlist`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `finance_wishlist` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_gym_exercises_modified_at_ins`
AFTER INSERT ON `gym_exercises`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `gym_exercises` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_gym_exercises_modified_at_upd`
AFTER UPDATE ON `gym_exercises`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `gym_exercises` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_gym_routines_modified_at_ins`
AFTER INSERT ON `gym_routines`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `gym_routines` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_gym_routines_modified_at_upd`
AFTER UPDATE ON `gym_routines`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `gym_routines` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_gym_sessions_modified_at_ins`
AFTER INSERT ON `gym_sessions`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `gym_sessions` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_gym_sessions_modified_at_upd`
AFTER UPDATE ON `gym_sessions`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `gym_sessions` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_gym_sets_modified_at_ins`
AFTER INSERT ON `gym_sets`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `gym_sets` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_gym_sets_modified_at_upd`
AFTER UPDATE ON `gym_sets`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `gym_sets` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_habit_entries_modified_at_ins`
AFTER INSERT ON `habit_entries`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `habit_entries` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_habit_entries_modified_at_upd`
AFTER UPDATE ON `habit_entries`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `habit_entries` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_habits_modified_at_ins`
AFTER INSERT ON `habits`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `habits` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_habits_modified_at_upd`
AFTER UPDATE ON `habits`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `habits` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_nutrition_logs_modified_at_ins`
AFTER INSERT ON `nutrition_logs`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `nutrition_logs` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_nutrition_logs_modified_at_upd`
AFTER UPDATE ON `nutrition_logs`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `nutrition_logs` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_sodium_intake_modified_at_ins`
AFTER INSERT ON `sodium_intake`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `sodium_intake` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_sodium_intake_modified_at_upd`
AFTER UPDATE ON `sodium_intake`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `sodium_intake` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_supplement_logs_modified_at_ins`
AFTER INSERT ON `supplement_logs`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `supplement_logs` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_supplement_logs_modified_at_upd`
AFTER UPDATE ON `supplement_logs`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `supplement_logs` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_supplements_modified_at_ins`
AFTER INSERT ON `supplements`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `supplements` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_supplements_modified_at_upd`
AFTER UPDATE ON `supplements`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `supplements` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_tasks_modified_at_ins`
AFTER INSERT ON `tasks`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `tasks` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_tasks_modified_at_upd`
AFTER UPDATE ON `tasks`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `tasks` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_whoop_tokens_modified_at_ins`
AFTER INSERT ON `whoop_tokens`
FOR EACH ROW
WHEN NEW.`modified_at` = 0
BEGIN
  UPDATE `whoop_tokens` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_whoop_tokens_modified_at_upd`
AFTER UPDATE ON `whoop_tokens`
FOR EACH ROW
WHEN NEW.`modified_at` = OLD.`modified_at`
BEGIN
  UPDATE `whoop_tokens` SET `modified_at` = CAST(strftime('%s','now') AS INTEGER) WHERE rowid = NEW.rowid;
END;
