import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Surfaced clearly during dev if the Neon URL is missing from .env.local
  throw new Error(
    "DATABASE_URL is not set. Add your Neon connection string to .env.local",
  );
}

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });

export * as schema from "./schema";
