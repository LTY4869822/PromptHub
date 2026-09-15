import type { PromptItem } from "./prompt-data";

export type LocalComment = { id: string; promptId: string; authorName: string; authorInitials: string; body: string; createdAt: string };
const parse = <T,>(value: string | null, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
export const readList = (key: string) => typeof window === "undefined" ? [] : parse<(string | number)[]>(window.localStorage.getItem(key), []);
export const writeList = (key: string, values: (string | number)[]) => window.localStorage.setItem(key, JSON.stringify(values));
export const toggleListValue = (key: string, value: string | number) => { const current = readList(key); const exists = current.map(String).includes(String(value)); const next = exists ? current.filter((item) => String(item) !== String(value)) : [...current, value]; writeList(key, next); return !exists; };
export const readLocalPrompts = () => {
  if (typeof window === "undefined") return [] as PromptItem[];
  const persistent = parse<PromptItem[]>(window.localStorage.getItem("promptory-local-prompts"), []);
  const session = parse<PromptItem[]>(window.sessionStorage.getItem("promptory-local-prompts"), []);
  return [...persistent, ...session].filter((item, index, all) => all.findIndex((other) => String(other.id) === String(item.id)) === index);
};
export const updateLocalPrompt = (next: PromptItem) => {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const items = parse<PromptItem[]>(storage.getItem("promptory-local-prompts"), []);
    if (items.some((item) => String(item.id) === String(next.id))) storage.setItem("promptory-local-prompts", JSON.stringify(items.map((item) => String(item.id) === String(next.id) ? { ...next, mediaUrl: String(item.mediaUrl || "").startsWith("idb:") ? item.mediaUrl : next.mediaUrl, posterUrl: String(item.posterUrl || "").startsWith("idb:") ? item.posterUrl : next.posterUrl } : item)));
  }
};
export const deleteLocalPrompt = (id: string | number) => {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const items = parse<PromptItem[]>(storage.getItem("promptory-local-prompts"), []);
    storage.setItem("promptory-local-prompts", JSON.stringify(items.filter((item) => String(item.id) !== String(id))));
  }
};
export const readComments = (promptId: string | number) => typeof window === "undefined" ? [] : parse<LocalComment[]>(window.localStorage.getItem("promptory-comments"), []).filter((item) => item.promptId === String(promptId));
export const addLocalComment = (promptId: string | number, body: string) => { const all = parse<LocalComment[]>(window.localStorage.getItem("promptory-comments"), []); const comment = { id: `comment-${Date.now()}`, promptId: String(promptId), authorName: "你", authorInitials: "你", body, createdAt: "刚刚" }; window.localStorage.setItem("promptory-comments", JSON.stringify([comment, ...all])); return comment; };
export const readReports = () => typeof window === "undefined" ? [] : parse<any[]>(window.localStorage.getItem("promptory-reports"), []);
export const saveReport = (report: Record<string, unknown>) => window.localStorage.setItem("promptory-reports", JSON.stringify([{ id: Date.now(), createdAt: new Date().toISOString(), ...report }, ...readReports()]));

const MEDIA_DB = "promptory-local-media";
const MEDIA_STORE = "files";
type MediaRecord = { id: string; media?: Blob | null; poster?: Blob | null; avatar?: Blob | null; cover?: Blob | null };
const openMediaDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(MEDIA_DB, 1);
  request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(MEDIA_STORE)) request.result.createObjectStore(MEDIA_STORE, { keyPath: "id" }); };
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
export const saveMediaRecord = async (record: MediaRecord) => {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => { const transaction = db.transaction(MEDIA_STORE, "readwrite"); const store = transaction.objectStore(MEDIA_STORE); const request = store.get(record.id); request.onsuccess = () => store.put({ ...(request.result || {}), ...record }); request.onerror = () => reject(request.error); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  db.close();
};
export const readMediaRecord = async (id: string) => {
  const db = await openMediaDb();
  const record = await new Promise<MediaRecord | undefined>((resolve, reject) => { const request = db.transaction(MEDIA_STORE, "readonly").objectStore(MEDIA_STORE).get(id); request.onsuccess = () => resolve(request.result as MediaRecord | undefined); request.onerror = () => reject(request.error); });
  db.close(); return record;
};
export const deleteMediaRecord = async (id: string) => {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => { const transaction = db.transaction(MEDIA_STORE, "readwrite"); transaction.objectStore(MEDIA_STORE).delete(id); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  db.close();
};
export const hydratePromptMedia = async (items: PromptItem[]) => Promise.all(items.map(async (item) => {
  if (!String(item.mediaUrl || "").startsWith("idb:") && !String(item.posterUrl || "").startsWith("idb:")) return item;
  try {
    const record = await readMediaRecord(String(item.id));
    return { ...item, mediaUrl: record?.media ? URL.createObjectURL(record.media) : null, posterUrl: record?.poster ? URL.createObjectURL(record.poster) : null };
  } catch { return { ...item, mediaUrl: null, posterUrl: null }; }
}));

export type CreatorProfile = { nickname: string; gender: string; city: string; birthday: string; bio: string; avatarUrl?: string; coverUrl?: string; promptoryId: string };
export const defaultProfile: CreatorProfile = { nickname: "PromptHub 创作者", gender: "保密", city: "未填写", birthday: "未填写", bio: "用提示词保存每一次灵感闪现。", promptoryId: "prompthub_creator" };
export const readLocalProfile = () => {
  if (typeof window === "undefined") return defaultProfile;
  const stored = { ...defaultProfile, ...parse<Partial<CreatorProfile>>(window.localStorage.getItem("promptory-profile"), {}) };
  return { ...stored, nickname: stored.nickname === "Promptory 创作者" ? defaultProfile.nickname : stored.nickname, promptoryId: stored.promptoryId === "promptory_creator" ? defaultProfile.promptoryId : stored.promptoryId };
};
export const saveLocalProfile = (profile: CreatorProfile) => window.localStorage.setItem("promptory-profile", JSON.stringify(profile));
export const hydrateProfileMedia = async (profile: CreatorProfile) => {
  try { const record = await readMediaRecord("creator-profile"); return { ...profile, avatarUrl: record?.avatar ? URL.createObjectURL(record.avatar) : profile.avatarUrl, coverUrl: record?.cover ? URL.createObjectURL(record.cover) : profile.coverUrl }; }
  catch { return profile; }
};
