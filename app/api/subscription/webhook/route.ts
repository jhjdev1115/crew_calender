import { ensureDatabase, getD1, getRevenueCatSecrets } from "../../../../db";
import { syncRevenueCat } from "../../_lib";

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// RevenueCat 대시보드의 Webhook Authorization header 값을 `Bearer <REVENUECAT_WEBHOOK_SECRET>`로 설정한다.
// 갱신·해지·환불·만료 이벤트가 오면 본문은 믿지 않고 해당 사용자를 RevenueCat에서 다시 읽는다.
export async function POST(request: Request) {
  const { webhookSecret } = getRevenueCatSecrets();
  const header = request.headers.get("authorization") ?? "";
  if (!webhookSecret || !sameSecret(header, `Bearer ${webhookSecret}`))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as { event?: { app_user_id?: string } };
    const userId = String(body.event?.app_user_id ?? "");
    await ensureDatabase();
    const db = getD1();
    const profile = userId
      ? await db.prepare("SELECT 1 FROM profiles WHERE user_id = ?").bind(userId).first()
      : null;
    // 익명 ID나 삭제된 계정의 이벤트는 재시도되지 않게 200으로 받는다
    if (profile) await syncRevenueCat(db, userId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }
}
