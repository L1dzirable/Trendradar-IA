/*
  # Add Signal Quality Scoring

  1. Changes
    - Add quality_score column to signals table (integer 1-10, default 5)
    - Add quality_factors column to signals table (jsonb for breakdown)

  2. Purpose
    - Track signal quality to surface high-value opportunities
    - Provide evidence quality scoring for predictions
    - Filter noise from genuine market signals

  3. Notes
    - Default score of 5 means "not yet scored"
    - quality_factors stores the breakdown of which rules contributed
*/

-- Add quality scoring columns to signals table
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 5;

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS quality_factors JSONB DEFAULT '{}';

-- Add index for quality filtering
CREATE INDEX IF NOT EXISTS signals_quality_score_idx ON signals(quality_score);
