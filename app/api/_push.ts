import {
  buildPushPayload,
  type PushSubscription,
} from "@block65/webcrypto-web-push";
import { getVapidKeys } from "../../db";
import { airportLocalDateTimeToDate } from "../airport-timezones";
import { rows, toBool } from "./_lib";

type PushRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};
type DutyRow = {
  id: string;
  type: string;
  start_at: string | null;
  end_at: string | null;
  event_tz: string | null;
  flight_no: string | null;
  dep_airport: string | null;
  arr_airport: string | null;
};
type PushMessage = { title: string; body: string; tag: string; url?: string };

async function sendSubscription(row: PushRow, message: PushMessage) {
  const vapid = getVapidKeys();
  if (!vapid.publicKey || !vapid.privateKey)
    throw new Error("VAPID keys are unavailable.");
  const subscription: PushSubscription = {
    endpoint: row.endpoint,
    expirationTime: null,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
  const payload = await buildPushPayload(
    { data: message, options: { ttl: 300, urgency: "high", topic: message.tag } },
    subscription,
    {
      publicKey: vapid.publicKey,
      privateKey: vapid.privateKey,
      subject: vapid.subject,
    },
  );
  const body = payload.body.buffer.slice(
    payload.body.byteOffset,
    payload.body.byteOffset + payload.body.byteLength,
  ) as ArrayBuffer;
  return fetch(row.endpoint, { ...payload, body });
}

export async function sendPushToUser(
  db: D1Database,
  userId: string,
  message: PushMessage,
  eventKey = `${message.tag}:${Date.now()}`,
) {
  const subscriptions = rows(
    await db
      .prepare("SELECT * FROM push_subscriptions WHERE user_id = ?")
      .bind(userId)
      .all<PushRow>(),
  );
  let sent = 0;
  for (const subscription of subscriptions) {
    const inserted = await db
      .prepare(
        "INSERT OR IGNORE INTO notification_deliveries (id, subscription_id, event_key, sent_at) VALUES (?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        subscription.id,
        eventKey,
        new Date().toISOString(),
      )
      .run();
    if (!inserted.meta.changes) continue;
    try {
      const response = await sendSubscription(subscription, message);
      if (response.ok) {
        sent += 1;
      } else if (response.status === 404 || response.status === 410) {
        await db.batch([
          db
            .prepare("DELETE FROM notification_deliveries WHERE subscription_id = ?")
            .bind(subscription.id),
          db
            .prepare("DELETE FROM push_subscriptions WHERE id = ?")
            .bind(subscription.id),
        ]);
      } else {
        throw new Error(`Push endpoint returned ${response.status}.`);
      }
    } catch (error) {
      await db
        .prepare(
          "DELETE FROM notification_deliveries WHERE subscription_id = ? AND event_key = ?",
        )
        .bind(subscription.id, eventKey)
        .run();
      console.error(error instanceof Error ? error.message : "Push failed");
    }
  }
  return sent;
}

function isDue(target: Date | null, now: number) {
  if (!target) return false;
  const delta = now - target.getTime();
  return delta >= 0 && delta <= 10 * 60_000;
}

async function partnerId(db: D1Database, userId: string) {
  const row = await db
    .prepare(
      `SELECT CASE WHEN c.user_low_id = ? THEN c.user_high_id ELSE c.user_low_id END AS partner_id
       FROM connections c WHERE c.status = 'active' AND (c.user_low_id = ? OR c.user_high_id = ?) LIMIT 1`,
    )
    .bind(userId, userId, userId)
    .first<{ partner_id: string }>();
  return row?.partner_id ?? null;
}

async function flightsFor(db: D1Database, userId: string) {
  return rows(
    await db
      .prepare(
        `SELECT id, type, start_at, end_at, event_tz, flight_no, dep_airport, arr_airport
         FROM duties WHERE user_id = ? AND type = 'flight' AND deleted_at IS NULL
         AND start_at IS NOT NULL ORDER BY start_at LIMIT 100`,
      )
      .bind(userId)
      .all<DutyRow>(),
  );
}

export async function dispatchDueForUser(db: D1Database, userId: string) {
  const preferences = await db
    .prepare("SELECT * FROM notification_preferences WHERE user_id = ?")
    .bind(userId)
    .first<Record<string, unknown>>();
  if (!preferences || !toBool(preferences.all_enabled)) return 0;
  const hideDetails = toBool(preferences.hide_details);
  const now = Date.now();
  let sent = 0;
  if (toBool(preferences.own_flight_pre)) {
    for (const duty of await flightsFor(db, userId)) {
      const start = airportLocalDateTimeToDate(
        duty.start_at,
        duty.dep_airport,
        duty.event_tz,
      );
      const target = start ? new Date(start.getTime() - 3 * 60 * 60_000) : null;
      if (!isDue(target, now)) continue;
      sent += await sendPushToUser(
        db,
        userId,
        {
          title: "내 비행 3시간 전",
          body: hideDetails
            ? "새 알림이 있어요"
            : `${duty.flight_no ?? "비행"} · ${duty.dep_airport ?? "출발"} → ${duty.arr_airport ?? "도착"}`,
          tag: `own-flight-pre-${duty.id}`,
          url: "/",
        },
        `own-flight-pre:${duty.id}`,
      );
    }
  }
  const peerId = await partnerId(db, userId);
  if (peerId) {
    for (const duty of await flightsFor(db, peerId)) {
      if (toBool(preferences.partner_flight_pre)) {
        const start = airportLocalDateTimeToDate(
          duty.start_at,
          duty.dep_airport,
          duty.event_tz,
        );
        const target = start ? new Date(start.getTime() - 3 * 60 * 60_000) : null;
        if (isDue(target, now))
          sent += await sendPushToUser(
            db,
            userId,
            {
              title: "파트너 비행 3시간 전",
              body: hideDetails
                ? "새 알림이 있어요"
                : `${duty.dep_airport ?? "출발"} → ${duty.arr_airport ?? "도착"}`,
              tag: `partner-flight-pre-${duty.id}`,
              url: "/",
            },
            `partner-flight-pre:${duty.id}`,
          );
      }
      if (toBool(preferences.partner_flight_post)) {
        const end = airportLocalDateTimeToDate(
          duty.end_at,
          duty.arr_airport,
          duty.event_tz,
        );
        if (isDue(end, now))
          sent += await sendPushToUser(
            db,
            userId,
            {
              title: "파트너 비행 종료 예정",
              body: hideDetails
                ? "새 알림이 있어요"
                : `${duty.arr_airport ?? "도착지"} 도착 예정 시각이에요`,
              tag: `partner-flight-post-${duty.id}`,
              url: "/",
            },
            `partner-flight-post:${duty.id}`,
          );
      }
    }
    if (toBool(preferences.shared_off_d1)) {
      const nowDate = new Date(now);
      const seoulParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(nowDate);
      const values = Object.fromEntries(
        seoulParts.map((part) => [part.type, part.value]),
      );
      const today = `${values.year}-${values.month}-${values.day}`;
      const target = airportLocalDateTimeToDate(
        `${today}T09:00`,
        null,
        "Asia/Seoul",
      );
      if (isDue(target, now)) {
        const tomorrowDate = new Date(`${today}T12:00:00Z`);
        tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
        const tomorrow = tomorrowDate.toISOString().slice(0, 10);
        const shared = await db
          .prepare(
            `SELECT
              EXISTS(SELECT 1 FROM duties WHERE user_id = ? AND type IN ('off','leave') AND deleted_at IS NULL
                AND start_date <= ? AND COALESCE(end_date, start_date) >= ?) AS mine,
              EXISTS(SELECT 1 FROM duties WHERE user_id = ? AND type IN ('off','leave') AND deleted_at IS NULL
                AND start_date <= ? AND COALESCE(end_date, start_date) >= ?) AS peer`,
          )
          .bind(userId, tomorrow, tomorrow, peerId, tomorrow, tomorrow)
          .first<{ mine: number; peer: number }>();
        if (shared?.mine && shared.peer)
          sent += await sendPushToUser(
            db,
            userId,
            {
              title: "내일은 같은 날짜 휴무",
              body: hideDetails ? "새 알림이 있어요" : "파트너와 함께 쉬는 날이에요 ♥",
              tag: `shared-off-${tomorrow}`,
              url: "/",
            },
            `shared-off:${tomorrow}`,
          );
      }
    }
  }
  return sent;
}

export async function notifyPartnerRosterChanged(
  db: D1Database,
  actorUserId: string,
) {
  const peerId = await partnerId(db, actorUserId);
  if (!peerId) return 0;
  const preferences = await db
    .prepare(
      "SELECT all_enabled, roster_changed, hide_details FROM notification_preferences WHERE user_id = ?",
    )
    .bind(peerId)
    .first<Record<string, unknown>>();
  if (
    !preferences ||
    !toBool(preferences.all_enabled) ||
    !toBool(preferences.roster_changed)
  )
    return 0;
  return sendPushToUser(
    db,
    peerId,
    {
      title: "파트너 일정이 변경됐어요",
      body: toBool(preferences.hide_details)
        ? "새 알림이 있어요"
        : "CrewSync에서 새로운 공유 일정을 확인해보세요.",
      tag: `roster-changed-${actorUserId}`,
      url: "/",
    },
    `roster-changed:${actorUserId}:${Math.floor(Date.now() / 60_000)}`,
  );
}

export async function dispatchAllDue(db: D1Database) {
  const users = rows(
    await db
      .prepare("SELECT DISTINCT user_id FROM push_subscriptions")
      .all<{ user_id: string }>(),
  );
  let sent = 0;
  for (const user of users) sent += await dispatchDueForUser(db, user.user_id);
  await db
    .prepare("DELETE FROM notification_deliveries WHERE sent_at < ?")
    .bind(new Date(Date.now() - 45 * 86400000).toISOString())
    .run();
  return sent;
}
