/*
  # Initial Database Schema

  1. New Tables
    - signals: Raw signal data from various sources
      - id (serial, primary key)
      - source (text, source platform)
      - external_id (text, platform-specific ID)
      - title (text)
      - body (text)
      - url (text)
      - score (integer)
      - comment_count (integer)
      - keyword (text)
      - raw_json (jsonb)
      - collected_at (timestamptz)
      - Unique constraint on (source, external_id)

    - opportunities: Business opportunities identified from signals
      - id (uuid, primary key)
      - title (varchar 500)
      - description (text)
      - category (varchar 100)
      - score (integer, 0-100)
      - sources (jsonb array)
      - signal_ids (jsonb array)
      - created_at (timestamptz)
      - updated_at (timestamptz)

    - predictions: Prediction lifecycle tracking
      - id (serial, primary key)
      - opportunity_id (uuid, references opportunities)
      - prediction_text (text)
      - methodology_notes (text)
      - drafted_at (timestamptz, Stage 1)
      - draft_score (integer)
      - draft_signal_count (integer)
      - draft_signal_snapshot (jsonb)
      - published_at (timestamptz, Stage 2)
      - is_published (boolean, default false)
      - status (varchar 20, default 'draft')
      - verified_at (timestamptz, Stage 3)
      - verification_evidence (text)
      - verification_url (text)
      - lead_time_days (integer)

    - concept_nodes: Weak signal concept tracking
      - id (serial, primary key)
      - concept (text, unique)
      - label (text)
      - created_at (timestamptz)

    - concept_mentions: Links signals to concepts
      - id (serial, primary key)
      - signal_id (integer, references signals)
      - concept_id (integer, references concept_nodes)
      - created_at (timestamptz)
      - Unique constraint on (signal_id, concept_id)

    - edge_snapshots: Concept relationship tracking
      - id (serial, primary key)
      - concept_a (text)
      - concept_b (text)
      - weight (integer, default 1)
      - signal_id (integer, references signals)
      - created_at (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public read access for opportunities and predictions (published only)
    - Admin-only write access

  3. Indexes
    - signals: (source, external_id) for deduplication
    - opportunities: score for sorting
    - predictions: opportunity_id, status, is_published
    - concept_nodes: concept for lookups
*/

-- Create signals table
CREATE TABLE IF NOT EXISTS signals (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  score INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  keyword TEXT,
  raw_json JSONB,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS signals_source_idx ON signals(source);
CREATE INDEX IF NOT EXISTS signals_collected_at_idx ON signals(collected_at);

-- Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100),
  score INTEGER DEFAULT 0,
  sources JSONB DEFAULT '[]'::jsonb,
  signal_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS opportunities_score_idx ON opportunities(score DESC);
CREATE INDEX IF NOT EXISTS opportunities_created_at_idx ON opportunities(created_at DESC);

-- Create predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  prediction_text TEXT NOT NULL,
  methodology_notes TEXT,
  
  -- Stage 1: Auto-draft
  drafted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  draft_score INTEGER NOT NULL,
  draft_signal_count INTEGER NOT NULL,
  draft_signal_snapshot JSONB DEFAULT '[]'::jsonb,
  
  -- Stage 2: Auto-promote
  published_at TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT false,
  
  -- Stage 3: Human verification
  status VARCHAR(20) DEFAULT 'draft',
  verified_at TIMESTAMPTZ,
  verification_evidence TEXT,
  verification_url TEXT,
  lead_time_days INTEGER
);

CREATE INDEX IF NOT EXISTS predictions_opportunity_id_idx ON predictions(opportunity_id);
CREATE INDEX IF NOT EXISTS predictions_status_idx ON predictions(status);
CREATE INDEX IF NOT EXISTS predictions_is_published_idx ON predictions(is_published);
CREATE INDEX IF NOT EXISTS predictions_drafted_at_idx ON predictions(drafted_at);

-- Create concept_nodes table
CREATE TABLE IF NOT EXISTS concept_nodes (
  id SERIAL PRIMARY KEY,
  concept TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS concept_nodes_concept_idx ON concept_nodes(concept);

-- Create concept_mentions table
CREATE TABLE IF NOT EXISTS concept_mentions (
  id SERIAL PRIMARY KEY,
  signal_id INTEGER NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  concept_id INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(signal_id, concept_id)
);

CREATE INDEX IF NOT EXISTS concept_mentions_signal_id_idx ON concept_mentions(signal_id);
CREATE INDEX IF NOT EXISTS concept_mentions_concept_id_idx ON concept_mentions(concept_id);

-- Create edge_snapshots table
CREATE TABLE IF NOT EXISTS edge_snapshots (
  id SERIAL PRIMARY KEY,
  concept_a TEXT NOT NULL,
  concept_b TEXT NOT NULL,
  weight INTEGER DEFAULT 1,
  signal_id INTEGER REFERENCES signals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS edge_snapshots_concepts_idx ON edge_snapshots(concept_a, concept_b);
CREATE INDEX IF NOT EXISTS edge_snapshots_created_at_idx ON edge_snapshots(created_at);

-- Enable RLS
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow public read for published data
CREATE POLICY "Public can view signals"
  ON signals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view opportunities"
  ON opportunities FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view published predictions"
  ON predictions FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "Public can view concept nodes"
  ON concept_nodes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view concept mentions"
  ON concept_mentions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view edge snapshots"
  ON edge_snapshots FOR SELECT
  TO anon, authenticated
  USING (true);