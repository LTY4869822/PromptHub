import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  nickname: text("nickname").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastLoginAt: text("last_login_at"),
  emailVerified: integer("email_verified").notNull().default(0),
  emailVerifiedAt: text("email_verified_at"),
}, (table) => [uniqueIndex("idx_users_email_unique").on(table.email), index("idx_users_role_status").on(table.role, table.status)]);

export const authTokens = sqliteTable("auth_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  purpose: text("purpose").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_auth_tokens_user_purpose").on(table.userId, table.purpose), index("idx_auth_tokens_expires").on(table.expiresAt)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  userAgent: text("user_agent"),
}, (table) => [index("idx_sessions_user_id").on(table.userId), index("idx_sessions_expires_at").on(table.expiresAt)]);

export const prompts = sqliteTable("prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerKey: text("owner_key"),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  summary: text("summary"),
  negativePrompt: text("negative_prompt"),
  aspectRatio: text("aspect_ratio"),
  modelVersion: text("model_version"),
  parameters: text("parameters"),
  useCases: text("use_cases").notNull().default("[]"),
  source: text("source").notNull().default("原创"),
  sourceUrl: text("source_url"),
  originalWorkUrl: text("original_work_url"),
  tool: text("tool").notNull().default("通用 AI"),
  promptType: text("prompt_type").notNull().default("待确认类型"),
  mediaRole: text("media_role").notNull().default("生成效果"),
  mediaType: text("media_type").notNull().default("image"),
  mediaKey: text("media_key"),
  posterKey: text("poster_key"),
  duration: text("duration"),
  mediaName: text("media_name"),
  mediaMime: text("media_mime"),
  mediaSize: integer("media_size").notNull().default(0),
  tags: text("tags").notNull().default("[]"),
  rightsType: text("rights_type").notNull().default("原创分享"),
  reviewStatus: text("review_status").notNull().default("legacy"),
  reviewMode: text("review_mode").notNull().default("legacy"),
  reviewConfidence: integer("review_confidence").notNull().default(0),
  reviewReason: text("review_reason").notNull().default("历史内容，待下次编辑时复审"),
  safetyLabels: text("safety_labels").notNull().default("[]"),
  reviewModel: text("review_model").notNull().default("legacy"),
  reviewedAt: text("reviewed_at"),
  contentStatus: text("content_status").notNull().default("published"),
  moderationNote: text("moderation_note"),
  moderatedBy: text("moderated_by"),
  deletedAt: text("deleted_at"),
  hotScore: integer("hot_score").notNull().default(0),
  authorName: text("author_name").notNull().default("匿名创作者"),
  authorInitials: text("author_initials").notNull().default("匿"),
  authorBio: text("author_bio").notNull().default(""),
  likes: integer("likes").notNull().default(0),
  saves: integer("saves").notNull().default(0),
  views: integer("views").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_prompts_status_id").on(table.contentStatus, table.id),
  index("idx_prompts_owner_status_id").on(table.ownerKey, table.contentStatus, table.id),
  index("idx_prompts_hot_status").on(table.contentStatus, table.hotScore),
  index("idx_prompts_author_status").on(table.authorName, table.contentStatus),
]);

export const promptComments = sqliteTable("prompt_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptId: integer("prompt_id").notNull(),
  authorKey: text("author_key"),
  authorName: text("author_name").notNull(),
  authorInitials: text("author_initials").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("published"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_comments_prompt_status_id").on(table.promptId, table.status, table.id)]);

export const promptReactions = sqliteTable("prompt_reactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptId: integer("prompt_id").notNull(),
  reactionType: text("reaction_type").notNull(),
  actorKey: text("actor_key").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_reactions_prompt_type_actor").on(table.promptId, table.reactionType, table.actorKey), index("idx_reactions_actor_type").on(table.actorKey, table.reactionType)]);

export const creatorFollows = sqliteTable("creator_follows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creatorName: text("creator_name").notNull(),
  creatorKey: text("creator_key"),
  actorKey: text("actor_key").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_follows_creator_key_actor").on(table.creatorKey, table.actorKey), index("idx_follows_actor").on(table.actorKey)]);

export const promptReports = sqliteTable("prompt_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptId: integer("prompt_id").notNull(),
  reason: text("reason").notNull(),
  detail: text("detail"),
  actorKey: text("actor_key").notNull(),
  status: text("status").notNull().default("open"),
  assignedTo: text("assigned_to"),
  resolution: text("resolution"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_reports_status_id").on(table.status, table.id), index("idx_reports_prompt").on(table.promptId)]);

export const creatorProfiles = sqliteTable("creator_profiles", {
  actorKey: text("actor_key").primaryKey(),
  userId: text("user_id"),
  nickname: text("nickname").notNull(),
  gender: text("gender").notNull().default("保密"),
  city: text("city").notNull().default("未填写"),
  birthday: text("birthday").notNull().default("未填写"),
  bio: text("bio").notNull().default(""),
  promptoryId: text("promptory_id").notNull(),
  avatarKey: text("avatar_key"),
  coverKey: text("cover_key"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_profiles_user_id_unique").on(table.userId), uniqueIndex("idx_profiles_promptory_id_unique").on(table.promptoryId)]);

export const uploadSessions = sqliteTable("upload_sessions", {
  id: text("id").primaryKey(),
  ownerKey: text("owner_key").notNull(),
  objectKey: text("object_key").notNull(),
  multipartId: text("multipart_id"),
  kind: text("kind").notNull(),
  fileName: text("file_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("created"),
  parts: text("parts").notNull().default("[]"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_uploads_owner_status").on(table.ownerKey, table.status), index("idx_uploads_expires_at").on(table.expiresAt)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  detail: text("detail").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_created").on(table.id), index("idx_audit_actor").on(table.actorId)]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  expiresAt: text("expires_at").notNull(),
}, (table) => [index("idx_rate_limits_expires").on(table.expiresAt)]);

export const promptViews = sqliteTable("prompt_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptId: integer("prompt_id").notNull(),
  actorKey: text("actor_key").notNull(),
  dayKey: text("day_key").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_views_prompt_actor_day").on(table.promptId, table.actorKey, table.dayKey)]);

export const reviewReceipts = sqliteTable("review_receipts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  payloadHash: text("payload_hash").notNull(),
  result: text("result").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_review_receipts_user_expires").on(table.userId, table.expiresAt)]);
