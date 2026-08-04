"use client";

import { useMemo, useState, type ReactNode } from "react";

type Screen =
  | "onboarding"
  | "role"
  | "profile"
  | "calendar"
  | "day"
  | "duty"
  | "quick"
  | "link"
  | "notifications"
  | "settings"
  | "delete";

type Role = "crew" | "partner";
type DutyType = "flight" | "standby" | "off" | "layover" | "training" | "leave";

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

const baseEvents: Record<number, { label: string; type: DutyType }[]> = {
  1: [{ label: "비행 DOH → ICN", type: "flight" }],
  5: [{ label: "체류 서울", type: "layover" }],
  10: [{ label: "비행 DOH → ICN", type: "flight" }],
  16: [{ label: "체류 서울", type: "layover" }],
  18: [{ label: "대기", type: "standby" }],
  21: [{ label: "휴무", type: "off" }],
  22: [{ label: "휴무", type: "off" }],
  25: [{ label: "비행 DOH → ICN", type: "flight" }],
  31: [{ label: "체류 서울", type: "layover" }],
};

function Mark({ children, tone = "blue" }: { children: ReactNode; tone?: string }) {
  return <span className={`mark mark-${tone}`}>{children}</span>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo-lockup ${compact ? "compact" : ""}`} aria-label="CrewSync">
      <span className="logo-calendar" aria-hidden="true"><span>↗</span></span>
      <strong>CrewSync</strong>
    </div>
  );
}

function TopBar({ title, onBack, close = false }: { title: string; onBack: () => void; close?: boolean }) {
  return (
    <header className="topbar">
      <button className="icon-button" onClick={onBack} aria-label={close ? "닫기" : "뒤로 가기"}>
        {close ? "×" : "‹"}
      </button>
      <strong>{title}</strong>
      <span className="topbar-spacer" />
    </header>
  );
}

function BottomNav({ active, go }: { active: "calendar" | "link" | "settings"; go: (screen: Screen) => void }) {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      <button className={active === "calendar" ? "active" : ""} onClick={() => go("calendar")}>
        <span aria-hidden="true">▣</span><small>캘린더</small>
      </button>
      <button className={active === "link" ? "active" : ""} onClick={() => go("link")}>
        <span aria-hidden="true">↗</span><small>연동</small>
      </button>
      <button className={active === "settings" ? "active" : ""} onClick={() => go("settings")}>
        <span aria-hidden="true">⚙</span><small>설정</small>
      </button>
    </nav>
  );
}

function Onboarding({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="screen onboarding-screen">
      <div className="onboarding-inner">
        <Logo />
        <div className="hero-copy">
          <h1>서로의 일정을,<br />더 쉽게</h1>
          <p>승무원 스케줄을 안전하게 공유하고<br />같은 날짜의 휴무를 한눈에 확인하세요</p>
        </div>
        <div className="sync-illustration" aria-hidden="true">
          <div className="mini-calendar crew-mini"><b>✈</b><i /><i /><i className="picked" /><i /><i /></div>
          <span className="sync-line">••••</span>
          <div className="mini-calendar partner-mini"><i /><i className="heart">♥</i><i /><i /><i className="heart">♥</i><i /></div>
        </div>
      </div>
      <div className="auth-actions">
        <button className="button button-google" onClick={onContinue}>
          <span className="google-g">G</span> Google로 계속하기
        </button>
        <button className="button button-primary" onClick={onContinue}>이메일로 계속하기</button>
        <p className="legal">계속하면 <a href="#terms">이용약관</a> 및 <a href="#privacy">개인정보처리방침</a>에 동의하게 됩니다.</p>
      </div>
    </main>
  );
}

function RoleSelection({ role, setRole, next, back }: { role: Role; setRole: (r: Role) => void; next: () => void; back: () => void }) {
  return (
    <main className="screen form-screen">
      <TopBar title="" onBack={back} />
      <section className="screen-body role-body">
        <div className="page-intro">
          <h1>어떻게 사용하시나요?</h1>
          <p>역할에 따라 필요한 기능만 보여드릴게요</p>
        </div>
        <button className={`role-card ${role === "crew" ? "selected" : ""}`} onClick={() => setRole("crew")}>
          <span className="role-icon">♧</span>
          <span className="role-copy"><strong>승무원</strong><span>내 로스터를 등록하고<br />파트너와 안전하게 공유해요</span><span className="role-tags"><em>전체 일정 관리</em><em>초대 코드 생성</em></span></span>
          {role === "crew" && <span className="check-badge">✓</span>}
        </button>
        <button className={`role-card ${role === "partner" ? "selected" : ""}`} onClick={() => setRole("partner")}>
          <span className="role-icon">♡</span>
          <span className="role-copy"><strong>파트너</strong><span>상대의 공유 일정과<br />같은 날짜 휴무를 확인해요</span><span className="role-tags"><em>공유 일정 보기</em><em>내 휴무 등록</em></span></span>
          {role === "partner" && <span className="check-badge">✓</span>}
        </button>
        <p className="info-line">ⓘ 일정과 연동이 없을 때 한 번 변경할 수 있어요</p>
      </section>
      <div className="sticky-action"><button className="button button-primary" onClick={next}>다음</button></div>
    </main>
  );
}

function ProfileSetup({ role, next, back }: { role: Role; next: () => void; back: () => void }) {
  const [name, setName] = useState(role === "crew" ? "지원" : "민수");
  return (
    <main className="screen form-screen">
      <TopBar title="프로필 설정" onBack={back} />
      <section className="screen-body profile-body">
        <div className="page-intro"><h1>기본 정보를 알려주세요</h1><p>일정과 알림을 정확하게 보여드릴게요</p></div>
        <div className="profile-picker"><div className="avatar avatar-large">{name.slice(0, 1)}</div><button>⌑</button><span>사진 추가</span></div>
        <label className="field-label">표시 이름<input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></label>
        {role === "crew" && <>
          <label className="field-label">항공사<input value="Qatar Airways · QR" readOnly /></label>
          <label className="field-label">베이스 공항<input value="Doha · DOH" readOnly /></label>
        </>}
        <label className="field-label">일정 기준 시간대<button className="select-field">{role === "crew" ? "Asia/Qatar · UTC+3" : "Asia/Seoul · UTC+9"}<span>›</span></button></label>
        <div className="info-box">ⓘ 시간대는 비행 시각과 같은 날짜 휴무를 계산할 때 사용해요</div>
      </section>
      <div className="sticky-action"><button className="button button-primary" disabled={!name.trim()} onClick={next}>시작하기</button></div>
    </main>
  );
}

function CalendarHome({ role, go, toast }: { role: Role; go: (s: Screen) => void; toast: (m: string) => void }) {
  const [selectedDay, setSelectedDay] = useState(21);
  const days = useMemo(() => {
    const values = [27, 28, 29, 30, 31, ...Array.from({ length: 31 }, (_, i) => i + 1), 1, 2, 3, 4, 5, 6];
    return values.map((day, index) => ({ day, current: index >= 5 && index < 36, index }));
  }, []);
  const openDay = (day: number) => { setSelectedDay(day); go("day"); };
  return (
    <main className="screen calendar-screen">
      <section className="calendar-content">
        <div className="greeting-row">
          <div><h1>{role === "crew" ? "안녕하세요, 지원님" : "민수님, 안녕하세요"}</h1><p>{role === "crew" ? "오늘도 안전한 비행 되세요" : "서로의 하루를 한눈에 확인해요"}</p></div>
          <div className="avatar avatar-small">{role === "crew" ? "지" : "민"}</div>
        </div>
        {role === "crew" ? (
          <button className="shared-banner" onClick={() => openDay(21)}><span className="heart-calendar">♥</span><strong>같은 날짜 휴무 <b>2일</b></strong><span>›</span></button>
        ) : (
          <button className="partner-banner" onClick={() => go("link")}><span className="avatar avatar-medium">지</span><span><strong>지원님의 공유 일정</strong><small>Qatar Airways · DOH</small></span><em>● 연동 중</em><b>›</b></button>
        )}
        <div className="month-toolbar">
          <button aria-label="이전 달" onClick={() => toast("7월 일정으로 이동했어요")}>‹</button>
          <h2>2026년 8월</h2>
          <button aria-label="다음 달" onClick={() => toast("9월 일정으로 이동했어요")}>›</button>
          <button className="today-button" onClick={() => toast("오늘 날짜로 돌아왔어요")}>오늘</button>
        </div>
        <div className="weekday-row">{["월", "화", "수", "목", "금", "토", "일"].map((d, i) => <span className={i === 5 ? "sat" : i === 6 ? "sun" : ""} key={d}>{d}</span>)}</div>
        <div className="calendar-grid">
          {days.map(({ day, current, index }) => {
            const dow = index % 7;
            const events = current ? baseEvents[day] : undefined;
            const shared = current && (day === 21 || day === 22);
            return (
              <button key={`${index}-${day}`} className={`day-cell ${!current ? "outside" : ""} ${shared ? "shared" : ""} ${selectedDay === day && current ? "focused" : ""}`} onClick={() => current && openDay(day)} aria-label={`8월 ${day}일${events ? `, ${events.map(e => e.label).join(", ")}` : ""}`}>
                <span className={dow === 5 ? "sat" : dow === 6 ? "sun" : ""}>{day}</span>
                {shared && <i className="tiny-heart">♥</i>}
                {events?.slice(0, 2).map((event) => <em className={`event-pill event-${event.type}`} key={event.label}>{event.label}</em>)}
              </button>
            );
          })}
        </div>
        {role === "partner" && <p className="privacy-note">▣ 상대가 허용한 일정 정보만 표시됩니다</p>}
        <button className="fab" onClick={() => go("duty")}><span>＋</span>{role === "crew" ? "일정 추가" : "내 휴무 추가"}</button>
      </section>
      <BottomNav active="calendar" go={go} />
    </main>
  );
}

function DayDetail({ role, back, add }: { role: Role; back: () => void; add: () => void }) {
  return (
    <main className="screen detail-screen">
      <TopBar title="8월 21일 금요일" onBack={back} />
      <section className="screen-body day-body">
        <div className="shared-banner static"><span className="heart-calendar">♥</span><strong>같은 날짜 휴무</strong></div>
        <h2>내 일정</h2>
        <article className="duty-card off-card"><Mark tone="green">휴무</Mark><button aria-label="일정 메뉴">⋮</button><strong>8월 21일 - 8월 22일</strong><span>연차 포함 2일</span></article>
        <h2>파트너 일정</h2>
        <article className="partner-duty-card"><div><span className="avatar avatar-medium">{role === "crew" ? "민" : "지"}</span><strong>{role === "crew" ? "민수" : "지원"}</strong><Mark tone="green">휴무</Mark></div><h3>8월 21일 - 8월 22일</h3><p>공유된 정보만 표시됩니다</p></article>
        <h2>다가오는 일정</h2>
        <article className="duty-card flight-card"><Mark>8월 24일 월요일</Mark><strong>DOH → ICN</strong><span>오후 5:20 출발</span></article>
      </section>
      <div className="sticky-action"><button className="button button-outline" onClick={add}>＋ 이 날 일정 추가</button></div>
    </main>
  );
}

function DutyForm({ role, back, save, quick }: { role: Role; back: () => void; save: (continueAdding?: boolean) => void; quick: () => void }) {
  const allowed: DutyType[] = role === "partner" ? ["off", "leave"] : ["flight", "standby", "off", "layover", "training", "leave"];
  const [type, setType] = useState<DutyType>(role === "partner" ? "off" : "flight");
  const [lookup, setLookup] = useState(role === "crew");
  return (
    <main className="screen form-screen duty-form-screen">
      <TopBar title="일정 추가" onBack={back} close />
      <section className="screen-body duty-body">
        <div className="duty-tabs">
          {allowed.map((item) => <button key={item} onClick={() => { setType(item); setLookup(item === "flight"); }} className={type === item ? "active" : ""}><span>{dutyIcons[item]}</span>{dutyLabels[item]}</button>)}
        </div>
        {type === "flight" ? <>
          <label className="field-label">편명<div className="inline-field"><input defaultValue="QR858" /><button onClick={() => setLookup(true)}>조회</button></div></label>
          {lookup && <><div className="success-box">✓ 운항 정보를 찾았어요</div><article className="flight-result"><strong>DOH → ICN</strong><dl><dt>출발</dt><dd>8월 24일 오후 5:20</dd><dt>도착</dt><dd>8월 25일 오전 7:35</dd></dl><small>출발지·도착지 현지 시각</small></article></>}
          <label className="field-label">기종<input defaultValue="Boeing 777-300ER" /></label>
        </> : <>
          <div className="date-pair"><label className="field-label">시작일<input type="date" defaultValue="2026-08-21" /></label><label className="field-label">종료일<input type="date" defaultValue="2026-08-22" /></label></div>
          {type === "layover" && <label className="field-label">체류 도시<input defaultValue="서울" /></label>}
          {(type === "standby" || type === "training" || type === "layover") && <div className="date-pair"><label className="field-label">시작 시각<input type="time" defaultValue="09:00" /></label><label className="field-label">종료 시각<input type="time" defaultValue="17:00" /></label></div>}
        </>}
        <label className="field-label">메모<textarea placeholder="나만 볼 수 있어요" /></label>
        <p className="privacy-note">▣ 편명, 기종, 호텔명, 메모는 파트너에게 공유되지 않아요</p>
        {role === "crew" && <button className="text-button" onClick={quick}>빠른 입력 옵션 보기 →</button>}
      </section>
      <div className="dual-sticky"><button className="button button-ghost" onClick={() => save(true)}>저장 후 계속 등록</button><button className="button button-primary" onClick={() => save(false)}>저장</button></div>
    </main>
  );
}

function QuickEntry({ back, create, reset }: { back: () => void; create: () => void; reset: () => void }) {
  const actions = [
    ["▱", "계속 등록", "저장 후 화면을 닫지 않고 다음 일정 입력", "primary"],
    ["▤", "기존 일정 복제", "날짜와 시각만 바꿔 비슷한 일정 추가", ""],
    ["↻", "반복 일정 만들기", "휴무와 대기를 최대 12건까지 생성", ""],
  ];
  return (
    <main className="screen form-screen">
      <TopBar title="빠른 입력" onBack={back} />
      <section className="screen-body quick-body">
        <div className="page-intro"><h1>이번 달 일정을 빠르게 등록하세요</h1><p>자주 쓰는 방법을 선택하면 입력 시간을 줄일 수 있어요</p></div>
        {actions.map(([icon, title, desc, tone]) => <button className={`quick-card ${tone}`} key={title} onClick={create}><span>{icon}</span><span><strong>{title}</strong><small>{desc}</small></span><b>›</b></button>)}
        <button className="quick-card danger" onClick={reset}><span>♲</span><span><strong>8월 일정 초기화</strong><small>2026년 8월 로스터를 확인 후 삭제</small></span><b>›</b></button>
        <h2>최근 입력</h2>
        <div className="recent-list"><div><span><strong>QR858</strong> · DOH → ICN</span><button onClick={create}>복제</button></div><div><span><strong>휴무</strong> · 8월 21일 - 22일</span><button onClick={create}>복제</button></div></div>
      </section>
      <div className="sticky-action"><button className="button button-primary" onClick={create}>새 일정 계속 등록</button></div>
    </main>
  );
}

function PartnerLink({ role, go, toast }: { role: Role; go: (s: Screen) => void; toast: (m: string) => void }) {
  const [code, setCode] = useState("");
  const linked = true;
  return (
    <main className="screen form-screen link-screen">
      <TopBar title="파트너 연동" onBack={() => go("calendar")} />
      <section className="screen-body link-body">
        <div className="page-intro centered"><h1>{role === "crew" ? "초대 코드를 공유하세요" : "초대 코드를 입력하세요"}</h1><p>코드는 7일 동안 한 번만 사용할 수 있어요</p></div>
        {role === "crew" && <>
          <article className="invite-card"><span>내 초대 코드</span><strong>K7QP-2M8H</strong><p>2026년 8월 11일까지</p><div><button onClick={() => toast("초대 코드를 복사했어요")}>▤ 복사</button><button onClick={() => toast("공유 창을 열었어요")}>⇧ 공유</button></div></article>
          <button className="button button-outline small-button" onClick={() => toast("새 초대 코드를 만들었어요")}>↻ 새 코드 만들기</button>
        </>}
        {linked && <article className="share-info"><h2>연동하면 공유되는 정보</h2><p>✓ 비행 여부와 출발·도착 공항</p><p>✓ 출발·도착 시각</p><p>✓ 체류 도시와 휴무 날짜</p><div>▣ 편명, 기종, 호텔명, 메모는 공유되지 않아요</div></article>}
        <div className="code-divider"><span />코드를 받으셨나요?<span /></div>
        <input className="code-input" value={code} maxLength={9} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").replace(/(.{4})/, "$1-").slice(0, 9))} placeholder="ABCD-EFGH" aria-label="초대 코드" />
        <button className="button button-primary" disabled={code.length < 9} onClick={() => toast("지원님의 공유 일정을 확인했어요")}>코드 확인</button>
      </section>
      <BottomNav active="link" go={go} />
    </main>
  );
}

function Toggle({ on, setOn, label }: { on: boolean; setOn: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? "on" : ""}`} onClick={() => setOn(!on)}><span /></button>;
}

