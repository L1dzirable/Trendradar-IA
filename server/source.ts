// server/sources.ts
import Parser from "rss-parser";

const rss = new Parser();

// Petit util: normaliser + extraire des "mots clés" très simples
function extractTopicsFromTitles(titles: string[]): string[] {
  const stop = new Set([
"the","a","an","and","or","to","of","in","for","with",
"on","at","by","from",
"your","you","is","are","was","were","be","as","it",
"this","that",
"how","why","what","when","new","launch","released",
"v2","v3",
"year","years"
]);

  const words: Record<string, number> = {};

  for (const t of titles) {
    const cleaned = t
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    for (const w of cleaned.split(" ")) {
      if (w.length < 4) continue;
      if (stop.has(w)) continue;
      words[w] = (words[w] || 0) + 1;
    }
  }

  // Top 25 mots (tu pourras améliorer ensuite)
  return Object.entries(words)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([w]) => w);
}

async function fetchHackerNewsTitles(limit = 30): Promise<string[]> {
  const feed = await rss.parseURL("https://hnrss.org/frontpage");

  return (feed.items || [])
    .slice(0, limit)
    .map((it) => it.title || "")
    .filter(Boolean);
}

async function fetchProductHuntTitles(limit = 30): Promise<string[]> {
  const feed = await rss.parseURL("https://hnrss.org/newest");

  return (feed.items || [])
    .slice(0, limit)
    .map((it) => it.title || "")
    .filter(Boolean);
}

  // fallback si aucune source n’a répondue
  export async function sourcesToTopics(): Promise<string[]> {
  const [hn, ph] = await Promise.allSettled([
    fetchHackerNewsTitles(40),
    fetchProductHuntTitles(40),
  ]);

  const titles: string[] = [];

  if (hn.status === "fulfilled") {
  console.log("HN TITLES:", hn.value.slice(0,5));
  titles.push(...hn.value);
}

if (ph.status === "fulfilled") {
  console.log("PH TITLES:", ph.value.slice(0,5));
  titles.push(...ph.value);
}

  console.log("HN:", hn.status === "fulfilled" ? hn.value.length : hn.reason);
  console.log("PH:", ph.status === "fulfilled" ? ph.value.length : ph.reason);
  console.log("TOTAL:", titles.length);

  if (titles.length === 0) {
    return ["ai agents", "ugc creators", "local seo", "ai workflow automation"];
  }

  return extractTopicsFromTitles(titles);
  }