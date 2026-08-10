import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 | CrewSync",
  description: "CrewSync 개인정보처리방침",
};

const effectiveDate = "2026년 8월 11일";

export default function PrivacyPolicyPage() {
  return (
    <main className="public-policy-page">
      <article className="public-policy-card">
        <header className="public-policy-header">
          <Link href="/" className="public-policy-brand" aria-label="CrewSync 홈">
            <span aria-hidden="true">↗</span>
            <strong>CrewSync</strong>
          </Link>
          <p>시행일 {effectiveDate}</p>
          <h1>개인정보처리방침</h1>
          <p className="public-policy-lead">
            CrewSync는 승무 일정 관리와 친구 간 일정 공유에 필요한 최소한의
            정보만 처리하며, 사용자가 자신의 정보를 직접 관리할 수 있도록
            합니다.
          </p>
        </header>

        <section>
          <h2>1. 처리하는 개인정보</h2>
          <ul>
            <li>Google 로그인 정보: 이메일 주소, 표시 이름, Firebase 사용자 ID</li>
            <li>프로필 정보: 역할, 항공사, 베이스 공항, 일정 기준 시간대</li>
            <li>일정 정보: 근무 유형, 날짜와 시각, 편명, 출발·도착 공항</li>
            <li>서비스 정보: 친구 연결, 차단 목록, 알림 설정과 푸시 구독 정보</li>
            <li>구독 이용 시: 상품 ID, 구독 상태와 만료일</li>
          </ul>
        </section>

        <section>
          <h2>2. 이용 목적</h2>
          <p>
            회원 식별과 로그인, 승무 일정 저장·표시, 친구가 허용한 일정 공유,
            항공편 및 일정 알림, 구독 권한 확인, 서비스 보안과 문의 대응에
            사용합니다.
          </p>
        </section>

        <section>
          <h2>3. 로스터 PDF 처리</h2>
          <p>
            사용자가 선택한 로스터 PDF 원본은 브라우저 또는 기기 안에서만
            분석합니다. 원본 PDF와 전체 추출 텍스트는 서버에 업로드하거나
            저장하지 않습니다. 사용자가 결과를 확인한 뒤 등록한 최소 일정
            데이터만 서버에 저장합니다.
          </p>
        </section>

        <section>
          <h2>4. 친구에게 공유되는 정보</h2>
          <p>
            사용자가 친구 연결을 승인한 경우에만 근무 유형, 날짜와 시각,
            편명, 출발·도착 공항을 공유합니다. 개인 메모, 호텔명과 기종은
            친구에게 공유하지 않습니다. 사용자는 언제든 친구 연결을 해제하거나
            상대방을 차단할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>5. 외부 처리 서비스</h2>
          <p>
            로그인에는 Google Firebase Authentication을, 웹 서비스와 데이터
            저장에는 Cloudflare Workers 및 D1을 사용합니다. 유료 구독이
            제공되는 경우 Google Play Billing과 RevenueCat이 결제 및 구독
            상태를 처리할 수 있습니다. CrewSync는 카드번호를 직접 저장하지
            않습니다.
          </p>
        </section>

        <section>
          <h2>6. 보관 및 삭제</h2>
          <p>
            개인정보는 계정과 서비스를 제공하는 동안 보관합니다. 사용자가 계정
            삭제를 요청하면 친구 공유를 중단하고 계정 및 관련 서비스 데이터를
            삭제합니다. 법령상 보관 의무가 있는 정보는 해당 기간 동안 별도로
            보관한 뒤 삭제할 수 있습니다.
          </p>
          <p>
            계정 삭제 방법은 <Link href="/delete-account">계정 삭제 안내</Link>에서
            확인할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>7. 보호 조치</h2>
          <p>
            전송 구간을 HTTPS로 암호화하고, Firebase 인증 토큰으로 사용자별
            접근 권한을 확인하며, 일정과 친구 데이터에 사용자 소유권 검사를
            적용합니다.
          </p>
        </section>

        <section>
          <h2>8. 이용자의 권리</h2>
          <p>
            사용자는 앱에서 자신의 프로필과 일정을 조회·수정·삭제할 수 있고,
            친구 연결을 해제하거나 계정 전체 삭제를 요청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>9. 아동의 개인정보</h2>
          <p>
            CrewSync는 만 18세 이상의 승무원과 성인 사용자를 대상으로 하며,
            미성년자를 대상으로 서비스를 제공하지 않습니다.
          </p>
        </section>

        <section>
          <h2>10. 문의</h2>
          <p>
            개인정보 관련 문의: <a href="mailto:jhjdev1115@gmail.com">jhjdev1115@gmail.com</a>
          </p>
        </section>

        <footer className="public-policy-footer">
          <Link href="/">CrewSync로 돌아가기</Link>
          <Link href="/delete-account">계정 삭제 안내</Link>
        </footer>
      </article>
    </main>
  );
}
