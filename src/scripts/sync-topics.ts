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
const AIRTABLE_API_KEY = requiredEnv("AIRTABLE_API_KEY");

const client = createClient({ url: DATABASE_URL });
const db = drizzle(client, { schema });
const { tag, topic, topicTag, topicLink, topicPrerequisite } = schema;

const AIRTABLE_BASE_ID = "app1JWwSscnpSUgNp";
const AIRTABLE_TABLE_ID = "tblivpWMCQpFs0w7w";
const AIRTABLE_VIEW_ID = "List";

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

/** Parse markdown-style links from Airtable rich text. */
function extractLinks(
  richText: string | undefined | null,
): Array<{ title: string; url: string | null }> {
  if (!richText?.trim()) return [];

  const results: Array<{ title: string; url: string | null }> = [];
  // Match markdown links: [title](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  let lastEnd = 0;
  const plainParts: string[] = [];

  while ((match = linkRegex.exec(richText)) !== null) {
    // Collect plain text before this link
    if (match.index > lastEnd) {
      plainParts.push(richText.slice(lastEnd, match.index));
    }
    lastEnd = match.index + match[0].length;

    const title = cleanTitle(match[1]!);
    const url = match[2]!.trim();
    if (title) results.push({ title, url });
  }

  // Remaining plain text after last link
  if (lastEnd < richText.length) {
    plainParts.push(richText.slice(lastEnd));
  }

  // If no markdown links found, split plain text as bullet items
  if (results.length === 0) {
    return splitBullets(richText).map((t) => ({ title: t, url: null }));
  }

  // Also pick up any plain-text bullet items that aren't part of links
  for (const part of plainParts) {
    for (const item of splitBullets(part)) {
      if (item) results.push({ title: item, url: null });
    }
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

async function fetchAllRecords(): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
    );
    url.searchParams.set("view", AIRTABLE_VIEW_ID);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${body}`);
    }
    const json: { records: AirtableRecord[]; offset?: string } =
      await res.json();
    allRecords.push(...json.records);
    offset = json.offset;
  } while (offset);

  return allRecords;
}

async function main() {
  const records = await fetchAllRecords();

  // Build record-id-to-name map for prerequisite resolution
  const recordIdToName = new Map<string, string>();
  for (const record of records) {
    const name =
      typeof record.fields.Name === "string" ? record.fields.Name.trim() : null;
    if (name) {
      recordIdToName.set(record.id, name);
    }
  }

  let upserted = 0;
  let skipped = 0;
  let linkCount = 0;

  // First pass: upsert topics, tags, links
  await db.transaction(async (tx) => {
    for (let i = 0; i < records.length; i++) {
      const record = records[i]!;
      const fields = record.fields;
      const rowNum = i + 1;

      const name = typeof fields.Name === "string" ? fields.Name.trim() : null;
      if (!name) {
        skipped++;
        continue;
      }

      const description =
        typeof fields["Description+Relevance"] === "string"
          ? fields["Description+Relevance"].trim() || null
          : null;

      // Tags: Airtable multi-select returns string[]
      const rawTagsArray = Array.isArray(fields.Tags) ? fields.Tags : [];
      const rawTags = rawTagsArray.join(", ");

      // Prerequisites: Airtable linked records return string[] of record IDs
      const prereqRecordIds = Array.isArray(fields.Prerequisites)
        ? fields.Prerequisites.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const prereqNames = prereqRecordIds
        .map((id) => recordIdToName.get(id))
        .filter((n): n is string => !!n);
      const rawPrerequisites = prereqNames.join(", ") || null;

      // Resources: rich text (markdown)
      const rawResources =
        typeof fields.Resources === "string" ? fields.Resources : null;

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
      const tagNames = parseTags(rawTags || undefined);
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

      // Links from rich text Resources field
      const links = extractLinks(rawResources);
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

  // Second pass: resolve prerequisite relationships (topics must all exist first)
  let prereqCount = 0;
  await db.transaction(async (tx) => {
    // Clear all prerequisites first
    await tx.delete(topicPrerequisite);

    const allTopics = await tx.query.topic.findMany({
      columns: { id: true, name: true },
    });
    const topicNameToId = new Map(allTopics.map((t) => [t.name, t.id]));

    for (const record of records) {
      const fields = record.fields;
      const name = typeof fields.Name === "string" ? fields.Name.trim() : null;
      if (!name) continue;

      const topicId = topicNameToId.get(name);
      if (topicId == null) continue;

      const prereqRecordIds = Array.isArray(fields.Prerequisites)
        ? fields.Prerequisites.filter(
            (value): value is string => typeof value === "string",
          )
        : [];

      for (const prereqRecordId of prereqRecordIds) {
        const prereqName = recordIdToName.get(prereqRecordId);
        if (!prereqName) continue;
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
