// SQL inlined for React Native/Metro compatibility (can't import .sql files)
const journal = {
  "version": "5",
  "dialect": "sqlite",
  "entries": [
    { "idx": 0, "version": "5", "when": 1733218319454, "tag": "0000_parched_joshua_kane", "breakpoints": true },
    { "idx": 1, "version": "5", "when": 1733230287602, "tag": "0001_closed_switch", "breakpoints": true },
    { "idx": 2, "version": "5", "when": 1733233619749, "tag": "0002_thankful_vertigo", "breakpoints": true }
  ]
};

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

const m0001 = `CREATE TABLE \`body_metrics\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`date\` integer NOT NULL,
\t\`weight_kg\` real,
\t\`body_fat_pct\` real,
\t\`notes\` text,
\t\`photo_uri\` text,
\t\`created_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`pedometer_history\` (
\t\`date\` text PRIMARY KEY NOT NULL,
\t\`steps\` integer DEFAULT 0 NOT NULL,
\t\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`whoop_daily\` (
\t\`date\` text PRIMARY KEY NOT NULL,
\t\`strain\` real,
\t\`kilojoule\` real,
\t\`avg_heart_rate\` integer,
\t\`max_heart_rate\` integer,
\t\`recovery_score\` integer,
\t\`resting_heart_rate\` integer,
\t\`hrv_rmssd_milli\` real,
\t\`spo2_percentage\` real,
\t\`skin_temp_celsius\` real,
\t\`sleep_performance\` integer,
\t\`sleep_duration_milli\` integer,
\t\`respiratory_rate\` real,
\t\`nap\` integer,
\t\`raw\` text,
\t\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`whoop_tokens\` (
\t\`id\` text PRIMARY KEY DEFAULT 'default' NOT NULL,
\t\`access_token\` text,
\t\`refresh_token\` text,
\t\`expires_at\` integer,
\t\`scope\` text,
\t\`whoop_user_id\` integer,
\t\`created_at\` integer NOT NULL
);`;

const m0002 = `CREATE TABLE \`hydration\` (
\t\`date\` text PRIMARY KEY NOT NULL,
\t\`target_liters\` real DEFAULT 3 NOT NULL,
\t\`consumed_liters\` real DEFAULT 0 NOT NULL,
\t\`effective_liters\` real DEFAULT 0 NOT NULL,
\t\`sodium_mg\` integer DEFAULT 0 NOT NULL,
\t\`extra_liters_from_sodium\` real DEFAULT 0 NOT NULL,
\t\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`manual_metrics\` (
\t\`date\` text PRIMARY KEY NOT NULL,
\t\`calories_in\` integer,
\t\`protein_g\` integer,
\t\`carbs_g\` integer,
\t\`fat_g\` integer,
\t\`sodium_mg\` integer,
\t\`fiber_g\` integer,
\t\`steps_walk\` integer,
\t\`steps_conscious\` integer,
\t\`workout_minutes\` integer,
\t\`workout_type\` text,
\t\`workout_calories\` integer,
\t\`bowel_movement\` integer,
\t\`bowel_volume\` text,
\t\`sleep_quality\` integer,
\t\`stress_level\` integer,
\t\`notes\` text,
\t\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`nutrition_logs\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`date\` text NOT NULL,
\t\`source\` text DEFAULT 'openclaw' NOT NULL,
\t\`total_calories\` integer,
\t\`protein_g\` integer,
\t\`carbs_g\` integer,
\t\`fat_g\` integer,
\t\`sodium_mg\` integer,
\t\`fiber_g\` integer,
\t\`raw_data\` text,
\t\`created_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`sodium_intake\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`date\` text NOT NULL,
\t\`source\` text NOT NULL,
\t\`sodium_mg\` integer NOT NULL,
\t\`meal_type\` text,
\t\`notes\` text,
\t\`created_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`supplement_logs\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`supplement_id\` text NOT NULL,
\t\`date\` text NOT NULL,
\t\`dose_mg\` integer NOT NULL,
\t\`taken_at\` integer,
\t\`skipped\` integer DEFAULT false NOT NULL,
\t\`notes\` text,
\t\`created_at\` integer NOT NULL,
\tFOREIGN KEY (\`supplement_id\`) REFERENCES \`supplements\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`supplements\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`name\` text NOT NULL,
\t\`type\` text DEFAULT 'creatine' NOT NULL,
\t\`daily_dose_mg\` integer DEFAULT 5000 NOT NULL,
\t\`reminder_time\` text,
\t\`is_active\` integer DEFAULT true NOT NULL,
\t\`created_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`weight_predictions\` (
\t\`date\` text PRIMARY KEY NOT NULL,
\t\`actual_weight_kg\` real,
\t\`predicted_weight_kg\` real,
\t\`prediction_range_low\` real,
\t\`prediction_range_high\` real,
\t\`predicted_delta_kg\` real,
\t\`factors\` text,
\t\`confidence\` real,
\t\`updated_at\` integer NOT NULL
);`;

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
  },
};
