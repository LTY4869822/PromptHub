import { prepareAuth } from "./server-auth";
import { isLocalRequest } from "./server-platform";

let localDataReady = false;

const localTables = [
  `CREATE TABLE IF NOT EXISTS prompts (id INTEGER PRIMARY KEY AUTOINCREMENT,owner_key TEXT,title TEXT NOT NULL,prompt TEXT NOT NULL,summary TEXT,negative_prompt TEXT,aspect_ratio TEXT,model_version TEXT,parameters TEXT,use_cases TEXT NOT NULL DEFAULT '[]',source TEXT NOT NULL DEFAULT '原创',source_url TEXT,original_work_url TEXT,tool TEXT NOT NULL DEFAULT '通用 AI',prompt_type TEXT NOT NULL DEFAULT '待确认类型',media_role TEXT NOT NULL DEFAULT '生成效果',media_type TEXT NOT NULL DEFAULT 'image',media_key TEXT,poster_key TEXT,duration TEXT,media_name TEXT,media_mime TEXT,media_size INTEGER NOT NULL DEFAULT 0,tags TEXT NOT NULL DEFAULT '[]',rights_type TEXT NOT NULL DEFAULT '原创分享',review_status TEXT NOT NULL DEFAULT 'legacy',review_mode TEXT NOT NULL DEFAULT 'legacy',review_confidence INTEGER NOT NULL DEFAULT 0,review_reason TEXT NOT NULL DEFAULT '历史内容，待下次编辑时复审',safety_labels TEXT NOT NULL DEFAULT '[]',review_model TEXT NOT NULL DEFAULT 'legacy',reviewed_at TEXT,content_status TEXT NOT NULL DEFAULT 'published',moderation_note TEXT,moderated_by TEXT,deleted_at TEXT,hot_score INTEGER NOT NULL DEFAULT 0,author_name TEXT NOT NULL DEFAULT '匿名创作者',author_initials TEXT NOT NULL DEFAULT '匿',author_bio TEXT NOT NULL DEFAULT '',likes INTEGER NOT NULL DEFAULT 0,saves INTEGER NOT NULL DEFAULT 0,views INTEGER NOT NULL DEFAULT 0,comments_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS prompt_comments (id INTEGER PRIMARY KEY AUTOINCREMENT,prompt_id INTEGER NOT NULL,author_key TEXT,author_name TEXT NOT NULL,author_initials TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'published',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS prompt_reactions (id INTEGER PRIMARY KEY AUTOINCREMENT,prompt_id INTEGER NOT NULL,reaction_type TEXT NOT NULL,actor_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS creator_follows (id INTEGER PRIMARY KEY AUTOINCREMENT,creator_name TEXT NOT NULL,creator_key TEXT,actor_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS prompt_reports (id INTEGER PRIMARY KEY AUTOINCREMENT,prompt_id INTEGER NOT NULL,reason TEXT NOT NULL,detail TEXT,actor_key TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',assigned_to TEXT,resolution TEXT,resolved_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS creator_profiles (actor_key TEXT PRIMARY KEY,user_id TEXT,nickname TEXT NOT NULL,gender TEXT NOT NULL DEFAULT '保密',city TEXT NOT NULL DEFAULT '未填写',birthday TEXT NOT NULL DEFAULT '未填写',bio TEXT NOT NULL DEFAULT '',promptory_id TEXT NOT NULL,avatar_key TEXT,cover_key TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS review_receipts (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,payload_hash TEXT NOT NULL,result TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS upload_sessions (id TEXT PRIMARY KEY,owner_key TEXT NOT NULL,object_key TEXT NOT NULL,multipart_id TEXT,kind TEXT NOT NULL,file_name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'created',parts TEXT NOT NULL DEFAULT '[]',expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS prompt_views (id INTEGER PRIMARY KEY AUTOINCREMENT,prompt_id INTEGER NOT NULL,actor_key TEXT NOT NULL,day_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(prompt_id,actor_key,day_key))`,
];

const localColumns: Record<string, Array<[string, string]>> = {
  creator_profiles: [["user_id", "TEXT"]],
  creator_follows: [["creator_key", "TEXT"]],
  prompt_comments: [["author_key", "TEXT"], ["status", "TEXT NOT NULL DEFAULT 'published'"]],
  prompt_reports: [["status", "TEXT NOT NULL DEFAULT 'open'"], ["assigned_to", "TEXT"], ["resolution", "TEXT"], ["resolved_at", "TEXT"]],
  prompts: [["content_status", "TEXT NOT NULL DEFAULT 'published'"], ["moderation_note", "TEXT"], ["moderated_by", "TEXT"], ["deleted_at", "TEXT"], ["hot_score", "INTEGER NOT NULL DEFAULT 0"]],
  users: [["email_verified", "INTEGER NOT NULL DEFAULT 0"], ["email_verified_at", "TEXT"]],
};

const localIndexes = [
  "CREATE INDEX IF NOT EXISTS idx_prompts_status_id ON prompts(content_status,id)",
  "CREATE INDEX IF NOT EXISTS idx_prompts_owner_status_id ON prompts(owner_key,content_status,id)",
  "CREATE INDEX IF NOT EXISTS idx_prompts_hot_status ON prompts(content_status,hot_score)",
  "CREATE INDEX IF NOT EXISTS idx_comments_prompt_status_id ON prompt_comments(prompt_id,status,id)",
  "CREATE INDEX IF NOT EXISTS idx_reports_status_id ON prompt_reports(status,id)",
  "CREATE INDEX IF NOT EXISTS idx_uploads_owner_status ON upload_sessions(owner_key,status)",
  "CREATE INDEX IF NOT EXISTS idx_review_receipts_user_expires ON review_receipts(user_id,expires_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_prompt_type_actor ON prompt_reactions(prompt_id,reaction_type,actor_key)",
  "DROP INDEX IF EXISTS idx_follows_creator_actor",
  "DELETE FROM creator_follows WHERE creator_key IS NOT NULL AND id NOT IN (SELECT MIN(id) FROM creator_follows WHERE creator_key IS NOT NULL GROUP BY creator_key,actor_key)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_creator_key_actor ON creator_follows(creator_key,actor_key)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_promptory_id_unique ON creator_profiles(promptory_id)",
  "CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose ON auth_tokens(user_id,purpose)",
  "CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens(expires_at)",
];

export async function prepareData(request: Request) {
  const db = await prepareAuth(request);
  if (!db) return null;
  if (!isLocalRequest(request) || localDataReady) return db;
  await db.batch(localTables.map((statement) => db.prepare(statement)));
  for (const [table, additions] of Object.entries(localColumns)) {
    const info = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
    const present = new Set((info.results || []).map((column: { name: string }) => column.name));
    for (const [name, definition] of additions) if (!present.has(name)) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
  }
  await db.batch(localIndexes.map((statement) => db.prepare(statement)));
  localDataReady = true;
  return db;
}
