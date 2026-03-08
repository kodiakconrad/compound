-- 002_drop_is_template.sql
-- Removes the is_template column from programs.
-- Templates are no longer a user-facing concept. All programs are just programs.
-- Prebuilt (seeded) programs are identified by is_prebuilt=1 and are read-only.

ALTER TABLE programs DROP COLUMN is_template;
