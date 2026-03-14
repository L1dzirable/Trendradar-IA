import type { AggregatedSignal } from '../../shared/signals';

const GITHUB_SEARCH_URL = 'https://api.github.com/search/repositories';

const SAAS_TOPICS = [
  'saas', 'api', 'automation', 'workflow', 'productivity',
  'developer-tools', 'devtools', 'monitoring', 'analytics',
  'authentication', 'payments', 'integration', 'cli', 'sdk'
];

interface GitHubRepo {
  id: number;
  full_name: string;
  description: string | null;
  topics: string[];
  stargazers_count: number;
  created_at: string;
  html_url: string;
  language: string | null;
}

function normalizeStarScore(stars: number): number {
  if (stars >= 10000) return 95;
  if (stars >= 5000)  return 85;
  if (stars >= 1000)  return 70;
  if (stars >= 500)   return 55;
  if (stars >= 100)   return 40;
  return 25;
}

export async function fetchGitHubSignals(): Promise<AggregatedSignal[]> {
  try {
    const queries = [
  'topic:saas+topic:api',
  'topic:developer-tools+topic:automation',
  'topic:productivity+topic:workflow',
];

const results = await Promise.allSettled(
  queries.map(q =>
    fetch(`${GITHUB_SEARCH_URL}?q=${q}&sort=updated&order=desc&per_page=10`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TrendRadar/1.0'
      }
    }).then(r => r.json())
  )
);

const repos: GitHubRepo[] = results
  .filter(r => r.status === 'fulfilled')
  .flatMap(r => (r as PromiseFulfilledResult<any>).value.items ?? []);

    return repos
      .filter(repo => repo.description && repo.description.length > 20)
      .map(repo => ({
        source: 'github' as const,
        externalId: `github-${repo.id}`,
        title: repo.description!,
        url: repo.html_url,
        score: normalizeStarScore(repo.stargazers_count),
        createdAt: new Date(repo.created_at),
      }));

  } catch (err) {
    console.error('[github] unexpected error:', err);
    return [];
  }
}