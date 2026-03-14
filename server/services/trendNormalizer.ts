const TREND_TABLE: { keywords: string[]; canonical: string }[] = [
  { keywords: ['auth', 'login', 'password', 'oauth', 'sso', 'account', 'restrict', 'permission', 'access'], canonical: 'Access Control & Auth' },
  { keywords: ['ai', 'llm', 'gpt', 'copilot', 'assistant', 'generate', 'prompt'], canonical: 'AI & LLM Tooling' },
  { keywords: ['api', 'integration', 'webhook', 'sdk', 'connect'], canonical: 'API & Integrations' },
  { keywords: ['analytics', 'dashboard', 'metric', 'report', 'insight', 'tracking'], canonical: 'Analytics & Reporting' },
  { keywords: ['billing', 'payment', 'subscription', 'revenue', 'pricing', 'stripe'], canonical: 'Billing & Payments' },
  { keywords: ['deploy', 'devops', 'ci', 'pipeline', 'docker', 'kubernetes', 'infra'], canonical: 'DevOps & Deployment' },
  { keywords: ['email', 'notification', 'alert', 'inbox', 'smtp'], canonical: 'Email & Notifications' },
  { keywords: ['onboard', 'signup', 'activation', 'setup', 'wizard'], canonical: 'Onboarding & Activation' },
  { keywords: ['search', 'filter', 'query', 'index', 'elastic'], canonical: 'Search & Discovery' },
  { keywords: ['security', 'vulnerability', 'cve', 'exploit', 'encrypt'], canonical: 'Security & Compliance' },
  { keywords: ['workflow', 'automation', 'task', 'schedule', 'trigger', 'zap'], canonical: 'Workflow Automation' },
  { keywords: ['mobile', 'ios', 'android', 'react native', 'flutter'], canonical: 'Mobile Development' },
  { keywords: ['storage', 'file', 'upload', 'cdn', 's3', 'blob'], canonical: 'Storage & Files' },
  { keywords: ['team', 'collaboration', 'workspace', 'permission', 'role'], canonical: 'Team & Collaboration' },
  { keywords: ['test', 'qa', 'debug', 'error', 'monitor', 'log', 'observ'], canonical: 'Testing & Observability' },
];

export function canonicalizeTrend(title: string): string | null {
  const lower = title.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const entry of TREND_TABLE) {
    const score = entry.keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry.canonical;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

export function buildTrendSlug(canonical: string): string {
  return canonical
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}