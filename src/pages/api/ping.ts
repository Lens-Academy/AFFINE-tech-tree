import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/server/db";
import { sql } from "drizzle-orm";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  await db.run(sql`SELECT 1`);
  res.status(200).json({ ok: true });
}
