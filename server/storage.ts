import { db } from "./db";
import { trends, type InsertTrend, type Trend } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getTrends(): Promise<Trend[]>;
  createTrend(trend: InsertTrend): Promise<Trend>;
}

export class DatabaseStorage implements IStorage {
  async getTrends(): Promise<Trend[]> {
    return await db.select().from(trends).orderBy(desc(trends.createdAt));
  }

  async createTrend(insertTrend: InsertTrend): Promise<Trend> {
    const [trend] = await db.insert(trends).values(insertTrend).returning();
    return trend;
  }
}

export const storage = new DatabaseStorage();
