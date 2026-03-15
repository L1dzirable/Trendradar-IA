import { AggregatedSignal } from "../../shared/signals";
import { GapType } from "../../shared/signals";

export function detectGapType(
  signal: AggregatedSignal
): GapType | null {

  const title = signal.title.toLowerCase();

  if (
    title.includes("any tool") ||
    title.includes("looking for") ||
    title.includes("is there a way")
  ) {
    return "validated_demand";
  }

  if (
    title.includes("i built") ||
    title.includes("my script") ||
    title.includes("my workaround")
  ) {
    return "diy_evidence";
  }

  if (
    title.includes("would love") ||
    title.includes("someone should build")
  ) {
    return "emerging_interest";
  }

  return null;
}