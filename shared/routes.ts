import { z } from 'zod';
import { generateTrendRequestSchema, trends } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  trends: {
    generate: {
      method: 'POST' as const,
      path: '/api/trends' as const,
      input: generateTrendRequestSchema,
      responses: {
        200: z.custom<typeof trends.$inferSelect>(),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/trends' as const,
      responses: {
        200: z.array(z.custom<typeof trends.$inferSelect>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type GenerateTrendInput = z.infer<typeof api.trends.generate.input>;
export type TrendResponse = z.infer<typeof api.trends.generate.responses[200]>;
export type TrendsListResponse = z.infer<typeof api.trends.list.responses[200]>;
