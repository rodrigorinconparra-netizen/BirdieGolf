import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load env from .env.local so drizzle-kit can read the Neon connection string.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
