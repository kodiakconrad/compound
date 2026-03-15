-- Add set_scheme column to section_exercises for storing per-set progression
-- scheme data (Pyramid, 5/3/1, Drop Set) as JSON.
ALTER TABLE section_exercises ADD COLUMN set_scheme TEXT;
