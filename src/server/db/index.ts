import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "~/env";
import * as schema from "./schema";

type GlobalForDb = typeof globalThis & {
  __libsqlClient?: ReturnType<typeof createClient>;
};

const globalForDb = globalThis as GlobalForDb;

// Use HTTPS for serverless environments to avoid WebSocket connection overhead.
// libsql:// uses WebSocket which adds 1-3s on cold starts and can exceed Vercel's timeout.
const dbUrl = env.DATABASE_URL.replace(/^libsql:\/\//, "https://");

const client = globalForDb.__libsqlClient ?? createClient({ url: dbUrl });

globalForDb.__libsqlClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
