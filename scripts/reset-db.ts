/**
 * Drops and recreates the public schema, applies all migrations, then seeds.
 * This is the only sanctioned way to clear immutable tables.
 *
 * Usage:
 *   DATABASE_URL=... ANTHROPIC_API_KEY=... npx tsx scripts/reset-db.ts --confirm
 *
 * Without --confirm, prints what it would do and exits.
 */

import { Pool } from "pg";
import fs from "fs";
import path from "path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const host = new URL(connectionString).hostname;
const confirmed = process.argv.includes("--confirm");

if (!confirmed) {
  console.log(`Would reset database on: ${host}`);
  console.log("Pass --confirm to proceed.");
  process.exit(0);
}

console.log(`Resetting database on: ${host}`);

const pool = new Pool({ connectionString });

async function run() {
  // Drop and recreate public schema (wipes everything)
  console.log("  Dropping public schema...");
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query("GRANT ALL ON SCHEMA public TO postgres");
  await pool.query("GRANT ALL ON SCHEMA public TO public");

  // Apply migrations in order
  const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && !f.includes("_test"))
    .sort();

  for (const file of files) {
    console.log(`  Applying ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    await pool.query(sql);
  }

  console.log("  Migrations applied.");
  await pool.end();

  // Run seed (it creates its own pool via db.ts)
  console.log("  Running seed...");
  // Dynamic import so it picks up the fresh schema
  await import("./seed");
}

run().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
