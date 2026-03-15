import { db } from "../../db";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Opportunity {
  id: string;
  title: string;
  description: string;
  pain_point: string;
  target_market: string;
  why_now: string;
  confidence_score: number;
  window_estimate: string;
  created_at: Date;
}

interface Prediction {
  id: string;
  opportunity_id: string;
  title: string;
  prediction_text: string;
  confidence_score: number;
  status: string;
  detected_at: Date;
  predicted_window: string;
  created_at: Date;
  updated_at: Date;
}

export class PredictionEngine {
  async generatePredictions(): Promise<Prediction[]> {
    console.log("[PredictionEngine] Starting prediction generation");

    const opportunities = await this.fetchTopOpportunities();
    console.log(`[PredictionEngine] Found ${opportunities.length} opportunities to process`);

    if (opportunities.length === 0) {
      console.log("[PredictionEngine] No opportunities to process");
      return [];
    }

    const existingPredictionIds = await this.getExistingPredictionOpportunityIds();
    const newOpportunities = opportunities.filter(
      opp => !existingPredictionIds.has(opp.id)
    );

    console.log(`[PredictionEngine] ${newOpportunities.length} new opportunities (${opportunities.length - newOpportunities.length} already have predictions)`);

    if (newOpportunities.length === 0) {
      console.log("[PredictionEngine] All opportunities already have predictions");
      return [];
    }

    const predictions: Prediction[] = [];

    for (const opportunity of newOpportunities) {
      try {
        const prediction = await this.generatePredictionForOpportunity(opportunity);
        predictions.push(prediction);
        console.log(`[PredictionEngine] ✓ Generated prediction: ${prediction.title}`);
      } catch (err) {
        console.error(`[PredictionEngine] Failed to generate prediction for opportunity ${opportunity.id}:`, err);
      }
    }

    console.log(`[PredictionEngine] Successfully generated ${predictions.length} predictions`);
    return predictions;
  }

  private async fetchTopOpportunities(): Promise<Opportunity[]> {
    const result = await db.query(`
      SELECT
        id,
        title,
        description,
        pain_point,
        target_market,
        why_now,
        confidence_score,
        window_estimate,
        created_at
      FROM opportunities
      WHERE confidence_score > 60
      ORDER BY confidence_score DESC, created_at DESC
      LIMIT 50
    `);

    return result.rows;
  }

  private async getExistingPredictionOpportunityIds(): Promise<Set<string>> {
    const result = await db.query(`
      SELECT DISTINCT opportunity_id
      FROM predictions
    `);

    return new Set(result.rows.map(row => row.opportunity_id));
  }

  private async generatePredictionForOpportunity(opportunity: Opportunity): Promise<Prediction> {
    const predictionText = await this.generatePredictionText(opportunity);

    const result = await db.query(`
      INSERT INTO predictions (
        opportunity_id,
        title,
        prediction_text,
        confidence_score,
        status,
        detected_at,
        predicted_window,
        draft_score,
        draft_signal_count,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
      RETURNING *
    `, [
      opportunity.id,
      opportunity.title,
      predictionText,
      opportunity.confidence_score,
      'draft',
      opportunity.created_at,
      opportunity.window_estimate || 'Q2-Q4 2026',
      Math.round(opportunity.confidence_score),
      10
    ]);

    return result.rows[0];
  }

  private async generatePredictionText(opportunity: Opportunity): Promise<string> {
    const prompt = `Based on the following market opportunity, generate a clear, specific startup prediction statement.

OPPORTUNITY DETAILS:
Title: ${opportunity.title}
Description: ${opportunity.description}
Pain Point: ${opportunity.pain_point}
Target Market: ${opportunity.target_market}
Why Now: ${opportunity.why_now}
Confidence Score: ${opportunity.confidence_score}
Time Window: ${opportunity.window_estimate}

INSTRUCTIONS:
- Write a clear market prediction statement (2-3 sentences)
- Make it business-readable and actionable
- Focus on what startup/product will emerge and why
- Avoid vague template language
- Be specific about the market hypothesis

Generate the prediction:`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a market analyst generating specific startup predictions based on weak signals and market opportunities. Write clear, actionable predictions that read like real market hypotheses."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      return completion.choices[0].message.content?.trim() || this.generateFallbackPrediction(opportunity);
    } catch (err) {
      console.error("[PredictionEngine] OpenAI API error, using fallback:", err);
      return this.generateFallbackPrediction(opportunity);
    }
  }

  private generateFallbackPrediction(opportunity: Opportunity): string {
    return `A startup addressing ${opportunity.pain_point} in the ${opportunity.target_market} market will emerge. ${opportunity.why_now} The opportunity window is estimated at ${opportunity.window_estimate}, with market timing driven by current weak signals indicating growing demand.`;
  }

  async getTopPredictions(limit: number = 20): Promise<Prediction[]> {
    const result = await db.query(`
      SELECT
        p.id,
        p.opportunity_id,
        p.title,
        p.prediction_text,
        p.confidence_score,
        p.status,
        p.detected_at,
        p.predicted_window,
        p.created_at,
        p.updated_at
      FROM predictions p
      ORDER BY p.detected_at DESC, p.confidence_score DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  async getPredictionById(id: string): Promise<Prediction | null> {
    const result = await db.query(`
      SELECT
        p.id,
        p.opportunity_id,
        p.title,
        p.prediction_text,
        p.confidence_score,
        p.status,
        p.detected_at,
        p.predicted_window,
        p.confirmation_date,
        p.confirmation_source_url,
        p.notes,
        p.created_at,
        p.updated_at,
        o.title as opportunity_title,
        o.description as opportunity_description,
        o.target_market,
        o.pain_point
      FROM predictions p
      LEFT JOIN opportunities o ON o.id = p.opportunity_id
      WHERE p.id = $1
    `, [id]);

    return result.rows[0] || null;
  }
}

export const predictionEngine = new PredictionEngine();
