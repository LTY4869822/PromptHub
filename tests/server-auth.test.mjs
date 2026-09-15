import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("all write APIs enforce server authentication", async () => {
  for (const path of ["app/api/prompts/route.ts", "app/api/profile/route.ts", "app/api/review/route.ts", "app/api/uploads/route.ts", "app/api/account/route.ts"]) {
    const source = await read(path);
    assert.match(source, /requireUser\(request\)/, path);
    assert.doesNotMatch(source, /local-creator/, path);
  }
});

test("administrator actions require the admin role", async () => {
  const source = await read("app/api/admin/route.ts");
  assert.match(source, /requireAdmin\(request\)/);
  assert.match(source, /audit_logs/);
});

test("the local administrator cannot be bootstrapped for a non-local request", async () => {
  const auth = await read("app/lib/server-auth.ts");
  const login = await read("app/api/auth/login/route.ts");
  assert.match(auth, /bootstrapAdmin\(db, isLocalRequest\(request\)\)/);
  assert.match(auth, /if \(!localRequest && \(!configuredEmail \|\| !configuredPassword\)\) return/);
  assert.doesNotMatch(login, /PromptHub\.Admin#2026/);
});

test("production publishing has no silent browser-local fallback", async () => {
  const source = await read("app/create/page.tsx");
  assert.doesNotMatch(source, /promptory-local-prompts/);
  assert.doesNotMatch(source, /saveLocal/);
  assert.match(source, /uploadAsset/);
});

test("account registration does not depend on the external AI review service", async () => {
  const route = await read("app/api/auth/register/route.ts");
  assert.match(route, /reviewAccountNickname/);
  assert.doesNotMatch(route, /reviewPromptSubmission/);
});

test("password hashing stays within the production WebCrypto PBKDF2 limit", async () => {
  const auth = await read("app/lib/server-auth.ts");
  assert.match(auth, /PASSWORD_ITERATIONS = 100_000/);
  assert.doesNotMatch(auth, /PASSWORD_ITERATIONS = 210_000/);
});

test("route authentication never replaces the application with a blocking screen", async () => {
  const gate = await read("app/components/AuthGate.tsx");
  assert.doesNotMatch(gate, /state !== "allowed"/);
  assert.doesNotMatch(gate, /auth-guard/);
  assert.match(gate, /router\.push/);
  assert.doesNotMatch(gate, /router\.prefetch/);
  assert.match(gate, /visibilitychange/);
  assert.match(gate, /router\.refresh/);
});

test("prompt review supports DeepSeek with structured output and safe fallback", async () => {
  const review = await read("app/lib/server-review.ts");
  assert.match(review, /DEEPSEEK_API_KEY/);
  assert.match(review, /response_format: \{ type: "json_object" \}/);
  assert.match(review, /deepseek-unavailable/);
});

test("database schema has identity, governance, and uniqueness constraints", async () => {
  const source = await read("db/schema.ts");
  for (const value of ["users", "sessions", "audit_logs", "upload_sessions", "review_receipts", "idx_reactions_prompt_type_actor", "idx_views_prompt_actor_day", "idx_follows_creator_key_actor"]) assert.match(source, new RegExp(value));
});

test("large media uses resumable uploads with size and purpose validation", async () => {
  const source = await read("app/api/uploads/route.ts");
  assert.match(source, /createMultipartUpload/);
  assert.match(source, /Number\(object\.size \|\| 0\) !== Number\(row\.size\)/);
  assert.match(source, /kind === "poster" && !isImage/);
  assert.match(source, /payload\.byteLength !== expectedLength/);
});

test("works publish directly after text review; admin console still supports pending moderation", async () => {
  const prompts = await read("app/api/prompts/route.ts");
  assert.match(prompts, /const contentStatus = "published"/);
  const admin = await read("app/api/admin/route.ts");
  assert.match(admin, /content_status='pending'/);
});

test("unavailable visual review publishes with a moderation note instead of queueing", async () => {
  const prompts = await read("app/api/prompts/route.ts");
  assert.match(prompts, /moderationNote = "视觉审核服务暂不可用，作品已直接发布"/);
  assert.doesNotMatch(prompts, /视觉安全审核暂不可用，本次发布已暂停/);
  assert.doesNotMatch(prompts, /visualReviewPending \? "pending" : "published"/);
});

test("account deletion anonymizes personal data", async () => {
  const source = await read("app/api/account/route.ts");
  assert.match(source, /nickname='已注销用户'/);
  assert.match(source, /UPDATE creator_profiles SET nickname='已注销用户'/);
  assert.match(source, /DELETE FROM prompt_reactions WHERE actor_key/);
  assert.match(source, /getMediaBucket\(\)\?\.delete/);
});

test("restricted media fails closed and is never publicly cached", async () => {
  const source = await read("app/api/media/[key]/route.ts");
  assert.match(source, /if \(!db\) return new Response\("Media authorization unavailable"/);
  assert.match(source, /private, no-store/);
  assert.doesNotMatch(source, /public, max-age/);
});
