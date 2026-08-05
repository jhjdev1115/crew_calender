import { getVapidKeys } from "../../../db";
import { apiError, prepareRequest } from "../_lib";
import { sendPushToUser } from "../_push";

type SubscriptionBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const vapid = getVapidKeys();
    if (!vapid.publicKey)
      return Response.json({ error: "푸시 알림 서버 설정이 필요합니다." }, { status: 503 });
    const row = await context.db
      .prepare("SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id = ?")
      .bind(context.user.userId)
      .first<{ count: number }>();
    return Response.json({ publicKey: vapid.publicKey, subscribed: Number(row?.count ?? 0) > 0 });
  } catch (error) {
    return apiError(error, "푸시 알림 상태를 불러오지 못했어요.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const body = (await request.json()) as SubscriptionBody & { action?: string };
    if (body.action === "test") {
      const sent = await sendPushToUser(context.db, context.user.userId, {
        title: "CrewSync 알림 테스트",
        body: "알림이 정상적으로 연결됐어요.",
        tag: `test-${Date.now()}`,
        url: "/",
      });
      return Response.json({ sent });
    }
    const endpoint = String(body.endpoint ?? "");
    const p256dh = String(body.keys?.p256dh ?? "");
    const auth = String(body.keys?.auth ?? "");
    if (!endpoint.startsWith("https://") || !p256dh || !auth)
      return Response.json({ error: "유효하지 않은 푸시 구독입니다." }, { status: 422 });
    const now = new Date().toISOString();
    await context.db
      .prepare(
        `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh,
         auth = excluded.auth, updated_at = excluded.updated_at`,
      )
      .bind(crypto.randomUUID(), context.user.userId, endpoint, p256dh, auth, now, now)
      .run();
    return Response.json({ subscribed: true });
  } catch (error) {
    return apiError(error, "푸시 알림을 연결하지 못했어요.");
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    await context.db.batch([
      context.db
        .prepare(
          "DELETE FROM notification_deliveries WHERE subscription_id IN (SELECT id FROM push_subscriptions WHERE user_id = ?)",
        )
        .bind(context.user.userId),
      context.db
        .prepare("DELETE FROM push_subscriptions WHERE user_id = ?")
        .bind(context.user.userId),
    ]);
    return Response.json({ subscribed: false });
  } catch (error) {
    return apiError(error, "푸시 알림 연결을 해제하지 못했어요.");
  }
}
