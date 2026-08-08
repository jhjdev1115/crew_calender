"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { airportLocalDateTimeToDate } from "./airport-timezones";
import type { LocalRosterAnalysis } from "./roster-token-parser";

type Screen =
  | "onboarding"
  | "role"
  | "profile"
  | "calendar"
  | "day"
  | "duty"
  | "quick"
  | "roster"
  | "link"
  | "notifications"
  | "pro"
  | "blocked"
  | "timezone"
  | "accessibility"
  | "terms"
  | "privacy"
  | "help"
  | "about"
  | "settings"
  | "delete";
type Role = "crew" | "partner";
type DutyType = "flight" | "standby" | "off" | "layover" | "training" | "leave";
type Profile = {
  user_id: string;
  email: string;
  display_name: string;
  role: Role | null;
  airline: string | null;
  base_airport: string | null;
  schedule_tz: string;
  deletion_requested_at: string | null;
};
type Duty = {
  id: string;
  user_id?: string;
  type: DutyType;
  start_date: string | null;
  end_date: string | null;
  start_at: string | null;
  end_at: string | null;
  event_tz?: string | null;
  flight_no?: string | null;
  dep_airport?: string | null;
  arr_airport?: string | null;
  aircraft?: string | null;
  layover_city?: string | null;
  hotel_name?: string | null;
  note?: string | null;
  source?: "mine" | "partner";
};
type NotificationState = {
  all: boolean;
  mine: boolean;
  partnerPre: boolean;
  partnerPost: boolean;
  roster: boolean;
  shared: boolean;
  private: boolean;
  notificationTz: string;
};
type Subscription = {
  plan: "free" | "pro";
  status: "active" | "trialing" | "canceled" | "expired";
  provider: string | null;
  productId: string | null;
  currentPeriodEnd: string | null;
};
const freeFriendLimit = 5;
type PartnerState = {
  invite: { code_hint?: string; expires_at?: string } | null;
  friends: FriendProfile[];
  friendDuties: Duty[];
};
type FriendProfile = {
  connection_id: string;
  user_id: string;
  display_name: string;
  role: Role | null;
  airline: string | null;
  base_airport: string | null;
  schedule_tz: string;
  linked_at: string;
};
type BlockedUser = {
  user_id: string;
  display_name: string;
  airline: string | null;
  base_airport: string | null;
  created_at: string;
};
type DisplayPreferences = {
  textSize: "normal" | "large";
  highContrast: boolean;
  reduceMotion: boolean;
};
const defaultDisplayPreferences: DisplayPreferences = {
  textSize: "normal",
  highContrast: false,
  reduceMotion: false,
};
type DutyPayload = {
  type: DutyType;
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
type RosterItem = DutyPayload & {
  id: string;
  sourceCode: string;
  confidence: number;
};
type RosterAnalysis = LocalRosterAnalysis;

const dutyLabels: Record<DutyType, string> = {
  flight: "비행",
  standby: "대기",
  off: "휴무",
  layover: "체류",
  training: "교육",
  leave: "연차",
};
const dutyIcons: Record<DutyType, string> = {
  flight: "✈",
  standby: "♿",
  off: "♥",
  layover: "⌖",
  training: "▣",
  leave: "▦",
};
const defaultNotifications: NotificationState = {
  all: true,
  mine: true,
  partnerPre: true,
  partnerPost: true,
  roster: true,
  shared: true,
  private: true,
  notificationTz: "auto",
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new ApiRequestError(
      data.error || "요청을 처리하지 못했어요.",
      response.status,
    );
  return data;
}

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function todayKey() {
  return dateKey(new Date());
}
function monthKey(date = new Date()) {
  return dateKey(date).slice(0, 7);
}
function formatMonth(value: string) {
  const [y, m] = value.split("-").map(Number);
  return `${y}년 ${m}월`;
}
function formatKoreanDate(value: string) {
  const d = new Date(`${value}T12:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${["일", "월", "화", "수", "목", "금", "토"][d.getDay()]}요일`;
}
function dutyStart(duty: Duty) {
  return duty.start_date ?? duty.start_at?.slice(0, 10) ?? "";
}
function dutyEnd(duty: Duty) {
  return duty.end_date ?? duty.end_at?.slice(0, 10) ?? dutyStart(duty);
}
function formatDutyRange(duty: Duty) {
  const start = duty.start_date ?? formatShortDateTime(duty.start_at);
  const end = duty.end_date ?? formatShortDateTime(duty.end_at);
  return end ? `${start} - ${end}` : start;
}
function dutiesOnDate(duties: Duty[], date: string) {
  return duties.filter(
    (duty) => dutyStart(duty) <= date && dutyEnd(duty) >= date,
  );
}
function dutyLabel(duty: Duty) {
  if (duty.type === "flight")
    return `비행${duty.flight_no ? ` ${duty.flight_no}` : ""} ${duty.dep_airport ?? "출발"} → ${duty.arr_airport ?? "도착"}`;
  if (duty.type === "layover") return `체류 ${duty.layover_city ?? ""}`.trim();
  return dutyLabels[duty.type];
}
function calendarDutyLabel(duty: Duty) {
  return duty.type === "flight" ? dutyLabels.flight : dutyLabel(duty);
}
function flightDurationMinutes(duty: Duty) {
  const start = airportLocalDateTimeToDate(
    duty.start_at,
    duty.dep_airport,
    duty.event_tz,
  )?.getTime();
  const end = airportLocalDateTimeToDate(
    duty.end_at,
    duty.arr_airport,
    duty.event_tz,
  )?.getTime();
  if (start === undefined || end === undefined || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}
function formatFlightMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}분`;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}
function formatShortDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " ");
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours() < 12 ? "오전" : "오후"} ${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function formatKoreanTime(
  value: string | null,
  airport: string | null | undefined,
  fallbackTimeZone?: string | null,
) {
  const date = airportLocalDateTimeToDate(value, airport, fallbackTimeZone);
  if (!date) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
function formatKoreanFlightRange(duty: Duty) {
  const start = formatKoreanTime(
    duty.start_at,
    duty.dep_airport,
    duty.event_tz,
  );
  const end = formatKoreanTime(
    duty.end_at,
    duty.arr_airport,
    duty.event_tz,
  );
  if (!start) return "";
  return end ? `${start} → ${end}` : start;
}

function formatLocalFlightRange(duty: Duty) {
  const sameDate = duty.start_at?.slice(0, 10) === duty.end_at?.slice(0, 10);
  const start = sameDate
    ? duty.start_at?.slice(11, 16) ?? ""
    : duty.start_at?.replace("T", " ") ?? "";
  const end = sameDate
    ? duty.end_at?.slice(11, 16) ?? ""
    : duty.end_at?.replace("T", " ") ?? "";
  if (!start) return "";
  const departure = `${duty.dep_airport ?? "출발지"} 현지 ${start}`;
  return end
    ? `${departure} → ${duty.arr_airport ?? "도착지"} 현지 ${end}`
    : departure;
}

function Mark({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`mark mark-${tone}`}>{children}</span>;
}
function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`logo-lockup ${compact ? "compact" : ""}`}
      aria-label="CrewSync"
    >
      <span className="logo-calendar" aria-hidden="true">
        <span>↗</span>
      </span>
      <strong>CrewSync</strong>
    </div>
  );
}
function TopBar({
  title,
  onBack,
  close = false,
}: {
  title: string;
  onBack: () => void;
  close?: boolean;
}) {
  return (
    <header className="topbar">
      <button
        className="icon-button"
        onClick={onBack}
        aria-label={close ? "닫기" : "뒤로 가기"}
      >
        {close ? "×" : "‹"}
      </button>
      <strong>{title}</strong>
      <span className="topbar-spacer" />
    </header>
  );
}
function BottomNav({
  active,
  go,
}: {
  active: "calendar" | "link" | "settings";
  go: (screen: Screen) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      <button
        className={active === "calendar" ? "active" : ""}
        onClick={() => go("calendar")}
      >
        <span aria-hidden="true">▣</span>
        <small>캘린더</small>
      </button>
      <button
        className={active === "link" ? "active" : ""}
        onClick={() => go("link")}
      >
        <span aria-hidden="true">↗</span>
        <small>친구</small>
      </button>
      <button
        className={active === "settings" ? "active" : ""}
        onClick={() => go("settings")}
      >
        <span aria-hidden="true">⚙</span>
        <small>설정</small>
      </button>
    </nav>
  );
}

function LoadingScreen() {
  return (
    <main className="screen loading-screen">
      <Logo />
      <div className="loading-orbit" />
      <strong>내 일정을 안전하게 불러오는 중</strong>
    </main>
  );
}

function Onboarding({
  onContinue,
  onTerms,
  onPrivacy,
  buttonLabel = "CrewSync 시작하기",
}: {
  onContinue: () => void;
  onTerms?: () => void;
  onPrivacy?: () => void;
  buttonLabel?: string;
}) {
  return (
    <main className="screen onboarding-screen">
      <div className="onboarding-inner">
        <Logo />
        <div className="hero-copy">
          <h1>
            서로의 일정을,
            <br />더 쉽게
          </h1>
          <p>
            승무원 스케줄을 안전하게 공유하고
            <br />
            같은 날짜의 휴무를 한눈에 확인하세요
          </p>
        </div>
        <div className="sync-illustration" aria-hidden="true">
          <div className="mini-calendar crew-mini">
            <b>✈</b>
            <i />
            <i />
            <i className="picked" />
            <i />
            <i />
          </div>
          <span className="sync-line">••••</span>
          <div className="mini-calendar partner-mini">
            <i />
            <i className="heart">♥</i>
            <i />
            <i />
            <i className="heart">♥</i>
            <i />
          </div>
        </div>
      </div>
      <div className="auth-actions">
        <button className="button button-primary" onClick={onContinue}>
          {buttonLabel}
        </button>
        <p className="legal">
          계속하면 <button type="button" onClick={onTerms}>이용약관</button> 및{" "}
          <button type="button" onClick={onPrivacy}>개인정보처리방침</button>에 동의하게 됩니다.
        </p>
      </div>
    </main>
  );
}

function RoleSelection({
  role,
  setRole,
  next,
  back,
}: {
  role: Role;
  setRole: (r: Role) => void;
  next: () => void;
  back: () => void;
}) {
  return (
    <main className="screen form-screen">
      <TopBar title="" onBack={back} />
      <section className="screen-body role-body">
        <div className="page-intro">
          <h1>어떻게 사용하시나요?</h1>
          <p>역할에 따라 필요한 기능만 보여드릴게요</p>
        </div>
        {(["crew", "partner"] as Role[]).map((item) => (
          <button
            key={item}
            className={`role-card ${role === item ? "selected" : ""}`}
            onClick={() => setRole(item)}
          >
            <span className="role-icon">{item === "crew" ? "♧" : "♡"}</span>
            <span className="role-copy">
              <strong>{item === "crew" ? "승무원" : "친구"}</strong>
              <span>
                {item === "crew" ? (
                  <>
                    내 로스터를 등록하고
                    <br />
                    친구들과 안전하게 공유해요
                  </>
                ) : (
                  <>
                    상대의 공유 일정과
                    <br />
                    같은 날짜 휴무를 확인해요
                  </>
                )}
              </span>
              <span className="role-tags">
                <em>{item === "crew" ? "전체 일정 관리" : "공유 일정 보기"}</em>
                <em>{item === "crew" ? "초대 코드 생성" : "내 휴무 등록"}</em>
              </span>
            </span>
            {role === item && <span className="check-badge">✓</span>}
          </button>
        ))}
        <p className="info-line">
          ⓘ 일정과 연동이 없을 때 한 번 변경할 수 있어요
        </p>
      </section>
      <div className="sticky-action">
        <button className="button button-primary" onClick={next}>
          다음
        </button>
      </div>
    </main>
  );
}

function ProfileSetup({
  role,
  initialName,
  next,
  back,
}: {
  role: Role;
  initialName: string;
  next: (name: string, timezone: string) => Promise<void>;
  back: () => void;
}) {
  const [name, setName] = useState(
    initialName || (role === "crew" ? "지원" : "민수"),
  );
  const [saving, setSaving] = useState(false);
  const timezone = role === "crew" ? "Asia/Qatar" : "Asia/Seoul";
  const submit = async () => {
    setSaving(true);
    try {
      await next(name, timezone);
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="screen form-screen">
      <TopBar title="프로필 설정" onBack={back} />
      <section className="screen-body profile-body">
        <div className="page-intro">
          <h1>기본 정보를 알려주세요</h1>
          <p>일정과 알림을 정확하게 보여드릴게요</p>
        </div>
        <div className="profile-picker">
          <div className="avatar avatar-large">{name.slice(0, 1)}</div>
          <span>내 프로필</span>
        </div>
        <label className="field-label">
          표시 이름
          <input
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {role === "crew" && (
          <>
            <label className="field-label">
              항공사
              <input value="Qatar Airways · QR" readOnly />
            </label>
            <label className="field-label">
              베이스 공항
              <input value="Doha · DOH" readOnly />
            </label>
          </>
        )}
        <label className="field-label">
          일정 기준 시간대
          <button className="select-field">
            {timezone} · {role === "crew" ? "UTC+3" : "UTC+9"}
            <span>›</span>
          </button>
        </label>
        <div className="info-box">
          ⓘ 시간대는 비행 시각과 같은 날짜 휴무를 계산할 때 사용해요
        </div>
      </section>
      <div className="sticky-action">
        <button
          className="button button-primary"
          disabled={!name.trim() || saving}
          onClick={submit}
        >
          {saving ? "저장 중…" : "시작하기"}
        </button>
      </div>
    </main>
  );
}

function CalendarHome({
  role,
  profile,
  duties,
  partner,
  month,
  loading,
  go,
  selectDate,
  changeMonth,
  toast,
  subscription,
}: {
  role: Role;
  profile: Profile;
  duties: Duty[];
  partner: PartnerState;
  month: string;
  loading: boolean;
  go: (s: Screen) => void;
  selectDate: (d: string) => void;
  changeMonth: (delta: number) => void;
  toast: (m: string) => void;
  subscription: Subscription;
}) {
  const cells = useMemo(() => {
    const [year, mon] = month.split("-").map(Number);
    const first = new Date(year, mon - 1, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(year, mon - 1, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = dateKey(date);
      return {
        key,
        day: date.getDate(),
        current: date.getMonth() === mon - 1,
        index: i,
      };
    });
  }, [month]);
  const allDuties = useMemo(
    () =>
      role === "partner"
        ? [
            ...duties,
            ...partner.friendDuties.map((d) => ({
              ...d,
              source: "partner" as const,
            })),
          ]
        : duties,
    [duties, partner.friendDuties, role],
  );
  const byDate = useMemo(() => {
    const map = new Map<string, Duty[]>();
    for (const cell of cells)
      map.set(cell.key, dutiesOnDate(allDuties, cell.key));
    return map;
  }, [allDuties, cells]);
  const firstFriend = partner.friends[0];
  const partnerName = firstFriend?.display_name ?? "친구";
  const flightStats = useMemo(() => {
    const trackedDuties = role === "crew" ? duties : partner.friendDuties;
    const today = todayKey();
    let totalMinutes = 0;
    let completedMinutes = 0;
    for (const duty of trackedDuties) {
      if (duty.type !== "flight" || !dutyStart(duty).startsWith(month)) continue;
      const duration = flightDurationMinutes(duty);
      if (!duration) continue;
      totalMinutes += duration;
      if (dutyStart(duty) <= today) completedMinutes += duration;
    }
    return {
      totalMinutes,
      completedMinutes,
      percent: totalMinutes
        ? Math.min(100, Math.round((completedMinutes / totalMinutes) * 100))
        : 0,
    };
  }, [duties, month, partner.friendDuties, role]);
  return (
    <main className="screen calendar-screen">
      <section className="calendar-content">
        <div className="greeting-row">
          <div>
            <h1>안녕하세요, {profile.display_name}님</h1>
            <p>
              {loading
                ? "일정을 동기화하는 중이에요"
                : `${duties.length}개의 내 일정이 저장되어 있어요`}
            </p>
          </div>
          <div className="avatar avatar-small">
            {profile.display_name.slice(0, 1)}
          </div>
        </div>
        {partner.friends.length ? (
          <button className="partner-banner" onClick={() => go("link")}>
            <span className="avatar avatar-medium">
              {partnerName.slice(0, 1)}
            </span>
            <span>
              <strong>
                {partner.friends.length === 1
                  ? `${partnerName}님의 시간표`
                  : `친구 ${partner.friends.length}명의 시간표`}
              </strong>
              <small>
                {String(firstFriend?.airline ?? "등록된 친구")}
                {firstFriend?.base_airport
                  ? ` · ${String(firstFriend.base_airport)}`
                  : ""}
              </small>
            </span>
            <em>● 공유 중</em>
            <b>›</b>
          </button>
        ) : (
          <button className="shared-banner" onClick={() => go("link")}>
            <span className="heart-calendar">♥</span>
            <strong>
              친구를 등록하고 <b>서로의 시간표</b>를 확인하세요
            </strong>
            <span>›</span>
          </button>
        )}
        {role === "crew" && (
          <button className="ai-roster-banner" onClick={() => go("roster")}>
            <span>✦</span>
            <span>
              <strong>기기에서 로스터 PDF 등록</strong>
              <small>PDF를 올리면 일정과 현지 시각을 자동으로 정리해요</small>
            </span>
            <b>›</b>
          </button>
        )}
        {subscription.plan === "pro" ? (
        <section className="flight-progress" aria-label="이번 달 비행시간 진행률">
          <div>
            <span>
              {role === "partner" ? `${partnerName}님의 ` : ""}이번 달 비행시간
            </span>
            <strong>
              {formatFlightMinutes(flightStats.completedMinutes)}
              <small> / 총 {formatFlightMinutes(flightStats.totalMinutes)}</small>
            </strong>
          </div>
          <div
            className="flight-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={flightStats.percent}
          >
            <i style={{ width: `${flightStats.percent}%` }} />
          </div>
          <b>{flightStats.percent}%</b>
        </section>
        ) : (
          <button className="flight-progress flight-progress-locked" onClick={() => go("pro")}>
            <span className="pro-lock" aria-hidden="true">✦</span>
            <span>
              <strong>이번 달 비행시간 통계</strong>
              <small>Pro에서 총 비행시간과 진행률을 확인하세요</small>
            </span>
            <b>Pro</b>
          </button>
        )}
        <div className="month-toolbar">
          <button aria-label="이전 달" onClick={() => changeMonth(-1)}>
            ‹
          </button>
          <h2>{formatMonth(month)}</h2>
          <button aria-label="다음 달" onClick={() => changeMonth(1)}>
            ›
          </button>
          <button
            className="today-button"
            onClick={() => {
              const now = monthKey();
              if (now === month) toast("이미 이번 달을 보고 있어요");
              else changeMonth(0);
            }}
          >
            오늘
          </button>
        </div>
        <div className="weekday-row">
          {["월", "화", "수", "목", "금", "토", "일"].map((d, i) => (
            <span className={i === 5 ? "sat" : i === 6 ? "sun" : ""} key={d}>
              {d}
            </span>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map(({ key, day, current, index }) => {
            const events = byDate.get(key) ?? [];
            const dow = index % 7;
            const shared =
              events.some(
                (d) =>
                  d.source !== "partner" && ["off", "leave"].includes(d.type),
              ) &&
              events.some(
                (d) =>
                  d.source === "partner" && ["off", "leave"].includes(d.type),
              );
            return (
              <button
                key={key}
                className={`day-cell ${!current ? "outside" : ""} ${shared ? "shared" : ""} ${key === todayKey() ? "today" : ""}`}
                onClick={() => {
                  selectDate(key);
                  go("day");
                }}
                aria-label={`${key}, ${events.map(dutyLabel).join(", ")}`}
              >
                <span className={dow === 5 ? "sat" : dow === 6 ? "sun" : ""}>
                  {day}
                </span>
                {shared && <i className="tiny-heart">♥</i>}
                {events.slice(0, 2).map((event) => (
                  <em
                    className={`event-pill event-${event.type}`}
                    key={`${event.id}-${key}`}
                  >
                    {event.source === "partner" ? "♡ " : ""}
                    {calendarDutyLabel(event)}
                  </em>
                ))}
                {events.length > 2 && (
                  <small className="more-count desktop-more-count">
                    +{events.length - 2}
                  </small>
                )}
                {events.length > 1 && (
                  <small className="more-count mobile-more-count">
                    +{events.length - 1}
                  </small>
                )}
              </button>
            );
          })}
        </div>
        {!loading && allDuties.length === 0 && (
          <div className="calendar-empty">
            <strong>아직 등록된 일정이 없어요</strong>
            <span>아래 버튼으로 첫 일정을 추가해보세요.</span>
          </div>
        )}
        <button className="fab" onClick={() => go("duty")}>
          <span>＋</span>
          {role === "crew" ? "일정 추가" : "내 휴무 추가"}
        </button>
      </section>
      <BottomNav active="calendar" go={go} />
    </main>
  );
}

function DayDetail({
  date,
  duties,
  partnerDuties,
  back,
  add,
  remove,
}: {
  date: string;
  duties: Duty[];
  partnerDuties: Duty[];
  back: () => void;
  add: () => void;
  remove: (id: string) => Promise<void>;
}) {
  const mine = dutiesOnDate(duties, date);
  const peer = dutiesOnDate(partnerDuties, date);
  const shared =
    mine.some((d) => ["off", "leave"].includes(d.type)) &&
    peer.some((d) => ["off", "leave"].includes(d.type));
  const card = (duty: Duty, own: boolean) => (
    <article className={`saved-duty ${duty.type}`} key={duty.id}>
      <div>
        <Mark tone={["off", "leave"].includes(duty.type) ? "green" : "blue"}>
          {dutyLabels[duty.type]}
        </Mark>
        {own && (
          <button onClick={() => remove(duty.id)} aria-label="일정 삭제">
            삭제
          </button>
        )}
      </div>
      <strong>{dutyLabel(duty)}</strong>
      <span>
        {duty.type === "flight" ? formatLocalFlightRange(duty) : formatDutyRange(duty)}
      </span>
      {duty.type === "flight" && formatKoreanFlightRange(duty) && (
        <span className="korea-time">
          한국 시간 · {formatKoreanFlightRange(duty)}
        </span>
      )}
      {own && duty.note && <small>{duty.note}</small>}
    </article>
  );
  return (
    <main className="screen detail-screen">
      <TopBar title={formatKoreanDate(date)} onBack={back} />
      <section className="screen-body day-body">
        {shared && (
          <div className="shared-banner static">
            <span className="heart-calendar">♥</span>
            <strong>같은 날짜 휴무</strong>
          </div>
        )}
        <h2>내 일정</h2>
        {mine.length ? (
          mine.map((d) => card(d, true))
        ) : (
          <div className="empty-card">이 날 등록된 내 일정이 없어요.</div>
        )}
        <h2>친구 일정</h2>
        {peer.length ? (
          peer.map((d) => card(d, false))
        ) : (
          <div className="empty-card">공유된 친구 일정이 없어요.</div>
        )}
      </section>
      <div className="sticky-action">
        <button className="button button-outline" onClick={add}>
          ＋ 이 날 일정 추가
        </button>
      </div>
    </main>
  );
}

function DutyForm({
  role,
  selectedDate,
  back,
  save,
  quick,
}: {
  role: Role;
  selectedDate: string;
  back: () => void;
  save: (payload: DutyPayload, again: boolean) => Promise<void>;
  quick: () => void;
}) {
  const allowed: DutyType[] =
    role === "partner"
      ? ["off", "leave"]
      : ["flight", "standby", "off", "layover", "training", "leave"];
  const [type, setType] = useState<DutyType>(
    role === "partner" ? "off" : "flight",
  );
  const [startDate, setStartDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState(selectedDate);
  const [startAt, setStartAt] = useState(`${selectedDate}T09:00`);
  const [endAt, setEndAt] = useState(`${selectedDate}T17:00`);
  const [flightNo, setFlightNo] = useState("");
  const [dep, setDep] = useState("DOH");
  const [arr, setArr] = useState("");
  const [aircraft, setAircraft] = useState("");
  const [city, setCity] = useState("");
  const [hotel, setHotel] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const allDay = type === "off" || type === "leave";
  const departureBasis = /^[A-Z]{3}$/.test(dep) ? dep : "출발 공항";
  const arrivalBasis = /^[A-Z]{3}$/.test(arr) ? arr : "도착 공항";
  const submit = async (again: boolean) => {
    setSaving(true);
    try {
      await save(
        {
          type,
          startDate: allDay ? startDate : undefined,
          endDate: allDay ? endDate : undefined,
          startAt: allDay ? undefined : startAt,
          endAt: allDay ? undefined : endAt,
          flightNo,
          depAirport: dep,
          arrAirport: arr,
          aircraft,
          layoverCity: city,
          hotelName: hotel,
          note,
        },
        again,
      );
      if (again) {
        setFlightNo("");
        setArr("");
        setNote("");
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="screen form-screen duty-form-screen">
      <TopBar title="일정 추가" onBack={back} close />
      <section className="screen-body duty-body">
        <div className="duty-tabs">
          {allowed.map((item) => (
            <button
              key={item}
              onClick={() => setType(item)}
              className={type === item ? "active" : ""}
            >
              <span>{dutyIcons[item]}</span>
              {dutyLabels[item]}
            </button>
          ))}
        </div>
        {allDay ? (
          <div className="date-pair">
            <label className="field-label">
              시작일
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="field-label">
              종료일
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
        ) : (
          <>
            {type === "flight" && (
              <>
                <label className="field-label">
                  편명
                  <input
                    value={flightNo}
                    onChange={(e) => setFlightNo(e.target.value.toUpperCase())}
                    placeholder="예: QR858"
                  />
                </label>
                <div className="date-pair">
                  <label className="field-label">
                    출발 공항
                    <input
                      value={dep}
                      maxLength={3}
                      onChange={(e) => setDep(e.target.value.toUpperCase())}
                    />
                  </label>
                  <label className="field-label">
                    도착 공항
                    <input
                      value={arr}
                      maxLength={3}
                      onChange={(e) => setArr(e.target.value.toUpperCase())}
                      placeholder="ICN"
                    />
                  </label>
                </div>
                <div className="date-pair airport-time-pair">
                  <label className="field-label">
                    <span className="time-label-line">
                      출발 시각
                      <b>{departureBasis} 기준</b>
                    </span>
                    <input
                      type="datetime-local"
                      value={startAt}
                      aria-label={`${departureBasis} 기준 출발 시각`}
                      onChange={(e) => setStartAt(e.target.value)}
                    />
                  </label>
                  <label className="field-label">
                    <span className="time-label-line">
                      도착 시각
                      <b>{arrivalBasis} 기준</b>
                    </span>
                    <input
                      type="datetime-local"
                      value={endAt}
                      aria-label={`${arrivalBasis} 기준 도착 시각`}
                      onChange={(e) => setEndAt(e.target.value)}
                    />
                  </label>
                </div>
                <p className="airport-time-note">
                  ◷ 출발과 도착 시각은 각 공항의 현지 시각으로 저장돼요
                </p>
                <label className="field-label">
                  기종
                  <input
                    value={aircraft}
                    onChange={(e) => setAircraft(e.target.value)}
                    placeholder="예: Boeing 777-300ER"
                  />
                </label>
              </>
            )}
            {type !== "flight" && (
              <div className="date-pair">
                <label className="field-label">
                  시작 시각
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </label>
                <label className="field-label">
                  종료 시각
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </label>
              </div>
            )}
            {type === "layover" && (
              <>
                <label className="field-label">
                  체류 도시
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="예: 서울"
                  />
                </label>
                <label className="field-label">
                  호텔명
                  <input
                    value={hotel}
                    onChange={(e) => setHotel(e.target.value)}
                    placeholder="나에게만 표시됩니다"
                  />
                </label>
              </>
            )}
          </>
        )}
        <label className="field-label">
          메모
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="나만 볼 수 있어요"
          />
        </label>
        <p className="privacy-note">
          ▣ 기종, 호텔명, 메모는 친구에게 공유되지 않아요
        </p>
        {role === "crew" && (
          <button className="text-button" onClick={quick}>
            빠른 입력 옵션 보기 →
          </button>
        )}
      </section>
      <div className="dual-sticky">
        <button
          className="button button-ghost"
          disabled={saving}
          onClick={() => submit(true)}
        >
          저장 후 계속 등록
        </button>
        <button
          className="button button-primary"
          disabled={saving}
          onClick={() => submit(false)}
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </main>
  );
}

function QuickEntry({
  month,
  duties,
  back,
  create,
  roster,
  reset,
}: {
  month: string;
  duties: Duty[];
  back: () => void;
  create: () => void;
  roster: () => void;
  reset: () => Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const doReset = async () => {
    if (
      !window.confirm(
        `${formatMonth(month)} 일정 ${duties.length}건을 초기화할까요?`,
      )
    )
      return;
    setWorking(true);
    try {
      await reset();
    } finally {
      setWorking(false);
    }
  };
  return (
    <main className="screen form-screen">
      <TopBar title="빠른 입력" onBack={back} />
      <section className="screen-body quick-body">
        <div className="page-intro">
          <h1>이번 달 일정을 빠르게 등록하세요</h1>
          <p>자주 쓰는 방법을 선택하면 입력 시간을 줄일 수 있어요</p>
        </div>
        <button className="quick-card ai" onClick={roster}>
          <span>✦</span>
          <span>
            <strong>보안 로스터 PDF 분석</strong>
            <small>비행·휴무·대기·교육 일정을 한 번에 가져오기</small>
          </span>
          <b>›</b>
        </button>
        {[
          ["▱", "계속 등록", "저장 후 화면을 닫지 않고 다음 일정 입력"],
          ["▤", "기존 일정 복제", "최근 일정의 값을 참고해 새 일정 추가"],
          ["↻", "반복 일정 만들기", "같은 유형의 일정을 이어서 등록"],
        ].map(([icon, title, desc], index) => (
          <button
            className={`quick-card ${index === 0 ? "primary" : ""}`}
            key={title}
            onClick={create}
          >
            <span>{icon}</span>
            <span>
              <strong>{title}</strong>
              <small>{desc}</small>
            </span>
            <b>›</b>
          </button>
        ))}
        <button
          className="quick-card danger"
          disabled={working || duties.length === 0}
          onClick={doReset}
        >
          <span>♲</span>
          <span>
            <strong>{formatMonth(month)} 일정 초기화</strong>
            <small>현재 저장된 {duties.length}건을 확인 후 삭제</small>
          </span>
          <b>›</b>
        </button>
        <h2>최근 입력</h2>
        <div className="recent-list">
          {duties
            .slice(-3)
            .reverse()
            .map((duty) => (
              <div key={duty.id}>
                <span>
                  <strong>{dutyLabels[duty.type]}</strong> · {dutyLabel(duty)}
                </span>
                <button onClick={create}>참고</button>
              </div>
            ))}
          {duties.length === 0 && (
            <div>
              <span>최근 입력한 일정이 없어요.</span>
            </div>
          )}
        </div>
      </section>
      <div className="sticky-action">
        <button className="button button-primary" onClick={create}>
          새 일정 계속 등록
        </button>
      </div>
    </main>
  );
}

function RosterImport({
  back,
  importItems,
}: {
  back: () => void;
  importItems: (items: RosterItem[]) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<RosterAnalysis | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  const chooseFile = (next: File | null) => {
    setError("");
    setAnalysis(null);
    setSelected(new Set());
    if (!next) {
      setFile(null);
      return;
    }
    if (
      next.type !== "application/pdf" &&
      !next.name.toLowerCase().endsWith(".pdf")
    ) {
      setFile(null);
      setError("PDF 파일만 선택할 수 있어요.");
      return;
    }
    if (next.size > 12 * 1024 * 1024) {
      setFile(null);
      setError("PDF 크기는 12MB 이하여야 해요.");
      return;
    }
    setFile(next);
  };

  const analyze = async () => {
    if (!file || analyzing) return;
    setAnalyzing(true);
    setError("");
    try {
      const { analyzeRosterPdfLocally } = await import("./roster-local-parser");
      const localAnalysis = await analyzeRosterPdfLocally(file);
      setAnalysis(localAnalysis);
      setSelected(new Set(localAnalysis.items.map((item) => item.id)));
      setFile(null);
      setFileInputKey((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "PDF를 분석하지 못했어요.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const updateItem = (id: string, patch: Partial<RosterItem>) => {
    setAnalysis((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === id ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
  };

  const toggleItem = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitImport = async () => {
    if (!analysis || importing) return;
    const chosen = analysis.items.filter((item) => selected.has(item.id));
    if (chosen.length === 0) {
      setError("등록할 일정을 한 개 이상 선택해주세요.");
      return;
    }
    setImporting(true);
    setError("");
    try {
      await importItems(chosen);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "일정을 등록하지 못했어요.",
      );
    } finally {
      setImporting(false);
    }
  };

  const counts = analysis
    ? analysis.items.reduce<Record<string, number>>((acc, item) => {
        acc[item.type] = (acc[item.type] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  return (
    <main className="screen form-screen roster-screen">
      <TopBar title="보안 로스터 분석" onBack={back} />
      <section className="screen-body roster-body">
        <div className="page-intro">
          <h1>로스터 PDF를 일정으로 바꿔드려요</h1>
          <p>PDF를 기기 안에서 읽고 비행·휴무·교육만 안전하게 정리해요</p>
        </div>
        <label
          className={`roster-dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            chooseFile(event.dataTransfer.files[0] ?? null);
          }}
        >
          <input
            key={fileInputKey}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
          <span>{file ? "✓" : "PDF"}</span>
          <strong>{file ? file.name : "PDF를 선택하거나 여기에 놓으세요"}</strong>
          <small>
            {file
              ? `${(file.size / 1024).toFixed(0)}KB · 분석 준비 완료`
              : "최대 12MB · 항공사 로스터 PDF"}
          </small>
        </label>
        <div className="roster-privacy">
          <span>▣</span>
          <p>
            PDF 원본과 전체 텍스트는 서버나 AI로 전송하지 않아요. 기기에서
            날짜·비행 경로·휴무·교육만 추출하고 원본은 즉시 메모리에서 제거해요.
          </p>
        </div>
        {error && <p className="roster-error">{error}</p>}
        <button
          className="button button-primary roster-analyze-button"
          disabled={!file || analyzing}
          onClick={analyze}
        >
          {analyzing ? "기기에서 로스터를 읽는 중…" : "보안 분석 시작"}
        </button>
        {analyzing && (
          <div className="roster-progress" role="status">
            <span className="loading-spinner" />
            <span>
              <strong>기기 안에서 날짜 열을 읽고 있어요</strong>
              <small>원본 PDF는 외부로 전송되지 않아요.</small>
            </span>
          </div>
        )}

        {analysis && !analyzing && (
          <>
            <section className="roster-summary">
              <span>✦ 분석 완료</span>
              <h2>{analysis.summary}</h2>
              <p>
                {analysis.periodStart} - {analysis.periodEnd}
              </p>
              <small>{analysis.timezoneNote}</small>
              <div>
                {Object.entries(counts).map(([type, count]) => (
                  <em key={type}>
                    {dutyLabels[type as DutyType]} {count}
                  </em>
                ))}
              </div>
            </section>
            <div className="roster-list-heading">
              <span>
                <strong>등록할 일정</strong>
                <small>
                  {selected.size}/{analysis.items.length}개 선택
                </small>
              </span>
              <button
                onClick={() =>
                  setSelected(
                    selected.size === analysis.items.length
                      ? new Set()
                      : new Set(analysis.items.map((item) => item.id)),
                  )
                }
              >
                {selected.size === analysis.items.length ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            <div className="roster-items">
              {analysis.items.map((item) => {
                const isAllDay = item.type === "off" || item.type === "leave";
                const isEditing = editing === item.id;
                const confidence = Math.max(
                  0,
                  Math.min(100, Math.round(Number(item.confidence || 0) * 100)),
                );
                return (
                  <article
                    className={`roster-item ${selected.has(item.id) ? "selected" : ""}`}
                    key={item.id}
                  >
                    <div className="roster-item-head">
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                        />
                        <span>
                          <strong>
                            {dutyLabels[item.type]}
                            {item.type === "flight" &&
                              ` ${item.flightNo || ""} ${item.depAirport || "출발"} → ${item.arrAirport || "도착"}`}
                            {item.type === "layover" && ` ${item.layoverCity}`}
                          </strong>
                          <small>
                            {isAllDay
                              ? item.endDate
                                ? `${item.startDate} - ${item.endDate}`
                                : item.startDate
                              : item.endAt
                                ? `${item.startAt?.replace("T", " ")} - ${item.endAt.replace("T", " ")}`
                                : item.startAt?.replace("T", " ")}
                          </small>
                        </span>
                      </label>
                      <button onClick={() => setEditing(isEditing ? null : item.id)}>
                        {isEditing ? "닫기" : "수정"}
                      </button>
                    </div>
                    <div className="roster-item-meta">
                      <span>기기에서 추출</span>
                      <span className={confidence < 75 ? "low" : ""}>
                        신뢰도 {confidence}%
                      </span>
                    </div>
                    {item.note && <p>{item.note}</p>}
                    {isEditing && (
                      <div className="roster-editor">
                        <label className="field-label">
                          일정 유형
                          <select
                            className="select-field"
                            value={item.type}
                            onChange={(event) =>
                              updateItem(item.id, {
                                type: event.target.value as DutyType,
                              })
                            }
                          >
                            {Object.entries(dutyLabels).map(([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {isAllDay ? (
                          <div className="date-pair">
                            <label className="field-label">
                              시작일
                              <input
                                type="date"
                                value={item.startDate ?? ""}
                                onChange={(event) =>
                                  updateItem(item.id, { startDate: event.target.value })
                                }
                              />
                            </label>
                            <label className="field-label">
                              종료일
                              <input
                                type="date"
                                value={item.endDate ?? ""}
                                onChange={(event) =>
                                  updateItem(item.id, { endDate: event.target.value })
                                }
                              />
                            </label>
                          </div>
                        ) : (
                          <div className="date-pair">
                            <label className="field-label">
                              시작 시각
                              <input
                                type="datetime-local"
                                value={item.startAt ?? ""}
                                onChange={(event) =>
                                  updateItem(item.id, { startAt: event.target.value })
                                }
                              />
                            </label>
                            <label className="field-label">
                              종료 시각
                              <input
                                type="datetime-local"
                                value={item.endAt ?? ""}
                                onChange={(event) =>
                                  updateItem(item.id, { endAt: event.target.value })
                                }
                              />
                            </label>
                          </div>
                        )}
                        {item.type === "flight" && (
                          <>
                            <label className="field-label">
                              편명
                              <input
                                maxLength={12}
                                value={item.flightNo ?? ""}
                                onChange={(event) =>
                                  updateItem(item.id, {
                                    flightNo: event.target.value.toUpperCase(),
                                  })
                                }
                              />
                            </label>
                            <div className="date-pair">
                              <label className="field-label">
                                출발 공항
                                <input
                                  maxLength={3}
                                  value={item.depAirport ?? ""}
                                  onChange={(event) =>
                                    updateItem(item.id, {
                                      depAirport: event.target.value.toUpperCase(),
                                    })
                                  }
                                />
                              </label>
                              <label className="field-label">
                                도착 공항
                                <input
                                  maxLength={3}
                                  value={item.arrAirport ?? ""}
                                  onChange={(event) =>
                                    updateItem(item.id, {
                                      arrAirport: event.target.value.toUpperCase(),
                                    })
                                  }
                                />
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
      {analysis && !analyzing && (
        <div className="sticky-action">
          <button
            className="button button-primary"
            disabled={selected.size === 0 || importing}
            onClick={submitImport}
          >
            {importing ? "일정을 등록하는 중…" : `선택한 ${selected.size}개 일정 등록`}
          </button>
        </div>
      )}
    </main>
  );
}

function FriendPage({
  partner,
  subscription,
  month,
  go,
  createInvite,
  acceptInvite,
  removeFriend,
  blockFriend,
  changeMonth,
  toast,
}: {
  partner: PartnerState;
  subscription: Subscription;
  month: string;
  go: (s: Screen) => void;
  createInvite: () => Promise<{ code: string; expiresAt: string }>;
  acceptInvite: (code: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  blockFriend: (friendId: string) => Promise<void>;
  changeMonth: (delta: number) => void;
  toast: (m: string) => void;
}) {
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const atFreeFriendLimit =
    subscription.plan !== "pro" && partner.friends.length >= freeFriendLimit;
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(
    partner.friends[0]?.user_id ?? null,
  );
  const selectedFriend =
    partner.friends.find((friend) => friend.user_id === selectedFriendId) ??
    partner.friends[0] ??
    null;
  const selectedDuties = selectedFriend
    ? partner.friendDuties.filter((duty) => duty.user_id === selectedFriend.user_id)
    : [];
  const cells = useMemo(() => {
    const [year, mon] = month.split("-").map(Number);
    const first = new Date(year, mon - 1, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(year, mon - 1, 1 - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        key: dateKey(date),
        day: date.getDate(),
        current: date.getMonth() === mon - 1,
        index,
      };
    });
  }, [month]);
  const create = async () => {
    setBusy(true);
    try {
      setIssued(await createInvite());
    } finally {
      setBusy(false);
    }
  };
  const accept = async () => {
    setBusy(true);
    try {
      await acceptInvite(code);
      setCode("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="screen form-screen link-screen">
      <TopBar title="친구" onBack={() => go("calendar")} />
      <section className="screen-body link-body">
        <div className="page-intro friend-intro">
          <span>
            <h1>친구 시간표</h1>
            <p>등록된 친구를 누르면 이번 달 일정을 볼 수 있어요</p>
          </span>
          <b>{subscription.plan === "pro" ? `${partner.friends.length}명` : `${partner.friends.length}/${freeFriendLimit}`}</b>
        </div>

        {partner.friends.length ? (
          <div className="friend-list" aria-label="등록된 친구">
            {partner.friends.map((friend) => (
              <button
                className={friend.user_id === selectedFriend?.user_id ? "active" : ""}
                key={friend.user_id}
                onClick={() => setSelectedFriendId(friend.user_id)}
              >
                <span className="avatar avatar-medium">{friend.display_name.slice(0, 1)}</span>
                <span>
                  <strong>{friend.display_name}</strong>
                  <small>
                    {friend.role === "crew"
                      ? `${friend.airline ?? "승무원"}${friend.base_airport ? ` · ${friend.base_airport}` : ""}`
                      : "친구"}
                  </small>
                </span>
                <b>›</b>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-card">아직 등록된 친구가 없어요. 초대 코드로 첫 친구를 추가해보세요.</div>
        )}

        {selectedFriend && (
          <section className="friend-calendar-card">
            <div className="friend-calendar-heading">
              <span>
                <strong>{selectedFriend.display_name}님의 시간표</strong>
                <small>{formatMonth(month)}</small>
              </span>
              <div className="friend-actions">
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm(`${selectedFriend.display_name}님을 친구에서 삭제할까요?`)) return;
                    setBusy(true);
                    try {
                      await removeFriend(selectedFriend.user_id);
                      setSelectedFriendId(null);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  삭제
                </button>
                <button
                  className="block-friend-button"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm(`${selectedFriend.display_name}님을 차단할까요? 서로의 일정이 보이지 않고 다시 친구 등록할 수 없어요.`)) return;
                    setBusy(true);
                    try {
                      await blockFriend(selectedFriend.user_id);
                      setSelectedFriendId(null);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  차단
                </button>
              </div>
            </div>
            <div className="month-toolbar friend-month-toolbar">
              <button aria-label="이전 달" onClick={() => changeMonth(-1)}>‹</button>
              <h2>{formatMonth(month)}</h2>
              <button aria-label="다음 달" onClick={() => changeMonth(1)}>›</button>
              <button className="today-button" onClick={() => changeMonth(0)}>오늘</button>
            </div>
            <div className="weekday-row">
              {["월", "화", "수", "목", "금", "토", "일"].map((day, index) => (
                <span className={index === 5 ? "sat" : index === 6 ? "sun" : ""} key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-grid friend-calendar-grid">
              {cells.map(({ key, day, current, index }) => {
                const events = dutiesOnDate(selectedDuties, key);
                return (
                  <div className={`day-cell ${!current ? "outside" : ""} ${key === todayKey() ? "today" : ""}`} key={key}>
                    <span className={index % 7 === 5 ? "sat" : index % 7 === 6 ? "sun" : ""}>{day}</span>
                    {events.slice(0, 1).map((event) => (
                      <em className={`event-pill event-${event.type}`} key={`${event.id}-${key}`}>{calendarDutyLabel(event)}</em>
                    ))}
                    {events.length > 1 && <small className="more-count">+{events.length - 1}</small>}
                  </div>
                );
              })}
            </div>
            <div className="friend-schedule-list">
              {selectedDuties.length ? selectedDuties.map((duty) => (
                <article className={`saved-duty ${duty.type}`} key={duty.id}>
                  <div><Mark tone={["off", "leave"].includes(duty.type) ? "green" : "blue"}>{dutyLabels[duty.type]}</Mark></div>
                  <strong>{dutyLabel(duty)}</strong>
                  <span>{duty.type === "flight" ? formatLocalFlightRange(duty) : formatDutyRange(duty)}</span>
                  {duty.type === "flight" && formatKoreanFlightRange(duty) && (
                    <span className="korea-time">한국 시간 · {formatKoreanFlightRange(duty)}</span>
                  )}
                </article>
              )) : <div className="empty-card">이번 달에 공유된 일정이 없어요.</div>}
            </div>
          </section>
        )}

        <section className="friend-add-card">
          <h2>친구 등록</h2>
          <p>
            {atFreeFriendLimit
              ? "무료 플랜의 친구 5명 한도에 도달했어요. Pro에서는 무제한으로 등록할 수 있어요."
              : "내 코드를 공유하거나 친구에게 받은 코드를 입력하세요."}
          </p>
          {atFreeFriendLimit && (
            <button className="button button-primary friend-upgrade-button" onClick={() => go("pro")}>
              Pro로 친구 무제한 등록하기
            </button>
          )}
          {!atFreeFriendLimit && <>
          {issued ? (
            <article className="invite-card">
              <span>내 초대 코드</span>
              <strong>{issued.code}</strong>
              <p>{new Date(issued.expiresAt).toLocaleDateString("ko-KR")}까지</p>
              <div>
                <button onClick={() => { navigator.clipboard.writeText(issued.code); toast("초대 코드를 복사했어요"); }}>▤ 복사</button>
                <button onClick={() => {
                  if (navigator.share) navigator.share({ title: "CrewSync 친구 초대", text: issued.code });
                  else navigator.clipboard.writeText(issued.code);
                }}>⇧ 공유</button>
              </div>
            </article>
          ) : (
            <button className="button button-outline" disabled={busy} onClick={create}>내 초대 코드 만들기</button>
          )}
          <div className="code-divider"><span />친구 코드 입력<span /></div>
          <input
            className="code-input"
            value={code}
            maxLength={9}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").replace(/(.{4})/, "$1-").slice(0, 9))}
            placeholder="ABCD-EFGH"
            aria-label="친구 초대 코드"
          />
          <button className="button button-primary" disabled={code.length < 9 || busy} onClick={accept}>친구 등록하기</button>
          </>}
        </section>

        <article className="share-info">
          <h2>친구에게 공유되는 정보</h2>
          <p>✓ 비행 날짜와 출발·도착 공항</p>
          <p>✓ 출발·도착 현지 시각과 한국 시각</p>
          <p>✓ 휴무·교육 등 일정 유형</p>
          <div>▣ 기종, 호텔명, 메모는 공유되지 않아요</div>
        </article>
      </section>
      <BottomNav active="link" go={go} />
    </main>
  );
}

function Toggle({
  on,
  setOn,
  label,
  disabled = false,
}: {
  on: boolean;
  setOn: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${on ? "on" : ""}`}
      onClick={() => setOn(!on)}
    >
      <span />
    </button>
  );
}
function SettingIcon({ children }: { children: ReactNode }) {
  return <span className="setting-icon">{children}</span>;
}
function base64UrlToBytes(value: string) {
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
function NotificationSettings({
  value,
  go,
  save,
}: {
  value: NotificationState;
  go: (s: Screen) => void;
  save: (value: NotificationState) => Promise<void>;
}) {
  const [settings, setSettings] = useState(value);
  const [saving, setSaving] = useState(false);
  const [pushStatus, setPushStatus] = useState<
    "checking" | "unsupported" | "default" | "denied" | "enabled"
  >("checking");
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (active) setPushStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setPushStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/crew-sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await requestJson("/api/push", {
          method: "POST",
          body: JSON.stringify(subscription.toJSON()),
        });
      }
      if (active) setPushStatus(subscription ? "enabled" : "default");
    })().catch(() => {
      if (active) setPushStatus("unsupported");
    });
    return () => {
      active = false;
    };
  }, []);
  const enablePush = async () => {
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus(permission === "denied" ? "denied" : "default");
        return;
      }
      const state = await requestJson<{ publicKey: string }>("/api/push");
      const registration = await navigator.serviceWorker.register("/crew-sw.js");
      let subscription = await registration.pushManager.getSubscription();
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(state.publicKey),
      });
      await requestJson("/api/push", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      setPushStatus("enabled");
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "알림을 연결하지 못했어요.",
      );
    } finally {
      setPushBusy(false);
    }
  };
  const testPush = async () => {
    setPushBusy(true);
    try {
      const result = await requestJson<{ sent: number }>("/api/push", {
        method: "POST",
        body: JSON.stringify({ action: "test" }),
      });
      if (!result.sent) throw new Error("연결된 알림 기기를 찾지 못했어요.");
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "테스트 알림을 보내지 못했어요.",
      );
    } finally {
      setPushBusy(false);
    }
  };
  const update = async (key: keyof NotificationState, next: boolean) => {
    const previous = settings;
    const changed = { ...settings, [key]: next };
    setSettings(changed);
    setSaving(true);
    try {
      await save(changed);
    } catch {
      setSettings(previous);
    } finally {
      setSaving(false);
    }
  };
  const rows: [keyof NotificationState, string, string, string][] = [
    ["mine", "✈", "내 비행 3시간 전", "내 출발 일정을 미리 알려드려요"],
    ["partnerPre", "⌁", "친구 비행 3시간 전", "친구의 비행 시작 전 알림"],
    [
      "partnerPost",
      "⌁",
      "친구 비행 종료 예정",
      "도착 확정이 아닌 예정 시각 안내",
    ],
  ];
  return (
    <main className="screen form-screen notifications-screen">
      <TopBar title="알림 설정" onBack={() => go("settings")} />
      <section className="screen-body settings-body">
        <div className={`push-setup-card ${pushStatus === "enabled" ? "enabled" : ""}`}>
          <SettingIcon>♧</SettingIcon>
          <span>
            <strong>
              {pushStatus === "enabled" ? "휴대폰 알림 연결됨" : "휴대폰 알림 받기"}
            </strong>
            <small>
              {pushStatus === "unsupported"
                ? "아이폰은 홈 화면에 추가한 뒤 알림을 켜주세요"
                : pushStatus === "denied"
                  ? "브라우저 설정에서 알림 권한을 허용해주세요"
                  : pushStatus === "enabled"
                    ? "앱을 닫아도 일정 알림을 받을 수 있어요"
                    : "한 번만 허용하면 이 기기로 알려드려요"}
            </small>
          </span>
          {pushStatus === "enabled" ? (
            <button disabled={pushBusy} onClick={testPush}>
              테스트
            </button>
          ) : (
            <button
              disabled={
                pushBusy ||
                ["checking", "unsupported", "denied"].includes(pushStatus)
              }
              onClick={enablePush}
            >
              {pushBusy ? "연결 중" : "알림 켜기"}
            </button>
          )}
        </div>
        <div className="setting-card single">
          <SettingIcon>●</SettingIcon>
          <span>
            <strong>전체 알림</strong>
            <small>{saving ? "저장 중…" : "CrewSync의 모든 알림"}</small>
          </span>
          <Toggle
            label="전체 알림"
            on={settings.all}
            setOn={(v) => update("all", v)}
          />
        </div>
        <h2>비행 알림</h2>
        <div className="setting-card grouped">
          {rows.map(([key, icon, title, sub]) => (
            <div className="setting-row" key={key}>
              <SettingIcon>{icon}</SettingIcon>
              <span>
                <strong>{title}</strong>
                <small>{sub}</small>
              </span>
              <Toggle
                disabled={!settings.all}
                label={title}
                on={Boolean(settings[key])}
                setOn={(v) => update(key, v)}
              />
            </div>
          ))}
        </div>
        <h2>일정 알림</h2>
        <div className="setting-card grouped">
          <div className="setting-row">
            <SettingIcon>▦</SettingIcon>
            <span>
              <strong>로스터 변경</strong>
              <small>상대 일정이 변경되면 알려드려요</small>
            </span>
            <Toggle
              disabled={!settings.all}
              label="로스터 변경"
              on={settings.roster}
              setOn={(v) => update("roster", v)}
            />
          </div>
          <div className="setting-row">
            <SettingIcon>♥</SettingIcon>
            <span>
              <strong>같은 날짜 휴무 D-1</strong>
              <small>전날 오전 9시에 알려드려요</small>
            </span>
            <Toggle
              disabled={!settings.all}
              label="같은 날짜 휴무"
              on={settings.shared}
              setOn={(v) => update("shared", v)}
            />
          </div>
        </div>
        <h2>개인정보 보호</h2>
        <div className="setting-card single privacy-setting">
          <SettingIcon>▣</SettingIcon>
          <span>
            <strong>잠금화면 상세 숨기기</strong>
            <small>알림 내용을 ‘새 알림이 있어요’로 표시</small>
          </span>
          <Toggle
            label="잠금화면 상세 숨기기"
            on={settings.private}
            setOn={(v) => update("private", v)}
          />
        </div>
        <div className="setting-card timezone-row">
          <SettingIcon>◷</SettingIcon>
          <span>
            <strong>알림 기준 시간대</strong>
          </span>
          <em>자동 · 기기 시간대</em>
        </div>
      </section>
      <BottomNav active="settings" go={go} />
    </main>
  );
}

function ProPage({
  subscription,
  back,
  notify,
}: {
  subscription: Subscription;
  back: () => void;
  notify: (message: string) => void;
}) {
  const isPro = subscription.plan === "pro";
  return (
    <main className="screen form-screen pro-screen">
      <TopBar title="CrewSync Pro" onBack={back} />
      <section className="screen-body pro-body">
        <div className="pro-hero">
          <span>✦</span>
          <h1>{isPro ? "CrewSync Pro 이용 중" : "일정을 더 여유롭게"}</h1>
          <p>{isPro ? "모든 Pro 기능이 활성화되어 있어요." : "친구와 비행시간을 더 편하게 관리하세요."}</p>
        </div>
        <article className="pro-plan-card">
          <span>CREWSYNC PRO</span>
          <strong>월 3,900원</strong>
          <small>언제든 스토어에서 해지할 수 있어요</small>
        </article>
        <section className="pro-benefit-list">
          <p>✓ 친구 무제한 등록</p>
          <p>✓ 이번 달 비행시간·진행률 통계</p>
          <p>✓ PDF 로스터 분석 및 고급 알림 혜택</p>
        </section>
        {isPro ? (
          <button className="button button-outline" onClick={back}>계속 사용하기</button>
        ) : (
          <button
            className="button button-primary"
            onClick={() => notify("스토어 결제 연결을 준비 중이에요. 연결 후 이 화면에서 바로 구독할 수 있어요.")}
          >
            Pro 구독하기
          </button>
        )}
        <p className="pro-footnote">구독 권한은 결제 완료 뒤 서버에서 확인되어 안전하게 적용됩니다.</p>
      </section>
    </main>
  );
}

function BlockedListPage({
  blocked,
  back,
  unblock,
}: {
  blocked: BlockedUser[];
  back: () => void;
  unblock: (userId: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  return (
    <main className="screen form-screen">
      <TopBar title="차단 목록" onBack={back} />
      <section className="screen-body detail-settings-body">
        <div className="setting-page-intro">
          <h1>차단한 사용자</h1>
          <p>차단한 사용자와는 일정이 공유되지 않고 친구로 다시 등록할 수 없어요.</p>
        </div>
        {blocked.length ? (
          <div className="blocked-list">
            {blocked.map((user) => (
              <article key={user.user_id}>
                <span className="avatar avatar-medium">{user.display_name.slice(0, 1)}</span>
                <span>
                  <strong>{user.display_name}</strong>
                  <small>{[user.airline, user.base_airport].filter(Boolean).join(" · ") || "CrewSync 사용자"}</small>
                </span>
                <button
                  disabled={busyId === user.user_id}
                  onClick={async () => {
                    setBusyId(user.user_id);
                    try { await unblock(user.user_id); } finally { setBusyId(null); }
                  }}
                >
                  {busyId === user.user_id ? "처리 중" : "차단 해제"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-card">차단한 사용자가 없어요.</div>
        )}
      </section>
    </main>
  );
}

const timezoneOptions = [
  ["Asia/Qatar", "도하", "UTC+3"],
  ["Asia/Seoul", "서울", "UTC+9"],
  ["Europe/London", "런던", "UTC±0"],
  ["Europe/Paris", "파리", "UTC+1"],
  ["America/New_York", "뉴욕", "UTC-5"],
  ["Asia/Tokyo", "도쿄", "UTC+9"],
] as const;

function TimezonePage({
  value,
  back,
  save,
}: {
  value: string;
  back: () => void;
  save: (timezone: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(value);
  const [busy, setBusy] = useState(false);
  return (
    <main className="screen form-screen">
      <TopBar title="일정 기준 시간대" onBack={back} />
      <section className="screen-body detail-settings-body">
        <div className="setting-page-intro">
          <h1>기준 도시를 선택하세요</h1>
          <p>휴무 날짜와 일정의 기본 표시 기준으로 사용해요. 비행 출발·도착 시간은 각 공항 현지 시간을 그대로 유지합니다.</p>
        </div>
        <div className="choice-list">
          {timezoneOptions.map(([timezone, city, offset]) => (
            <button className={selected === timezone ? "selected" : ""} key={timezone} onClick={() => setSelected(timezone)}>
              <span><strong>{city}</strong><small>{timezone}</small></span>
              <em>{offset}</em>
              <b>{selected === timezone ? "✓" : ""}</b>
            </button>
          ))}
        </div>
        <button
          className="button button-primary"
          disabled={busy || selected === value}
          onClick={async () => {
            setBusy(true);
            try { await save(selected); } finally { setBusy(false); }
          }}
        >
          {busy ? "저장 중" : "시간대 저장"}
        </button>
      </section>
    </main>
  );
}

function AccessibilityPage({
  value,
  back,
  save,
}: {
  value: DisplayPreferences;
  back: () => void;
  save: (value: DisplayPreferences) => void;
}) {
  const update = <K extends keyof DisplayPreferences>(key: K, next: DisplayPreferences[K]) =>
    save({ ...value, [key]: next });
  return (
    <main className="screen form-screen">
      <TopBar title="화면 및 접근성" onBack={back} />
      <section className="screen-body detail-settings-body">
        <div className="setting-page-intro">
          <h1>편한 화면으로 조정하세요</h1>
          <p>이 설정은 현재 기기에 저장돼요.</p>
        </div>
        <h2>글자 크기</h2>
        <div className="segmented-control" role="group" aria-label="글자 크기">
          <button className={value.textSize === "normal" ? "active" : ""} onClick={() => update("textSize", "normal")}>기본</button>
          <button className={value.textSize === "large" ? "active" : ""} onClick={() => update("textSize", "large")}>크게</button>
        </div>
        <div className="setting-card grouped accessibility-options">
          <div className="setting-row">
            <SettingIcon>◐</SettingIcon>
            <span><strong>고대비 표시</strong><small>글자와 테두리를 더 선명하게 표시</small></span>
            <Toggle label="고대비 표시" on={value.highContrast} setOn={(next) => update("highContrast", next)} />
          </div>
          <div className="setting-row">
            <SettingIcon>◌</SettingIcon>
            <span><strong>움직임 줄이기</strong><small>화면 전환과 애니메이션 최소화</small></span>
            <Toggle label="움직임 줄이기" on={value.reduceMotion} setOn={(next) => update("reduceMotion", next)} />
          </div>
        </div>
      </section>
    </main>
  );
}

function InformationPage({
  kind,
  back,
}: {
  kind: "terms" | "privacy";
  back: () => void;
}) {
  const privacy = kind === "privacy";
  return (
    <main className="screen form-screen info-document-screen">
      <TopBar title={privacy ? "개인정보처리방침" : "이용약관"} onBack={back} />
      <article className="screen-body info-document">
        <p className="document-date">시행일: 2026년 8월 8일</p>
        <h1>{privacy ? "CrewSync 개인정보처리방침" : "CrewSync 이용약관"}</h1>
        {privacy ? (
          <>
            <h2>1. 처리하는 정보</h2><p>계정 식별정보, 표시 이름, 항공사·베이스 공항, 일정 및 친구 연결 정보를 서비스 제공에 필요한 범위에서 처리합니다.</p>
            <h2>2. 로스터 PDF</h2><p>원본 PDF는 사용자의 브라우저 안에서만 읽고 서버로 전송하지 않습니다. 사용자가 확인하고 등록한 최소 일정 데이터만 저장합니다.</p>
            <h2>3. 친구 공유</h2><p>친구에게는 비행 여부, 출발·도착 공항과 시각, 휴무·교육 등 허용된 일정만 공유합니다. 기종, 호텔명, 개인 메모는 공유하지 않습니다.</p>
            <h2>4. 결제 정보</h2><p>구독 결제는 Google Play, Apple 및 RevenueCat이 처리하며 CrewSync는 카드번호를 직접 저장하지 않습니다. 구독 상태와 만료일만 저장할 수 있습니다.</p>
            <h2>5. 보관 및 삭제</h2><p>계정 삭제 요청 시 공유를 즉시 중단하고 복구 기간 이후 계정과 저장 데이터를 삭제합니다. 법령상 보관 의무가 있는 정보는 해당 기간 동안 분리 보관할 수 있습니다.</p>
            <h2>6. 문의</h2><p>개인정보 관련 문의는 jhjdev1115@gmail.com으로 보내주세요.</p>
          </>
        ) : (
          <>
            <h2>1. 서비스 목적</h2><p>CrewSync는 승무원 일정 등록, 로스터 분석, 친구 간 일정 공유와 알림 기능을 제공합니다.</p>
            <h2>2. 사용자 책임</h2><p>사용자는 업로드하거나 입력하는 로스터와 일정 정보를 이용할 권한이 있어야 하며, 회사 규정과 비밀유지 의무를 준수해야 합니다.</p>
            <h2>3. 일정 정보</h2><p>자동 분석 결과와 항공편 정보에는 오류가 있을 수 있으므로 실제 근무 전 공식 로스터와 항공사 안내를 확인해야 합니다.</p>
            <h2>4. Pro 구독</h2><p>Pro 기능은 스토어에 표시된 기간과 가격으로 자동 갱신될 수 있습니다. 해지하더라도 현재 결제 기간까지 이용할 수 있으며 환불은 각 스토어 정책을 따릅니다.</p>
            <h2>5. 금지 행위</h2><p>타인의 계정·초대 코드 무단 사용, 서비스 방해, 불법 정보 저장 및 다른 사용자의 개인정보 침해를 금지합니다.</p>
            <h2>6. 계정 종료</h2><p>사용자는 설정에서 계정 삭제를 요청할 수 있습니다. 중대한 약관 위반이나 서비스 악용이 확인되면 이용이 제한될 수 있습니다.</p>
          </>
        )}
      </article>
    </main>
  );
}

function HelpPage({ back }: { back: () => void }) {
  return (
    <main className="screen form-screen">
      <TopBar title="도움말 및 문의" onBack={back} />
      <section className="screen-body detail-settings-body help-body">
        <div className="setting-page-intro"><h1>무엇을 도와드릴까요?</h1><p>자주 묻는 내용을 확인하거나 이메일로 문의할 수 있어요.</p></div>
        <details><summary>PDF가 분석되지 않아요</summary><p>텍스트가 포함된 원본 로스터 PDF를 선택해 주세요. 이미지로만 된 PDF는 일부 항목을 인식하지 못할 수 있습니다.</p></details>
        <details><summary>친구 일정이 갱신되지 않아요</summary><p>화면을 다시 열거나 새로고침해 주세요. 차단 여부와 친구 연결 상태도 확인해 주세요.</p></details>
        <details><summary>알림이 오지 않아요</summary><p>설정의 알림 항목과 휴대폰 브라우저 또는 앱의 알림 권한이 모두 켜져 있어야 합니다.</p></details>
        <details><summary>구독을 복원하고 싶어요</summary><p>스토어 결제가 연결된 앱 버전에서는 Pro 화면의 구매 복원 기능으로 동일한 Google 또는 Apple 계정의 구독을 복원할 수 있습니다.</p></details>
        <a className="button button-primary support-link" href="mailto:jhjdev1115@gmail.com?subject=CrewSync%20문의">이메일 문의하기</a>
        <small className="support-email">jhjdev1115@gmail.com</small>
      </section>
    </main>
  );
}

function AboutPage({ back, notify }: { back: () => void; notify: (message: string) => void }) {
  return (
    <main className="screen form-screen">
      <TopBar title="앱 정보" onBack={back} />
      <section className="screen-body detail-settings-body about-body">
        <Logo />
        <h1>버전 1.0.0</h1>
        <p>승무원과 친구의 일정을 안전하고 간편하게 공유하는 캘린더입니다.</p>
        <button className="button button-outline" onClick={() => notify("현재 최신 버전을 사용하고 있어요.")}>업데이트 확인</button>
        <small>© 2026 CrewSync</small>
      </section>
    </main>
  );
}

function Settings({
  profile,
  partner,
  subscription,
  blockedCount,
  go,
  logout,
}: {
  profile: Profile;
  partner: PartnerState;
  subscription: Subscription;
  blockedCount: number;
  go: (s: Screen) => void;
  logout: () => void;
}) {
  const section = (
    title: string,
    rows: {
      icon: string;
      label: string;
      value?: string;
      action?: () => void;
    }[],
  ) => (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-list">
        {rows.map((row) => (
          <button key={row.label} onClick={row.action}>
            <span className="line-icon">{row.icon}</span>
            <strong>{row.label}</strong>
            {row.value && <em>{row.value}</em>}
            <b>›</b>
          </button>
        ))}
      </div>
    </section>
  );
  return (
    <main className="screen form-screen settings-screen">
      <header className="title-only">
        <h1>설정</h1>
      </header>
      <section className="screen-body settings-page-body">
        <article className="profile-summary">
          <div className="avatar avatar-large">
            {profile.display_name.slice(0, 1)}
          </div>
          <span>
            <strong>{profile.display_name}</strong>
            <small>
              {profile.role === "crew"
                ? `${profile.airline} · ${profile.base_airport}`
                : profile.schedule_tz}
            </small>
          </span>
          <button onClick={() => go("profile")}>프로필 수정</button>
        </article>
        {section("구독", [
          {
            icon: "✦",
            label: "CrewSync Pro",
            value: subscription.plan === "pro" ? "이용 중" : "무료 플랜",
            action: () => go("pro"),
          },
        ])}
        {section("친구", [
          {
            icon: "↗",
            label: "친구 관리",
            value: partner.friends.length
              ? `${partner.friends.length}${subscription.plan === "pro" ? "명 등록됨" : `/${freeFriendLimit}명`}`
              : "등록된 친구 없음",
            action: () => go("link"),
          },
          { icon: "♙", label: "차단 목록", value: `${blockedCount}명`, action: () => go("blocked") },
        ])}
        {section("앱 설정", [
          { icon: "♧", label: "알림 설정", action: () => go("notifications") },
          { icon: "◷", label: "일정 기준 시간대", value: profile.schedule_tz, action: () => go("timezone") },
          { icon: "◎", label: "화면 및 접근성", action: () => go("accessibility") },
        ])}
        {section("정보 및 지원", [
          { icon: "□", label: "이용약관", action: () => go("terms") },
          { icon: "♢", label: "개인정보처리방침", action: () => go("privacy") },
          { icon: "?", label: "도움말 및 문의", action: () => go("help") },
          { icon: "ⓘ", label: "앱 버전", value: "1.0.0", action: () => go("about") },
        ])}
        <button className="logout-button" onClick={logout}>
          로그아웃
        </button>
        <button className="delete-row" onClick={() => go("delete")}>
          <span>♲</span>
          <span>
            <strong>계정 삭제</strong>
            <small>계정과 저장된 데이터를 삭제합니다</small>
          </span>
          <b>›</b>
        </button>
      </section>
      <BottomNav active="settings" go={go} />
    </main>
  );
}

function AccountDelete({
  back,
  done,
}: {
  back: () => void;
  done: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const enabled = confirm.trim() === "계정 삭제" && checked;
  const submit = async () => {
    setBusy(true);
    try {
      await done();
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="screen form-screen delete-screen">
      <TopBar title="계정 삭제" onBack={back} close />
      <section className="screen-body delete-body">
        <div className="delete-shield">▣</div>
        <div className="page-intro centered">
          <h1>정말 계정을 삭제할까요?</h1>
          <p>
            삭제를 요청하면 즉시 일정 공유가 중단되고
            <br />
            30일 후 계정과 데이터가 완전히 삭제돼요
          </p>
        </div>
        <div className="danger-info">
          <p>✓ 모든 친구 연결이 즉시 해제돼요</p>
          <p>✓ 초대 코드와 예약 알림이 취소돼요</p>
          <p>✓ 30일 동안 지원을 통해 복원을 요청할 수 있어요</p>
        </div>
        <div className="backup-info">
          <span>☁</span>
          <span>
            <strong>백업 데이터 안내</strong>
            <small>
              백업을 포함한 데이터 제거에는 최대 37일이 걸릴 수 있어요
            </small>
          </span>
        </div>
        <label className="field-label">
          확인을 위해 ‘계정 삭제’를 입력하세요
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="계정 삭제"
          />
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>위 내용을 확인했어요</span>
        </label>
        <button
          className="button button-danger"
          disabled={!enabled || busy}
          onClick={submit}
        >
          {busy ? "요청 중…" : "삭제 요청하기"}
        </button>
        <button className="button button-ghost" onClick={back}>
          취소
        </button>
      </section>
    </main>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [ready, setReady] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [role, setRole] = useState<Role>("crew");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [partner, setPartner] = useState<PartnerState>({
    invite: null,
    friends: [],
    friendDuties: [],
  });
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [displayPreferences, setDisplayPreferences] =
    useState<DisplayPreferences>(() => {
      if (typeof window === "undefined") return defaultDisplayPreferences;
      try {
        const stored = window.localStorage.getItem("crewsync-display-preferences");
        return stored
          ? { ...defaultDisplayPreferences, ...JSON.parse(stored) }
          : defaultDisplayPreferences;
      } catch {
        return defaultDisplayPreferences;
      }
    });
  const [notifications, setNotifications] =
    useState<NotificationState>(defaultNotifications);
  const [subscription, setSubscription] = useState<Subscription>({
    plan: "free",
    status: "active",
    provider: null,
    productId: null,
    currentPeriodEnd: null,
  });
  const [currentMonth, setCurrentMonth] = useState(monthKey());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [loadingDuties, setLoadingDuties] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }, []);
  const go = useCallback((next: Screen) => {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const loadMonth = useCallback(
    async (month: string, options: { silent?: boolean } = {}) => {
      if (!options.silent) setLoadingDuties(true);
      try {
        const data = await requestJson<{ duties: Duty[] }>(
          `/api/duties?month=${month}`,
        );
        setDuties(data.duties.map((d) => ({ ...d, source: "mine" })));
      } catch (error) {
        if (!options.silent)
          notify(
            error instanceof Error ? error.message : "일정을 불러오지 못했어요.",
          );
      } finally {
        if (!options.silent) setLoadingDuties(false);
      }
    },
    [notify],
  );
  const loadPartner = useCallback(async (options: { silent?: boolean } = {}) => {
    try {
      const data = await requestJson<PartnerState>(`/api/invites?month=${currentMonth}`);
      setPartner({
        ...data,
        friends: data.friends ?? [],
        friendDuties: (data.friendDuties ?? []).map((d) => ({
          ...d,
          source: "partner",
        })),
      });
    } catch (error) {
      if (!options.silent)
        notify(
          error instanceof Error
            ? error.message
            : "친구 정보를 불러오지 못했어요.",
        );
    }
  }, [currentMonth, notify]);
  const loadBlockedUsers = useCallback(async () => {
    const data = await requestJson<{ blocked: BlockedUser[] }>("/api/blocks");
    setBlockedUsers(data.blocked ?? []);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = displayPreferences.textSize;
    root.dataset.highContrast = String(displayPreferences.highContrast);
    root.dataset.reduceMotion = String(displayPreferences.reduceMotion);
    window.localStorage.setItem(
      "crewsync-display-preferences",
      JSON.stringify(displayPreferences),
    );
  }, [displayPreferences]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [profileData, notificationData, partnerData, subscriptionData, blockedData] = await Promise.all([
          requestJson<{ profile: Profile }>("/api/profile"),
          requestJson<{ settings: NotificationState }>("/api/notifications"),
          requestJson<PartnerState>(`/api/invites?month=${monthKey()}`),
          requestJson<{ subscription: Subscription }>("/api/subscription"),
          requestJson<{ blocked: BlockedUser[] }>("/api/blocks"),
        ]);
        if (!mounted) return;
        setProfile(profileData.profile);
        if (profileData.profile.role) {
          setRole(profileData.profile.role);
          setScreen("calendar");
        }
        setNotifications(notificationData.settings ?? defaultNotifications);
        setSubscription(subscriptionData.subscription);
        setBlockedUsers(blockedData.blocked ?? []);
        setPartner({
          ...partnerData,
          friends: partnerData.friends ?? [],
          friendDuties: (partnerData.friendDuties ?? []).map((d) => ({
            ...d,
            source: "partner",
          })),
        });
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) {
          if (mounted) setAuthRequired(true);
        } else {
          notify(
            error instanceof Error ? error.message : "앱을 시작하지 못했어요.",
          );
        }
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [notify]);
  useEffect(() => {
    if (!ready || !profile?.role) return;
    const timer = window.setTimeout(() => {
      void Promise.all([loadMonth(currentMonth), loadPartner()]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentMonth, loadMonth, loadPartner, profile?.role, ready]);

  useEffect(() => {
    if (!ready || authRequired || !profile?.role) return;
    let active = true;
    const sync = () => {
      if (!active || document.visibilityState === "hidden") return;
      void Promise.all([
        loadMonth(currentMonth, { silent: true }),
        loadPartner({ silent: true }),
      ]);
    };
    const interval = window.setInterval(sync, 10_000);
    const onFocus = () => sync();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authRequired, currentMonth, loadMonth, loadPartner, profile?.role, ready]);

  useEffect(() => {
    if (!ready || authRequired || !profile?.role) return;
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;
    const dispatch = () => {
      void requestJson("/api/push/dispatch", { method: "POST" }).catch(() => {});
    };
    const first = window.setTimeout(dispatch, 2500);
    const interval = window.setInterval(dispatch, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [authRequired, profile?.role, ready]);

  const saveProfile = async (name: string, timezone: string) => {
    const data = await requestJson<{ profile: Profile }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ displayName: name, role, scheduleTz: timezone }),
    });
    setProfile(data.profile);
    notify("프로필을 저장했어요.");
    go("calendar");
  };
  const saveDuty = async (payload: DutyPayload, again: boolean) => {
    await requestJson("/api/duties", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await loadMonth(currentMonth);
    notify("일정을 안전하게 저장했어요.");
    if (!again) go("calendar");
  };
  const removeDuty = async (id: string) => {
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    await requestJson(`/api/duties/${id}`, { method: "DELETE" });
    await loadMonth(currentMonth);
    notify("일정을 삭제했어요.");
  };
  const resetMonth = async () => {
    const data = await requestJson<{ deleted: number }>(
      `/api/duties?month=${currentMonth}`,
      { method: "DELETE" },
    );
    await loadMonth(currentMonth);
    notify(`${data.deleted}개의 일정을 초기화했어요.`);
    go("calendar");
  };
  const importRoster = async (items: RosterItem[]) => {
    const data = await requestJson<{
      imported: number;
      skipped: number;
      duplicates: number;
      incomplete: number;
      month: string;
    }>("/api/roster/import", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const first = items[0]?.startDate || items[0]?.startAt?.slice(0, 10);
    const targetMonth = data.month || first?.slice(0, 7) || currentMonth;
    if (targetMonth !== currentMonth) setCurrentMonth(targetMonth);
    await loadMonth(targetMonth);
    const result = [`${data.imported}개 등록`];
    if (data.duplicates) result.push(`중복 ${data.duplicates}개 제외`);
    if (data.incomplete) result.push(`시작 정보 없음 ${data.incomplete}개 제외`);
    notify(result.join(" · "));
    go("calendar");
  };
  const changeMonth = (delta: number) => {
    if (delta === 0) {
      setCurrentMonth(monthKey());
      return;
    }
    const [y, m] = currentMonth.split("-").map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    setCurrentMonth(monthKey(date));
  };
  const createInvite = async () => {
    const data = await requestJson<{ code: string; expiresAt: string }>(
      "/api/invites",
      { method: "POST", body: JSON.stringify({ action: "create" }) },
    );
    await loadPartner();
    notify("새 초대 코드를 만들었어요.");
    return data;
  };
  const acceptInvite = async (code: string) => {
    await requestJson("/api/invites", {
      method: "POST",
      body: JSON.stringify({ action: "accept", code }),
    });
    await loadPartner();
    notify("친구 등록을 완료했어요.");
  };
  const removeFriend = async (friendId: string) => {
    await requestJson("/api/invites", {
      method: "POST",
      body: JSON.stringify({ action: "remove", friendId }),
    });
    await loadPartner();
    notify("친구를 삭제했어요.");
  };
  const blockFriend = async (friendId: string) => {
    await requestJson("/api/blocks", {
      method: "POST",
      body: JSON.stringify({ userId: friendId }),
    });
    await Promise.all([loadPartner(), loadBlockedUsers()]);
    notify("사용자를 차단했어요.");
  };
  const unblockUser = async (userId: string) => {
    await requestJson(`/api/blocks?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    await loadBlockedUsers();
    notify("차단을 해제했어요.");
  };
  const saveTimezone = async (timezone: string) => {
    if (!profile?.role) return;
    const data = await requestJson<{ profile: Profile }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify({
        displayName: profile.display_name,
        role: profile.role,
        scheduleTz: timezone,
      }),
    });
    setProfile(data.profile);
    notify("일정 기준 시간대를 저장했어요.");
    go("settings");
  };
  const saveNotifications = async (value: NotificationState) => {
    const data = await requestJson<{ settings: NotificationState }>(
      "/api/notifications",
      { method: "PUT", body: JSON.stringify(value) },
    );
    setNotifications(data.settings);
  };
  const deleteAccount = async () => {
    await requestJson("/api/account", { method: "DELETE" });
    notify("삭제 요청을 접수했어요.");
    window.setTimeout(() => {
      window.location.href = "/signout-with-chatgpt?return_to=/";
    }, 900);
  };
  const logout = () => {
    window.location.href =
      window.location.hostname === "localhost"
        ? "/"
        : "/signout-with-chatgpt?return_to=/";
  };

  if (!ready)
    return (
      <div className="site-shell">
        <div className="app-frame">
          <LoadingScreen />
        </div>
      </div>
    );
  if (authRequired && (screen === "terms" || screen === "privacy"))
    return (
      <div className="site-shell">
        <div className="app-frame">
          <InformationPage kind={screen} back={() => setScreen("onboarding")} />
        </div>
      </div>
    );
  if (authRequired)
    return (
      <div className="site-shell">
        <div className="app-frame">
          <Onboarding
            buttonLabel="ChatGPT로 로그인"
            onTerms={() => setScreen("terms")}
            onPrivacy={() => setScreen("privacy")}
            onContinue={() => {
              window.location.href = "/signin-with-chatgpt?return_to=/";
            }}
          />
        </div>
      </div>
    );
  const safeProfile = profile ?? {
    user_id: "",
    email: "",
    display_name: "",
    role: null,
    airline: null,
    base_airport: null,
    schedule_tz: role === "crew" ? "Asia/Qatar" : "Asia/Seoul",
    deletion_requested_at: null,
  };
  const renderScreen = () => {
    switch (screen) {
      case "onboarding":
        return (
          <Onboarding
            onContinue={() => go("role")}
            onTerms={() => go("terms")}
            onPrivacy={() => go("privacy")}
          />
        );
      case "role":
        return (
          <RoleSelection
            role={role}
            setRole={setRole}
            next={() => go("profile")}
            back={() => go("onboarding")}
          />
        );
      case "profile":
        return (
          <ProfileSetup
            role={role}
            initialName={safeProfile.display_name}
            next={saveProfile}
            back={() => (safeProfile.role ? go("settings") : go("role"))}
          />
        );
      case "calendar":
        return (
          <CalendarHome
            role={role}
            profile={safeProfile}
            duties={duties}
            partner={partner}
            month={currentMonth}
            loading={loadingDuties}
            go={go}
            selectDate={setSelectedDate}
            changeMonth={changeMonth}
            toast={notify}
            subscription={subscription}
          />
        );
      case "day":
        return (
          <DayDetail
            date={selectedDate}
            duties={duties}
            partnerDuties={partner.friendDuties}
            back={() => go("calendar")}
            add={() => go("duty")}
            remove={removeDuty}
          />
        );
      case "duty":
        return (
          <DutyForm
            role={role}
            selectedDate={selectedDate}
            back={() => go("calendar")}
            quick={() => go("quick")}
            save={saveDuty}
          />
        );
      case "quick":
        return (
          <QuickEntry
            month={currentMonth}
            duties={duties}
            back={() => go("duty")}
            create={() => go("duty")}
            roster={() => go("roster")}
            reset={resetMonth}
          />
        );
      case "roster":
        return (
          <RosterImport back={() => go("calendar")} importItems={importRoster} />
        );
      case "link":
        return (
          <FriendPage
            partner={partner}
            subscription={subscription}
            month={currentMonth}
            go={go}
            createInvite={createInvite}
            acceptInvite={acceptInvite}
            removeFriend={removeFriend}
            blockFriend={blockFriend}
            changeMonth={changeMonth}
            toast={notify}
          />
        );
      case "pro":
        return (
          <ProPage
            subscription={subscription}
            back={() => go("settings")}
            notify={notify}
          />
        );
      case "notifications":
        return (
          <NotificationSettings
            value={notifications}
            go={go}
            save={saveNotifications}
          />
        );
      case "blocked":
        return <BlockedListPage blocked={blockedUsers} back={() => go("settings")} unblock={unblockUser} />;
      case "timezone":
        return <TimezonePage value={safeProfile.schedule_tz} back={() => go("settings")} save={saveTimezone} />;
      case "accessibility":
        return <AccessibilityPage value={displayPreferences} back={() => go("settings")} save={setDisplayPreferences} />;
      case "terms":
        return <InformationPage kind="terms" back={() => go(safeProfile.role ? "settings" : "onboarding")} />;
      case "privacy":
        return <InformationPage kind="privacy" back={() => go(safeProfile.role ? "settings" : "onboarding")} />;
      case "help":
        return <HelpPage back={() => go("settings")} />;
      case "about":
        return <AboutPage back={() => go("settings")} notify={notify} />;
      case "settings":
        return (
          <Settings
            profile={safeProfile}
            partner={partner}
            subscription={subscription}
            blockedCount={blockedUsers.length}
            go={go}
            logout={logout}
          />
        );
      case "delete":
        return (
          <AccountDelete back={() => go("settings")} done={deleteAccount} />
        );
    }
  };
  return (
    <div className="site-shell">
      <aside className="desktop-context">
        <Logo compact />
        <h2>
          서로의 일정을,
          <br />더 가깝게.
        </h2>
        <p>
          실시간으로 저장되는
          <br />
          안전한 승무원 스케줄 캘린더
        </p>
        <div className="desktop-badges">
          <span>영구 저장</span>
          <span>친구 시간표 공유</span>
          <span>사용자별 보호</span>
        </div>
      </aside>
      <div className="app-frame">
        {renderScreen()}
        {toast && (
          <div className="toast" role="status">
            ✓ {toast}
          </div>
        )}
      </div>
    </div>
  );
}