function NotificationSettings({ go }: { go: (s: Screen) => void }) {
  const [settings, setSettings] = useState({ all: true, mine: true, partnerPre: true, partnerPost: true, roster: true, shared: true, private: true });
  const update = (key: keyof typeof settings, value: boolean) => setSettings((prev) => ({ ...prev, [key]: value }));
  const rows: [keyof typeof settings, string, string, string][] = [
    ["mine", "✈", "내 비행 3시간 전", "내 출발 일정을 미리 알려드려요"],
    ["partnerPre", "⌁", "파트너 비행 3시간 전", "상대의 비행 시작 전 알림"],
    ["partnerPost", "⌁", "파트너 비행 종료 예정", "도착 확정이 아닌 예정 시각 안내"],
  ];
  return (
    <main className="screen form-screen notifications-screen">
      <TopBar title="알림 설정" onBack={() => go("settings")} />
      <section className="screen-body settings-body">
        <div className="setting-card single"><SettingIcon>●</SettingIcon><span><strong>전체 알림</strong><small>CrewSync의 모든 알림</small></span><Toggle label="전체 알림" on={settings.all} setOn={(v) => update("all", v)} /></div>
        <h2>비행 알림</h2>
        <div className="setting-card grouped">{rows.map(([key, icon, title, sub]) => <div className="setting-row" key={key}><SettingIcon>{icon}</SettingIcon><span><strong>{title}</strong><small>{sub}</small></span><Toggle label={title} on={settings[key]} setOn={(v) => update(key, v)} /></div>)}</div>
        <h2>일정 알림</h2>
        <div className="setting-card grouped"><div className="setting-row"><SettingIcon>▦</SettingIcon><span><strong>로스터 변경</strong><small>상대 일정이 변경되면 알려드려요</small></span><Toggle label="로스터 변경" on={settings.roster} setOn={(v) => update("roster", v)} /></div><div className="setting-row"><SettingIcon>♥</SettingIcon><span><strong>같은 날짜 휴무 D-1</strong><small>전날 오전 9시에 알려드려요</small></span><Toggle label="같은 날짜 휴무" on={settings.shared} setOn={(v) => update("shared", v)} /></div></div>
        <h2>개인정보 보호</h2>
        <div className="setting-card single privacy-setting"><SettingIcon>▣</SettingIcon><span><strong>잠금화면 상세 숨기기</strong><small>알림 내용을 ‘새 알림이 있어요’로 표시</small></span><Toggle label="잠금화면 상세 숨기기" on={settings.private} setOn={(v) => update("private", v)} /></div>
        <button className="setting-card timezone-row"><SettingIcon>◷</SettingIcon><span><strong>알림 기준 시간대</strong></span><em>자동 · Asia/Seoul ›</em></button>
      </section>
      <BottomNav active="settings" go={go} />
    </main>
  );
}

