import { MacroDriver } from "../../shared/signals";

const DRIVER_PATTERNS: { driver: MacroDriver; keywords: string[] }[] = [
  { driver: "ai_adoption",
    keywords: ["ai", "llm", "gpt", "copilot", "ml", "model", "prompt", "agent", "embedding"] },
  { driver: "regulatory_pressure",
    keywords: ["compliance", "gdpr", "hipaa", "audit", "security", "permission", "access", "rbac", "soc2"] },
  { driver: "cost_reduction",
    keywords: ["cost", "expensive", "pricing", "bill", "reduce", "cheap", "afford", "budget"] },
  { driver: "developer_tooling",
    keywords: ["sdk", "api", "cli", "library", "framework", "integration", "webhook", "devtools"] },
  { driver: "remote_work",
    keywords: ["remote", "async", "distributed", "team", "collaboration", "timezone", "hybrid"] },
  { driver: "platform_shift",
    keywords: ["mobile", "wasm", "edge", "serverless", "cloud", "kubernetes", "container", "runtime"] },
];

export function classifyMacroDriver(signals: { title: string }[]): MacroDriver {
  const scores = new Map<MacroDriver, number>();

  for (const signal of signals) {
    const lower = signal.title.toLowerCase();
    for (const { driver, keywords } of DRIVER_PATTERNS) {
      const matches = keywords.filter(kw => lower.includes(kw)).length;
      if (matches > 0) scores.set(driver, (scores.get(driver) ?? 0) + matches);
    }
  }

  if (scores.size === 0) return "unknown";

  return Array.from(scores.entries()).reduce((best, curr) =>
  curr[1] > best[1] ? curr : best
  )[0];
}