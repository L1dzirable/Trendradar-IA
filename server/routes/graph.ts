import { Router } from "express";
import { db } from "../db";
import { edgeSnapshots, conceptNodes } from "../../shared/schema";
import { desc, sql } from "drizzle-orm";

const router = Router();

interface GraphNode {
  id: string;
  label: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

router.get("/edges", async (req, res) => {
  try {
    const edges = await db
      .select({
        conceptA: edgeSnapshots.conceptA,
        conceptB: edgeSnapshots.conceptB,
        weight: edgeSnapshots.weight,
      })
      .from(edgeSnapshots)
      .orderBy(desc(edgeSnapshots.weight))
      .limit(200);

    const uniqueConcepts = new Set<string>();
    edges.forEach(edge => {
      uniqueConcepts.add(edge.conceptA);
      uniqueConcepts.add(edge.conceptB);
    });

    const conceptsList = Array.from(uniqueConcepts);
    const conceptLabelsMap = new Map<string, string>();

    if (conceptsList.length > 0) {
      const labels = await db
        .select({
          concept: conceptNodes.concept,
          label: conceptNodes.label,
        })
        .from(conceptNodes)
        .where(sql`${conceptNodes.concept} = ANY(${conceptsList})`);

      labels.forEach(row => {
        conceptLabelsMap.set(row.concept, row.label || row.concept);
      });
    }

    const nodes: GraphNode[] = conceptsList.map(concept => ({
      id: concept,
      label: conceptLabelsMap.get(concept) || concept,
    }));

    const graphEdges: GraphEdge[] = edges.map(edge => ({
      source: edge.conceptA,
      target: edge.conceptB,
      weight: edge.weight || 1,
    }));

    const response: GraphData = {
      nodes,
      edges: graphEdges,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching graph data:", error);
    res.status(500).json({ error: "Failed to fetch graph data" });
  }
});

export default router;
