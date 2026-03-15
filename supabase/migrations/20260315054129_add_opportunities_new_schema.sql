/*
  # Add new opportunity engine fields

  1. Changes
    - Drop existing opportunities table (old schema from different system)
    - Create new opportunities table with opportunity engine schema
    - Add fields: pain_point, target_market, why_now, cluster_id, confidence_score, window_estimate
    - Add indexes for performance
    - Enable RLS with public read access

  2. New Schema
    - `id` (uuid, primary key) - unique identifier
    - `title` (text, not null) - opportunity title
    - `description` (text, not null) - detailed description
    - `pain_point` (text, not null) - problem being solved
    - `target_market` (text, not null) - target customer segment
    - `why_now` (text, not null) - timing rationale
    - `cluster_id` (integer, foreign key) - reference to trend_clusters
    - `confidence_score` (numeric, not null) - 0-100 score
    - `window_estimate` (text, not null) - timing window
    - `created_at` (timestamptz) - creation timestamp
    - `updated_at` (timestamptz) - last update timestamp
*/

-- Drop existing opportunities table
DROP TABLE IF EXISTS opportunities CASCADE;

-- Create new opportunities table
CREATE TABLE opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  pain_point text NOT NULL,
  target_market text NOT NULL,
  why_now text NOT NULL,
  cluster_id integer REFERENCES trend_clusters(id) ON DELETE CASCADE,
  confidence_score numeric NOT NULL,
  window_estimate text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT confidence_score_range CHECK (confidence_score >= 0 AND confidence_score <= 100)
);

-- Create indexes
CREATE INDEX idx_opportunities_confidence_score ON opportunities(confidence_score DESC);
CREATE INDEX idx_opportunities_cluster_id ON opportunities(cluster_id);
CREATE INDEX idx_opportunities_created_at ON opportunities(created_at DESC);

-- Enable RLS
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read opportunities
CREATE POLICY "Public read access to opportunities"
  ON opportunities
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert opportunities
CREATE POLICY "Authenticated users can insert opportunities"
  ON opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users can update opportunities
CREATE POLICY "Authenticated users can update opportunities"
  ON opportunities
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Only authenticated users can delete opportunities
CREATE POLICY "Authenticated users can delete opportunities"
  ON opportunities
  FOR DELETE
  TO authenticated
  USING (true);
