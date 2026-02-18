import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

declare global {
  interface CloudflareEnv {
    DATABASE_URL: D1Database;
  }
}

export const db = drizzle(getCloudflareContext().env.DATABASE_URL, { schema });
