CREATE TABLE `whoop_journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_start` integer NOT NULL,
	`cycle_end` integer,
	`question_text` text NOT NULL,
	`answered_yes` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`user_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whoop_journal_entries_cycle_question_unique` ON `whoop_journal_entries` (`cycle_start`,`question_text`);--> statement-breakpoint
CREATE TABLE `whoop_sleep_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_start` integer NOT NULL,
	`cycle_end` integer,
	`sleep_start` integer NOT NULL,
	`sleep_end` integer NOT NULL,
	`sleep_score_pct` integer,
	`respiratory_rate` real,
	`sleep_duration_min` integer,
	`time_in_bed_min` integer,
	`light_sleep_min` integer,
	`deep_sleep_min` integer,
	`rem_sleep_min` integer,
	`awake_min` integer,
	`sleep_needed_min` integer,
	`sleep_debt_min` integer,
	`sleep_efficiency_pct` integer,
	`sleep_consistency_pct` integer,
	`is_nap` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'csv_import' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`user_id` text
);
--> statement-breakpoint
CREATE TABLE `whoop_workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_start` integer NOT NULL,
	`cycle_end` integer,
	`workout_start` integer NOT NULL,
	`workout_end` integer NOT NULL,
	`activity_name` text NOT NULL,
	`activity_strain` real,
	`kilojoule` real,
	`max_heart_rate` integer,
	`avg_heart_rate` integer,
	`hr_zone_1_pct` real,
	`hr_zone_2_pct` real,
	`hr_zone_3_pct` real,
	`hr_zone_4_pct` real,
	`hr_zone_5_pct` real,
	`gps_enabled` integer,
	`source` text DEFAULT 'csv_import' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`user_id` text
);
--> statement-breakpoint
ALTER TABLE `body_metrics` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `caffeine_logs` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `finance_accounts` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `finance_subscriptions` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `finance_wishlist` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `gym_exercises` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `gym_routines` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `gym_sessions` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `gym_sets` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `hydration` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `hydration_profile` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `insight_logs` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `manual_metrics` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `nutrition_logs` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `pedometer_history` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `sodium_intake` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `supplement_logs` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `supplements` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `weight_predictions` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `whoop_daily` ADD `user_id` text;