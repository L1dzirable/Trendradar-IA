import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type GenerateTrendInput } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw new Error("Invalid response format from server.");
  }
  return result.data;
}

export function useTrends() {
  return useQuery({
    queryKey: [api.trends.list.path],
    queryFn: async () => {
      const res = await fetch(api.trends.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trends");
      const data = await res.json();
      return data;
    },
  });
}

export function useGenerateTrend() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: GenerateTrendInput) => {
      const validated = api.trends.generate.input.parse(input);
      
      const res = await fetch(api.trends.generate.path, {
        method: api.trends.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400) {
          const error = parseWithLogging(api.trends.generate.responses[400], data, "trends.generate.400");
          throw new Error(error.message);
        }
        throw new Error(data.message || "Failed to generate trend");
      }

      return parseWithLogging(api.trends.generate.responses[200], data, "trends.generate.200");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.trends.list.path] });
      toast({ 
        title: "Radar Complete", 
        description: "Successfully uncovered a new trend opportunity.",
      });
    },
    onError: (error) => {
      toast({ 
        title: "Scan Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
}
