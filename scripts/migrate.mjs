// Applies any migrations/*.sql files that the database has not seen yet.
//   npm run db:migrate        (your development database, .env.local)
//   npm run db:migrate:prod   (the live database, .env.prod)
import { readFileSync, readdirSync } from "node:fs";
import { connect, describeTarget } from "./_db.mjs";

const db = connect();
console.log(`Database: ${describeTarget()}`);
await db.execute("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)");

const files = readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();
let applied = new Set((await db.execute("SELECT name FROM _migrations")).rows.map((r) => String(r.name)));

// A database restored from a Cloudflare backup already has its tables and a list of what was applied.
if (applied.size === 0) {
  const old = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'");
  if (old.rows.length) {
    const names = (await db.execute("SELECT name FROM d1_migrations")).rows.map((r) => String(r.name));
    for (const name of names) await db.execute({ sql: "INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (?, ?)", args: [name, Date.now()] });
    applied = new Set(names);
    console.log(`Found ${names.length} migrations already applied by your Cloudflare database.`);
  }
}

let ran = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = readFileSync(`migrations/${file}`, "utf8").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
  await db.batch([...statements, { sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", args: [file, Date.now()] }], "write");
  console.log(`  applied ${file}`);
  ran++;
}
console.log(ran ? `Done. ${ran} migration${ran === 1 ? "" : "s"} applied.` : "Already up to date.");
