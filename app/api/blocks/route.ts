import { apiError, prepareRequest, rows } from "../_lib";

export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const blocked = rows(
      await context.db
        .prepare(
          `SELECT b.blocked_user_id AS user_id, b.created_at,
            p.display_name, p.airline, p.base_airport
           FROM user_blocks b
           JOIN profiles p ON p.user_id = b.blocked_user_id
           WHERE b.blocker_user_id = ?
           ORDER BY b.created_at DESC`,
        )
        .bind(context.user.userId)
        .all<Record<string, unknown>>(),
    );
    return Response.json({ blocked });
  } catch (error) {
    return apiError(error, "차단 목록을 불러오지 못했어요.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const body = (await request.json()) as { userId?: string };
    const blockedUserId = String(body.userId ?? "").trim();
    if (!blockedUserId || blockedUserId === context.user.userId)
      return Response.json({ error: "차단할 사용자를 확인해주세요." }, { status: 422 });
    const profile = await context.db
      .prepare("SELECT user_id FROM profiles WHERE user_id = ?")
      .bind(blockedUserId)
      .first();
    if (!profile)
      return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
    const now = new Date().toISOString();
    await context.db.batch([
      context.db
        .prepare(
          `INSERT INTO user_blocks (blocker_user_id, blocked_user_id, created_at)
           VALUES (?, ?, ?)
           ON CONFLICT(blocker_user_id, blocked_user_id) DO NOTHING`,
        )
        .bind(context.user.userId, blockedUserId, now),
      context.db
        .prepare(
          `UPDATE connections SET status = 'unlinked', unlinked_at = ?
           WHERE status = 'active' AND (
             (user_low_id = ? AND user_high_id = ?) OR
             (user_low_id = ? AND user_high_id = ?)
           )`,
        )
        .bind(now, context.user.userId, blockedUserId, blockedUserId, context.user.userId),
    ]);
    return Response.json({ blocked: true });
  } catch (error) {
    return apiError(error, "사용자를 차단하지 못했어요.");
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const userId = new URL(request.url).searchParams.get("userId")?.trim();
    if (!userId)
      return Response.json({ error: "차단 해제할 사용자를 확인해주세요." }, { status: 422 });
    await context.db
      .prepare("DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?")
      .bind(context.user.userId, userId)
      .run();
    return Response.json({ unblocked: true });
  } catch (error) {
    return apiError(error, "차단을 해제하지 못했어요.");
  }
}
