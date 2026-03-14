/**
 * Reddit Signals Service
 * Fetches and extracts market signals from startup-related subreddits
 */

export interface RedditSignal {
  id: string;
  title: string;
  subreddit: string;
  upvotes: number;
  comments: number;
  url: string;
  createdAt: number;
  keywords: string[];
  inferredPainPoint?: string;
  score: number;
}

interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number;
  url: string;
}

const TARGET_SUBREDDITS = [
  "startups",
  "entrepreneur",
  "SaaS",
  "sideproject",
  "microsaas",
  "indiehackers",
];

/**
 * Extract keywords from text by finding common startup-related terms
 */
function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();
  
  // Common startup-related keywords
  const patterns = [
    /\b(SaaS|B2B|B2C|MVP|API|automation|platform|marketplace|subscription|freemium|growth|scaling|user acquisition|retention|churn|analytics|ai|ml|machine learning|blockchain|web3|crypto|app|tool|service|product)\b/gi,
    /\b(founder|startup|business|idea|launch|build|ship|beta|alpha|open source|bootstrapped|vc|venture capital|seed|series [a-z])\b/gi,
    /\b(revenue|monetization|pricing|features|development|engineering|design|ux|ui|marketing|sales)\b/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        keywords.add(match.toLowerCase());
      });
    }
  }

  return Array.from(keywords).slice(0, 8); // Limit to 8 keywords
}

/**
 * Infer potential pain points from post title and content
 */
function inferPainPoint(title: string): string | undefined {
  const painPatterns = [
    { pattern: /struggling|struggling with|problem with|issue with|can't|can not|difficult|hard to/gi, pain: "Implementation difficulty" },
    { pattern: /need|looking for|searching for|want|how to/gi, pain: "Unmet need or knowledge gap" },
    { pattern: /expensive|costly|high cost|too much/gi, pain: "Cost" },
    { pattern: /slow|speed|performance|latency|delay/gi, pain: "Performance" },
    { pattern: /complicated|complex|confusing|unclear/gi, pain: "User experience" },
    { pattern: /spam|security|privacy|safe|protection|attack/gi, pain: "Security/Privacy" },
    { pattern: /time consuming|manual|repetitive|automation|busy|overwhelmed/gi, pain: "Time/Efficiency" },
  ];

  for (const { pattern, pain } of painPatterns) {
    if (pattern.test(title)) {
      return pain;
    }
  }

  return undefined;
}

/**
 * Fetch posts from a single subreddit
 */
async function fetchSubredditPosts(subreddit: string, limit: number = 25): Promise<RedditPost[]> {
  try {
    const url = `https://old.reddit.com/r/${subreddit}/new.json?limit=25`;
    
    const response = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
  },
});

    if (!response.ok) {
      console.error(`Failed to fetch from r/${subreddit}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.data?.children) {
      return [];
    }

    return data.data.children
      .map((child: any) => ({
        id: child.data.id,
        title: child.data.title,
        subreddit: child.data.subreddit,
        score: child.data.score,
        num_comments: child.data.num_comments,
        created_utc: child.data.created_utc,
        url: child.data.url,
      }))
      .filter((post: RedditPost) => post.score > 5); // Filter low-engagement posts
  } catch (err) {
    console.error(`Error fetching r/${subreddit}:`, err);
    return [];
  }
}

/**
 * Convert Reddit post to normalized signal object
 */
function postToSignal(post: RedditPost): RedditSignal {
  const keywords = extractKeywords(post.title);
  const inferredPainPoint = inferPainPoint(post.title);

  // Score based on engagement and recency
  const recencyBoost = Math.max(0, 1 - (Date.now() / 1000 - post.created_utc) / (7 * 24 * 3600));
  const engagementScore = (post.score / 100) * 0.6 + (post.num_comments / 50) * 0.4;
  const finalScore = Math.min(100, engagementScore * (1 + recencyBoost * 0.3));

  return {
    id: `reddit-${post.subreddit}-${post.id}`,
    title: post.title,
    subreddit: post.subreddit,
    upvotes: post.score,
    comments: post.num_comments,
    url: post.url,
    createdAt: post.created_utc * 1000,
    keywords,
    inferredPainPoint,
    score: Math.round(finalScore),
  };
}

/**
 * Fetch all signals from target subreddits
 */
export async function fetchRedditSignals(limit: number = 15): Promise<RedditSignal[]> {
  const allSignals: RedditSignal[] = [];

  // Fetch posts from all target subreddits in parallel
  const promises = TARGET_SUBREDDITS.map(subreddit =>
    fetchSubredditPosts(subreddit, limit)
      .then(posts => posts.map(postToSignal))
  );

  const results = await Promise.all(promises);
  
  // Combine and sort by score
  for (const signals of results) {
    allSignals.push(...signals);
  }

  return allSignals
    .sort((a, b) => b.score - a.score)
    .slice(0, limit * 2); // Return top signals
}

/**
 * Get cached signals (in production, this would use a database or Redis)
 */
let cachedSignals: RedditSignal[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export async function getRedditSignals(forceRefresh: boolean = false): Promise<RedditSignal[]> {
  const now = Date.now();

  if (!forceRefresh && cachedSignals.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return cachedSignals;
  }

  try {
    cachedSignals = await fetchRedditSignals();
    lastFetchTime = now;
    return cachedSignals;
  } catch (err) {
    console.error("Failed to fetch Reddit signals:", err);
    return cachedSignals; // Return cached data on error
  }
}
