# CrewSync

승무원과 친구가 일정을 안전하게 공유하고, 같은 날짜 휴무를 확인하는 캘린더 앱입니다.

스택: [vinext](https://github.com/cloudflare/vinext) · Cloudflare Workers/D1 · Drizzle · Firebase Auth · `pdfjs-dist`

## 주요 기능

- Google / 이메일 Firebase 로그인
- 승무원 · 파트너 역할 온보딩
- 월간 캘린더, 일정 등록·수정·삭제
- **로스터 PDF 기기 내 분석** — PDF 원본을 서버/AI로 올리지 않음
- 초대 코드로 친구 연동 (무료 최대 5명, Pro는 확장)
- 친구에게는 요약 일정만 공유 (편명·기종·호텔·메모 제외)
- 차단 목록, 웹 푸시 알림
- Pro: 이번 달 비행시간·진행률 통계
- 이용약관 · 개인정보 · 계정 삭제 요청

## 사전 요구사항

- Node.js `>=22.13.0`
- Firebase 프로젝트 (Auth)
- 로컬/배포용 환경 변수 (아래 참고)

## 빠른 시작

```bash
cp .env.example .env
npm install
npm run dev
```

`.env`에 Firebase·초대 코드·VAPID 값을 채운 뒤, 터미널에 나온 주소로 접속하세요.

```bash
npm run build
npm run start
```

## 환경 변수

로컬은 프로젝트 루트 `.env`를 사용합니다. 예시 키는 `.env.example`에 있습니다.

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_FIREBASE_*` | 클라이언트 Firebase 설정 |
| `FIREBASE_PROJECT_ID` | 서버에서 ID 토큰 검증 |
| `INVITE_PEPPER` | 초대 코드 해시용 비밀값 |
| `VAPID_*` | 웹 푸시 |

프로덕션 시크릿은 Cloudflare 바인딩/시크릿으로 넣습니다.

```bash
npm run secrets:cloudflare
```

## 프로젝트 구조

| 경로 | 설명 |
|------|------|
| `app/page.tsx` | 메인 UI |
| `app/globals.css` | 스타일 |
| `app/firebase-client.ts` | Firebase 클라이언트 |
| `app/roster-local-parser.ts` | PDF 로컬 파싱 (pdf.js) |
| `app/roster-token-parser.ts` | 텍스트 토큰 → 일정 변환 |
| `app/api/` | duties, invites, blocks, subscription, push 등 |
| `db/schema.ts` | D1 / Drizzle 스키마 |
| `drizzle/` | 마이그레이션 |
| `worker/index.ts` | Worker 엔트리 |
| `wrangler.jsonc` | Cloudflare 배포 설정 |

## 로스터 PDF 분석

PDF는 **브라우저(기기) 안에서만** 분석합니다.

1. PDF 선택
2. `pdfjs-dist`로 텍스트 추출
3. 카타르 스타일 규칙으로 일정 변환
4. 확인 후 구조화된 일정만 서버 저장
5. PDF 원본은 DB에 저장하지 않음

`/api/roster/analyze`는 원본 업로드를 받지 않습니다 (410).  
저장은 `/api/roster/import`로 구조화된 항목만 보냅니다.

## 친구 공유 범위

**공유됨**
- 일정 유형 (비행/휴무/대기 등)
- 날짜·출도착 시각
- 출발·도착 공항
- 체류 도시

**공유되지 않음**
- 편명, 기종, 호텔명, 메모

## 스타일

`app/globals.css`에서 수정합니다.  
모바일(`max-width: 900px`) 미디어쿼리가 기본값을 덮을 수 있으니 폰 프레임 확인 시 해당 구간도 함께 보세요.

## 배포 (Cloudflare)

```bash
npm run build
npm run db:migrate:cloudflare
npm run deploy:cloudflare
```

- D1 DB: `crewsync-production` (`wrangler.jsonc`)
- 마이그레이션 디렉터리: `drizzle/`

## 유용한 명령어

- `npm run dev` — 로컬 개발
- `npm run build` — 빌드
- `npm run start` — 빌드 결과 실행
- `npm test` — 스모크 테스트
- `npm run lint` — ESLint
- `npm run db:generate` — Drizzle 마이그레이션 생성
- `npm run deploy:cloudflare` — Cloudflare 배포
- `npm run db:migrate:cloudflare` — 원격 D1 마이그레이션
- `npm run secrets:cloudflare` — 시크릿 설정 도우미

## 참고

- [vinext](https://github.com/cloudflare/vinext)
- [Drizzle D1](https://orm.drizzle.team/docs/get-started/d1-new)
- [pdf.js](https://github.com/mozilla/pdf.js)
- [Firebase Auth](https://firebase.google.com/docs/auth)
