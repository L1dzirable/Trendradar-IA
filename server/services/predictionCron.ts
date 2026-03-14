import { autoPromotePredictions } from "./predictionPromotion";

const PROMOTION_CHECK_INTERVAL = 1000 * 60 * 60;

let cronInterval: NodeJS.Timeout | null = null;

export function startPredictionCron() {
  if (cronInterval) {
    console.log("[predictions-cron] Already running");
    return;
  }

  console.log("[predictions-cron] Starting auto-promotion cron (checking every hour)");

  cronInterval = setInterval(async () => {
    try {
      console.log("[predictions-cron] Running auto-promotion check...");
      const promotedCount = await autoPromotePredictions();
      if (promotedCount > 0) {
        console.log(`[predictions-cron] Promoted ${promotedCount} predictions to published`);
      }
    } catch (error) {
      console.error("[predictions-cron] Auto-promotion failed:", error);
    }
  }, PROMOTION_CHECK_INTERVAL);

  runImmediatePromotion();
}

export function stopPredictionCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log("[predictions-cron] Stopped");
  }
}

async function runImmediatePromotion() {
  try {
    console.log("[predictions-cron] Running initial auto-promotion check...");
    const promotedCount = await autoPromotePredictions();
    if (promotedCount > 0) {
      console.log(`[predictions-cron] Initial promotion: ${promotedCount} predictions published`);
    }
  } catch (error) {
    console.error("[predictions-cron] Initial promotion failed:", error);
  }
}
