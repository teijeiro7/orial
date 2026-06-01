CREATE TABLE `finance_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`date` text NOT NULL,
	`account_id` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `finance_income` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`date` text NOT NULL,
	`account_id` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE set null
);