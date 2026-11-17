import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  ensureDatabase,
  getD1,
  getFirebaseProjectId,
  getInvitePepper,
  getRevenueCatSecrets,
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
      "SELECT plan, status, provider, product_id AS productId, current_period_end AS currentPeriodEnd FROM subscriptions WHERE user_id = ?",
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
  // 기간이 지난 구독은 웹훅이 늦어도 바로 무료로 취급한다
  return validUntil && (row.status === "active" || row.status === "trialing")
    ? row
    : { ...row, plan: "free" };
}

export const FREE_ROSTER_IMPORTS = 2;

export async function freeRosterImportsLeft(db: D1Database, userId: string) {
  const row = await db
    .prepare("SELECT COUNT(*) AS used FROM roster_imports WHERE user_id = ?")
    .bind(userId)
    .first<{ used: number }>();
  return Math.max(0, FREE_ROSTER_IMPORTS - (row?.used ?? 0));
}

// RevenueCat이 구독의 원본이다. "pro" entitlement 상태를 읽어 subscriptions 행에 반영한다.
export async function syncRevenueCat(db: D1Database, userId: string) {
  const { apiKey } = getRevenueCatSecrets();
  if (!apiKey) throw new Error("REVENUECAT_SECRET_KEY is not configured.");
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!response.ok) throw new Error(`RevenueCat responded ${response.status}.`);
  const data = (await response.json()) as {
    subscriber?: {
      entitlements?: Record<
        string,
        { expires_date: string | null; product_identifier: string }
      >;
    };
  };
  const pro = data.subscriber?.entitlements?.pro;
  const now = new Date().toISOString();
  if (!pro) {
    // 수동으로 부여한 Pro(provider가 다른 행)는 건드리지 않는다
    await db
      .prepare(
        "UPDATE subscriptions SET plan = 'free', status = 'expired', updated_at = ? WHERE user_id = ? AND provider = 'revenuecat'",
      )
      .bind(now, userId)
      .run();
    return;
  }
  const expires = pro.expires_date ? new Date(pro.expires_date).toISOString() : null;
  const active = !expires || expires > now;
  await db
    .prepare(
      `INSERT INTO subscriptions (user_id, plan, status, provider, product_id, current_period_end, updated_at)
       VALUES (?, ?, ?, 'revenuecat', ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan, status = excluded.status,
         provider = excluded.provider, product_id = excluded.product_id,
         current_period_end = excluded.current_period_end, updated_at = excluded.updated_at`,
    )
    .bind(
      userId,
      active ? "pro" : "free",
      active ? "active" : "expired",
      pro.product_identifier,
      expires,
      now,
    )
    .run();
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
