import { AggregatedSignal } from "../../shared/signals";

const WEIGHTS = {
  hn_ask: 1.4,
  hn_show: 1.1,
  hn_general: 0.9,

  reddit_b2b: 1.3,
  reddit_general: 0.6,

  producthunt: 1.2,

  default: 1.0,
} as const;

const B2B_SUBS = /entrepreneur|saas|startups|indiehackers|devops|sysadmin/i;

export function getSourceWeight(signal: AggregatedSignal): number {
  const src = signal.source.toLowerCase();

  if (src.includes("hackernews")) {
    if (/^ask hn/i.test(signal.title)) return WEIGHTS.hn_ask;
    if (/^show hn/i.test(signal.title)) return WEIGHTS.hn_show;

    return WEIGHTS.hn_general;
  }

  if (src.includes("reddit")) {
    return B2B_SUBS.test(signal.source)
      ? WEIGHTS.reddit_b2b
      : WEIGHTS.reddit_general;
  }

  if (src.includes("producthunt")) {
    return WEIGHTS.producthunt;
  }

  return WEIGHTS.default;
}