import { relations, sql } from "drizzle-orm";
import { index, uniqueIndex, sqliteTable } from "drizzle-orm/sqlite-core";

import { UNDERSTANDING_LEVELS } from "../../shared/understandingLevels.ts";
import {
  FEEDBACK_ITEM_TYPES,
  HELPFULNESS_RATINGS,
} from "../../shared/feedbackTypes.ts";

// Better Auth core tables
export const user = sqliteTable("user", (d) => ({
  id: d
    .text({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.text({ length: 255 }),
  email: d.text({ length: 255 }).notNull().unique(),
  isNonUser: d.integer({ mode: "boolean" }).notNull().default(false),
  emailVerified: d.integer({ mode: "boolean" }).default(false),
  image: d.text({ length: 255 }),
  createdAt: d
    .integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
}));

export const userRelations = relations(user, ({ many }) => ({
  account: many(account),
  session: many(session),
  userTopicStatus: many(userTopicStatus),
  bookmark: many(bookmark),
  resource: many(resource),
  teachingSessionAsTeacher: many(teachingSession, {
    relationName: "teacher",
  }),
  teachingSessionAsLearner: many(teachingSession, {
    relationName: "learner",
  }),
  levelTransitions: many(levelTransition),
  feedbackItemsAsReferencedUser: many(feedbackItem, {
    relationName: "referencedUser",
  }),
  roles: many(userRole, { relationName: "roleUser" }),
  createdRoles: many(userRole, { relationName: "roleCreator" }),
  adminActions: many(adminActionLog, { relationName: "actorUser" }),
}));

export const account = sqliteTable(
  "account",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id),
    accountId: d.text({ length: 255 }).notNull(),
    providerId: d.text({ length: 255 }).notNull(),
    accessToken: d.text(),
    refreshToken: d.text(),
    accessTokenExpiresAt: d.integer({ mode: "timestamp" }),
    refreshTokenExpiresAt: d.integer({ mode: "timestamp" }),
    scope: d.text({ length: 255 }),
    idToken: d.text(),
    password: d.text(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const session = sqliteTable(
  "session",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id),
    token: d.text({ length: 255 }).notNull().unique(),
    expiresAt: d.integer({ mode: "timestamp" }).notNull(),
    ipAddress: d.text({ length: 255 }),
    userAgent: d.text({ length: 255 }),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const verification = sqliteTable(
  "verification",
  (d) => ({
    id: d
      .text({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    identifier: d.text({ length: 255 }).notNull(),
    value: d.text({ length: 255 }).notNull(),
    expiresAt: d.integer({ mode: "timestamp" }).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// Tech tree tables
export const topic = sqliteTable(
  "topic",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    name: d.text({ length: 512 }).notNull().unique(),
    description: d.text(),
    rawPrerequisites: d.text(),
    spreadsheetRow: d.integer({ mode: "number" }),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("topic_name_idx").on(t.name)],
);

export const topicLink = sqliteTable(
  "topic_link",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    topicId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    title: d.text({ length: 512 }).notNull(),
    url: d.text({ length: 2048 }),
    position: d.integer({ mode: "number" }).notNull().default(0),
  }),
  (t) => [index("topic_link_topic_idx").on(t.topicId)],
);

export const tag = sqliteTable("tag", (d) => ({
  name: d.text({ length: 255 }).notNull().primaryKey(),
}));

export const topicTag = sqliteTable(
  "topic_tag",
  (d) => ({
    topicId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    tagName: d
      .text({ length: 255 })
      .notNull()
      .references(() => tag.name, { onDelete: "cascade" }),
  }),
  (t) => [uniqueIndex("topic_tag_unique").on(t.topicId, t.tagName)],
);

export const userTopicStatus = sqliteTable(
  "user_topic_status",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topicId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    level: d.text({ length: 64, enum: UNDERSTANDING_LEVELS }).notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("user_topic_status_unique").on(t.userId, t.topicId),
    index("user_topic_status_user_idx").on(t.userId),
    index("user_topic_status_topic_idx").on(t.topicId),
  ],
);

export const resource = sqliteTable(
  "resource",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    topicId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    title: d.text({ length: 512 }).notNull(),
    url: d.text({ length: 2048 }).notNull(),
    type: d.text({ length: 64 }),
    submittedById: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    approved: d.integer({ mode: "boolean" }).default(false),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("resource_topic_idx").on(t.topicId)],
);

export const teachingSession = sqliteTable(
  "teaching_session",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    teacherId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    learnerId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topicId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    rating: d.integer({ mode: "number" }),
    feedback: d.text(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  }),
  (t) => [
    index("teaching_session_teacher_idx").on(t.teacherId),
    index("teaching_session_learner_idx").on(t.learnerId),
    index("teaching_session_topic_idx").on(t.topicId),
  ],
);

export const bookmark = sqliteTable(
  "bookmark",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topicId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  }),
  (t) => [uniqueIndex("bookmark_user_topic_unique").on(t.userId, t.topicId)],
);

export const levelTransition = sqliteTable(
  "level_transition",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topicId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    fromLevel: d.text({ length: 64, enum: UNDERSTANDING_LEVELS }),
    toLevel: d.text({ length: 64, enum: UNDERSTANDING_LEVELS }),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  }),
  (t) => [
    index("level_transition_user_idx").on(t.userId),
    index("level_transition_topic_idx").on(t.topicId),
    index("level_transition_user_topic_idx").on(t.userId, t.topicId),
  ],
);

