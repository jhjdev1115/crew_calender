import {
  apiError,
  hashInviteCode,
  activeFriendCount,
  getSubscription,
  monthBounds,
  normalizeInviteCode,
  prepareRequest,
  rows,
} from "../_lib";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function displayCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const bounds = monthBounds(month);
    if (!bounds)
      return Response.json({ error: "조회할 월을 확인해주세요." }, { status: 400 });

    const now = new Date().toISOString();
    const invite = await context.db
      .prepare(
        "SELECT code_hint, expires_at FROM invite_codes WHERE issuer_user_id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
      )
      .bind(context.user.userId, now)
      .first();
    const friends = rows(
      await context.db
        .prepare(
          `SELECT c.id AS connection_id,
            p.user_id, p.display_name, p.role, p.airline, p.base_airport, p.schedule_tz,
            c.linked_at
          FROM connections c
          JOIN profiles p ON p.user_id = CASE
            WHEN c.user_low_id = ? THEN c.user_high_id ELSE c.user_low_id END
          WHERE (c.user_low_id = ? OR c.user_high_id = ?) AND c.status = 'active'
          ORDER BY p.display_name COLLATE NOCASE, c.linked_at`,
        )
        .bind(context.user.userId, context.user.userId, context.user.userId)
        .all<Record<string, unknown>>(),
    );

    const friendDuties = friends.length
      ? rows(
          await context.db
            .prepare(
              `SELECT d.id, d.user_id, d.type, d.start_date, d.end_date,
                d.start_at, d.end_at, d.event_tz, d.flight_no,
                CASE WHEN d.type = 'flight' THEN d.dep_airport ELSE NULL END AS dep_airport,
                CASE WHEN d.type = 'flight' THEN d.arr_airport ELSE NULL END AS arr_airport,
                CASE WHEN d.type = 'layover' THEN d.layover_city ELSE NULL END AS layover_city
              FROM duties d
              JOIN connections c ON (
                (c.user_low_id = ? AND c.user_high_id = d.user_id) OR
                (c.user_high_id = ? AND c.user_low_id = d.user_id)
              ) AND c.status = 'active'
              WHERE d.deleted_at IS NULL AND (
                (d.start_date IS NOT NULL AND d.start_date <= ? AND COALESCE(d.end_date, d.start_date) >= ?) OR
                (d.start_at IS NOT NULL AND substr(d.start_at, 1, 10) <= ? AND COALESCE(substr(d.end_at, 1, 10), substr(d.start_at, 1, 10)) >= ?)
              )
              ORDER BY COALESCE(d.start_date, d.start_at), d.created_at`,
            )
            .bind(
              context.user.userId,
              context.user.userId,
              bounds.end,
              bounds.start,
              bounds.end,
              bounds.start,
            )
            .all<Record<string, unknown>>(),
        )
      : [];
    return Response.json({ invite, friends, friendDuties, month });
  } catch (error) {
    return apiError(error, "친구 정보를 불러오지 못했어요.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const body = (await request.json()) as {
      action?: string;
      code?: string;
      friendId?: string;
    };

    if (body.action === "create") {
      const subscription = await getSubscription(context.db, context.user.userId);
      if (subscription.plan !== "pro" && (await activeFriendCount(context.db, context.user.userId)) >= 5)
        return Response.json({ error: "무료 플랜은 친구 5명까지 등록할 수 있어요. Pro로 업그레이드하면 무제한으로 등록할 수 있어요." }, { status: 403 });
      const raw = makeCode();
      const hash = await hashInviteCode(raw, request);
      const now = new Date();
      const expires = new Date(now.getTime() + 7 * 86400000);
      await context.db.batch([
        context.db
          .prepare(
            "UPDATE invite_codes SET revoked_at = ? WHERE issuer_user_id = ? AND used_at IS NULL AND revoked_at IS NULL",
          )
          .bind(now.toISOString(), context.user.userId),
        context.db
          .prepare(
            "INSERT INTO invite_codes (id, issuer_user_id, code_hash, code_hint, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(
            crypto.randomUUID(),
            context.user.userId,
            hash,
            raw.slice(-2),
            expires.toISOString(),
            now.toISOString(),
          ),
      ]);
      return Response.json(
        { code: displayCode(raw), expiresAt: expires.toISOString() },
        { status: 201 },
      );
    }

    if (body.action === "accept") {
      const code = normalizeInviteCode(body.code);
      if (code.length !== 8)
        return Response.json({ error: "사용할 수 없는 코드예요." }, { status: 422 });
      const hash = await hashInviteCode(code, request);
      const now = new Date().toISOString();
      const invite = await context.db
        .prepare(
          `SELECT id, issuer_user_id FROM invite_codes
           WHERE code_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
        )
        .bind(hash, now)
        .first<{ id: string; issuer_user_id: string }>();
      if (!invite || invite.issuer_user_id === context.user.userId)
        return Response.json({ error: "사용할 수 없는 코드예요." }, { status: 422 });

      const [low, high] = [context.user.userId, invite.issuer_user_id].sort();
      const existing = await context.db
        .prepare(
          "SELECT status FROM connections WHERE user_low_id = ? AND user_high_id = ?",
        )
        .bind(low, high)
        .first<{ status: string }>();
      if (existing?.status === "active")
        return Response.json({ error: "이미 등록된 친구예요." }, { status: 409 });

      const [currentPlan, issuerPlan, currentCount, issuerCount] = await Promise.all([
        getSubscription(context.db, context.user.userId),
        getSubscription(context.db, invite.issuer_user_id),
        activeFriendCount(context.db, context.user.userId),
        activeFriendCount(context.db, invite.issuer_user_id),
      ]);
      if (
        (currentPlan.plan !== "pro" && currentCount >= 5) ||
        (issuerPlan.plan !== "pro" && issuerCount >= 5)
      )
        return Response.json({ error: "무료 플랜은 친구 5명까지 등록할 수 있어요. 한쪽이 Pro로 업그레이드한 뒤 다시 시도해 주세요." }, { status: 403 });

      await context.db.batch([
        context.db
          .prepare(
            `INSERT INTO connections (id, user_low_id, user_high_id, status, linked_at, unlinked_at)
             VALUES (?, ?, ?, 'active', ?, NULL)
             ON CONFLICT(user_low_id, user_high_id) DO UPDATE SET
               status = 'active', linked_at = excluded.linked_at, unlinked_at = NULL`,
          )
          .bind(crypto.randomUUID(), low, high, now),
        context.db
          .prepare("UPDATE invite_codes SET used_at = ? WHERE id = ? AND used_at IS NULL")
          .bind(now, invite.id),
      ]);
      return Response.json({ added: true, friendId: invite.issuer_user_id });
    }

    if (body.action === "remove") {
      const friendId = String(body.friendId ?? "").trim();
      if (!friendId || friendId === context.user.userId)
        return Response.json({ error: "삭제할 친구를 확인해주세요." }, { status: 422 });
      const now = new Date().toISOString();
      await context.db
        .prepare(
          `UPDATE connections SET status = 'unlinked', unlinked_at = ?
           WHERE status = 'active' AND (
             (user_low_id = ? AND user_high_id = ?) OR
             (user_low_id = ? AND user_high_id = ?)
           )`,
        )
        .bind(now, context.user.userId, friendId, friendId, context.user.userId)
        .run();
      return Response.json({ removed: true });
    }

    return Response.json({ error: "지원하지 않는 요청이에요." }, { status: 400 });
  } catch (error) {
    return apiError(error, "친구 요청을 처리하지 못했어요.");
  }
}
