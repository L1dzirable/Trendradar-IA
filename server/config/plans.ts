export type PlanId = "free" | "founder" | "pro" | "agency";

export interface PlanConfig {
  name: string;
  price: number;
  stripePriceId: string | null;
  limits: {
    signalsPerDay: number;
    pdfExportsPerMonth: number;
    opportunitiesVisible: number;
  };
  features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    name: "Free",
    price: 0,
    stripePriceId: null,
    limits: {
      signalsPerDay: 10,
      pdfExportsPerMonth: 0,
      opportunitiesVisible: 3,
    },
    features: ["signal_feed"],
  },

  founder: {
    name: "Founder",
    price: 7900,
    stripePriceId: process.env.STRIPE_PRICE_FOUNDER ?? null,
    limits: {
      signalsPerDay: 100,
      pdfExportsPerMonth: 5,
      opportunitiesVisible: 20,
    },
    features: ["signal_feed", "opportunity_feed"],
  },

  pro: {
    name: "Pro",
    price: 14900,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
    limits: {
      signalsPerDay: 500,
      pdfExportsPerMonth: 20,
      opportunitiesVisible: 100,
    },
    features: ["signal_feed", "opportunity_feed", "pdf_export"],
  },

  agency: {
    name: "Agency",
    price: 39900,
    stripePriceId: process.env.STRIPE_PRICE_AGENCY ?? null,
    limits: {
      signalsPerDay: -1,
      pdfExportsPerMonth: -1,
      opportunitiesVisible: -1,
    },
    features: ["signal_feed", "opportunity_feed", "pdf_export", "white_label"],
  },
};

/** Retrouve un PlanId à partir d'un Stripe price_id */
export function getPlanFromPriceId(priceId: string): PlanId {
  const entry = Object.entries(PLANS).find(
    ([, cfg]) => cfg.stripePriceId === priceId
  );
  return (entry?.[0] as PlanId) ?? "free";
}

/** Retourne la limite d'opportunités visibles pour un plan */
export function getOpportunityLimit(plan: PlanId): number {
  return PLANS[plan].limits.opportunitiesVisible;
}