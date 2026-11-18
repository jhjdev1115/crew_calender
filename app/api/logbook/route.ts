import { apiError, getSubscription, prepareRequest, rows } from "../_lib";

// 비행 기록. Pro는 고른 해 전체, 무료는 지난달부터만 내려준다.
export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const pro =
      (await getSubscription(context.db, context.user.userId)).plan === "pro";
    const now = new Date();
    const param = new URL(request.url).searchParams.get("year") ?? "";
    const year = /^\d{4}$/.test(param) ? param : String(now.getUTCFullYear());
    const from = pro
      ? `${year}-01-01`
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
          .toISOString()
          .slice(0, 10);
    const to = pro ? `${year}-12-31` : "9999-12-31";
    const result = await context.db
      .prepare(
        `SELECT * FROM duties WHERE user_id = ? AND deleted_at IS NULL AND type IN ('flight','layover')
         AND COALESCE(start_date, substr(start_at, 1, 10)) BETWEEN ? AND ?
         ORDER BY COALESCE(start_at, start_date) DESC`,
      )
      .bind(context.user.userId, from, to)
      .all<Record<string, unknown>>();
    return Response.json({ duties: rows(result), locked: !pro });
  } catch (error) {
    return apiError(error, "비행 기록을 불러오지 못했어요.");
  }
}
