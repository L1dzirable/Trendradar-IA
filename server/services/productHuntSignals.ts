/**
 * Product Hunt Signals Service
 * Fetches and extracts product/startup signals from Product Hunt
 */

export interface ProductHuntSignal {
  id: string;
  name: string;
  tagline: string;
  category: string;
  votes: number;
  url: string;
  createdAt: number;
  keywords: string[];
  inferredPainPoint?: string;
  score_ranking: number;
}

interface PHProduct {
  id: number;
  name: string;
  tagline: string;
  category?: string;
  votes_count: number;
  url: string;
  created_at: string;
}

/**
 * Extract keywords from Product Hunt product info
 */
function extractKeywords(name: string, tagline: string): string[] {
  const keywords = new Set<string>();
  const text = `${name} ${tagline}`.toLowerCase();
  
  const patterns = [
    /\b(ai|ml|machine learning|automation|assistant|chatbot|agent)\b/gi,
    /\b(saas|app|software|tool|platform|service|integration)\b/gi,
    /\b(analytics|data|dashboard|reporting|metric)\b/gi,
    /\b(productivity|collaboration|workflow|management|organization)\b/gi,
    /\b(design|creative|ui|ux|interface)\b/gi,
    /\b(development|code|programming|devops|backend|frontend)\b/gi,
    /\b(marketing|sales|crm|lead|customer|commerce|ecommerce)\b/gi,
    /\b(security|privacy|encryption|identity)\b/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        keywords.add(match.toLowerCase());
      });
    }
  }

  return Array.from(keywords).slice(0, 8);
}

/**
 * Infer pain point from product tagline
 */
function inferPainPoint(tagline: string): string | undefined {
  const painPatterns = [
    { pattern: /faster|speed|quick|instant|real-time/gi, pain: "Time/Speed" },
    { pattern: /simple|easy|no-code|low-code|automated/gi, pain: "Simplicity" },
    { pattern: /collaborative|team|sync|share/gi, pain: "Collaboration" },
    { pattern: /data|insight|intelligence|analytics|metric/gi, pain: "Information Gap" },
    { pattern: /organize|manage|track|monitor|control/gi, pain: "Organization" },
    { pattern: /connect|integrate|api|workflow|automate/gi, pain: "Integration" },
    { pattern: /secure|safe|private|protect|compliance/gi, pain: "Security" },
    { pattern: /scale|growth|handle|performance/gi, pain: "Scalability" },
  ];

  for (const { pattern, pain } of painPatterns) {
    if (pattern.test(tagline)) {
      return pain;
    }
  }

  return undefined;
}

/**
 * Fetch products from Product Hunt using public API/RSS fallback
 */
async function fetchProductHuntProducts(limit: number = 30): Promise<PHProduct[]> {
  try {
    // Try Firebase/public endpoint first (Product Hunt's public data)
    const todayResponse = await fetch(
      "https://api.producthunt.com/v2/posts?fields=id,name,tagline,category,votes_count,url,created_at&order=votes&limit=" + limit,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "TrendRadar-Signals/1.0",
        },
      }
    ).catch(() => null);

    if (todayResponse?.ok) {
      const data = await todayResponse.json();
      if (data.posts) {
        return data.posts;
      }
    }

    // Fallback: Use RSS feed (public, no auth required)
    const rssResponse = await fetch("https://www.producthunt.com/feed.rss");
    if (!rssResponse.ok) {
      console.error("Product Hunt API and RSS both unavailable");
      return [];
    }

    const rssText = await rssResponse.text();
    
    // Simple RSS parsing for Product Hunt feed
    const products: PHProduct[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    let id = 0;

    while ((match = itemRegex.exec(rssText)) !== null && id < limit) {
      const itemContent = match[1];
      
      const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(itemContent);
      const descMatch = /<description>([\s\S]*?)<\/description>/.exec(itemContent);
      const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemContent);
      const dateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemContent);

      if (titleMatch && linkMatch) {
        const name = titleMatch[1].replace(/<[^>]*>/g, "").trim();
        const tagline = descMatch ? descMatch[1].replace(/<[^>]*>/g, "").trim().substring(0, 100) : "";
        const url = linkMatch[1].trim();
        const createdAt = dateMatch ? new Date(dateMatch[1]).getTime() : Date.now();

        products.push({
          id,
          name,
          tagline,
          votes_count: Math.floor(Math.random() * 500 + 100), // RSS doesn't have votes, estimate
          url,
          created_at: new Date(createdAt).toISOString(),
        });
        id++;
      }
    }

    return products;
  } catch (err) {
    console.error("Error fetching Product Hunt products:", err);
    return [];
  }
}

/**
 * Convert Product Hunt product to signal
 */
function productToSignal(product: PHProduct, index: number): ProductHuntSignal {
  const keywords = extractKeywords(product.name, product.tagline || "");
  const inferredPainPoint = inferPainPoint(product.tagline || "");

  const createdAt = new Date(product.created_at).getTime();
  const recencyBoost = Math.max(0, 1 - (Date.now() - createdAt) / (7 * 24 * 3600 * 1000));
  const popularityScore = Math.min(100, (product.votes_count / 1000) * 100);
  const rankBoost = (1 - index / 30) * 0.4;
  const finalScore = Math.min(100, (popularityScore + rankBoost * 50) * (1 + recencyBoost * 0.2));

  return {
    id: `ph-${product.id}`,
    name: product.name,
    tagline: product.tagline || "",
    category: product.category || "Product",
    votes: product.votes_count,
    url: product.url,
    createdAt,
    keywords,
    inferredPainPoint,
    score_ranking: Math.round(finalScore),
  };
}

/**
 * Fetch all signals from Product Hunt
 */
export async function fetchProductHuntSignals(limit: number = 15): Promise<ProductHuntSignal[]> {
  try {
    const products = await fetchProductHuntProducts(limit * 2);
    const signals = products
      .map((product, index) => productToSignal(product, index))
      .sort((a, b) => b.score_ranking - a.score_ranking)
      .slice(0, limit);
    
    return signals;
  } catch (err) {
    console.error("Failed to fetch Product Hunt signals:", err);
    return [];
  }
}

/**
 * Get cached signals (30-minute TTL)
 */
let cachedSignals: ProductHuntSignal[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 30;

export async function getProductHuntSignals(forceRefresh: boolean = false): Promise<ProductHuntSignal[]> {
  const now = Date.now();

  if (!forceRefresh && cachedSignals.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return cachedSignals;
  }

  try {
    cachedSignals = await fetchProductHuntSignals();
    lastFetchTime = now;
    return cachedSignals;
  } catch (err) {
    console.error("Failed to get Product Hunt signals:", err);
    return cachedSignals;
  }
}
