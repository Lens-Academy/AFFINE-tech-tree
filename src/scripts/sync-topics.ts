import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, notInArray } from "drizzle-orm";

import * as schema from "../server/db/schema.ts";
import { parseTags } from "./parseTags.ts";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const DATABASE_URL = requiredEnv("DATABASE_URL");

const client = createClient({ url: DATABASE_URL });
const db = drizzle(client, { schema });
const { tag, topic, topicTag, topicLink, topicPrerequisite } = schema;

const SPREADSHEET_ID = "13o-_6jETt-qq8gShKqbSicyvxdwjP2CXCZBxZWjN3Ks";

async function fetchSheetCSV(sheetName: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet "${sheetName}": ${res.status}`);
  }
  return res.text();
}

/** Parse CSV text into rows of string arrays. Handles quoted fields, embedded commas, and embedded newlines. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let i = 0;

  while (i < src.length) {
    const row: string[] = [];

    while (i < src.length && src[i] !== "\n") {
      if (src[i] === '"') {
        i++; // skip opening quote
        let field = "";
        while (i < src.length) {
          if (src[i] === '"' && src[i + 1] === '"') {
            field += '"';
            i += 2;
          } else if (src[i] === '"') {
            i++; // skip closing quote
            break;
          } else {
            field += src[i++];
          }
        }
        row.push(field);
        if (src[i] === ",") i++;
      } else {
        let field = "";
        while (i < src.length && src[i] !== "," && src[i] !== "\n") {
          field += src[i++];
        }
        row.push(field);
        if (src[i] === ",") i++;
      }
    }

    if (src[i] === "\n") i++;
    if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
      rows.push(row);
    }
  }

  return rows;
}

function csvToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0]!;
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]!] = row[i] ?? "";
    }
    return obj;
  });
}

/**
 * Split the Resources cell value into individual resource names.
 * Items are separated by ", "; items containing commas are wrapped in "...".
 */
function splitResourceNames(raw: string): string[] {
  if (!raw.trim()) return [];
  const results: string[] = [];
  let i = 0;

  while (i < raw.length) {
    while (i < raw.length && raw[i] === " ") i++;
    if (i >= raw.length) break;

    if (raw[i] === '"') {
      i++; // skip opening quote
      let item = "";
      while (i < raw.length && raw[i] !== '"') {
        item += raw[i++];
      }
      if (raw[i] === '"') i++; // skip closing quote
      const trimmed = item.trim();
      if (trimmed) results.push(trimmed);
      // skip trailing ", "
      while (i < raw.length && (raw[i] === "," || raw[i] === " ")) i++;
    } else {
      let item = "";
      while (i < raw.length) {
        // separator is ", " (comma followed by space)
        if (raw[i] === "," && raw[i + 1] === " ") {
          i++; // skip comma
          break;
        } else if (raw[i] === "," && i + 1 >= raw.length) {
          i++; // skip trailing comma
          break;
        }
        item += raw[i++];
      }
      const trimmed = item.trim();
      if (trimmed) results.push(trimmed);
    }
  }

  return results;
}

type TopicRow = {
  name: string;
  description: string | null;
  rawResources: string | null;
  tags: string;
  rawPrerequisites: string | null;
  importance: number;
};

async function fetchTopics(): Promise<TopicRow[]> {
  const csv = await fetchSheetCSV("Topics");
  const rows = csvToObjects(parseCSV(csv)) as Array<{
    Name: string;
    "Description+Relevance": string;
    Resources: string;
    Tags: string;
    Prerequisites: string;
    Importance: string;
  }>;

  return rows
    .map((row) => ({
      name: row.Name?.trim() ?? "",
      description: row["Description+Relevance"]?.trim() || null,
      rawResources: row.Resources?.trim() || null,
      tags: row.Tags?.trim() ?? "",
      rawPrerequisites: row.Prerequisites?.trim() || null,
      importance: Math.trunc(Number(row.Importance) || 0),
    }))
    .filter((t) => t.name !== "");
}

type ResourceInfo = { url: string | null; author: string | null };

async function fetchResourceMap(): Promise<Map<string, ResourceInfo>> {
  const csv = await fetchSheetCSV("Resources");
  const rows = csvToObjects(parseCSV(csv)) as Array<{
    Name: string;
    Link: string;
    Author: string;
  }>;

  const map = new Map<string, ResourceInfo>();
  for (const row of rows) {
    const name = row.Name?.trim();
    if (name)
      map.set(name, {
        url: row.Link?.trim() || null,
        author: row.Author?.trim() || null,
      });
  }
  return map;
}

async function main() {
  const [topics, resourceMap] = await Promise.all([
    fetchTopics(),
    fetchResourceMap(),
  ]);

  let upserted = 0;
  let skipped = 0;
  let linkCount = 0;

  // First pass: upsert topics, tags, links
  await db.transaction(async (tx) => {
    for (let i = 0; i < topics.length; i++) {
      const t = topics[i]!;
      const rowNum = i + 1;

      const name = t.name;
      if (!name) {
        skipped++;
        continue;
      }

      const description = t.description;
      const rawPrerequisites = t.rawPrerequisites;

      const existing = await tx.query.topic.findFirst({
        where: (tbl, { eq }) => eq(tbl.name, name),
      });

      let topicId: number;
      if (existing) {
        await tx
          .update(topic)
          .set({
            description,
            rawPrerequisites,
            spreadsheetRow: rowNum,
            importance: t.importance,
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
            importance: t.importance,
          })
          .returning({ id: topic.id });
        if (!inserted) throw new Error(`Failed to insert topic: ${name}`);
        topicId = inserted.id;
      }

      // Tags
      const tagNames = parseTags(t.tags || undefined);
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

      // Links: look up URLs and authors from Resources sheet by name
      const resourceNames = splitResourceNames(t.rawResources ?? "");
      for (let pos = 0; pos < resourceNames.length; pos++) {
        const title = resourceNames[pos]!;
        const info = resourceMap.get(title);
        await tx.insert(topicLink).values({
          topicId,
          title,
          url: info?.url ?? null,
          author: info?.author ?? null,
          position: pos,
        });
        linkCount++;
      }

      upserted++;
    }
  });

  // Delete topics that are no longer in the spreadsheet
  const sheetNames = new Set(topics.map((t) => t.name));
  const allDbTopics = await db.query.topic.findMany({
    columns: { id: true, name: true },
  });
  const toDelete = allDbTopics.filter((t) => !sheetNames.has(t.name));
  if (toDelete.length > 0) {
    await db
      .delete(topic)
      .where(
        notInArray(
          topic.name,
          [...sheetNames],
        ),
      );
    console.log(`Deleted ${toDelete.length} topics removed from sheet: ${toDelete.map((t) => t.name).join(", ")}`);
  }

  // Second pass: resolve prerequisite relationships (topics must all exist first)
  let prereqCount = 0;
  await db.transaction(async (tx) => {
    // Clear all prerequisites first
    await tx.delete(topicPrerequisite);

    const allTopics = await tx.query.topic.findMany({
      columns: { id: true, name: true },
    });
    const topicNameToId = new Map(allTopics.map((t) => [t.name, t.id]));

    for (const t of topics) {
      const topicId = topicNameToId.get(t.name);
      if (topicId == null) continue;
      if (!t.rawPrerequisites) continue;

      const prereqNames = t.rawPrerequisites
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const prereqName of prereqNames) {
        const prereqTopicId = topicNameToId.get(prereqName);
        if (prereqTopicId == null || prereqTopicId === topicId) continue;

        await tx
          .insert(topicPrerequisite)
          .values({ topicId, prerequisiteTopicId: prereqTopicId })
          .onConflictDoNothing();
        prereqCount++;
      }
    }
  });

  console.log(
    `Sync complete: ${upserted} topics upserted, ${linkCount} links, ${prereqCount} prerequisites, ${skipped} rows skipped`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
