-- De-dupe rows created by the pre-fix upsert bug (it conflicted on `id`, which
-- is always a new UUID, so every sync inserted a new row instead of updating
-- the existing one for that date). Keep the most recently inserted row per
-- date so CREATE UNIQUE INDEX below doesn't fail on existing duplicates.
DELETE FROM `body_metrics`
WHERE rowid NOT IN (
  SELECT MAX(rowid) FROM `body_metrics` GROUP BY `date`
);--> statement-breakpoint
CREATE UNIQUE INDEX `body_metrics_date_unique` ON `body_metrics` (`date`);