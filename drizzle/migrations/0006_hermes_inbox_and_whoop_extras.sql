CREATE TABLE `hermes_inbox_log` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload_json` text NOT NULL,
	`error` text,
	`received_at` integer NOT NULL,
	`consumed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hermes_inbox_log_external_id_unique` ON `hermes_inbox_log` (`external_id`);--> statement-breakpoint
CREATE TABLE `whoop_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`source` text NOT NULL,
	`data_json` text NOT NULL,
	`captured_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
