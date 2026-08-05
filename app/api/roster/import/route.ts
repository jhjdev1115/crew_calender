import { prepareRequest, rows } from "../../_lib";

type ImportItem = {
  sourceCode?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  startAt?: string;
  endAt?: string;
  flightNo?: string;
  depAirport?: string;
  arrAirport?: string;
  aircraft?: string;
  layoverCity?: string;
  hotelName?: string;
  note?: string;
};

type ExistingDuty = {
  type: string;
  start_date: string | null;
  end_date: string | null;
  start_at: string | null;
  end_at: string | null;
  flight_no: string | null;
  dep_airport: string | null;
  arr_airport: string | null;
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
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function clean(value: unknown, max = 300): string {
  return String(value ?? "").trim().slice(0, max);
}

function duplicateKey(item: {
  type: string;
  startDate: string;
  endDate: string;
  startAt: string;
  endAt: string;
  flightNo: string;
  depAirport: string;
  arrAirport: string;
}) {
  return [
    item.type,
    item.startDate,
    item.endDate,
    item.startAt,
    item.endAt,
    item.flightNo,
    item.depAirport,
    item.arrAirport,
  ].join("|");
}

function existingKey(item: ExistingDuty) {
  return duplicateKey({
    type: item.type,
    startDate: item.start_date ?? "",
    endDate: item.end_date ?? "",
    startAt: item.start_at ?? "",
    endAt: item.end_at ?? "",
    flightNo: item.flight_no ?? "",
    depAirport: item.dep_airport ?? "",
    arrAirport: item.arr_airport ?? "",
  });
}

export async function POST(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const profile = await context.db
      .prepare("SELECT role, schedule_tz FROM profiles WHERE user_id = ?")
      .bind(context.user.userId)
      .first<{ role: string | null; schedule_tz: string }>();
    if (profile?.role !== "crew")
      return Response.json(
        { error: "승무원 프로필에서만 로스터를 등록할 수 있어요." },
        { status: 403 },
      );

    const body = (await request.json()) as { items?: ImportItem[] };
    if (!Array.isArray(body.items) || body.items.length === 0)
      return Response.json(
        { error: "등록할 일정을 선택해주세요." },
        { status: 422 },
      );
    if (body.items.length > 100)
      return Response.json(
        { error: "한 번에 최대 100개의 일정만 등록할 수 있어요." },
        { status: 422 },
      );

    let incomplete = 0;
    const normalized = body.items.flatMap((item) => {
      const type = clean(item.type, 20);
      if (!allowed.has(type)) {
        incomplete += 1;
        return [];
      }
      const isAllDay = allDay.has(type);
      const suppliedStartDate = clean(item.startDate, 10);
      const suppliedEndDate = clean(item.endDate, 10);
      const suppliedStartAt = clean(item.startAt, 16);
      const suppliedEndAt = clean(item.endAt, 16);
      let startDate = "";
      let endDate = "";
      let startAt = "";
      let endAt = "";

      if (isAllDay) {
        startDate = datePattern.test(suppliedStartDate)
          ? suppliedStartDate
          : dateTimePattern.test(suppliedStartAt)
            ? suppliedStartAt.slice(0, 10)
            : "";
        endDate = datePattern.test(suppliedEndDate) ? suppliedEndDate : "";
        if (endDate && endDate < startDate) endDate = "";
      } else if (dateTimePattern.test(suppliedStartAt)) {
        startAt = suppliedStartAt;
        endAt = dateTimePattern.test(suppliedEndAt) ? suppliedEndAt : "";
      } else if (datePattern.test(suppliedStartDate)) {
        // Some roster rows contain only a duty date. Store them as date-only
        // duties instead of rejecting the whole import batch.
        startDate = suppliedStartDate;
        endDate = datePattern.test(suppliedEndDate) ? suppliedEndDate : "";
        if (endDate && endDate < startDate) endDate = "";
      }

      if (!startDate && !startAt) {
        incomplete += 1;
        return [];
      }
      const flightNo = clean(item.flightNo, 20).toUpperCase();
      const depAirport = clean(item.depAirport, 3).toUpperCase();
      const arrAirport = clean(item.arrAirport, 3).toUpperCase();
      const layoverCity = clean(item.layoverCity, 80);
      const sourceCode = clean(item.sourceCode, 40);
      const sourceNote = sourceCode ? `로스터 코드: ${sourceCode}` : "";
      return [{
        type,
        startDate,
        endDate,
        startAt,
        endAt,
        flightNo,
        depAirport,
        arrAirport,
        aircraft: clean(item.aircraft, 80),
        layoverCity,
        hotelName: clean(item.hotelName, 160),
        note: [clean(item.note, 360), sourceNote].filter(Boolean).join(" · "),
      }];
    });

    const existing = rows(
      await context.db
        .prepare(
          `SELECT type, start_date, end_date, start_at, end_at, flight_no, dep_airport, arr_airport
           FROM duties WHERE user_id = ? AND deleted_at IS NULL`,
        )
        .bind(context.user.userId)
        .all<ExistingDuty>(),
    );
    const seen = new Set(existing.map(existingKey));
    let duplicates = 0;
    const fresh = normalized.filter((item) => {
      const key = duplicateKey(item);
      if (seen.has(key)) {
        duplicates += 1;
        return false;
      }
      seen.add(key);
      return true;
    });
    const firstDate =
      fresh[0]?.startDate ||
      fresh[0]?.startAt.slice(0, 10) ||
      normalized[0]?.startDate ||
      normalized[0]?.startAt.slice(0, 10) ||
      "";
    const month = firstDate.slice(0, 7);
    if (fresh.length === 0)
      return Response.json({
        imported: 0,
        skipped: duplicates + incomplete,
        duplicates,
        incomplete,
        month,
      });

    const now = new Date().toISOString();
    const statements = fresh.map((item) => {
      const firstDate = item.startDate || item.startAt.slice(0, 10);
      const rosterMonth = `${firstDate.slice(0, 7)}-01`;
      return context.db
        .prepare(
          `INSERT INTO duties (id, user_id, type, roster_month, start_date, end_date, start_at, end_at, event_tz, flight_no, dep_airport, arr_airport, aircraft, layover_city, hotel_name, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.user.userId,
          item.type,
          rosterMonth,
          item.startDate || null,
          item.endDate || null,
          item.startAt || null,
          item.endAt || null,
          item.type === "flight" ? "airport-local" : profile.schedule_tz,
          item.flightNo || null,
          item.depAirport || null,
          item.arrAirport || null,
          item.aircraft || null,
          item.layoverCity || null,
          item.hotelName || null,
          item.note || null,
          now,
          now,
        );
    });
    await context.db.batch(statements);
    return Response.json({
      imported: fresh.length,
      skipped: duplicates + incomplete,
      duplicates,
      incomplete,
      month,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "로스터를 등록하지 못했어요.";
    const validation = /번째|등록할 일정|최대 100/.test(message);
    if (!validation) console.error(message);
    return Response.json(
      { error: validation ? message : "로스터를 등록하지 못했어요." },
      { status: validation ? 422 : 500 },
    );
  }
}
