import { apiError, hashInviteCode, normalizeInviteCode, prepareRequest, rows } from "../_lib";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() { const bytes = crypto.getRandomValues(new Uint8Array(8)); return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(""); }
function displayCode(code: string) { return `${code.slice(0, 4)}-${code.slice(4)}`; }

export async function GET(request: Request) {
  try {
    const context = await prepareRequest(request); if (context instanceof Response) return context;
    const now = new Date().toISOString();
    const invite = await context.db.prepare("SELECT code_hint, expires_at FROM invite_codes WHERE issuer_user_id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1")
      .bind(context.user.userId, now).first();
    const connection = await context.db.prepare(`SELECT c.*, p.user_id AS partner_id, p.display_name, p.role, p.airline, p.base_airport
      FROM connections c JOIN profiles p ON p.user_id = CASE WHEN c.user_low_id = ? THEN c.user_high_id ELSE c.user_low_id END
      WHERE (c.user_low_id = ? OR c.user_high_id = ?) AND c.status = 'active' LIMIT 1`)
      .bind(context.user.userId, context.user.userId, context.user.userId).first<Record<string, unknown>>();
    let partnerDuties: Record<string, unknown>[] = [];
    if (connection?.partner_id) {
      const result = await context.db.prepare(`SELECT id, type, start_date, end_date, start_at, end_at, dep_airport, arr_airport, event_tz, layover_city
        FROM duties WHERE user_id = ? AND deleted_at IS NULL ORDER BY COALESCE(start_date, start_at) LIMIT 100`).bind(connection.partner_id).all<Record<string, unknown>>();
      partnerDuties = rows(result);
    }
    return Response.json({ invite, connection, partnerDuties });
  } catch (error) { return apiError(error, "연동 정보를 불러오지 못했어요."); }
}

export async function POST(request: Request) {
  try {
    const context = await prepareRequest(request); if (context instanceof Response) return context;
    const body = await request.json() as { action?: string; code?: string };
    if (body.action === "create") {
      const profile = await context.db.prepare("SELECT role FROM profiles WHERE user_id = ?").bind(context.user.userId).first<{ role: string | null }>();
      if (profile?.role !== "crew") return Response.json({ error: "승무원만 초대 코드를 만들 수 있어요." }, { status: 403 });
      const raw = makeCode(); const hash = await hashInviteCode(raw, request); const now = new Date(); const expires = new Date(now.getTime() + 7 * 86400000);
      await context.db.batch([
        context.db.prepare("UPDATE invite_codes SET revoked_at = ? WHERE issuer_user_id = ? AND used_at IS NULL AND revoked_at IS NULL").bind(now.toISOString(), context.user.userId),
        context.db.prepare("INSERT INTO invite_codes (id, issuer_user_id, code_hash, code_hint, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), context.user.userId, hash, raw.slice(-2), expires.toISOString(), now.toISOString()),
      ]);
      return Response.json({ code: displayCode(raw), expiresAt: expires.toISOString() }, { status: 201 });
    }
    if (body.action === "accept") {
      const code = normalizeInviteCode(body.code); if (code.length !== 8) return Response.json({ error: "사용할 수 없는 코드예요." }, { status: 422 });
      const hash = await hashInviteCode(code, request); const now = new Date().toISOString();
      const invite = await context.db.prepare(`SELECT i.id, i.issuer_user_id, p.role FROM invite_codes i JOIN profiles p ON p.user_id = i.issuer_user_id
        WHERE i.code_hash = ? AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > ?`).bind(hash, now).first<{ id: string; issuer_user_id: string; role: string }>();
      if (!invite || invite.issuer_user_id === context.user.userId) return Response.json({ error: "사용할 수 없는 코드예요." }, { status: 422 });
      const accepter = await context.db.prepare("SELECT role FROM profiles WHERE user_id = ?").bind(context.user.userId).first<{ role: string | null }>();
      if (!accepter?.role || (accepter.role === "partner" && invite.role === "partner")) return Response.json({ error: "이 역할 조합은 연동할 수 없어요." }, { status: 422 });
      const existing = await context.db.prepare("SELECT user_id FROM active_memberships WHERE user_id IN (?, ?) LIMIT 1")
        .bind(context.user.userId, invite.issuer_user_id).first();
      if (existing) return Response.json({ error: "이미 활성 연동이 있어요." }, { status: 409 });
      const [low, high] = [context.user.userId, invite.issuer_user_id].sort();
      const connectionId = crypto.randomUUID();
      await context.db.batch([
        context.db.prepare("INSERT INTO connections (id, user_low_id, user_high_id, status, linked_at) VALUES (?, ?, ?, 'active', ?)").bind(connectionId, low, high, now),
        context.db.prepare("INSERT INTO active_memberships (user_id, connection_id, created_at) VALUES (?, ?, ?)").bind(context.user.userId, connectionId, now),
        context.db.prepare("INSERT INTO active_memberships (user_id, connection_id, created_at) VALUES (?, ?, ?)").bind(invite.issuer_user_id, connectionId, now),
        context.db.prepare("UPDATE invite_codes SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(now, invite.id),
      ]);
      return Response.json({ linked: true });
    }
    if (body.action === "unlink") {
      const now = new Date().toISOString();
      const membership = await context.db.prepare("SELECT connection_id FROM active_memberships WHERE user_id = ?").bind(context.user.userId).first<{ connection_id: string }>();
      if (membership) await context.db.batch([
        context.db.prepare("UPDATE connections SET status = 'unlinked', unlinked_at = ? WHERE id = ? AND status = 'active'").bind(now, membership.connection_id),
        context.db.prepare("DELETE FROM active_memberships WHERE connection_id = ?").bind(membership.connection_id),
      ]);
      return Response.json({ unlinked: true });
    }
    return Response.json({ error: "지원하지 않는 요청이에요." }, { status: 400 });
  } catch (error) { return apiError(error, "연동 요청을 처리하지 못했어요."); }
}
