import { cityByCode } from "../../cities";
import { apiError, prepareRequest, rows } from "../_lib";

// 신고가 이만큼 쌓인 후기는 모두에게 숨긴다
const REPORTS_TO_HIDE = 3;
const visible = `(SELECT COUNT(*) FROM review_reports p WHERE p.review_id = r.id) < ${REPORTS_TO_HIDE}`;

// 후기는 익명이다. 응답에 user_id나 이름을 절대 넣지 않는다.
export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const airport = new URL(request.url).searchParams.get("airport");
    if (!airport) {
      const result = await context.db
        .prepare(
          `SELECT r.airport, COUNT(*) AS count, ROUND(AVG(r.rating), 1) AS average
           FROM city_reviews r WHERE ${visible} GROUP BY r.airport`,
        )
        .all<{ airport: string; count: number; average: number }>();
      return Response.json({ cities: rows(result) });
    }
    if (!cityByCode.has(airport))
      return Response.json({ error: "도시를 확인해주세요." }, { status: 400 });
    const result = await context.db
      .prepare(
        `SELECT r.id, r.rating, r.body, r.created_at AS createdAt, r.user_id = ? AS mine
         FROM city_reviews r
         WHERE r.airport = ? AND ${visible}
           AND NOT EXISTS (SELECT 1 FROM review_reports p WHERE p.review_id = r.id AND p.reporter_user_id = ?)
         ORDER BY r.created_at DESC LIMIT 100`,
      )
      .bind(context.user.userId, airport, context.user.userId)
      .all<{ id: string; rating: number; body: string; createdAt: string; mine: number }>();
    return Response.json({
      reviews: rows(result).map((item) => ({ ...item, mine: Boolean(item.mine) })),
    });
  } catch (error) {
    return apiError(error, "후기를 불러오지 못했어요.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const body = (await request.json()) as {
      action?: string;
      id?: string;
      airport?: string;
      rating?: number;
      body?: string;
    };
    const now = new Date().toISOString();

    if (body.action === "report") {
      const review = await context.db
        .prepare("SELECT user_id FROM city_reviews WHERE id = ?")
        .bind(String(body.id ?? ""))
        .first<{ user_id: string }>();
      if (!review)
        return Response.json({ error: "후기를 찾지 못했어요." }, { status: 404 });
      if (review.user_id === context.user.userId)
        return Response.json({ error: "내 후기는 신고할 수 없어요." }, { status: 422 });
      await context.db
        .prepare(
          "INSERT OR IGNORE INTO review_reports (review_id, reporter_user_id, created_at) VALUES (?, ?, ?)",
        )
        .bind(body.id, context.user.userId, now)
        .run();
      return Response.json({ ok: true });
    }

    const profile = await context.db
      .prepare("SELECT role FROM profiles WHERE user_id = ?")
      .bind(context.user.userId)
      .first<{ role: string | null }>();
    if (profile?.role !== "crew")
      return Response.json(
        { error: "승무원 프로필에서만 후기를 쓸 수 있어요." },
        { status: 403 },
      );
    const airport = String(body.airport ?? "");
    const rating = Number(body.rating);
    const text = String(body.body ?? "").trim();
    if (!cityByCode.has(airport))
      return Response.json({ error: "도시를 확인해주세요." }, { status: 422 });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return Response.json({ error: "별점을 1~5점으로 골라주세요." }, { status: 422 });
    if (text.length < 10 || text.length > 1000)
      return Response.json(
        { error: "후기는 10자 이상 1000자 이하로 써주세요." },
        { status: 422 },
      );
    // 도시마다 한 사람이 후기 하나. 다시 쓰면 고쳐 쓴다.
    await context.db
      .prepare(
        `INSERT INTO city_reviews (id, user_id, airport, rating, body, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, airport) DO UPDATE SET rating = excluded.rating, body = excluded.body, created_at = excluded.created_at`,
      )
      .bind(crypto.randomUUID(), context.user.userId, airport, rating, text, now)
      .run();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, "후기를 저장하지 못했어요.");
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const owned = "SELECT id FROM city_reviews WHERE id = ? AND user_id = ?";
    await context.db.batch([
      context.db
        .prepare(`DELETE FROM review_reports WHERE review_id IN (${owned})`)
        .bind(id, context.user.userId),
      context.db
        .prepare("DELETE FROM city_reviews WHERE id = ? AND user_id = ?")
        .bind(id, context.user.userId),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, "후기를 삭제하지 못했어요.");
  }
}
