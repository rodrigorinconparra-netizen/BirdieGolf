import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";

/**
 * Seeds an initial superadmin user.
 * Run with: npm run db:seed
 * Configure credentials via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env.local
 */
async function main() {
  const { db } = await import("./index");
  const { users, clubs } = await import("./schema");
  const { eq } = await import("drizzle-orm");

  const DEFAULT_BAG: [string, "wood" | "hybrid" | "iron" | "wedge" | "putter"][] = [
    ["Driver", "wood"],
    ["Madera 3", "wood"],
    ["Madera 5", "wood"],
    ["Híbrido 4", "hybrid"],
    ["Hierro 5", "iron"],
    ["Hierro 6", "iron"],
    ["Hierro 7", "iron"],
    ["Hierro 8", "iron"],
    ["Hierro 9", "iron"],
    ["Pitching Wedge", "wedge"],
    ["Gap Wedge", "wedge"],
    ["Sand Wedge", "wedge"],
    ["Putter", "putter"],
  ];

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@birdie.app";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "birdie1234";

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    console.log(`ℹ Superadmin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: "Super Admin", role: "superadmin" })
    .returning();

  await db.insert(clubs).values(
    DEFAULT_BAG.map(([name, kind], i) => ({ userId: user.id, name, kind, position: i })),
  );

  console.log(`✓ Superadmin created (with default bag)`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