function SettingIcon({ children }: { children: ReactNode }) { return <span className="setting-icon">{children}</span>; }

function Settings({ role, go, logout }: { role: Role; go: (s: Screen) => void; logout: () => void }) {
  const section = (title: string, rows: { icon: string; label: string; value?: string; action?: () => void }[]) => (
    <section className="settings-section"><h2>{title}</h2><div className="settings-list">{rows.map((row) => <button key={row.label} onClick={row.action}><span className="line-icon">{row.icon}</span><strong>{row.label}</strong>{row.value && <em>{row.value}</em>}<b>›</b></button>)}</div></section>
  );
  return (
    <main className="screen form-screen settings-screen">
      <header className="title-only"><h1>설정</h1></header>
      <section className="screen-body settings-page-body">
        <article className="profile-summary"><div className="avatar avatar-large">{role === "crew" ? "지" : "민"}</div><span><strong>{role === "crew" ? "지원" : "민수"}</strong><small>{role === "crew" ? "Qatar Airways · DOH" : "Asia/Seoul"}</small></span><button>프로필 수정</button></article>
        {section("연동", [{ icon: "↗", label: "파트너 연동", value: role === "crew" ? "민수와 연동 중" : "지원과 연동 중", action: () => go("link") }, { icon: "♙", label: "차단 목록", value: "0명" }])}
        {section("앱 설정", [{ icon: "♧", label: "알림 설정", action: () => go("notifications") }, { icon: "◷", label: "일정 기준 시간대", value: role === "crew" ? "Asia/Qatar" : "Asia/Seoul" }, { icon: "◎", label: "화면 및 접근성" }])}
        {section("정보 및 지원", [{ icon: "□", label: "이용약관" }, { icon: "♢", label: "개인정보처리방침" }, { icon: "?", label: "도움말 및 문의" }, { icon: "ⓘ", label: "앱 버전", value: "1.0.0" }])}
        <button className="logout-button" onClick={logout}>로그아웃</button>
        <button className="delete-row" onClick={() => go("delete")}><span>♲</span><span><strong>계정 삭제</strong><small>계정과 저장된 데이터를 삭제합니다</small></span><b>›</b></button>
      </section>
      <BottomNav active="settings" go={go} />
    </main>
  );
}

