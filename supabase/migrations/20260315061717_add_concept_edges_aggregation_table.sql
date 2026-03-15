/*
  # Add concept_edges aggregation table
  
  ## Purpose
  Creates an aggregated view of concept relationships over time, required by the roadmap
  for propagation detection and graph analysis.
  
  ## New Table: concept_edges
  Aggregates edge_snapshots into a time-windowed view of concept relationships:
  - `id` (serial, primary key) - unique identifier
  - `concept_a` (text, not null) - first concept (alphabetically sorted)
  - `concept_b` (text, not null) - second concept (alphabetically sorted)
  - `total_weight` (integer, default 0) - cumulative co-occurrence count
  - `first_seen` (timestamptz, not null) - first time this edge appeared
  - `last_seen` (timestamptz, not null) - most recent co-occurrence
  - `signal_count` (integer, default 0) - number of unique signals containing this edge
  - `source_distribution` (jsonb) - count of signals per source (reddit, hn, ph, github)
  - `created_at` (timestamptz) - record creation timestamp
  - `updated_at` (timestamptz) - last update timestamp
  
  ## Indexes
  - Unique constraint on (concept_a, concept_b) for aggregation
  - Index on last_seen for temporal queries
  - Index on total_weight for ranking
  
  ## Roadmap Compliance
  This table supports:
  - Propagation event detection (tracking edge growth over time)
  - Graph community detection algorithms
  - Convergence scoring
  - Historical analysis of concept relationships
*/

-- Create concept_edges aggregation table
CREATE TABLE IF NOT EXISTS concept_edges (
  id SERIAL PRIMARY KEY,
  concept_a TEXT NOT NULL,
  concept_b TEXT NOT NULL,
  total_weight INTEGER DEFAULT 0,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signal_count INTEGER DEFAULT 0,
  source_distribution JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(concept_a, concept_b)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS concept_edges_last_seen_idx ON concept_edges(last_seen DESC);
CREATE INDEX IF NOT EXISTS concept_edges_total_weight_idx ON concept_edges(total_weight DESC);
CREATE INDEX IF NOT EXISTS concept_edges_concepts_idx ON concept_edges(concept_a, concept_b);

-- Enable RLS
ALTER TABLE concept_edges ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access
CREATE POLICY "Public can view concept edges"
  ON concept_edges FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Service role can manage
CREATE POLICY "Service role can manage concept edges"
  ON concept_edges FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);