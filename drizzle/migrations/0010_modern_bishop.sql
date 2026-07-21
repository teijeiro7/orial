PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_nutrition_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`source` text DEFAULT 'openclaw' NOT NULL,
	`total_calories` integer,
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	`sodium_mg` real,
	`fiber_g` real,
	`raw_data` text,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_nutrition_logs`("id", "date", "source", "total_calories", "protein_g", "carbs_g", "fat_g", "sodium_mg", "fiber_g", "raw_data", "created_at", "updated_at") SELECT "id", "date", "source", "total_calories", "protein_g", "carbs_g", "fat_g", "sodium_mg", "fiber_g", "raw_data", "created_at", "updated_at" FROM `nutrition_logs`;--> statement-breakpoint
DROP TABLE `nutrition_logs`;--> statement-breakpoint
ALTER TABLE `__new_nutrition_logs` RENAME TO `nutrition_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;