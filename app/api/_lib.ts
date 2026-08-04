import { ensureDatabase, getD1, getInvitePepper } from "../../db";

export type ApiUser = { userId: string; email: string; displayName: string };

export async function prepareRequest(
  request: Request,
): Promise<{ user: ApiUser; db: D1Database } | Response> {
  const user = getRequestUser(request);
  if (!user)
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  await ensureDatabase();
  const db = getD1();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO profiles (user_id, email, display_name, schedule_tz, created_at, updated_at)
    VALUES (?, ?, ?, 'Asia/Seoul', ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at`,
    )
    .bind(user.userId, user.email, user.displayName, now, now)
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO notification_preferences (user_id, updated_at) VALUES (?, ?)`,
    )
    .bind(user.userId, now)
    .run();
  return { user, db };
}

export function getRequestUser(request: Request): ApiUser | null {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (userId && email) {
    const encoded = request.headers.get("oai-authenticated-user-full-name");
    let displayName = email.split("@")[0];
    if (
      encoded &&
      request.headers.get("oai-authenticated-user-full-name-encoding") ===
        "percent-encoded-utf-8"
    ) {
      try {
        displayName = decodeURIComponent(encoded);
      } catch {
        /* fall back to email */
      }
    }
    return { userId, email, displayName };
  }
  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return {
      userId: "local-development-user",
      email: "local@crewsync.dev",
      displayName: "지원",
    };
  }
  return null;
}

export function rows<T>(result: D1Result<T>): T[] {
  return result.results ?? [];
}

export function toBool(value: unknown): boolean {
  return value === true || value === 1;
}

export function monthBounds(
  value: string | null,
): { start: string; end: string } | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  const start = `${value}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export function normalizeInviteCode(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "");
}

export async function hashInviteCode(
  code: string,
  request: Request,
): Promise<string> {
  const local = ["localhost", "127.0.0.1"].includes(
    new URL(request.url).hostname,
  );
  const pepper =
    getInvitePepper() ?? (local ? "crewsync-local-development-pepper" : null);
  if (!pepper) throw new Error("Invite security configuration is unavailable.");
  const data = new TextEncoder().encode(`${pepper}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function apiError(
  error: unknown,
  fallback = "요청을 처리하지 못했어요.",
) {
  console.error(error instanceof Error ? error.message : fallback);
  return Response.json({ error: fallback }, { status: 500 });
}
