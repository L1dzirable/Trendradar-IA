/*
  # Add concept_velocity table for Analysis Layer
  
  ## Purpose
  Tracks velocity (growth rate) of concept mentions over time windows, enabling
  acceleration detection and trend lifecycle analysis.
  
  ## New Table: concept_velocity
  Daily snapshots of concept mention velocity:
  - `id` (serial, primary key) - unique identifier
  - `concept_id` (integer, foreign key) - references concept_nodes(id)
  - `concept` (text, not null) - denormalized for query performance
  - `date` (date, not null) - snapshot date
  - `daily_mentions` (integer, default 0) - mentions on this specific date
  - `weekly_mentions` (integer, default 0) - rolling 7-day window
  - `monthly_mentions` (integer, default 0) - rolling 30-day window
  - `velocity_7d` (numeric) - growth rate over 7 days
  - `velocity_30d` (numeric) - growth rate over 30 days
  - `acceleration` (numeric) - second derivative (change in velocity)
  - `is_accelerating` (boolean) - true if acceleration > threshold
  - `created_at` (timestamptz) - record creation timestamp
  
  ## Indexes
  - Unique constraint on (concept_id, date)
  - Index on date for temporal queries
  - Index on velocity_7d for ranking
  - Index on is_accelerating for filtering
  
  ## Roadmap Compliance
  This table supports:
  - Velocity calculation (required by roadmap)
  - Acceleration detection (required by roadmap)
  - Trend lifecycle classification
  - Early warning system for emerging concepts
*/

-- Create concept_velocity table
CREATE TABLE IF NOT EXISTS concept_velocity (
  id SERIAL PRIMARY KEY,
  concept_id INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  date DATE NOT NULL,
  daily_mentions INTEGER DEFAULT 0,
  weekly_mentions INTEGER DEFAULT 0,
  monthly_mentions INTEGER DEFAULT 0,
  velocity_7d NUMERIC(10, 4) DEFAULT 0,
  velocity_30d NUMERIC(10, 4) DEFAULT 0,
  acceleration NUMERIC(10, 4) DEFAULT 0,
  is_accelerating BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(concept_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS concept_velocity_date_idx ON concept_velocity(date DESC);
CREATE INDEX IF NOT EXISTS concept_velocity_7d_idx ON concept_velocity(velocity_7d DESC);
CREATE INDEX IF NOT EXISTS concept_velocity_accelerating_idx ON concept_velocity(is_accelerating)
  WHERE is_accelerating = true;
CREATE INDEX IF NOT EXISTS concept_velocity_concept_id_idx ON concept_velocity(concept_id);

-- Enable RLS
ALTER TABLE concept_velocity ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access
CREATE POLICY "Public can view concept velocity"
  ON concept_velocity FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Service role can manage
CREATE POLICY "Service role can manage concept velocity"
  ON concept_velocity FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);