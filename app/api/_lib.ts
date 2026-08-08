import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  ensureDatabase,
  getD1,
  getFirebaseProjectId,
  getInvitePepper,
} from "../../db";

export type ApiUser = { userId: string; email: string; displayName: string };
export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus = "active" | "trialing" | "canceled" | "expired";
export type Subscription = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: string | null;
  productId: string | null;
  currentPeriodEnd: string | null;
};

const firebaseKeys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

export async function getSubscription(
  db: D1Database,
  userId: string,
): Promise<Subscription> {
  const row = await db
    .prepare(
      "SELECT plan, status, provider, product_id, current_period_end FROM subscriptions WHERE user_id = ?",
    )
    .bind(userId)
    .first<Subscription>();
  if (!row || row.plan !== "pro") {
    return {
      plan: "free",
      status: "active",
      provider: null,
      productId: null,
      currentPeriodEnd: null,
    };
  }
  const validUntil = !row.currentPeriodEnd || row.currentPeriodEnd > new Date().toISOString();
  return row.status === "active" || (row.status === "trialing" && validUntil)
    ? row
    : { ...row, plan: "free" };
}

export async function activeFriendCount(db: D1Database, userId: string) {
  const result = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM connections WHERE status = 'active' AND (user_low_id = ? OR user_high_id = ?)",
    )
    .bind(userId, userId)
    .first<{ count: number }>();
  return Number(result?.count ?? 0);
}

export async function prepareRequest(
  request: Request,
): Promise<{ user: ApiUser; db: D1Database } | Response> {
  const user = await getRequestUser(request);
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

export async function getRequestUser(request: Request): Promise<ApiUser | null> {
  const hostname = new URL(request.url).hostname;
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    if (hostname !== "localhost" && hostname !== "127.0.0.1") return null;
    return {
      userId: "local-development-user",
      email: "local@crewsync.dev",
      displayName: "지원",
    };
  }
  const projectId = getFirebaseProjectId() ?? "crewsync-f3dab";
  try {
    const { payload } = await jwtVerify(
      authorization.slice("Bearer ".length),
      firebaseKeys,
      {
        algorithms: ["RS256"],
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
      },
    );
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!payload.sub || !email || payload.email_verified !== true) return null;
    return {
      userId: payload.sub,
      email,
      displayName:
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : email.split("@")[0],
    };
  } catch {
    return null;
  }
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
