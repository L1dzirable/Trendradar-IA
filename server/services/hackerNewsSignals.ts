/**
 * Hacker News Signals Service
 * Fetches and extracts startup-relevant signals from Hacker News top stories
 */

export interface HackerNewsSignal {
  id: string;
  title: string;
  score: number;
  comments: number;
  url: string;
  createdAt: number;
  keywords: string[];
  inferredPainPoint?: string;
  score_ranking: number;
}

interface HNStory {
  id: number;
  title: string;
  score: number;
  descendants: number;
  url?: string;
  time: number;
}

const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";

/**
 * Extract keywords from HN story title
 */
function extractKeywords(title: string): string[] {
  const keywords = new Set<string>();
  
  const patterns = [
    /\b(ai|ml|machine learning|deep learning|llm|gpt|transformer|neural|algorithm)\b/gi,
    /\b(startup|founder|bootstrap|vc|venture|seed|series [a-z]|acquisition|unicorn)\b/gi,
    /\b(saas|b2b|api|platform|tool|framework|library|sdk|open source)\b/gi,
    /\b(automation|productivity|workflow|integration|pipeline|deployment)\b/gi,
    /\b(devops|infrastructure|cloud|server|database|cache|kubernetes|docker)\b/gi,
    /\b(web3|crypto|blockchain|defi|nft|solana|ethereum)\b/gi,
    /\b(security|privacy|encryption|authentication|compliance)\b/gi,
  ];

  for (const pattern of patterns) {
    const matches = title.match(pattern);
    if (matches) {
      matches.forEach(match => {
        keywords.add(match.toLowerCase());
      });
    }
  }

  return Array.from(keywords).slice(0, 8);
}

/**
 * Infer pain point from HN story title
 */
function inferPainPoint(title: string): string | undefined {
  const painPatterns = [
    { pattern: /problem|issue|bug|crash|error|failing|broken/gi, pain: "Reliability" },
    { pattern: /slow|performance|latency|optimization|fast/gi, pain: "Performance" },
    { pattern: /security|vulnerability|breach|exploit|attack/gi, pain: "Security" },
    { pattern: /complex|difficult|hard|learning curve|confusing/gi, pain: "Complexity" },
    { pattern: /expensive|cost|price|billing|payment/gi, pain: "Cost" },
    { pattern: /scaling|scale|growth|load|capacity/gi, pain: "Scalability" },
    { pattern: /automat|manual|repetitive|workflow|process/gi, pain: "Efficiency" },
  ];

  for (const { pattern, pain } of painPatterns) {
    if (pattern.test(title)) {
      return pain;
    }
  }

  return undefined;
}

/**
 * Fetch top stories from Hacker News
 */
async function fetchTopStories(limit: number = 30): Promise<HNStory[]> {
  try {
    // Fetch list of top story IDs

    const [askRes, showRes] = await Promise.all([
  fetch(`${HN_API_BASE}/askstories.json`),
  fetch(`${HN_API_BASE}/showstories.json`)
]);
    if (!askRes.ok || !showRes.ok) {
  console.error("Failed to fetch HN ask/show stories");
  return [];
    }

    const askIds: number[] = await askRes.json();
    const showIds: number[] = await showRes.json();

    const storyIds = [...askIds.slice(0, limit), ...showIds.slice(0, limit)];
    const topIds = storyIds.slice(0, Math.min(limit * 2, 50));

    // Fetch individual story details
    const storyPromises = topIds.map(id =>
      fetch(`${HN_API_BASE}/item/${id}.json`)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null)
    );

    const stories = await Promise.all(storyPromises);
    return stories.filter((s): s is HNStory => s !== null && !!s.title);
  } catch (err) {
    console.error("Error fetching Hacker News stories:", err);
    return [];
  }
}

/**
 * Convert HN story to normalized signal
 */
function storyToSignal(story: HNStory, index: number): HackerNewsSignal {
  const keywords = extractKeywords(story.title);
  const inferredPainPoint = inferPainPoint(story.title);

  // Score based on HN ranking (higher rank = higher score)
  const recencyBoost = Math.max(0, 1 - (Date.now() / 1000 - story.time) / (24 * 3600));
  const engagementScore = (story.score / 500) * 0.6 + (story.descendants / 200) * 0.4;
  const rankBoost = (1 - index / 30) * 0.5; // Earlier stories get boost
  const finalScore = Math.min(100, (engagementScore + rankBoost) * (1 + recencyBoost * 0.2));

  return {
    id: `hn-${story.id}`,
    title: story.title,
    score: story.score,
    comments: story.descendants || 0,
    url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
    createdAt: story.time * 1000,
    keywords,
    inferredPainPoint,
    score_ranking: Math.round(finalScore),
  };
}

/**
 * Fetch all signals from Hacker News
 */
export async function fetchHackerNewsSignals(limit: number = 15): Promise<HackerNewsSignal[]> {
  try {
    const stories = await fetchTopStories(limit * 2);
    const signals = stories
      .map((story, index) => storyToSignal(story, index))
      .sort((a, b) => b.score_ranking - a.score_ranking)
      .slice(0, limit);
    
    return signals;
  } catch (err) {
    console.error("Failed to fetch Hacker News signals:", err);
    return [];
  }
}

/**
 * Get cached signals (30-minute TTL)
 */
let cachedSignals: HackerNewsSignal[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 30;

export async function getHackerNewsSignals(forceRefresh: boolean = false): Promise<HackerNewsSignal[]> {
  const now = Date.now();

  if (!forceRefresh && cachedSignals.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return cachedSignals;
  }

  try {
    cachedSignals = await fetchHackerNewsSignals();
    lastFetchTime = now;
    return cachedSignals;
  } catch (err) {
    console.error("Failed to get Hacker News signals:", err);
    return cachedSignals;
  }
}
