/*
  # Add failed_trends table for Proof Layer
  
  ## Purpose
  Records predictions and opportunities that did not materialize, critical for system
  calibration and learning. Required by roadmap for proof/validation layer.
  
  ## New Table: failed_trends
  Tracks failed predictions with snapshots for analysis:
  - `id` (serial, primary key) - unique identifier
  - `prediction_id` (integer, foreign key) - references predictions(id)
  - `opportunity_id` (uuid, foreign key) - references opportunities(id)
  - `concept_slug` (varchar) - main concept identifier
  - `concept_label` (text) - human-readable concept name
  - `predicted_at` (timestamptz, not null) - when prediction was made
  - `failed_at` (timestamptz, not null) - when we determined it failed
  - `window_elapsed` (boolean) - true if time window passed without validation
  - `failure_reason` (text) - why this failed (manual or automatic)
  - `peak_score` (numeric) - highest weak signal score reached
  - `peak_date` (timestamptz) - when peak score was reached
  - `snapshot_data` (jsonb) - frozen state at prediction time
  - `notes` (text) - additional context
  - `created_at` (timestamptz) - record creation timestamp
  
  ## Indexes
  - Index on prediction_id for lookups
  - Index on failed_at for temporal analysis
  - Index on concept_slug for concept-based queries
  
  ## Roadmap Compliance
  This table supports:
  - Failed trend tracking (required by roadmap)
  - System calibration and accuracy measurement
  - Learning from false positives
  - Historical analysis for model improvement
*/

-- Create failed_trends table
CREATE TABLE IF NOT EXISTS failed_trends (
  id SERIAL PRIMARY KEY,
  prediction_id INTEGER REFERENCES predictions(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  concept_slug VARCHAR(255) NOT NULL,
  concept_label TEXT,
  predicted_at TIMESTAMPTZ NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_elapsed BOOLEAN DEFAULT false,
  failure_reason TEXT,
  peak_score NUMERIC(5, 2),
  peak_date TIMESTAMPTZ,
  snapshot_data JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS failed_trends_prediction_id_idx ON failed_trends(prediction_id);
CREATE INDEX IF NOT EXISTS failed_trends_opportunity_id_idx ON failed_trends(opportunity_id);
CREATE INDEX IF NOT EXISTS failed_trends_failed_at_idx ON failed_trends(failed_at DESC);
CREATE INDEX IF NOT EXISTS failed_trends_concept_slug_idx ON failed_trends(concept_slug);

-- Enable RLS
ALTER TABLE failed_trends ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access (for transparency)
CREATE POLICY "Public can view failed trends"
  ON failed_trends FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Authenticated users can manage
CREATE POLICY "Authenticated users can manage failed trends"
  ON failed_trends FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);