CREATE TABLE `hydration` (
	`date` text PRIMARY KEY NOT NULL,
	`target_liters` real DEFAULT 3 NOT NULL,
	`consumed_liters` real DEFAULT 0 NOT NULL,
	`effective_liters` real DEFAULT 0 NOT NULL,
	`sodium_mg` integer DEFAULT 0 NOT NULL,
	`extra_liters_from_sodium` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `manual_metrics` (
	`date` text PRIMARY KEY NOT NULL,
	`calories_in` integer,
	`protein_g` integer,
	`carbs_g` integer,
	`fat_g` integer,
	`sodium_mg` integer,
	`fiber_g` integer,
	`steps_walk` integer,
	`steps_conscious` integer,
	`workout_minutes` integer,
	`workout_type` text,
	`workout_calories` integer,
	`bowel_movement` integer,
	`bowel_volume` text,
	`sleep_quality` integer,
	`stress_level` integer,
	`notes` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `nutrition_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`source` text DEFAULT 'openclaw' NOT NULL,
	`total_calories` integer,
	`protein_g` integer,
	`carbs_g` integer,
	`fat_g` integer,
	`sodium_mg` integer,
	`fiber_g` integer,
	`raw_data` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sodium_intake` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`source` text NOT NULL,
	`sodium_mg` integer NOT NULL,
	`meal_type` text,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `supplement_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`supplement_id` text NOT NULL,
	`date` text NOT NULL,
	`dose_mg` integer NOT NULL,
	`taken_at` integer,
	`skipped` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `supplements` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'creatine' NOT NULL,
	`daily_dose_mg` integer DEFAULT 5000 NOT NULL,
	`reminder_time` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weight_predictions` (
	`date` text PRIMARY KEY NOT NULL,
	`actual_weight_kg` real,
	`predicted_weight_kg` real,
	`prediction_range_low` real,
	`prediction_range_high` real,
	`predicted_delta_kg` real,
	`factors` text,
	`confidence` real,
	`updated_at` integer NOT NULL
);
