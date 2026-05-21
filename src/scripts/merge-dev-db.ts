/**
 * Merges user data from a dev deployment's SQLite dump into the live Turso DB.
 *
 * Usage:
 *   node --env-file=.env --experimental-strip-types src/scripts/merge-dev-db.ts <dump.sql> [--dry-run]
 *
 * The dump must be a .sql file produced by:
 *   turso db shell <dev-db-name> .dump > dump.sql
 *
 * What is migrated:
 *   - user + account records for Discord users not yet in the live DB
 *   - user_topic_status   (upsert: keeps the more-advanced level on conflict)
 *   - bookmark            (insert or ignore)
 *   - excited_to_teach    (insert or ignore)
 *   - level_transition    (insert all historical records)
 *   - feedback_item       (insert all, with remapped transitionId)
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const UNDERSTANDING_LEVEL_RANK: Record<string, number> = {
  unfamiliar: 0,
  vague: 1,
  can_teach: 2,
  advanced_questions_welcome: 3,
};

const dumpPath = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!dumpPath) {
  console.error("Usage: merge-dev-db.ts <dump.sql> [--dry-run]");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in environment");
  process.exit(1);
}

if (dryRun) {
  console.log("=== DRY RUN — no changes will be written ===\n");
}

// ---------------------------------------------------------------------------
// Load dump into in-memory SQLite
// ---------------------------------------------------------------------------
console.log(`Loading dump from ${dumpPath}…`);
const sql = readFileSync(dumpPath, "utf8");
const srcDb = new DatabaseSync(":memory:");
srcDb.exec(sql);
console.log("Dump loaded.\n");

// ---------------------------------------------------------------------------
// Connect to live Turso DB
// ---------------------------------------------------------------------------
const liveUrl = databaseUrl.replace(/^libsql:\/\//, "https://");
const live = createClient({ url: liveUrl });

// ---------------------------------------------------------------------------
// Build Discord ID → userId maps for both DBs
// ---------------------------------------------------------------------------
type Row = Record<string, string | number | null | undefined>;

function srcAll(query: string): Row[] {
  const stmt = srcDb.prepare(query);
  return stmt.all() as Row[];
}

// dev: discord_id → { devUserId, userRow, accountRow }
const devDiscordAccounts = srcAll(
  "SELECT a.accountId, a.userId, a.id as accountId2, a.scope, a.createdAt as accountCreatedAt, " +
    "u.name, u.email, u.image, u.segment, u.availableForTutoring, u.isNonUser, u.isApproved, u.createdAt as userCreatedAt " +
    "FROM account a JOIN user u ON u.id = a.userId WHERE a.providerId = 'discord'",
);
const devDiscordToUserId = new Map<string, string>(
  devDiscordAccounts.map((r) => [r.accountId as string, r.userId as string]),
);

// live: discord_id → live_userId
const liveAccounts = await live.execute(
  "SELECT accountId, userId FROM account WHERE providerId = 'discord'",
);
const liveDiscordToUserId = new Map<string, string>(
  liveAccounts.rows.map((r) => [r.accountId as string, r.userId as string]),
);

// ---------------------------------------------------------------------------
// Create user + account records for dev users not yet in live DB
// ---------------------------------------------------------------------------
console.log("Checking for users to create…");
let usersCreated = 0;

for (const row of devDiscordAccounts) {
  const discordId = row.accountId as string;
  if (liveDiscordToUserId.has(discordId)) continue; // already exists

  const newUserId = crypto.randomUUID();
  const newAccountId = crypto.randomUUID();

  if (!dryRun) {
    await live.execute({
      sql: "INSERT OR IGNORE INTO user (id, name, email, image, segment, availableForTutoring, isNonUser, isApproved, emailVerified, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)",
      args: [
        newUserId,
        row.name ?? null,
        row.email ?? `discord-${discordId}@placeholder.invalid`,
        row.image ?? null,
        row.segment ?? null,
        row.availableForTutoring ?? 0,
        row.isNonUser ?? 0,
        row.userCreatedAt ?? Math.floor(Date.now() / 1000),
      ],
    });
    await live.execute({
      sql: "INSERT OR IGNORE INTO account (id, userId, accountId, providerId, scope, createdAt) VALUES (?, ?, ?, 'discord', ?, ?)",
      args: [
        newAccountId,
        newUserId,
        discordId,
        row.scope ?? null,
        row.accountCreatedAt ?? Math.floor(Date.now() / 1000),
      ],
    });
  }

  liveDiscordToUserId.set(discordId, newUserId);
  usersCreated++;
  console.log(
    `  ${dryRun ? "[dry] " : ""}created user for Discord ${discordId} (${row.name ?? "unnamed"})`,
  );
}
console.log(`  ${usersCreated} users created\n`);

// dev_userId → live_userId (all matched + newly created)
const devToLive = new Map<string, string>();
let unmatched = 0;
for (const [discordId, devUserId] of devDiscordToUserId) {
  const liveUserId = liveDiscordToUserId.get(discordId);
  if (liveUserId) {
    devToLive.set(devUserId, liveUserId);
  } else {
    unmatched++;
  }
}

console.log(
  `Mapped ${devToLive.size} users (${unmatched} still unmatched — no Discord account in dump).\n`,
);
if (devToLive.size === 0) {
  console.log("Nothing to migrate.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Validate topic and topic_link IDs exist in live DB
// ---------------------------------------------------------------------------
console.log("Validating topic and topic_link IDs…");

const liveTopicRows = await live.execute("SELECT id FROM topic");
const liveTopicIds = new Set<number>(
  liveTopicRows.rows.map((r) => r.id as number),
);

const liveTopicLinkRows = await live.execute("SELECT id FROM topic_link");
const liveTopicLinkIds = new Set<number>(
  liveTopicLinkRows.rows.map((r) => r.id as number),
);

const devTopicIds = new Set<number>(
  srcAll(
    "SELECT DISTINCT topicId FROM user_topic_status UNION SELECT DISTINCT topicId FROM bookmark UNION SELECT DISTINCT topicId FROM level_transition UNION SELECT DISTINCT topicId FROM feedback_item",
  ).map((r) => r.topicId as number),
);
const missingTopicIds = [...devTopicIds].filter((id) => !liveTopicIds.has(id));
if (missingTopicIds.length > 0) {
  console.warn(
    `  WARNING: ${missingTopicIds.length} topic IDs in the dump are missing from the live DB: ${missingTopicIds.join(", ")}`,
  );
  console.warn("  Rows referencing these topics will be skipped.\n");
} else {
  console.log("  All topic IDs OK.\n");
}

const devTopicLinkIds = new Set<number>(
  srcAll(
    "SELECT DISTINCT topicLinkId FROM feedback_item WHERE topicLinkId IS NOT NULL",
  ).map((r) => r.topicLinkId as number),
);
const missingTopicLinkIds = [...devTopicLinkIds].filter(
  (id) => !liveTopicLinkIds.has(id),
);
if (missingTopicLinkIds.length > 0) {
  console.warn(
    `  WARNING: ${missingTopicLinkIds.length} topic_link IDs in the dump are missing from the live DB: ${missingTopicLinkIds.join(", ")}`,
  );
  console.warn("  topicLinkId will be set to NULL for those feedback_items.\n");
} else {
  console.log("  All topic_link IDs OK.\n");
}

const missingTopicIdSet = new Set(missingTopicIds);
const missingTopicLinkIdSet = new Set(missingTopicLinkIds);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mapUserId(devId: string): string | null {
  return devToLive.get(devId) ?? null;
}

async function liveExecute(query: string, args: unknown[] = []) {
  if (dryRun) return { lastInsertRowid: BigInt(0), rowsAffected: 0 };
  return live.execute({ sql: query, args: args as never[] });
}

// ---------------------------------------------------------------------------
// 1. user_topic_status
// ---------------------------------------------------------------------------
console.log("Migrating user_topic_status…");
const devStatuses = srcAll(
  "SELECT userId, topicId, level FROM user_topic_status",
);

// Fetch live statuses for matched users
const liveUserIds = [...devToLive.values()];
const liveStatusRows = await live.execute({
  sql: `SELECT userId, topicId, level FROM user_topic_status WHERE userId IN (${liveUserIds.map(() => "?").join(",")})`,
  args: liveUserIds,
});
const liveStatusMap = new Map<string, string>(
  liveStatusRows.rows.map((r) => [
    `${r.userId as string}:${r.topicId as number}`,
    r.level as string,
  ]),
);

let statusInserted = 0;
let statusUpgraded = 0;
let statusSkipped = 0;

for (const row of devStatuses) {
  const liveUserId = mapUserId(row.userId as string);
  if (!liveUserId) continue;
  if (missingTopicIdSet.has(row.topicId as number)) {
    statusSkipped++;
    continue;
  }

  const key = `${liveUserId}:${row.topicId}`;
  const existingLevel = liveStatusMap.get(key);
  const devLevel = row.level as string;

  if (!existingLevel) {
    await liveExecute(
      "INSERT OR IGNORE INTO user_topic_status (userId, topicId, level) VALUES (?, ?, ?)",
      [liveUserId, row.topicId, devLevel],
    );
    statusInserted++;
  } else {
    const existingRank = UNDERSTANDING_LEVEL_RANK[existingLevel] ?? -1;
    const devRank = UNDERSTANDING_LEVEL_RANK[devLevel] ?? -1;
    if (devRank > existingRank) {
      await liveExecute(
        "UPDATE user_topic_status SET level = ? WHERE userId = ? AND topicId = ?",
        [devLevel, liveUserId, row.topicId],
      );
      statusUpgraded++;
    } else {
      statusSkipped++;
    }
  }
}
console.log(
  `  inserted ${statusInserted}, upgraded ${statusUpgraded}, skipped ${statusSkipped}\n`,
);

// ---------------------------------------------------------------------------
// 2. bookmark
// ---------------------------------------------------------------------------
console.log("Migrating bookmarks…");
const devBookmarks = srcAll("SELECT userId, topicId FROM bookmark");
let bookmarkInserted = 0;

for (const row of devBookmarks) {
  const liveUserId = mapUserId(row.userId as string);
  if (!liveUserId) continue;
  if (missingTopicIdSet.has(row.topicId as number)) continue;
  await liveExecute(
    "INSERT OR IGNORE INTO bookmark (userId, topicId) VALUES (?, ?)",
    [liveUserId, row.topicId],
  );
  bookmarkInserted++;
}
console.log(`  inserted ${bookmarkInserted}\n`);

// ---------------------------------------------------------------------------
// 3. excited_to_teach
// ---------------------------------------------------------------------------
console.log("Migrating excited_to_teach…");
const devExcited = srcAll("SELECT userId, topicId FROM excited_to_teach");
let excitedInserted = 0;

for (const row of devExcited) {
  const liveUserId = mapUserId(row.userId as string);
  if (!liveUserId) continue;
  if (missingTopicIdSet.has(row.topicId as number)) continue;
  await liveExecute(
    "INSERT OR IGNORE INTO excited_to_teach (userId, topicId) VALUES (?, ?)",
    [liveUserId, row.topicId],
  );
  excitedInserted++;
}
console.log(`  inserted ${excitedInserted}\n`);

// ---------------------------------------------------------------------------
// 4. level_transition (insert all; build id map for feedback_item)
// ---------------------------------------------------------------------------
console.log("Migrating level_transitions…");
const devTransitions = srcAll(
  "SELECT id, userId, topicId, fromLevel, toLevel, createdAt FROM level_transition ORDER BY id ASC",
);
const devTransitionIdToLive = new Map<number, number>();
let transitionInserted = 0;
let transitionSkipped = 0;

for (const row of devTransitions) {
  const liveUserId = mapUserId(row.userId as string);
  if (!liveUserId) {
    transitionSkipped++;
    continue;
  }
  if (missingTopicIdSet.has(row.topicId as number)) {
    transitionSkipped++;
    continue;
  }
  const result = await liveExecute(
    "INSERT INTO level_transition (userId, topicId, fromLevel, toLevel, createdAt) VALUES (?, ?, ?, ?, ?)",
    [
      liveUserId,
      row.topicId,
      row.fromLevel ?? null,
      row.toLevel ?? null,
      row.createdAt,
    ],
  );
  devTransitionIdToLive.set(
    row.id as number,
    dryRun ? 0 : Number(result.lastInsertRowid),
  );
  transitionInserted++;
}
console.log(`  inserted ${transitionInserted}, skipped ${transitionSkipped}\n`);

// ---------------------------------------------------------------------------
// 5. feedback_item
// ---------------------------------------------------------------------------
console.log("Migrating feedback_items…");
const devFeedback = srcAll(
  "SELECT id, userId, topicId, transitionId, type, topicLinkId, referencedUserId, freeTextValue, helpfulnessRating, comment, createdAt, updatedAt FROM feedback_item ORDER BY id ASC",
);
let feedbackInserted = 0;
let feedbackSkipped = 0;

for (const row of devFeedback) {
  const liveUserId = mapUserId(row.userId as string);
  if (!liveUserId) {
    feedbackSkipped++;
    continue;
  }
  if (missingTopicIdSet.has(row.topicId as number)) {
    feedbackSkipped++;
    continue;
  }

  // Translate transitionId
  const devTransId = row.transitionId as number | null;
  const liveTransId =
    devTransId != null ? (devTransitionIdToLive.get(devTransId) ?? null) : null;

  // Translate referencedUserId (may reference any user, not just matched ones)
  const devRefUserId = row.referencedUserId as string | null;
  const liveRefUserId =
    devRefUserId != null ? (mapUserId(devRefUserId) ?? null) : null;

  // Null out topicLinkId if the resource doesn't exist in the live DB
  const rawTopicLinkId = row.topicLinkId as number | null;
  const liveTopicLinkId =
    rawTopicLinkId != null && !missingTopicLinkIdSet.has(rawTopicLinkId)
      ? rawTopicLinkId
      : null;

  await liveExecute(
    `INSERT INTO feedback_item
       (userId, topicId, transitionId, type, topicLinkId, referencedUserId,
        freeTextValue, helpfulnessRating, comment, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      liveUserId,
      row.topicId,
      liveTransId,
      row.type,
      liveTopicLinkId,
      liveRefUserId,
      row.freeTextValue ?? null,
      row.helpfulnessRating ?? null,
      row.comment ?? null,
      row.createdAt,
      row.updatedAt ?? null,
    ],
  );
  feedbackInserted++;
}
console.log(`  inserted ${feedbackInserted}, skipped ${feedbackSkipped}\n`);

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------
console.log("=== Migration complete ===");
console.log(
  dryRun ? "(dry run — nothing was written)" : "All changes committed.",
);