export const feedbackItem = sqliteTable(
  "feedback_item",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    transitionId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => levelTransition.id, { onDelete: "cascade" }),
    type: d.text({ length: 32, enum: FEEDBACK_ITEM_TYPES }).notNull(),
    topicLinkId: d
      .integer({ mode: "number" })
      .references(() => topicLink.id, { onDelete: "set null" }),
    referencedUserId: d
      .text({ length: 255 })
      .references(() => user.id, { onDelete: "set null" }),
    freeTextValue: d.text({ length: 1024 }),
    helpfulnessRating: d.text({
      length: 32,
      enum: HELPFULNESS_RATINGS,
    }),
    comment: d.text({ length: 2048 }),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [index("feedback_item_transition_idx").on(t.transitionId)],
);

export const ADMIN_ROLES = ["admin"] as const;

export const userRole = sqliteTable(
  "user_role",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: d.text({ length: 32, enum: ADMIN_ROLES }).notNull(),
    createdByUserId: d
      .text({ length: 255 })
      .references(() => user.id, { onDelete: "set null" }),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  }),
  (t) => [
    uniqueIndex("user_role_user_role_unique").on(t.userId, t.role),
    index("user_role_role_idx").on(t.role),
  ],
);

export const adminActionLog = sqliteTable(
  "admin_action_log",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    actorUserId: d
      .text({ length: 255 })
      .references(() => user.id, { onDelete: "set null" }),
    action: d.text({ length: 128 }).notNull(),
    targetType: d.text({ length: 128 }).notNull(),
    targetId: d.text({ length: 255 }),
    payloadJson: d.text().notNull(),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  }),
  (t) => [
    index("admin_action_log_actor_idx").on(t.actorUserId),
    index("admin_action_log_action_idx").on(t.action),
  ],
);

export const appSetting = sqliteTable("app_setting", (d) => ({
  key: d.text({ length: 128 }).primaryKey(),
  value: d.text().notNull(),
  updatedAt: d
    .integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
}));

// Relations
export const topicRelations = relations(topic, ({ many }) => ({
  topicTags: many(topicTag),
  topicLinks: many(topicLink),
  userTopicStatus: many(userTopicStatus),
  resources: many(resource),
  bookmarks: many(bookmark),
  teachingSessions: many(teachingSession),
  levelTransitions: many(levelTransition),
}));

export const topicLinkRelations = relations(topicLink, ({ one, many }) => ({
  topic: one(topic, { fields: [topicLink.topicId], references: [topic.id] }),
  feedbackItems: many(feedbackItem),
}));

export const tagRelations = relations(tag, ({ many }) => ({
  topicTags: many(topicTag),
}));

export const topicTagRelations = relations(topicTag, ({ one }) => ({
  topic: one(topic, { fields: [topicTag.topicId], references: [topic.id] }),
  tag: one(tag, { fields: [topicTag.tagName], references: [tag.name] }),
}));

export const userTopicStatusRelations = relations(
  userTopicStatus,
  ({ one }) => ({
    user: one(user, {
      fields: [userTopicStatus.userId],
      references: [user.id],
    }),
    topic: one(topic, {
      fields: [userTopicStatus.topicId],
      references: [topic.id],
    }),
  }),
);

export const resourceRelations = relations(resource, ({ one }) => ({
  topic: one(topic, { fields: [resource.topicId], references: [topic.id] }),
  submittedBy: one(user, {
    fields: [resource.submittedById],
    references: [user.id],
  }),
}));

export const teachingSessionRelations = relations(
  teachingSession,
  ({ one }) => ({
    teacher: one(user, {
      fields: [teachingSession.teacherId],
      references: [user.id],
      relationName: "teacher",
    }),
    learner: one(user, {
      fields: [teachingSession.learnerId],
      references: [user.id],
      relationName: "learner",
    }),
    topic: one(topic, {
      fields: [teachingSession.topicId],
      references: [topic.id],
    }),
  }),
);

export const bookmarkRelations = relations(bookmark, ({ one }) => ({
  user: one(user, { fields: [bookmark.userId], references: [user.id] }),
  topic: one(topic, { fields: [bookmark.topicId], references: [topic.id] }),
}));

export const levelTransitionRelations = relations(
  levelTransition,
  ({ one, many }) => ({
    user: one(user, {
      fields: [levelTransition.userId],
      references: [user.id],
    }),
    topic: one(topic, {
      fields: [levelTransition.topicId],
      references: [topic.id],
    }),
    feedbackItems: many(feedbackItem),
  }),
);

export const feedbackItemRelations = relations(feedbackItem, ({ one }) => ({
  transition: one(levelTransition, {
    fields: [feedbackItem.transitionId],
    references: [levelTransition.id],
  }),
  topicLink: one(topicLink, {
    fields: [feedbackItem.topicLinkId],
    references: [topicLink.id],
  }),
  referencedUser: one(user, {
    fields: [feedbackItem.referencedUserId],
    references: [user.id],
    relationName: "referencedUser",
  }),
}));

export const userRoleRelations = relations(userRole, ({ one }) => ({
  user: one(user, {
    fields: [userRole.userId],
    references: [user.id],
    relationName: "roleUser",
  }),
  createdByUser: one(user, {
    fields: [userRole.createdByUserId],
    references: [user.id],
    relationName: "roleCreator",
  }),
}));

export const adminActionLogRelations = relations(adminActionLog, ({ one }) => ({
  actorUser: one(user, {
    fields: [adminActionLog.actorUserId],
    references: [user.id],
    relationName: "actorUser",
  }),
}));

export const appSettingRelations = relations(appSetting, () => ({}));
