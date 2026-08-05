import { apiError, monthBounds, prepareRequest, rows } from "../_lib";

type DutyInput = {
  type?: string;
  startDate?: string;
  endDate?: string;
  startAt?: string;
  endAt?: string;
  eventTz?: string;
  flightNo?: string;
  depAirport?: string;
  arrAirport?: string;
  aircraft?: string;
  layoverCity?: string;
  hotelName?: string;
  note?: string;
};

const allowed = new Set([
  "flight",
  "standby",
  "off",
  "layover",
  "training",
  "leave",
]);
const allDay = new Set(["off", "leave"]);
const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const bounds = monthBounds(new URL(request.url).searchParams.get("month"));
    if (!bounds)
      return Response.json(
        { error: "조회 월을 확인해주세요." },
        { status: 400 },
      );
    const result = await context.db
      .prepare(
        `SELECT * FROM duties WHERE user_id = ? AND deleted_at IS NULL AND (
      (start_date IS NOT NULL AND start_date <= ? AND COALESCE(end_date, start_date) >= ?) OR
      (start_at IS NOT NULL AND substr(start_at, 1, 10) <= ? AND COALESCE(substr(end_at, 1, 10), substr(start_at, 1, 10)) >= ?)
    ) ORDER BY COALESCE(start_date, start_at), created_at`,
      )
      .bind(
        context.user.userId,
        bounds.end,
        bounds.start,
        bounds.end,
        bounds.start,
      )
      .all<Record<string, unknown>>();
    return Response.json({ duties: rows(result) });
  } catch (error) {
    return apiError(error, "일정을 불러오지 못했어요.");
  }
}

export async function POST(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const body = (await request.json()) as DutyInput;
    const type = body.type ?? "";
    if (!allowed.has(type))
      return Response.json(
        { error: "일정 유형을 확인해주세요." },
        { status: 422 },
      );
    const profile = await context.db
      .prepare("SELECT role, schedule_tz FROM profiles WHERE user_id = ?")
      .bind(context.user.userId)
      .first<{ role: string | null; schedule_tz: string }>();
    if (!profile?.role)
      return Response.json(
        { error: "프로필 설정을 먼저 완료해주세요." },
        { status: 403 },
      );
    if (profile.role === "partner" && !allDay.has(type))
      return Response.json(
        { error: "파트너는 휴무와 연차만 등록할 수 있어요." },
        { status: 403 },
      );
    const isAllDay = allDay.has(type);
    const startDate = isAllDay ? (body.startDate ?? "") : null;
    const endDate = isAllDay ? (body.endDate ?? body.startDate ?? "") : null;
    const startAt = isAllDay ? null : (body.startAt ?? "");
    const endAt = isAllDay ? null : (body.endAt ?? "");
    if (
      isAllDay &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(startDate!) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate!) ||
        startDate! > endDate!)
    )
      return Response.json(
        { error: "시작일과 종료일을 확인해주세요." },
        { status: 422 },
      );
    if (
      !isAllDay &&
      (!startAt ||
        !endAt ||
        !localDateTime.test(startAt) ||
        !localDateTime.test(endAt) ||
        (type !== "flight" && new Date(endAt) <= new Date(startAt)))
    )
      return Response.json(
        { error: "시작·종료 시각을 확인해주세요." },
        { status: 422 },
      );
    if (
      type === "flight" &&
      (!body.depAirport?.trim() ||
        !body.arrAirport?.trim() ||
        body.depAirport.trim().toUpperCase() ===
          body.arrAirport.trim().toUpperCase())
    )
      return Response.json(
        { error: "서로 다른 출발·도착 공항을 입력해주세요." },
        { status: 422 },
      );
    if (type === "layover" && !body.layoverCity?.trim())
      return Response.json(
        { error: "체류 도시를 입력해주세요." },
        { status: 422 },
      );
    const firstDate = isAllDay ? startDate! : startAt!.slice(0, 10);
    const rosterMonth = `${firstDate.slice(0, 7)}-01`;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await context.db
      .prepare(
        `INSERT INTO duties (id, user_id, type, roster_month, start_date, end_date, start_at, end_at, event_tz, flight_no, dep_airport, arr_airport, aircraft, layover_city, hotel_name, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        context.user.userId,
        type,
        rosterMonth,
        startDate,
        endDate,
        startAt,
        endAt,
        type === "flight" ? "airport-local" : (body.eventTz ?? profile.schedule_tz),
        body.flightNo?.trim().toUpperCase() || null,
        body.depAirport?.trim().toUpperCase() || null,
        body.arrAirport?.trim().toUpperCase() || null,
        body.aircraft?.trim() || null,
        body.layoverCity?.trim() || null,
        body.hotelName?.trim() || null,
        body.note?.trim() || null,
        now,
        now,
      )
      .run();
    const duty = await context.db
      .prepare("SELECT * FROM duties WHERE id = ? AND user_id = ?")
      .bind(id, context.user.userId)
      .first();
    return Response.json({ duty }, { status: 201 });
  } catch (error) {
    return apiError(error, "일정을 저장하지 못했어요.");
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const bounds = monthBounds(new URL(request.url).searchParams.get("month"));
    if (!bounds)
      return Response.json(
        { error: "초기화할 월을 확인해주세요." },
        { status: 400 },
      );
    const now = new Date().toISOString();
    const result = await context.db
      .prepare(
        "UPDATE duties SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND roster_month = ? AND deleted_at IS NULL",
      )
      .bind(now, now, context.user.userId, `${bounds.start.slice(0, 7)}-01`)
      .run();
    return Response.json({ deleted: result.meta.changes ?? 0 });
  } catch (error) {
    return apiError(error, "월 일정을 초기화하지 못했어요.");
  }
}
