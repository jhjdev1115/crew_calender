"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deleteUser,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "../firebase-client";
import {
  reauthenticateWithGoogle,
  signInWithGoogle,
} from "../native-auth";

function errorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("popup-closed")) return "Google 로그인이 취소되었습니다.";
  if (code.includes("popup-blocked")) return "브라우저에서 로그인 팝업을 허용해주세요.";
  if (code.includes("requires-recent-login")) return "보안을 위해 Google에 다시 로그인해주세요.";
  return "계정 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

export default function DeleteAccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth, (nextUser) => {
        setUser(nextUser);
        setReady(true);
      }),
    [],
  );

  const signIn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    if (!user || !confirmed) return;
    setBusy(true);
    setMessage(null);
    try {
      const credential = await reauthenticateWithGoogle(user);
      const token = await credential.user.getIdToken();
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("server-delete-failed");
      await deleteUser(credential.user);
      setUser(null);
      setDeleted(true);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="public-policy-page">
      <article className="public-policy-card public-delete-card">
        <header className="public-policy-header">
          <Link href="/" className="public-policy-brand" aria-label="CrewSync 홈">
            <span aria-hidden="true">↗</span>
            <strong>CrewSync</strong>
          </Link>
          <p>Google Play 계정 삭제 안내</p>
          <h1>계정과 데이터를 삭제할 수 있어요</h1>
          <p className="public-policy-lead">
            아래에서 CrewSync에 사용한 Google 계정으로 로그인하면 앱을 설치하지
            않고도 계정 삭제를 요청할 수 있습니다.
          </p>
        </header>

        <section className="public-delete-summary">
          <h2>삭제되는 정보</h2>
          <ul>
            <li>프로필과 로그인 연결 정보</li>
            <li>등록한 비행·휴무·교육 등 모든 일정</li>
            <li>친구 연결, 초대 코드와 차단 목록</li>
            <li>알림 설정과 푸시 구독 정보</li>
            <li>CrewSync 구독 권한 기록</li>
          </ul>
          <p>
            법령상 별도 보관 의무가 있는 결제 기록은 Google Play 등 결제
            제공업체의 정책에 따라 보관될 수 있습니다. CrewSync에 저장된 서비스
            데이터는 삭제 후 복구할 수 없습니다.
          </p>
        </section>

        {!ready ? (
          <p className="public-delete-status">계정 상태를 확인하고 있습니다…</p>
        ) : deleted ? (
          <div className="public-delete-success" role="status">
            <strong>계정 삭제가 완료되었습니다.</strong>
            <p>CrewSync 계정과 저장된 서비스 데이터를 더 이상 사용할 수 없습니다.</p>
          </div>
        ) : !user ? (
          <button className="public-primary-button" onClick={signIn} disabled={busy}>
            {busy ? "Google 로그인 중…" : "Google 계정으로 본인 확인"}
          </button>
        ) : (
          <div className="public-delete-action">
            <p>
              로그인된 계정 <strong>{user.email}</strong>
            </p>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>삭제되는 정보와 복구할 수 없다는 점을 확인했습니다.</span>
            </label>
            <button
              className="public-danger-button"
              onClick={removeAccount}
              disabled={!confirmed || busy}
            >
              {busy ? "계정 삭제 중…" : "CrewSync 계정 영구 삭제"}
            </button>
          </div>
        )}

        {message && <p className="public-delete-error" role="alert">{message}</p>}

        <section>
          <h2>앱에서도 삭제할 수 있습니다</h2>
          <p>
            CrewSync 앱에서 <strong>설정 → 계정 삭제</strong>를 선택해도 같은
            범위의 계정과 데이터가 삭제됩니다.
          </p>
        </section>

        <section>
          <h2>도움이 필요한 경우</h2>
          <p>
            로그인할 수 없다면 계정에 사용한 이메일 주소로
            <a href="mailto:jhjdev1115@gmail.com?subject=CrewSync%20계정%20삭제%20요청"> jhjdev1115@gmail.com</a>에
            삭제 요청을 보내주세요. 본인 확인 후 처리합니다.
          </p>
        </section>

        <footer className="public-policy-footer">
          <Link href="/">CrewSync로 돌아가기</Link>
          <Link href="/privacy">개인정보처리방침</Link>
        </footer>
      </article>
    </main>
  );
}