function AccountDelete({ back, done }: { back: () => void; done: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [checked, setChecked] = useState(false);
  const enabled = confirm.trim() === "계정 삭제" && checked;
  return (
    <main className="screen form-screen delete-screen">
      <TopBar title="계정 삭제" onBack={back} close />
      <section className="screen-body delete-body">
        <div className="delete-shield">▣</div>
        <div className="page-intro centered"><h1>정말 계정을 삭제할까요?</h1><p>삭제를 요청하면 즉시 일정 공유가 중단되고<br />30일 후 계정과 데이터가 완전히 삭제돼요</p></div>
        <div className="danger-info"><p>✓ 파트너 연동이 즉시 해제돼요</p><p>✓ 초대 코드와 예약 알림이 취소돼요</p><p>✓ 30일 동안 다시 로그인해 복원할 수 있어요</p></div>
        <div className="backup-info"><span>☁</span><span><strong>백업 데이터 안내</strong><small>백업을 포함한 데이터 제거에는 최대 37일이 걸릴 수 있어요</small></span></div>
        <label className="field-label">확인을 위해 ‘계정 삭제’를 입력하세요<input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="계정 삭제" /></label>
        <label className="check-line"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> <span>위 내용을 확인했어요</span></label>
        <button className="button button-danger" disabled={!enabled} onClick={done}>삭제 요청하기</button>
        <button className="button button-ghost" onClick={back}>취소</button>
      </section>
    </main>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [role, setRole] = useState<Role>("crew");
  const [toast, setToast] = useState<string | null>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const go = (next: Screen) => {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderScreen = () => {
    switch (screen) {
      case "onboarding": return <Onboarding onContinue={() => go("role")} />;
      case "role": return <RoleSelection role={role} setRole={setRole} next={() => go("profile")} back={() => go("onboarding")} />;
      case "profile": return <ProfileSetup role={role} next={() => go("calendar")} back={() => go("role")} />;
      case "calendar": return <CalendarHome role={role} go={go} toast={notify} />;
      case "day": return <DayDetail role={role} back={() => go("calendar")} add={() => go("duty")} />;
      case "duty": return <DutyForm role={role} back={() => go("calendar")} quick={() => go("quick")} save={(again) => { notify("일정을 안전하게 저장했어요"); if (!again) go("calendar"); }} />;
      case "quick": return <QuickEntry back={() => go("duty")} create={() => go("duty")} reset={() => notify("8월 일정 9건을 확인한 뒤 초기화할 수 있어요")} />;
      case "link": return <PartnerLink role={role} go={go} toast={notify} />;
      case "notifications": return <NotificationSettings go={go} />;
      case "settings": return <Settings role={role} go={go} logout={() => go("onboarding")} />;
      case "delete": return <AccountDelete back={() => go("settings")} done={() => { notify("삭제 요청을 접수했어요. 30일 안에 복원할 수 있어요"); go("onboarding"); }} />;
    }
  };

  return (
    <div className="site-shell">
      <aside className="desktop-context">
        <Logo compact />
        <h2>서로의 일정을,<br />더 가깝게.</h2>
        <p>승무원과 파트너를 위한<br />안전한 스케줄 공유 캘린더</p>
        <div className="desktop-badges"><span>6종 일정</span><span>1:1 연동</span><span>Privacy first</span></div>
      </aside>
      <div className="app-frame">{renderScreen()}{toast && <div className="toast" role="status">✓ {toast}</div>}</div>
    </div>
  );
}
