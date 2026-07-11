CREATE TABLE `insight_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`generated_at` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`dismissed` integer DEFAULT false NOT NULL,
	`source_agent` text DEFAULT 'jarvis' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `gym_exercises` ADD `swap_group` text;--> statement-breakpoint
ALTER TABLE `gym_exercises` ADD `one_rm_estimated` real;--> statement-breakpoint
ALTER TABLE `gym_exercises` ADD `last_swapped_at` integer;