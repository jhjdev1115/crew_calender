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

test("ships AI roster PDF analysis and bulk import", async () => {
  const [page, importRoute, dutiesRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/roster/import/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/duties/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AI 로스터 분석/);
  assert.match(page, /\/api\/roster\/analyze/);
  assert.match(page, /\/api\/roster\/import/);
  assert.match(page, /공항별 현지 시각/);
  assert.match(importRoute, /body\.items\.flatMap/);
  assert.match(importRoute, /date-only/);
  assert.match(importRoute, /incomplete/);
  assert.match(page, /시작 정보 없음/);
  const analyzeRoute = await readFile(
    new URL("../app/api/roster/analyze/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(analyzeRoute, /Do not create layover items/);
  assert.doesNotMatch(analyzeRoute, /"layover",/);
  assert.match(dutiesRoute, /COALESCE\(end_date, start_date\)/);
  assert.match(dutiesRoute, /COALESCE\(substr\(end_at/);
  await access(new URL("../app/api/roster/analyze/route.ts", import.meta.url));
  await access(new URL("../app/api/roster/import/route.ts", import.meta.url));
});

test("requires real sign-in and keeps shared schedules automatically synchronized", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /\/signin-with-chatgpt\?return_to=\//);
  assert.match(page, /ChatGPT로 로그인/);
  assert.match(page, /window\.setInterval\(sync, 10_000\)/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /window\.addEventListener\("focus"/);
  assert.match(page, /loadPartner\(\{ silent: true \}\)/);
});

test("fits the full calendar into the mobile viewport with compact flight labels", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function calendarDutyLabel/);
  assert.match(page, /duty\.type === "flight" \? dutyLabels\.flight/);
  assert.match(styles, /\.calendar-screen \{\s*height: 100svh/);
  assert.match(styles, /grid-template-rows: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.calendar-screen > \.bottom-nav \{\s*height: 62px/);
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
