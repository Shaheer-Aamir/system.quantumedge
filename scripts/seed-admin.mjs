// Creates (or resets the password of) the super admin.
//   npm run seed         (development database, .env.local)
//   npm run seed:prod    (live database, .env.prod)
import { randomUUID } from "node:crypto";
import readline from "node:readline";
import { connect, describeTarget } from "./_db.mjs";

const ITERATIONS = 100000; // keep identical to src/lib/crypto.ts
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return `pbkdf2_sha256$${ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (str) => {
      if (hidden && rl.line !== undefined && !str.includes(question)) rl.output.write("*");
      else rl.output.write(str);
    };
    rl.question(question, (answer) => { rl.close(); if (hidden) console.log(); resolve(answer); });
  });
}

console.log(`Database: ${describeTarget()}`);
const username = (process.env.SEED_USERNAME ?? (await ask("Username (press Enter for 'Shaheer Aamir'): ")).trim()) || "Shaheer Aamir";
const password = process.env.SEED_PASSWORD ?? (await ask("Password (min 10 characters): ", { hidden: true }));
const confirm = process.env.SEED_PASSWORD ?? (await ask("Confirm password: ", { hidden: true }));
if (password.length < 10) { console.error("Password must be at least 10 characters."); process.exit(1); }
if (password !== confirm) { console.error("Passwords do not match."); process.exit(1); }

const db = connect();
await db.execute({
  sql: `INSERT INTO admins (id, username, username_lower, password_hash, role, is_active, profile_complete, created_at)
        VALUES (?, ?, ?, ?, 'super_admin', 1, 0, ?)
        ON CONFLICT(username_lower) DO UPDATE SET password_hash = excluded.password_hash, role = 'super_admin', is_active = 1`,
  args: [randomUUID(), username, username.toLowerCase(), await hashPassword(password), Date.now()],
});
console.log(`Done. You can now sign in as "${username}".`);
