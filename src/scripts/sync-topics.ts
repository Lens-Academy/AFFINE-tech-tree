import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";

import * as schema from "../server/db/schema.ts";
import { parseTags } from "./parseTags.ts";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const DATABASE_URL = requiredEnv("DATABASE_URL");
const AFFINE_SHEETS_API_KEY = requiredEnv("AFFINE_SHEETS_API_KEY");

const client = createClient({ url: DATABASE_URL });
const db = drizzle(client, { schema });
const { tag, topic, topicTag, topicLink } = schema;

const SPREADSHEET_ID = "16BG0Fw7mOOHJykBVLkeqPzlpdxgMMp1_YeSmgaFnKLc";

// Column indices in the spreadsheet (0-based)
const COL = {
  NAME: 0,
  DESCRIPTION: 1,
  LINKS: 2,
  PREREQUISITES: 3,
  TAGS: 4,
} as const;

type CellData = {
  formattedValue?: string;
  textFormatRuns?: Array<{
    startIndex?: number;
    format?: { link?: { uri?: string } };
  }>;
};

type SheetRow = { values?: CellData[] };

/** Extract {title, url} pairs from a cell's text format runs. */
function extractLinks(
  cell: CellData | undefined,
): Array<{ title: string; url: string | null }> {
  const text = cell?.formattedValue?.trim();
  if (!text) return [];

  const runs = cell?.textFormatRuns;
  if (!runs || runs.length === 0) {
    // No rich text — split by bullet/newline and return as plain titles
    return splitBullets(text).map((t) => ({ title: t, url: null }));
  }

  // Build spans: each run applies from its startIndex to the next run's startIndex
  const spans: Array<{ start: number; end: number; url: string | null }> = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    const start = run.startIndex ?? 0;
    const end =
      i + 1 < runs.length
        ? (runs[i + 1]!.startIndex ?? text.length)
        : text.length;
    const url = run.format?.link?.uri ?? null;
    spans.push({ start, end, url });
  }

  // Group consecutive spans into link items
  const results: Array<{ title: string; url: string | null }> = [];
  for (const span of spans) {
    const chunk = text.slice(span.start, span.end);
    if (span.url) {
      const title = cleanTitle(chunk);
      if (title) results.push({ title, url: span.url });
    }
  }

  // If no runs had links, fall back to plain bullet splitting
  if (results.length === 0) {
    return splitBullets(text).map((t) => ({ title: t, url: null }));
  }

  return results;
}

function splitBullets(text: string): string[] {
  return text
    .split(/[\n;]+/)
    .map(cleanTitle)
    .filter(Boolean);
}

function cleanTitle(s: string): string {
  return s
    .replace(/^[\s*•\-–—]+/, "")
    .replace(/[\s,;]+$/, "")
    .trim();
}

function cellText(row: SheetRow, col: number): string | null {
  return row.values?.[col]?.formattedValue?.trim() ?? null;
}

async function main() {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
  );
  url.searchParams.set("ranges", "Hoja 1");
  url.searchParams.set("includeGridData", "true");
  url.searchParams.set(
    "fields",
    "sheets.data.rowData.values(formattedValue,textFormatRuns)",
  );
  url.searchParams.set("key", AFFINE_SHEETS_API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${body}`);
  }
  const json: { sheets: Array<{ data: Array<{ rowData?: SheetRow[] }> }> } =
    await res.json();

  const rows = json.sheets[0]?.data[0]?.rowData ?? [];
  // Skip header row
  const dataRows = rows.slice(1);

  let upserted = 0;
  let skipped = 0;
  let linkCount = 0;

  await db.transaction(async (tx) => {
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]!;
      const rowNum = i + 2; // 1-based + header

      const name = cellText(row, COL.NAME);
      if (!name) {
        skipped++;
        continue;
      }

      const description = cellText(row, COL.DESCRIPTION);
      const rawPrerequisites = cellText(row, COL.PREREQUISITES);
      const rawTags = cellText(row, COL.TAGS);

      const existing = await tx.query.topic.findFirst({
        where: (t, { eq }) => eq(t.name, name),
      });

      let topicId: number;
      if (existing) {
        await tx
          .update(topic)
          .set({
            description,
            rawPrerequisites,
            spreadsheetRow: rowNum,
            updatedAt: new Date(),
          })
          .where(eq(topic.id, existing.id));
        topicId = existing.id;

        await tx.delete(topicTag).where(eq(topicTag.topicId, topicId));
        await tx.delete(topicLink).where(eq(topicLink.topicId, topicId));
      } else {
        const [inserted] = await tx
          .insert(topic)
          .values({
            name,
            description,
            rawPrerequisites,
            spreadsheetRow: rowNum,
          })
          .returning({ id: topic.id });
        if (!inserted) throw new Error(`Failed to insert topic: ${name}`);
        topicId = inserted.id;
      }

      // Tags
      const tagNames = parseTags(rawTags ?? undefined);
      for (const tagName of tagNames) {
        await tx
          .insert(tag)
          .values({ name: tagName })
          .onConflictDoNothing({ target: tag.name });
        await tx
          .insert(topicTag)
          .values({ topicId, tagName })
          .onConflictDoNothing({
            target: [topicTag.topicId, topicTag.tagName],
          });
      }

      // Links
      const links = extractLinks(row.values?.[COL.LINKS]);
      for (let pos = 0; pos < links.length; pos++) {
        const link = links[pos]!;
        await tx.insert(topicLink).values({
          topicId,
          title: link.title,
          url: link.url,
          position: pos,
        });
        linkCount++;
      }

      upserted++;
    }
  });

  console.log(
    `Sync complete: ${upserted} topics upserted, ${linkCount} links, ${skipped} rows skipped`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
