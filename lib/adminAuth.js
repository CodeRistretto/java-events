import crypto from "node:crypto";

const COOKIE_NAME = "java_events_admin";
const SESSION_SECONDS = 60 * 60 * 8;

function getSecret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("Falta ADMIN_SESSION_SECRET.");
  return value;
}

function sign(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createAdminCookie(username) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${username}.${expires}`;
  const value = `${payload}.${sign(payload)}`;

  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${SESSION_SECONDS}`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

function readCookie(request) {
  const raw = request.headers.get("cookie") || "";

  const cookies = Object.fromEntries(
    raw
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const i = item.indexOf("=");
        return [item.slice(0, i), decodeURIComponent(item.slice(i + 1))];
      })
  );

  return cookies[COOKIE_NAME] || null;
}

export function getAdminFromRequest(request) {
  const value = readCookie(request);
  if (!value) return null;

  const [username, expiresRaw, signature] = value.split(".");
  if (!username || !expiresRaw || !signature) return null;

  const payload = `${username}.${expiresRaw}`;
  const expected = sign(payload);

  if (signature.length !== expected.length) return null;

  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );

  if (!valid) return null;

  const expires = Number(expiresRaw);

  if (!expires || expires < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { username };
}

export function requireAdmin(request) {
  const admin = getAdminFromRequest(request);

  if (!admin) {
    const error = new Error("UNAUTHORIZED");
    error.status = 401;
    throw error;
  }

  return admin;
}
