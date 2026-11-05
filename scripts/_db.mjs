// Shared by the scripts. Connects using TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from the environment.
import { createClient } from "@libsql/client";

export function connect() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error("TURSO_DATABASE_URL is not set. Create the .env.local (or .env.prod) file first. See DEPLOYMENT.md.");
    process.exit(1);
  }
  return createClient({ url: url.replace(/^libsql:/, "https:"), authToken: process.env.TURSO_AUTH_TOKEN || undefined });
}

export const describeTarget = () => {
  const url = process.env.TURSO_DATABASE_URL ?? "";
  return url.startsWith("file:") ? `the local file ${url.slice(5)}` : url.replace(/^(libsql|https):\/\//, "").split("/")[0];
};
