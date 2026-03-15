/*
  # Add market_hypotheses table for Analysis Layer
  
  ## Purpose
  Stores generated market hypotheses that link emerging concepts to potential market opportunities.
  Required by the roadmap for bridging weak signals to actionable predictions.
  
  ## New Table: market_hypotheses
  Generated hypotheses about market opportunities:
  - `id` (serial, primary key) - unique identifier
  - `cluster_id` (integer, foreign key) - references trend_clusters(id)
  - `hypothesis_text` (text, not null) - the market hypothesis statement
  - `supporting_concepts` (jsonb) - array of concept IDs and scores
  - `confidence_score` (numeric) - 0-100 confidence in hypothesis
  - `market_size_estimate` (text) - qualitative size estimate
  - `timing_estimate` (text) - when this opportunity might materialize
  - `macro_driver` (varchar) - primary macro trend driving this
  - `pain_classification` (varchar) - type of pain being addressed
  - `target_segments` (jsonb) - potential customer segments
  - `convergence_score` (numeric) - how many trends are converging
  - `status` (varchar) - draft, validated, invalidated
  - `created_at` (timestamptz) - creation timestamp
  - `updated_at` (timestamptz) - last update timestamp
  - `validated_at` (timestamptz) - when hypothesis was validated (if applicable)
  
  ## Indexes
  - Index on cluster_id for lookups
  - Index on confidence_score for ranking
  - Index on status for filtering
  - Index on created_at for temporal queries
  
  ## Roadmap Compliance
  This table supports:
  - Market hypothesis generation (required by roadmap)
  - Convergence scoring
  - Opportunity prioritization
  - Validation tracking
*/

-- Create market_hypotheses table
CREATE TABLE IF NOT EXISTS market_hypotheses (
  id SERIAL PRIMARY KEY,
  cluster_id INTEGER REFERENCES trend_clusters(id) ON DELETE CASCADE,
  hypothesis_text TEXT NOT NULL,
  supporting_concepts JSONB DEFAULT '[]'::jsonb,
  confidence_score NUMERIC(5, 2) DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  market_size_estimate TEXT,
  timing_estimate TEXT,
  macro_driver VARCHAR(100),
  pain_classification VARCHAR(100),
  target_segments JSONB DEFAULT '[]'::jsonb,
  convergence_score NUMERIC(5, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'invalidated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS market_hypotheses_cluster_id_idx ON market_hypotheses(cluster_id);
CREATE INDEX IF NOT EXISTS market_hypotheses_confidence_score_idx ON market_hypotheses(confidence_score DESC);
CREATE INDEX IF NOT EXISTS market_hypotheses_status_idx ON market_hypotheses(status);
CREATE INDEX IF NOT EXISTS market_hypotheses_created_at_idx ON market_hypotheses(created_at DESC);

-- Enable RLS
ALTER TABLE market_hypotheses ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access
CREATE POLICY "Public can view market hypotheses"
  ON market_hypotheses FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Authenticated users can manage
CREATE POLICY "Authenticated users can manage market hypotheses"
  ON market_hypotheses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);