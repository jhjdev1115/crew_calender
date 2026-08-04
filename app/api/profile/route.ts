import { apiError, prepareRequest } from "../_lib";

type ProfileRow = {
  user_id: string; email: string; display_name: string; role: "crew" | "partner" | null;
  airline: string | null; base_airport: string | null; schedule_tz: string; deletion_requested_at: string | null;
};

export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const profile = await context.db.prepare("SELECT user_id, email, display_name, role, airline, base_airport, schedule_tz, deletion_requested_at FROM profiles WHERE user_id = ?")
      .bind(context.user.userId).first<ProfileRow>();
    return Response.json({ profile });
  } catch (error) { return apiError(error, "프로필을 불러오지 못했어요."); }
}

export async function PUT(request: Request) {
  try {
    const context = await prepareRequest(request);
    if (context instanceof Response) return context;
    const body = await request.json() as { displayName?: string; role?: string; scheduleTz?: string };
    const displayName = body.displayName?.trim().normalize("NFC") ?? "";
    const role = body.role === "crew" || body.role === "partner" ? body.role : null;
    const scheduleTz = body.scheduleTz?.trim() || (role === "crew" ? "Asia/Qatar" : "Asia/Seoul");
    if (!displayName || displayName.length > 20 || !role) return Response.json({ error: "이름과 역할을 확인해주세요." }, { status: 422 });
    try { new Intl.DateTimeFormat("ko-KR", { timeZone: scheduleTz }).format(); } catch { return Response.json({ error: "올바른 시간대를 선택해주세요." }, { status: 422 }); }
    const now = new Date().toISOString();
    await context.db.prepare(`UPDATE profiles SET display_name = ?, role = ?, airline = ?, base_airport = ?, schedule_tz = ?, updated_at = ?, deletion_requested_at = NULL WHERE user_id = ?`)
      .bind(displayName, role, role === "crew" ? "Qatar Airways" : null, role === "crew" ? "DOH" : null, scheduleTz, now, context.user.userId).run();
    return GET(request);
  } catch (error) { return apiError(error, "프로필을 저장하지 못했어요."); }
}
