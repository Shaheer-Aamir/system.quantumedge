import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
import * as schema from "./schema";
import type { Db } from "./types";

export type { Db };

let db: Db | undefined;

// Live site: Turso, reached over plain HTTPS (no native code, so it runs on any serverless host).
// Local development: set TURSO_DATABASE_URL=file:local.db to use a plain file on your computer.
export function getDb(): Db {
  if (db) return db;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not set. Copy .env.example to .env.local and fill it in. See DEPLOYMENT.md.");
  }

  if (url.startsWith("file:")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient: createLocal } = require("@libsql/client") as typeof import("@libsql/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle: drizzleLocal } = require("drizzle-orm/libsql") as typeof import("drizzle-orm/libsql");
    db = drizzleLocal(createLocal({ url }), { schema });
  } else {
    const client = createClient({ url: url.replace(/^libsql:/, "https:"), authToken: process.env.TURSO_AUTH_TOKEN });
    db = drizzle(client, { schema });
  }
  return db;
}
