import { apiError, prepareRequest, toBool } from "../_lib";

type Row = Record<string, unknown>;
const fields = ["all_enabled", "own_flight_pre", "partner_flight_pre", "partner_flight_post", "roster_changed", "shared_off_d1", "hide_details"] as const;

function serialize(row: Row | null) {
  if (!row) return null;
  return {
    all: toBool(row.all_enabled), mine: toBool(row.own_flight_pre), partnerPre: toBool(row.partner_flight_pre), partnerPost: toBool(row.partner_flight_post),
    roster: toBool(row.roster_changed), shared: toBool(row.shared_off_d1), private: toBool(row.hide_details), notificationTz: row.notification_tz,
  };
}

export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request); if (context instanceof Response) return context;
    const row = await context.db.prepare("SELECT * FROM notification_preferences WHERE user_id = ?").bind(context.user.userId).first<Row>();
    return Response.json({ settings: serialize(row) });
  } catch (error) { return apiError(error, "알림 설정을 불러오지 못했어요."); }
}

export async function PUT(request: Request) {
  try {
    const context = await prepareRequest(request); if (context instanceof Response) return context;
    const body = await request.json() as Record<string, unknown>;
    const values = [body.all, body.mine, body.partnerPre, body.partnerPost, body.roster, body.shared, body.private].map((v) => v ? 1 : 0);
    const tz = typeof body.notificationTz === "string" ? body.notificationTz : "auto";
    await context.db.prepare(`UPDATE notification_preferences SET ${fields.map((field) => `${field} = ?`).join(", ")}, notification_tz = ?, updated_at = ? WHERE user_id = ?`)
      .bind(...values, tz, new Date().toISOString(), context.user.userId).run();
    return GET(request);
  } catch (error) { return apiError(error, "알림 설정을 저장하지 못했어요."); }
}
