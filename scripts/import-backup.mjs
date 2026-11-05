// Loads a Cloudflare D1 backup (made with: npx wrangler d1 export ... --remote --output backup.sql)
// into an EMPTY database, then checks that every table has exactly the rows the backup had.
//   npm run db:import:prod -- backup.sql
import { readFileSync } from "node:fs";
import readline from "node:readline";
import { connect, describeTarget } from "./_db.mjs";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) { console.error("Usage: npm run db:import:prod -- backup.sql"); process.exit(1); }

// Split the dump into statements, ignoring semicolons that sit inside quoted text.
function splitStatements(text) {
  const out = []; let cur = ""; let quoted = false;
  for (const ch of text) {
    cur += ch;
    if (ch === "'") quoted = !quoted;
    else if (ch === ";" && !quoted) { if (cur.trim()) out.push(cur.trim()); cur = ""; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Parents before children, so every foreign key finds its row.
const ORDER = ["admins", "settings", "leads", "scripts", "calls", "meetings", "projects", "payments", "sessions", "login_failures", "d1_migrations"];

const statements = splitStatements(readFileSync(file, "utf8"));
const tables = [], indexes = [], rows = new Map();
for (const s of statements) {
  if (/^CREATE TABLE/i.test(s)) tables.push(s);
  else if (/^CREATE (UNIQUE )?INDEX/i.test(s)) indexes.push(s);
  else if (/^INSERT INTO/i.test(s)) {
    const name = /^INSERT INTO\s+"?([A-Za-z0-9_]+)"?/i.exec(s)?.[1];
    if (name && name !== "sqlite_sequence") rows.set(name, [...(rows.get(name) ?? []), s]);
  } // PRAGMA and sqlite_sequence lines are not needed
}
const order = [...ORDER.filter((t) => rows.has(t)), ...[...rows.keys()].filter((t) => !ORDER.includes(t))];

const db = connect();
console.log(`Backup:   ${file}  (${statements.length} statements, ${[...rows.values()].reduce((n, r) => n + r.length, 0)} rows)`);
console.log(`Target:   ${describeTarget()}`);

const existing = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'");
if (existing.rows.length) {
  console.error(`\nThis database is not empty (it has: ${existing.rows.map((r) => r.name).join(", ")}).`);
  console.error("Import into a brand new database so nothing is overwritten.");
  process.exit(1);
}

if (!process.argv.includes("--yes")) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question("\nType import to load the backup into this database: ", (a) => { rl.close(); r(a.trim().toLowerCase()); }));
  if (answer !== "import") { console.log("Cancelled. Nothing was changed."); process.exit(0); }
}

await db.batch(tables, "write");
await db.batch(indexes, "write");
for (const table of order) {
  const list = rows.get(table);
  for (let i = 0; i < list.length; i += 200) await db.batch(list.slice(i, i + 200), "write");
  console.log(`  ${table.padEnd(16)} ${list.length} rows`);
}

console.log("\nChecking the copy against the backup:");
let bad = 0;
for (const table of order) {
  const n = Number((await db.execute(`SELECT count(*) AS n FROM "${table}"`)).rows[0].n);
  const expected = rows.get(table).length;
  console.log(`  ${n === expected ? "OK " : "BAD"} ${table.padEnd(16)} ${n} of ${expected}`);
  if (n !== expected) bad++;
}
if (bad) { console.error("\nSome tables do not match. Delete this database, create a new one and run the import again."); process.exit(1); }
console.log("\nAll rows copied. Now run: npm run db:migrate:prod");
