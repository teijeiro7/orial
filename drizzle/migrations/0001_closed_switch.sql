CREATE TABLE `body_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`weight_kg` real,
	`body_fat_pct` real,
	`notes` text,
	`photo_uri` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pedometer_history` (
	`date` text PRIMARY KEY NOT NULL,
	`steps` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `whoop_daily` (
	`date` text PRIMARY KEY NOT NULL,
	`strain` real,
	`kilojoule` real,
	`avg_heart_rate` integer,
	`max_heart_rate` integer,
	`recovery_score` integer,
	`resting_heart_rate` integer,
	`hrv_rmssd_milli` real,
	`spo2_percentage` real,
	`skin_temp_celsius` real,
	`sleep_performance` integer,
	`sleep_duration_milli` integer,
	`respiratory_rate` real,
	`nap` integer,
	`raw` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `whoop_tokens` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`expires_at` integer,
	`scope` text,
	`whoop_user_id` integer,
	`created_at` integer NOT NULL
);
