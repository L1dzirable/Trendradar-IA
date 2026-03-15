/*
  # Add Weak Signal Scoring Fields to concept_nodes

  1. New Columns Added to concept_nodes
    - `weak_signal_score` (integer) - Composite score 0-100 combining all factors
    - `velocity_score` (decimal) - Growth rate of mentions over time
    - `frequency_score` (integer) - Based on total mention count
    - `diversity_score` (integer) - Based on source distribution
    - `recency_score` (integer) - Based on last_seen timestamp
    - `cooccurrence_score` (integer) - Based on connections to other concepts
    - `score_updated_at` (timestamp) - Last time scores were calculated
    - `first_seen` (timestamp) - First appearance of concept
    - `last_seen` (timestamp) - Most recent appearance of concept
    - `mention_count` (integer) - Total number of mentions
    - `source_distribution` (jsonb) - Distribution across sources

  2. Purpose
    - Enable weak signal detection by scoring emerging concepts
    - Track concept evolution over time
    - Identify high-potential trends early

  3. Indexes
    - Add index on weak_signal_score for fast retrieval of top concepts
    - Add index on score_updated_at for tracking scoring runs
*/

-- Add temporal tracking fields if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'first_seen'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN first_seen timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'last_seen'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN last_seen timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'mention_count'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN mention_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'source_distribution'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN source_distribution jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add scoring fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'weak_signal_score'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN weak_signal_score integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'velocity_score'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN velocity_score decimal(10, 4) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'frequency_score'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN frequency_score integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'diversity_score'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN diversity_score integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'recency_score'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN recency_score integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'cooccurrence_score'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN cooccurrence_score integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'concept_nodes' AND column_name = 'score_updated_at'
  ) THEN
    ALTER TABLE concept_nodes ADD COLUMN score_updated_at timestamptz;
  END IF;
END $$;

-- Create indexes for efficient scoring queries
CREATE INDEX IF NOT EXISTS idx_concept_nodes_weak_signal_score 
  ON concept_nodes(weak_signal_score DESC);

CREATE INDEX IF NOT EXISTS idx_concept_nodes_score_updated_at 
  ON concept_nodes(score_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_concept_nodes_last_seen 
  ON concept_nodes(last_seen DESC);