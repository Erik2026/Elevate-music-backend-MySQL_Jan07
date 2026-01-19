-- Add publishDate column to music table
-- Run this SQL in your MySQL database

ALTER TABLE music 
ADD COLUMN publishDate DATETIME NULL AFTER releaseDate;

-- Optional: Copy releaseDate to publishDate for existing records
-- UPDATE music SET publishDate = releaseDate WHERE publishDate IS NULL;
