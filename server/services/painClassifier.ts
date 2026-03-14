import { PainSignalClass } from "../../shared/signals";

const PAIN_PATTERNS: Record<NonNullable<PainSignalClass>, RegExp[]> = {
  complaint: [
    /tired of/i,
    /hate that/i,
    /still broken/i,
    /why is .+ so hard/i,
    /painful/i,
    /frustrating/i,
    /nobody solves/i,
    /impossible to/i,
  ],

  workaround: [
    /built this because/i,
    /nothing existed/i,
    /we hacked together/i,
    /so i built/i,
    /had to roll our own/i,
    /wrote our own/i,
  ],

  request: [
    /looking for a tool/i,
    /does anyone know/i,
    /what do you use for/i,
    /any recommendations/i,
    /is there a saas/i,
    /best tool for/i,
  ],

  validation: [
    /paying .+ (and|but) still/i,
    /\$\d+\/mo.+still/i,
    /vendor lock.?in/i,
    /switching from/i,
  ],

  job_signal: [
    /hiring.+(engineer|analyst|ops|manager)/i,
    /we('re| are) looking for.+(devops|data|ml)/i,
  ],
};

export function classifyPainSignal(title: string): PainSignalClass {
  for (const [cls, patterns] of Object.entries(PAIN_PATTERNS)) {
    if (patterns.some((p) => p.test(title))) {
      return cls as NonNullable<PainSignalClass>;
    }
  }

  return null;
}