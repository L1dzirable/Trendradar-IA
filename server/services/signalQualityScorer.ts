export interface Signal {
  id: number;
  source: string;
  externalId: string;
  title: string;
  body: string | null;
  url: string | null;
  score: number;
  commentCount: number;
  keyword: string | null;
  rawJson: any;
  collectedAt: Date;
}

export interface QualityFactors {
  base: number;
  soUnsolvedQuestion: number;
  soHighScore: number;
  hnHighScore: number;
  ghHighScore: number;
  longTitle: number;
  substantialBody: number;
  keywordInTitle: number;
  noiseTerms: number;
  lowEngagement: number;
}

const NOISE_TERMS = [
  'hiring', 'job', 'salary', 'who is', 'what is', 'how to',
  'tutorial', 'course', 'learn', 'beginner'
];

export function getQualityFactors(signal: Signal): QualityFactors {
  const factors: QualityFactors = {
    base: 5,
    soUnsolvedQuestion: 0,
    soHighScore: 0,
    hnHighScore: 0,
    ghHighScore: 0,
    longTitle: 0,
    substantialBody: 0,
    keywordInTitle: 0,
    noiseTerms: 0,
    lowEngagement: 0,
  };

  const titleLower = signal.title.toLowerCase();

  // +2 if source is 'stackoverflow' AND commentCount = 0 (unsolved question)
  if (signal.source === 'stackoverflow' && signal.commentCount === 0) {
    factors.soUnsolvedQuestion = 2;
  }

  // +1 if source is 'stackoverflow' AND score > 50
  if (signal.source === 'stackoverflow' && signal.score > 50) {
    factors.soHighScore = 1;
  }

  // +1 if source is 'hackernews' AND score > 100
  if (signal.source === 'hackernews' && signal.score > 100) {
    factors.hnHighScore = 1;
  }

  // +1 if source is 'github' AND score > 500
  if (signal.source === 'github' && signal.score > 500) {
    factors.ghHighScore = 1;
  }

  // +1 if title length > 40 characters
  if (signal.title.length > 40) {
    factors.longTitle = 1;
  }

  // +1 if body is not null and body length > 200
  if (signal.body && signal.body.length > 200) {
    factors.substantialBody = 1;
  }

  // +1 if keyword appears in title
  if (signal.keyword && titleLower.includes(signal.keyword.toLowerCase())) {
    factors.keywordInTitle = 1;
  }

  // -2 if title contains noise terms
  const hasNoiseTerm = NOISE_TERMS.some(term => titleLower.includes(term));
  if (hasNoiseTerm) {
    factors.noiseTerms = -2;
  }

  // -1 if score < 5 (low engagement)
  if (signal.score < 5) {
    factors.lowEngagement = -1;
  }

  return factors;
}

export function scoreSignal(signal: Signal): number {
  const factors = getQualityFactors(signal);

  // Sum all factors
  const total =
    factors.base +
    factors.soUnsolvedQuestion +
    factors.soHighScore +
    factors.hnHighScore +
    factors.ghHighScore +
    factors.longTitle +
    factors.substantialBody +
    factors.keywordInTitle +
    factors.noiseTerms +
    factors.lowEngagement;

  // Clamp to range 1-10
  return Math.max(1, Math.min(10, total));
}

export function getQualityFactorsAsRecord(signal: Signal): Record<string, number> {
  const factors = getQualityFactors(signal);
  const record: Record<string, number> = {};

  if (factors.base !== 0) record.base = factors.base;
  if (factors.soUnsolvedQuestion !== 0) record.soUnsolvedQuestion = factors.soUnsolvedQuestion;
  if (factors.soHighScore !== 0) record.soHighScore = factors.soHighScore;
  if (factors.hnHighScore !== 0) record.hnHighScore = factors.hnHighScore;
  if (factors.ghHighScore !== 0) record.ghHighScore = factors.ghHighScore;
  if (factors.longTitle !== 0) record.longTitle = factors.longTitle;
  if (factors.substantialBody !== 0) record.substantialBody = factors.substantialBody;
  if (factors.keywordInTitle !== 0) record.keywordInTitle = factors.keywordInTitle;
  if (factors.noiseTerms !== 0) record.noiseTerms = factors.noiseTerms;
  if (factors.lowEngagement !== 0) record.lowEngagement = factors.lowEngagement;

  return record;
}
