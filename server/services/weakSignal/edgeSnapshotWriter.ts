import { db } from "../../db";
import { edgeSnapshots } from "../../../shared/schema";

export async function writeEdgeSnapshots(
  signal: { id: number; source: string },
  conceptNodeIds: number[]
): Promise<void> {
  if (conceptNodeIds.length < 2) return;

  const rows: {
    conceptA: number;
    conceptB: number;
    signalId: number;
  }[] = [];

  for (let i = 0; i < conceptNodeIds.length; i++) {
    for (let j = i + 1; j < conceptNodeIds.length; j++) {
      const a = Math.min(conceptNodeIds[i], conceptNodeIds[j]);
      const b = Math.max(conceptNodeIds[i], conceptNodeIds[j]);
      rows.push({ conceptA: a, conceptB: b, signalId: signal.id });
    }
  }

  if (rows.length === 0) return;

  await db
  .insert(edgeSnapshots)
  .values(rows);
}