import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "~/env";
import * as schema from "./schema";

type GlobalForDb = typeof globalThis & {
  __libsqlClient?: ReturnType<typeof createClient>;
};

const globalForDb = globalThis as GlobalForDb;

const client =
  globalForDb.__libsqlClient ?? createClient({ url: env.DATABASE_URL });

if (env.NODE_ENV !== "production") {
  globalForDb.__libsqlClient = client;
}

export const db = drizzle(client, { schema });
