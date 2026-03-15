/*
  # Update predictions table schema

  1. Changes
    - Add `title` field for short prediction title
    - Add `confidence_score` field (numeric instead of integer)
    - Add `detected_at` field to track when opportunity was detected
    - Add `predicted_window` field for time window estimates
    - Add `confirmation_date` field for tracking outcomes
    - Add `confirmation_source_url` field for evidence
    - Add `notes` field for additional context
    - Add `created_at` and `updated_at` fields
    - Rename `drafted_at` references to `detected_at` in new context

  2. Notes
    - Existing fields like `drafted_at`, `is_published` are preserved
    - New fields allow richer prediction data model
*/

-- Add new fields if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'title'
  ) THEN
    ALTER TABLE predictions ADD COLUMN title text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE predictions ADD COLUMN confidence_score numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'detected_at'
  ) THEN
    ALTER TABLE predictions ADD COLUMN detected_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'predicted_window'
  ) THEN
    ALTER TABLE predictions ADD COLUMN predicted_window text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'confirmation_date'
  ) THEN
    ALTER TABLE predictions ADD COLUMN confirmation_date timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'confirmation_source_url'
  ) THEN
    ALTER TABLE predictions ADD COLUMN confirmation_source_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'notes'
  ) THEN
    ALTER TABLE predictions ADD COLUMN notes text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE predictions ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE predictions ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create index on detected_at if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_predictions_detected_at ON predictions(detected_at DESC);
