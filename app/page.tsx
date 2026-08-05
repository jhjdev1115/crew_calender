"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
type PartnerState = {
  invite: { code_hint?: string; expires_at?: string } | null;
  connection: Record<string, unknown> | null;
  partnerDuties: Duty[];
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
type RosterAnalysis = {
  summary: string;
  periodStart: string;
  periodEnd: string;
  timezoneNote: string;
  items: RosterItem[];
};

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
    return `비행 ${duty.dep_airport ?? "출발"} → ${duty.arr_airport ?? "도착"}`;
  if (duty.type === "layover") return `체류 ${duty.layover_city ?? ""}`.trim();
  return dutyLabels[duty.type];
}
function calendarDutyLabel(duty: Duty) {
  return duty.type === "flight" ? dutyLabels.flight : dutyLabel(duty);
}
function formatShortDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " ");
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours() < 12 ? "오전" : "오후"} ${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")}`;
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
        <small>연동</small>
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
  buttonLabel = "CrewSync 시작하기",
}: {
  onContinue: () => void;
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
          계속하면 <a href="#terms">이용약관</a> 및{" "}
          <a href="#privacy">개인정보처리방침</a>에 동의하게 됩니다.
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
              <strong>{item === "crew" ? "승무원" : "파트너"}</strong>
              <span>
                {item === "crew" ? (
                  <>
                    내 로스터를 등록하고
                    <br />
                    파트너와 안전하게 공유해요
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
            ...partner.partnerDuties.map((d) => ({
              ...d,
              source: "partner" as const,
            })),
          ]
        : duties,
    [duties, partner.partnerDuties, role],
  );
  const byDate = useMemo(() => {
    const map = new Map<string, Duty[]>();
    for (const cell of cells)
      map.set(cell.key, dutiesOnDate(allDuties, cell.key));
    return map;
  }, [allDuties, cells]);
  const partnerName = String(partner.connection?.display_name ?? "파트너");
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
        {partner.connection ? (
          <button className="partner-banner" onClick={() => go("link")}>
            <span className="avatar avatar-medium">
              {partnerName.slice(0, 1)}
            </span>
            <span>
              <strong>{partnerName}님의 공유 일정</strong>
              <small>
                {String(partner.connection.airline ?? "연동된 파트너")}
                {partner.connection.base_airport
                  ? ` · ${String(partner.connection.base_airport)}`
                  : ""}
              </small>
            </span>
            <em>● 연동 중</em>
            <b>›</b>
          </button>
        ) : (
          <button className="shared-banner" onClick={() => go("link")}>
            <span className="heart-calendar">♥</span>
            <strong>
              파트너를 연동해 <b>같은 날짜 휴무</b>를 확인하세요
            </strong>
            <span>›</span>
          </button>
        )}
        {role === "crew" && (
          <button className="ai-roster-banner" onClick={() => go("roster")}>
            <span>✦</span>
            <span>
              <strong>AI로 로스터 PDF 등록</strong>
              <small>PDF를 올리면 일정과 현지 시각을 자동으로 정리해요</small>
            </span>
            <b>›</b>
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
                className={`day-cell ${!current ? "outside" : ""} ${shared ? "shared" : ""}`}
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
                  <small className="more-count">+{events.length - 2}</small>
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
        {formatDutyRange(duty)}
      </span>
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
        <h2>파트너 일정</h2>
        {peer.length ? (
          peer.map((d) => card(d, false))
        ) : (
          <div className="empty-card">공유된 파트너 일정이 없어요.</div>
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
          ▣ 편명, 기종, 호텔명, 메모는 파트너에게 공유되지 않아요
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
            <strong>AI 로스터 PDF 분석</strong>
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
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("PDF 파일을 읽지 못했어요."));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/roster/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileData }),
      });
      const data = (await response.json()) as {
        analysis?: RosterAnalysis;
        error?: string;
      };
      if (!response.ok || !data.analysis)
        throw new Error(data.error || "PDF를 분석하지 못했어요.");
      setAnalysis(data.analysis);
      setSelected(new Set(data.analysis.items.map((item) => item.id)));
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
      <TopBar title="AI 로스터 분석" onBack={back} />
      <section className="screen-body roster-body">
        <div className="page-intro">
          <h1>로스터 PDF를 일정으로 바꿔드려요</h1>
          <p>비행·휴무·대기·교육과 공항별 현지 시각을 자동으로 정리해요</p>
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
            PDF는 AI 분석을 위해 OpenAI로 전송되며 CrewSync 데이터베이스에는
            원본 파일을 저장하지 않아요. 이름과 사번은 일정에 등록하지 않습니다.
          </p>
        </div>
        {error && <p className="roster-error">{error}</p>}
        <button
          className="button button-primary roster-analyze-button"
          disabled={!file || analyzing}
          onClick={analyze}
        >
          {analyzing ? "AI가 로스터를 분석하는 중…" : "✦ AI 분석 시작"}
        </button>
        {analyzing && (
          <div className="roster-progress" role="status">
            <span className="loading-spinner" />
            <span>
              <strong>표의 날짜와 열을 읽고 있어요</strong>
              <small>복잡한 로스터는 약 1분 정도 걸릴 수 있어요.</small>
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
                              ` ${item.depAirport || "출발"} → ${item.arrAirport || "도착"}`}
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
                      <span>{item.sourceCode || "코드 없음"}</span>
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
                        {item.type === "layover" && (
                          <div className="date-pair">
                            <label className="field-label">
                              체류 도시
                              <input
                                value={item.layoverCity ?? ""}
                                onChange={(event) =>
                                  updateItem(item.id, { layoverCity: event.target.value })
                                }
                              />
                            </label>
                            <label className="field-label">
                              호텔명
                              <input
                                value={item.hotelName ?? ""}
                                onChange={(event) =>
                                  updateItem(item.id, { hotelName: event.target.value })
                                }
                              />
                            </label>
                          </div>
                        )}
                        <label className="field-label">
                          메모
                          <input
                            value={item.note ?? ""}
                            onChange={(event) =>
                              updateItem(item.id, { note: event.target.value })
                            }
                          />
                        </label>
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

function PartnerLink({
  role,
  partner,
  go,
  createInvite,
  acceptInvite,
  unlink,
  toast,
}: {
  role: Role;
  partner: PartnerState;
  go: (s: Screen) => void;
  createInvite: () => Promise<{ code: string; expiresAt: string }>;
  acceptInvite: (code: string) => Promise<void>;
  unlink: () => Promise<void>;
  toast: (m: string) => void;
}) {
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const connection = partner.connection;
  const partnerName = String(connection?.display_name ?? "");
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
      <TopBar title="파트너 연동" onBack={() => go("calendar")} />
      <section className="screen-body link-body">
        {connection ? (
          <>
            <div className="page-intro centered">
              <h1>{partnerName}님과 연동 중</h1>
              <p>연동된 일정은 허용된 요약 정보만 공유돼요</p>
            </div>
            <article className="connected-card">
              <div className="avatar avatar-large">
                {partnerName.slice(0, 1)}
              </div>
              <strong>{partnerName}</strong>
              <span>
                {String(connection.role ?? "partner") === "crew"
                  ? `${String(connection.airline ?? "Qatar Airways")} · ${String(connection.base_airport ?? "DOH")}`
                  : "파트너"}
              </span>
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    await unlink();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                연동 해제
              </button>
            </article>
          </>
        ) : (
          <>
            <div className="page-intro centered">
              <h1>
                {role === "crew"
                  ? "초대 코드를 공유하세요"
                  : "초대 코드를 입력하세요"}
              </h1>
              <p>코드는 7일 동안 한 번만 사용할 수 있어요</p>
            </div>
            {role === "crew" && (
              <>
                {issued ? (
                  <article className="invite-card">
                    <span>내 초대 코드</span>
                    <strong>{issued.code}</strong>
                    <p>
                      {new Date(issued.expiresAt).toLocaleDateString("ko-KR")}
                      까지
                    </p>
                    <div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(issued.code);
                          toast("초대 코드를 복사했어요");
                        }}
                      >
                        ▤ 복사
                      </button>
                      <button
                        onClick={() => {
                          if (navigator.share)
                            navigator.share({
                              title: "CrewSync 초대",
                              text: issued.code,
                            });
                          else navigator.clipboard.writeText(issued.code);
                        }}
                      >
                        ⇧ 공유
                      </button>
                    </div>
                  </article>
                ) : (
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={create}
                  >
                    새 초대 코드 만들기
                  </button>
                )}
                <p className="info-line centered-text">
                  화면을 나가면 전체 코드는 다시 볼 수 없어요.
                </p>
              </>
            )}
            <article className="share-info">
              <h2>연동하면 공유되는 정보</h2>
              <p>✓ 비행 여부와 출발·도착 공항</p>
              <p>✓ 출발·도착 시각</p>
              <p>✓ 체류 도시와 휴무 날짜</p>
              <div>▣ 편명, 기종, 호텔명, 메모는 공유되지 않아요</div>
            </article>
            <div className="code-divider">
              <span />
              코드를 받으셨나요?
              <span />
            </div>
            <input
              className="code-input"
              value={code}
              maxLength={9}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z2-9]/g, "")
                    .replace(/(.{4})/, "$1-")
                    .slice(0, 9),
                )
              }
              placeholder="ABCD-EFGH"
              aria-label="초대 코드"
            />
            <button
              className="button button-primary"
              disabled={code.length < 9 || busy}
              onClick={accept}
            >
              코드 확인 및 연동
            </button>
          </>
        )}
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
    ["partnerPre", "⌁", "파트너 비행 3시간 전", "상대의 비행 시작 전 알림"],
    [
      "partnerPost",
      "⌁",
      "파트너 비행 종료 예정",
      "도착 확정이 아닌 예정 시각 안내",
    ],
  ];
  return (
    <main className="screen form-screen notifications-screen">
      <TopBar title="알림 설정" onBack={() => go("settings")} />
      <section className="screen-body settings-body">
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

function Settings({
  profile,
  partner,
  go,
  logout,
}: {
  profile: Profile;
  partner: PartnerState;
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
        {section("연동", [
          {
            icon: "↗",
            label: "파트너 연동",
            value: partner.connection
              ? `${String(partner.connection.display_name)}와 연동 중`
              : "미연동",
            action: () => go("link"),
          },
          { icon: "♙", label: "차단 목록", value: "0명" },
        ])}
        {section("앱 설정", [
          { icon: "♧", label: "알림 설정", action: () => go("notifications") },
          { icon: "◷", label: "일정 기준 시간대", value: profile.schedule_tz },
          { icon: "◎", label: "화면 및 접근성" },
        ])}
        {section("정보 및 지원", [
          { icon: "□", label: "이용약관" },
          { icon: "♢", label: "개인정보처리방침" },
          { icon: "?", label: "도움말 및 문의" },
          { icon: "ⓘ", label: "앱 버전", value: "1.0.0" },
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
          <p>✓ 파트너 연동이 즉시 해제돼요</p>
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
    connection: null,
    partnerDuties: [],
  });
  const [notifications, setNotifications] =
    useState<NotificationState>(defaultNotifications);
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
      const data = await requestJson<PartnerState>("/api/invites");
      setPartner({
        ...data,
        partnerDuties: (data.partnerDuties ?? []).map((d) => ({
          ...d,
          source: "partner",
        })),
      });
    } catch (error) {
      if (!options.silent)
        notify(
          error instanceof Error
            ? error.message
            : "연동 정보를 불러오지 못했어요.",
        );
    }
  }, [notify]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [profileData, notificationData, partnerData] = await Promise.all([
          requestJson<{ profile: Profile }>("/api/profile"),
          requestJson<{ settings: NotificationState }>("/api/notifications"),
          requestJson<PartnerState>("/api/invites"),
        ]);
        if (!mounted) return;
        setProfile(profileData.profile);
        if (profileData.profile.role) {
          setRole(profileData.profile.role);
          setScreen("calendar");
        }
        setNotifications(notificationData.settings ?? defaultNotifications);
        setPartner({
          ...partnerData,
          partnerDuties: (partnerData.partnerDuties ?? []).map((d) => ({
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
      void loadMonth(currentMonth);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentMonth, loadMonth, profile?.role, ready]);

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
    notify("파트너 연동을 완료했어요.");
  };
  const unlink = async () => {
    if (!window.confirm("파트너 연동을 해제할까요?")) return;
    await requestJson("/api/invites", {
      method: "POST",
      body: JSON.stringify({ action: "unlink" }),
    });
    await loadPartner();
    notify("파트너 연동을 해제했어요.");
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
  if (authRequired)
    return (
      <div className="site-shell">
        <div className="app-frame">
          <Onboarding
            buttonLabel="ChatGPT로 로그인"
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
        return <Onboarding onContinue={() => go("role")} />;
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
          />
        );
      case "day":
        return (
          <DayDetail
            date={selectedDate}
            duties={duties}
            partnerDuties={partner.partnerDuties}
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
          <PartnerLink
            role={role}
            partner={partner}
            go={go}
            createInvite={createInvite}
            acceptInvite={acceptInvite}
            unlink={unlink}
            toast={notify}
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
      case "settings":
        return (
          <Settings
            profile={safeProfile}
            partner={partner}
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
          <span>1:1 연동</span>
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
