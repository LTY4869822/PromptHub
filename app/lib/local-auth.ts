export type LocalAccount = {
  id: string;
  nickname: string;
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
};

export type LocalSession = {
  accountId: string;
  nickname: string;
  email: string;
  expiresAt: number;
};

const ACCOUNT_KEY = "prompthub-local-accounts-v1";
const SESSION_KEY = "prompthub-local-session-v1";
const LEGACY_SESSION_KEY = "prompthub-preview-user";
const encoder = new TextEncoder();

function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return window.btoa(value);
}

async function derivePasswordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 120_000 }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}

export function readLocalAccounts(): LocalAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCOUNT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveLocalAccounts(accounts: LocalAccount[]) {
  window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
}

export function hasLocalAccount(email: string) {
  const normalized = normalizeEmail(email);
  return readLocalAccounts().some((account) => account.email === normalized);
}

export async function registerLocalAccount(input: { nickname: string; email: string; password: string }) {
  const accounts = readLocalAccounts();
  const email = normalizeEmail(input.email);
  if (accounts.some((account) => account.email === email)) throw new Error("该邮箱已经注册，请直接登录");
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(18)));
  const account: LocalAccount = {
    id: crypto.randomUUID(),
    nickname: input.nickname.trim(),
    email,
    salt,
    passwordHash: await derivePasswordHash(input.password, salt),
    createdAt: new Date().toISOString(),
  };
  saveLocalAccounts([...accounts, account]);
  return account;
}

export async function loginLocalAccount(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const account = readLocalAccounts().find((item) => item.email === email);
  if (!account) throw new Error("该邮箱尚未注册，请先创建账号");
  const passwordHash = await derivePasswordHash(password, account.salt);
  if (passwordHash !== account.passwordHash) throw new Error("密码不正确，请重新输入");
  return account;
}

export async function resetLocalPassword(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const accounts = readLocalAccounts();
  const index = accounts.findIndex((item) => item.email === email);
  if (index < 0) throw new Error("没有找到这个邮箱对应的账号");
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(18)));
  accounts[index] = { ...accounts[index], salt, passwordHash: await derivePasswordHash(password, salt) };
  saveLocalAccounts(accounts);
}

export function saveLocalSession(account: Pick<LocalAccount, "id" | "nickname" | "email">, remember: boolean) {
  const session: LocalSession = {
    accountId: account.id,
    nickname: account.nickname,
    email: account.email,
    expiresAt: Date.now() + (remember ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000),
  };
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  (remember ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("prompthub-auth-change"));
  return session;
}

export function readLocalSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(SESSION_KEY);
      if (!raw) continue;
      const session = JSON.parse(raw) as LocalSession;
      const accountExists = readLocalAccounts().some((account) => account.id === session.accountId && account.email === session.email);
      if (!accountExists || !session.expiresAt || session.expiresAt <= Date.now()) { storage.removeItem(SESSION_KEY); continue; }
      return session;
    } catch { storage.removeItem(SESSION_KEY); }
  }
  return null;
}

export function clearLocalSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
  window.dispatchEvent(new Event("prompthub-auth-change"));
}
