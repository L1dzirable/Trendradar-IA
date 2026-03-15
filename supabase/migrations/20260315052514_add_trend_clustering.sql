/*
  # Add Trend Clustering Tables

  This migration adds tables to support trend clustering - grouping related scored concepts
  into higher-level emerging trend themes.

  ## New Tables

  ### `trend_clusters`
  Stores discovered trend clusters with aggregate metrics:
  - `id` (serial, primary key)
  - `label` (text) - Human-readable cluster label generated from top concepts
  - `avg_weak_signal_score` (integer) - Average weak signal score of member concepts
  - `total_mentions` (integer) - Total mentions across all cluster members
  - `source_diversity` (integer) - Count of unique sources mentioning cluster concepts
  - `cluster_velocity` (numeric) - Average velocity score across cluster members
  - `first_seen` (timestamptz) - Earliest first_seen date among members
  - `last_seen` (timestamptz) - Most recent last_seen date among members
  - `created_at` (timestamptz) - When cluster was created
  - `updated_at` (timestamptz) - Last update timestamp

  ### `trend_cluster_members`
  Links concepts to their parent clusters:
  - `id` (serial, primary key)
  - `cluster_id` (integer, foreign key to trend_clusters)
  - `concept_id` (integer, foreign key to concept_nodes)
  - `concept_score` (integer) - Weak signal score at time of clustering
  - `created_at` (timestamptz) - When membership was established

  ## Indexes
  - Index on cluster_id for fast member lookup
  - Index on concept_id to prevent duplicate memberships
  - Index on avg_weak_signal_score for top cluster queries

  ## Notes
  - Clusters are generated from scored concepts with strong graph connections
  - Clustering runs AFTER weak signal scoring and BEFORE opportunity generation
  - Clusters help identify broader emerging themes from individual concepts
*/

-- Create trend_clusters table
CREATE TABLE IF NOT EXISTS trend_clusters (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  avg_weak_signal_score INTEGER DEFAULT 0,
  total_mentions INTEGER DEFAULT 0,
  source_diversity INTEGER DEFAULT 0,
  cluster_velocity NUMERIC(10, 2) DEFAULT 0,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast top cluster queries
CREATE INDEX IF NOT EXISTS trend_clusters_score_idx
  ON trend_clusters(avg_weak_signal_score DESC);

-- Create index for temporal queries
CREATE INDEX IF NOT EXISTS trend_clusters_last_seen_idx
  ON trend_clusters(last_seen DESC);

-- Create trend_cluster_members table
CREATE TABLE IF NOT EXISTS trend_cluster_members (
  id SERIAL PRIMARY KEY,
  cluster_id INTEGER NOT NULL REFERENCES trend_clusters(id) ON DELETE CASCADE,
  concept_id INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
  concept_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cluster_id, concept_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS trend_cluster_members_cluster_idx
  ON trend_cluster_members(cluster_id);

CREATE INDEX IF NOT EXISTS trend_cluster_members_concept_idx
  ON trend_cluster_members(concept_id);

-- Enable RLS (required by Supabase best practices)
ALTER TABLE trend_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_cluster_members ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Authenticated users can view trend clusters"
  ON trend_clusters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view cluster members"
  ON trend_cluster_members FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage clusters (for admin endpoints)
CREATE POLICY "Service role can manage trend clusters"
  ON trend_clusters FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage cluster members"
  ON trend_cluster_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
