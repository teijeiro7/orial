// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';

export default {
  journal,
  migrations: {
    m0000: `CREATE TABLE \`habit_entries\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`habit_id\` text NOT NULL,
	\`date\` integer NOT NULL,
	\`completed\` integer NOT NULL,
	\`created_at\` integer NOT NULL,
	\`note\` text,
	\`notion_entry_id\` text,
	\`is_synced\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`habit_id\`) REFERENCES \`habits\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`habits\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`name\` text NOT NULL,
	\`emoji\` text DEFAULT '✅' NOT NULL,
	\`category\` text NOT NULL,
	\`frequency\` text NOT NULL,
	\`target_days\` text NOT NULL,
	\`target_count\` integer DEFAULT 1 NOT NULL,
	\`created_at\` integer NOT NULL,
	\`description\` text,
	\`notion_page_id\` text,
	\`color\` text,
	\`is_archived\` integer DEFAULT false NOT NULL,
	\`is_ai_suggested\` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`reminders\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`habit_id\` text NOT NULL,
	\`time\` text NOT NULL,
	\`days\` text NOT NULL,
	\`is_active\` integer DEFAULT true NOT NULL,
	\`calendar_event_id\` text,
	FOREIGN KEY (\`habit_id\`) REFERENCES \`habits\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`sync_queue\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`operation\` text NOT NULL,
	\`entity\` text NOT NULL,
	\`entity_id\` text NOT NULL,
	\`payload\` text NOT NULL,
	\`created_at\` integer NOT NULL,
	\`retry_count\` integer DEFAULT 0 NOT NULL,
	\`last_error\` text
);
--> statement-breakpoint
CREATE TABLE \`user_settings\` (
	\`id\` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	\`notion_access_token\` text,
	\`notion_habits_db_id\` text,
	\`notion_logs_db_id\` text,
	\`calendar_account_id\` text,
	\`calendar_provider\` text DEFAULT 'icloud',
	\`dark_mode\` integer DEFAULT true NOT NULL,
	\`ai_reminders_enabled\` integer DEFAULT true NOT NULL,
	\`sync_frequency\` text DEFAULT 'realtime',
	\`fcm_token\` text
);`,
    m0001: `CREATE TABLE \`body_metrics\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`date\` integer NOT NULL,
	\`weight_kg\` real,
	\`body_fat_pct\` real,
	\`notes\` text,
	\`photo_uri\` text,
	\`created_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`pedometer_history\` (
	\`date\` text PRIMARY KEY NOT NULL,
	\`steps\` integer DEFAULT 0 NOT NULL,
	\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`whoop_daily\` (
	\`date\` text PRIMARY KEY NOT NULL,
	\`strain\` real,
	\`kilojoule\` real,
	\`avg_heart_rate\` integer,
	\`max_heart_rate\` integer,
	\`recovery_score\` integer,
	\`resting_heart_rate\` integer,
	\`hrv_rmssd_milli\` real,
	\`spo2_percentage\` real,
	\`skin_temp_celsius\` real,
	\`sleep_performance\` integer,
	\`sleep_duration_milli\` integer,
	\`respiratory_rate\` real,
	\`nap\` integer,
	\`raw\` text,
	\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`whoop_tokens\` (
	\`id\` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	\`access_token\` text,
	\`refresh_token\` text,
	\`expires_at\` integer,
	\`scope\` text,
	\`whoop_user_id\` integer,
	\`created_at\` integer NOT NULL
);`,
  }
};
