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
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|react-loading-skeleton|Your site is taking shape/);
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
  assert.match(layout, /CrewSync/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../drizzle/0000_calm_zeigeist.sql", import.meta.url));
});
