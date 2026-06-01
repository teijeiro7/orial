CREATE TABLE `finance_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'bank' NOT NULL,
	`balance_amount` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`icon` text DEFAULT '💳' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `finance_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`account_id` text,
	`order_date` text NOT NULL,
	`estimated_delivery_date` text,
	`delivered_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `finance_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`billing_day` integer NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`account_id` text,
	`category` text DEFAULT 'other' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`auto_deduct` integer DEFAULT false NOT NULL,
	`last_billed_date` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `finance_wishlist` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`url` text,
	`notes` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gym_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`name` text NOT NULL,
	`target_sets` integer DEFAULT 3 NOT NULL,
	`target_reps_min` integer DEFAULT 8 NOT NULL,
	`target_reps_max` integer DEFAULT 12 NOT NULL,
	`current_weight_kg` real DEFAULT 0 NOT NULL,
	`increment_kg` real DEFAULT 2.5 NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `gym_routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gym_routines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '💪' NOT NULL,
	`days` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gym_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `gym_routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gym_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`reps` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `gym_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `hydration_profile` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`weight_kg` real DEFAULT 70 NOT NULL,
	`age_years` integer DEFAULT 25 NOT NULL,
	`gender` text DEFAULT 'male' NOT NULL,
	`training_hours_per_day` real DEFAULT 1 NOT NULL,
	`caffeine_mg_per_day` integer DEFAULT 0 NOT NULL,
	`stimulant_meds` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`scheduled_hour` integer,
	`completed` integer DEFAULT false NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`pushed_from` text,
	`completed_at` integer,
	`created_at` integer NOT NULL
);
