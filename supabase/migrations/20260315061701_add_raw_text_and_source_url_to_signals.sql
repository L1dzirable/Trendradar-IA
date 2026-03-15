/*
  # Add raw_text and raw_source_url to signals table
  
  ## Purpose
  This migration adds critical foundation layer fields to the signals table to support
  the weak signal detection engine roadmap requirements.
  
  ## Changes
  1. Add `raw_text` column - stores original unprocessed text BEFORE normalization
  2. Add `raw_source_url` column - stores canonical source URL for signal provenance
  
  ## Roadmap Compliance
  These fields are required by the roadmap for:
  - Data integrity and audit trail
  - Concept extraction from raw unprocessed text
  - Source tracking and duplicate detection
  - Historical analysis and re-processing capabilities
  
  ## Notes
  - raw_text should capture concatenated title + body before any processing
  - raw_source_url should be the canonical URL from the platform (Reddit, HN, PH, GitHub, etc.)
  - Both fields are nullable to support existing data
*/

-- Add raw_text column to store unprocessed signal text
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'signals' AND column_name = 'raw_text'
  ) THEN
    ALTER TABLE signals ADD COLUMN raw_text TEXT;
  END IF;
END $$;

-- Add raw_source_url column to store canonical source URL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'signals' AND column_name = 'raw_source_url'
  ) THEN
    ALTER TABLE signals ADD COLUMN raw_source_url TEXT;
  END IF;
END $$;

-- Create index on raw_source_url for deduplication queries
CREATE INDEX IF NOT EXISTS signals_raw_source_url_idx ON signals(raw_source_url);