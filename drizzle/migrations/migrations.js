// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

const journal = require('./meta/_journal.json');

const m0000 = `CREATE TABLE \`habit_entries\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`habit_id\` text NOT NULL,
\t\`date\` integer NOT NULL,
\t\`completed\` integer NOT NULL,
\t\`created_at\` integer NOT NULL,
\t\`note\` text,
\t\`notion_entry_id\` text,
\t\`is_synced\` integer DEFAULT false NOT NULL,
\tFOREIGN KEY (\`habit_id\`) REFERENCES \`habits\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`habits\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`name\` text NOT NULL,
\t\`emoji\` text DEFAULT '✅' NOT NULL,
\t\`category\` text NOT NULL,
\t\`frequency\` text NOT NULL,
\t\`target_days\` text NOT NULL,
\t\`target_count\` integer DEFAULT 1 NOT NULL,
\t\`created_at\` integer NOT NULL,
\t\`description\` text,
\t\`notion_page_id\` text,
\t\`color\` text,
\t\`is_archived\` integer DEFAULT false NOT NULL,
\t\`is_ai_suggested\` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`reminders\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`habit_id\` text NOT NULL,
\t\`time\` text NOT NULL,
\t\`days\` text NOT NULL,
\t\`is_active\` integer DEFAULT true NOT NULL,
\t\`calendar_event_id\` text,
\tFOREIGN KEY (\`habit_id\`) REFERENCES \`habits\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`sync_queue\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`operation\` text NOT NULL,
\t\`entity\` text NOT NULL,
\t\`entity_id\` text NOT NULL,
\t\`payload\` text NOT NULL,
\t\`created_at\` integer NOT NULL,
\t\`retry_count\` integer DEFAULT 0 NOT NULL,
\t\`last_error\` text
);
--> statement-breakpoint
CREATE TABLE \`user_settings\` (
\t\`id\` text PRIMARY KEY DEFAULT 'default' NOT NULL,
\t\`notion_access_token\` text,
\t\`notion_habits_db_id\` text,
\t\`notion_logs_db_id\` text,
\t\`calendar_account_id\` text,
\t\`calendar_provider\` text DEFAULT 'icloud',
\t\`dark_mode\` integer DEFAULT true NOT NULL,
\t\`ai_reminders_enabled\` integer DEFAULT true NOT NULL,
\t\`sync_frequency\` text DEFAULT 'realtime',
\t\`fcm_token\` text
);`;

module.exports = {
  journal,
  migrations: {
    m0000
  }
};
