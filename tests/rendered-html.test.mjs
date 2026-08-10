import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the CrewSync experience and metadata", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  await access(new URL("../dist/server/index.js", import.meta.url));
  assert.match(layout, /CrewSync — 서로의 일정을, 더 쉽게/);
  assert.match(layout, /og\.png/);
  assert.match(page, /서로의 일정을/);
  assert.match(page, /CrewSync 시작하기/);
  assert.doesNotMatch(
    `${page}\n${layout}`,
    /codex-preview|react-loading-skeleton|Your site is taking shape/,
  );
});

test("ships the finished app without starter preview dependencies", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /CalendarHome/);
  assert.match(page, /NotificationSettings/);
  assert.match(page, /AccountDelete/);
  assert.match(page, /\/api\/duties/);
  assert.match(page, /\/api\/profile/);
  assert.match(page, /출발 시각/);
  assert.match(page, /도착 시각/);
  assert.match(page, /각 공항의 현지 시각으로 저장돼요/);
  assert.match(layout, /CrewSync/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(
    access(new URL("../app/_sites-preview", import.meta.url)),
  );
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../drizzle/0000_calm_zeigeist.sql", import.meta.url));
});

test("ships private local roster PDF analysis and bulk import", async () => {
  const [page, importRoute, dutiesRoute, localParser, tokenParser] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/roster/import/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/duties/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/roster-local-parser.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/roster-token-parser.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /보안 로스터 분석/);
  assert.match(page, /analyzeRosterPdfLocally/);
  assert.match(page, /\/api\/roster\/import/);
  assert.match(page, /한국 시간 ·/);
  assert.match(importRoute, /body\.items\.flatMap/);
  assert.match(importRoute, /suppliedEndAt/);
  assert.match(importRoute, /clean\(item\.flightNo/);
  assert.match(importRoute, /incomplete/);
  assert.match(page, /시작 정보 없음/);
  assert.match(localParser, /getDocument/);
  assert.match(localParser, /wipeBytes/);
  assert.match(tokenParser, /flight\.flightNo = flightNo/);
  assert.match(tokenParser, /flight\.startAt/);
  assert.match(tokenParser, /flight\.endAt/);
  assert.match(dutiesRoute, /COALESCE\(end_date, start_date\)/);
  assert.match(dutiesRoute, /COALESCE\(substr\(end_at/);
  await access(new URL("../app/roster-local-parser.ts", import.meta.url));
  await access(new URL("../app/api/roster/import/route.ts", import.meta.url));
});

test("requires real sign-in and keeps shared schedules automatically synchronized", async () => {
  const [page, authLib, firebaseClient, wrangler] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/_lib.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/firebase-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Google로 계속하기/);
  assert.doesNotMatch(page, /createUserWithEmailAndPassword|signInWithEmailAndPassword/);
  assert.match(page, /getIdToken\(\)/);
  assert.match(page, /onAuthStateChanged/);
  assert.match(authLib, /jwtVerify/);
  assert.match(authLib, /securetoken\.google\.com/);
  assert.doesNotMatch(authLib, /oai-authenticated-user/);
  assert.match(firebaseClient, /crewsync-f3dab/);
  assert.match(wrangler, /crewsync-production/);
  assert.match(wrangler, /FIREBASE_PROJECT_ID/);
  assert.match(page, /window\.setInterval\(sync, 10_000\)/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /window\.addEventListener\("focus"/);
  assert.match(page, /loadPartner\(\{ silent: true \}\)/);
});

test("publishes public privacy and complete account deletion flows", async () => {
  const [page, privacy, deletionPage, accountRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/delete-account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(privacy, /CrewSync 개인정보처리방침/);
  assert.match(privacy, /로스터 PDF 원본은 브라우저 또는 기기 안에서만/);
  assert.match(deletionPage, /Google 계정으로 본인 확인/);
  assert.match(deletionPage, /reauthenticateWithPopup/);
  assert.match(deletionPage, /deleteUser/);
  assert.match(page, /reauthenticateWithPopup/);
  assert.match(page, /deleteUser/);
  assert.match(accountRoute, /DELETE FROM profiles WHERE user_id = \?/);
  assert.match(accountRoute, /DELETE FROM duties WHERE user_id = \?/);
  assert.doesNotMatch(accountRoute, /UPDATE profiles SET deletion_requested_at/);
});

test("supports multiple friends and friend-specific monthly schedules", async () => {
  const [page, invitesRoute, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invites/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function FriendPage/);
  assert.match(page, /친구 시간표/);
  assert.match(page, /partner\.friends\.map/);
  assert.match(page, /formatLocalFlightRange\(duty\)/);
  assert.match(page, /formatKoreanFlightRange\(duty\)/);
  assert.match(invitesRoute, /return Response\.json\(\{ invite, friends, friendDuties, month \}\)/);
  assert.match(invitesRoute, /ON CONFLICT\(user_low_id, user_high_id\) DO UPDATE/);
  assert.doesNotMatch(invitesRoute, /이미 활성 연동이 있어요/);
  assert.match(styles, /\.friend-list/);
  assert.match(styles, /\.friend-calendar-grid/);
});

test("fits the full calendar into the mobile viewport with compact flight labels", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function calendarDutyLabel/);
  assert.match(page, /duty\.type === "flight" \? dutyLabels\.flight/);
  assert.match(styles, /\.calendar-screen,[\s\S]*?height: 100dvh/);
  assert.match(styles, /grid-template-rows: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.settings-screen > \.screen-body \{[\s\S]*?overflow-y: auto/);
  assert.match(styles, /height: calc\(62px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /padding-bottom: env\(safe-area-inset-bottom\)/);
});

test("highlights today and reports completed monthly flight time", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function flightDurationMinutes/);
  assert.match(page, /dutyStart\(duty\) <= today/);
  assert.match(page, /이번 달 비행시간/);
  assert.match(page, /role="progressbar"/);
  assert.match(page, /key === todayKey\(\) \? "today"/);
  assert.match(styles, /\.day-cell\.today/);
  assert.match(styles, /\.flight-progress-track/);
});

test("keeps today's typography unchanged and adds Korean flight time", async () => {
  const [page, styles, airportTimes] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/airport-timezones.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /timeZone: "Asia\/Seoul"/);
  assert.match(page, /한국 시간 ·/);
  assert.match(page, /formatKoreanFlightRange/);
  assert.match(styles, /\.saved-duty > \.korea-time/);
  assert.doesNotMatch(styles, /\.day-cell\.today > span:first-child/);
  assert.match(airportTimes, /DOH: "Asia\/Qatar"/);
  assert.match(airportTimes, /ICN: "Asia\/Seoul"/);
  assert.match(airportTimes, /timeZoneOffsetMs/);
  assert.match(page, /airportLocalDateTimeToDate/);
});

