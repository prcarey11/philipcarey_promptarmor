/**
 * Drops and recreates the public schema, applies all migrations, then seeds.
 * This is the only sanctioned way to clear immutable tables.
 *
 * Usage:
 *   npx tsx scripts/reset-db.ts --target=dev  --confirm   # resets DATABASE_URL (local/test)
 *   npx tsx scripts/reset-db.ts --target=prod --confirm   # resets PROD_DATABASE_URL
 *
 * Without --confirm, prints what it would do and exits.
 */

import { Pool } from "pg";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const targetArg = args.find((a) => a.startsWith("--target="));
const target = targetArg?.split("=")[1];
const confirmed = args.includes("--confirm");

if (target !== "dev" && target !== "prod") {
  console.error("Usage: npx tsx scripts/reset-db.ts --target=dev|prod [--confirm]");
  process.exit(1);
}

const envVar = target === "prod" ? "PROD_DATABASE_URL" : "DATABASE_URL";
const connectionString = process.env[envVar];

if (!connectionString) {
  console.error(`${envVar} is not set.`);
  process.exit(1);
}

const host = new URL(connectionString).hostname;

if (!confirmed) {
  console.log(`Would reset ${target} database on: ${host}`);
  console.log(`  Reading from: ${envVar}`);
  console.log("Pass --confirm to proceed.");
  process.exit(0);
}

console.log(`Resetting ${target} database on: ${host}`);

// Set DATABASE_URL so db.ts (used by seed) connects to the right place
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });

async function run() {
  console.log("  Dropping public schema...");
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query("GRANT ALL ON SCHEMA public TO postgres");
  await pool.query("GRANT ALL ON SCHEMA public TO public");

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

  console.log("  Running seed...");
  await import("./seed");
}

run().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
