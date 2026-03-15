// client/src/components/TrendCard.tsx
import React from "react";
import { motion } from "framer-motion";
import { Activity, DollarSign, Lightbulb, Target } from "lucide-react";

type TrendLike = {
  topic?: string;
  trendName?: string;
  explanation?: string;
  businessIdea?: string;
  monetization?: string;

  // possibles champs (selon tes versions)
  difficulty?: number; // /10
  difficultyScore?: number; // /10
  market_score?: number; // /100
  marketScore?: number; // /100
  startupPotential?: number; // /100
};

type TrendCardProps = {
  trend: TrendLike;
  isNew?: boolean;
  isBest?: boolean;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const getDifficultyColor = (score: number) => {
  if (score <= 3) return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900";
  if (score <= 6) return "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900";
  return "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900";
};

const getDifficultyLabel = (score: number) => {
  if (score <= 3) return "Low";
  if (score <= 6) return "Medium";
  return "High";
};

export function TrendCard({ trend, isNew = false, isBest = false }: TrendCardProps) {
  // ✅ récupère proprement tes champs, peu importe snake_case ou camelCase
  const difficultyScore =
    (typeof trend.difficultyScore === "number" ? trend.difficultyScore : undefined) ??
    (typeof trend.difficulty === "number" ? trend.difficulty : undefined) ??
    0;

  const marketScore =
    (typeof trend.marketScore === "number" ? trend.marketScore : undefined) ??
    (typeof trend.market_score === "number" ? trend.market_score : undefined) ??
    0;

  const startupPotential =
    (typeof trend.startupPotential === "number" ? trend.startupPotential : undefined) ??
    marketScore ??
    0;

  const opportunityScore = clamp(Math.round(marketScore - difficultyScore * 5), 0, 100);

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 20, scale: 0.95 } : { opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="group relative bg-card rounded-3xl p-6 sm:p-8 border border-border/60 shadow-lg shadow-black/[0.02] hover:shadow-2xl hover:shadow-primary/[0.04] hover:border-primary/20 transition-all duration-500 overflow-hidden"
    >
      {/* Decorative gradient blob */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/[0.03] rounded-full blur-3xl group-hover:bg-primary/[0.06] transition-colors duration-500 pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary tracking-wide uppercase">
              <Activity className="w-3.5 h-3.5" />
              {trend.topic ?? "Trend"}
            </span>

            {isNew && (
              <span className="flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
            )}
          </div>

          <div className="flex items-start gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              {trend.trendName ?? "Untitled trend"}
            </h2>

            {isBest && (
              <span className="ml-2 px-2 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">
                Best Opportunity
              </span>
            )}
          </div>

          {trend.explanation && (
            <p className="text-muted-foreground leading-relaxed text-base">{trend.explanation}</p>
          )}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 border border-border/50 rounded-2xl bg-secondary/10">
          {/* Business Idea */}
          <div className="space-y-2 p-4 rounded-2xl bg-secondary/50 border border-border/40">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <div className="p-1.5 rounded-lg bg-background shadow-sm text-amber-500">
                <Lightbulb className="w-4 h-4" />
              </div>
              Business Idea
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {trend.businessIdea ?? "—"}
            </p>
          </div>

          {/* Monetization */}
          <div className="space-y-2 p-4 rounded-2xl bg-secondary/50 border border-border/40">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <div className="p-1.5 rounded-lg bg-background shadow-sm text-emerald-500">
                <DollarSign className="w-4 h-4" />
              </div>
              Monetization
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {trend.monetization ?? "—"}
            </p>
          </div>
        </div>

        {/* Footer Score */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          {/* Difficulty */}
          <div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">
    Opportunity
  </span>

  <span className="px-2 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
    {opportunityScore}/100
  </span>
</div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {clamp(difficultyScore, 0, 10)} / 10
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${getDifficultyColor(
                clamp(difficultyScore, 0, 10)
              )}`}
            >
              {getDifficultyLabel(clamp(difficultyScore, 0, 10))}
            </span>
          </div>

          {/* Startup Potential */}
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Startup Potential</span>
            <span className="px-3 py-1 rounded-full text-sm font-bold border flex items-center gap-1.5 bg-green-50 border-green-200 text-green-700">
              {clamp(startupPotential, 0, 100)} / 100
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default TrendCard;