test("ships encrypted web push subscriptions and scheduled notification delivery", async () => {
  const [page, pushRoute, pushWorker, worker, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/_push.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_wet_sabretooth.sql", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Notification\.requestPermission/);
  assert.match(page, /pushManager\.subscribe/);
  assert.match(page, /휴대폰 알림 연결됨/);
  assert.match(pushRoute, /push_subscriptions/);
  assert.match(pushWorker, /buildPushPayload/);
  assert.match(pushWorker, /own-flight-pre/);
  assert.match(pushWorker, /partner-flight-post/);
  assert.match(pushWorker, /shared-off/);
  assert.match(worker, /async scheduled/);
  assert.match(migration, /notification_deliveries/);
  await access(new URL("../public/crew-sw.js", import.meta.url));
  await access(new URL("../public/manifest.webmanifest", import.meta.url));
});

test("implements every settings destination and persistent user blocking", async () => {
  const [page, styles, blocksRoute, invitesRoute, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/blocks/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invites/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0004_lowly_joystick.sql", import.meta.url), "utf8"),
  ]);

  for (const screen of ["blocked", "timezone", "accessibility", "terms", "privacy", "help", "about"])
    assert.match(page, new RegExp(`case "${screen}"`));
  assert.match(page, /crewsync-display-preferences/);
  assert.match(page, /function BlockedListPage/);
  assert.match(page, /function TimezonePage/);
  assert.match(page, /function InformationPage/);
  assert.match(page, /setFriendReturnScreen\(screen === "settings" \? "settings" : "calendar"\)/);
  assert.match(page, /back=\{\(\) => go\(friendReturnScreen\)\}/);
  assert.match(page, /setProReturnScreen\(screen\)/);
  assert.match(page, /back=\{\(\) => go\(proReturnScreen\)\}/);
  assert.match(blocksRoute, /INSERT INTO user_blocks/);
  assert.match(blocksRoute, /DELETE FROM user_blocks/);
  assert.match(invitesRoute, /차단된 사용자와는 친구로 등록할 수 없어요/);
  assert.match(migration, /CREATE TABLE `user_blocks`/);
  assert.match(styles, /html\[data-reduce-motion="true"\]/);
});
