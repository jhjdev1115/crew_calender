# vinext-starter

[vinext](https://github.com/cloudflare/vinext) 기반의 깔끔한 풀스택 스타터입니다.
Cloudflare D1과 Drizzle를 선택적으로 사용할 수 있습니다.

## 사전 요구사항

- Node.js `>=22.13.0`

## 빠른 시작

```bash
npm install
npm run dev
npm run build
```

이 스타터는 `wrangler.jsonc`를 사용하지 않습니다.

## 포함 구성

- 사이트 코드는 `app/`에서 수정합니다
- `.openai/hosting.json`에 선택적 Sites D1·R2 바인딩을 선언합니다
- `vite.config.ts`가 선언된 바인딩을 로컬 개발 환경에서 시뮬레이션합니다
- `db/schema.ts`는 의도적으로 비어 있는 상태로 시작합니다
- `examples/d1/`에 선택적 D1 예제 화면이 있습니다
- `drizzle.config.ts`는 필요할 때 로컬 마이그레이션 생성을 지원합니다

## Workspace 인증 헤더

로그인한 방문자는 `oai-authenticated-user-id`와 `oai-authenticated-user-email` 헤더를 모두 받습니다. Private Site는 모든 방문자가 로그인해야 하고, Public Site는 익명 방문자도 있을 수 있으며 이 경우 두 헤더 모두 없습니다.

사용자 ID는 같은 Site의 같은 사용자에게는 안정적으로 유지되고, Site가 다르면 달라집니다. 이메일과 이름은 표시·연락 용도로 사용합니다.

SIWC로 인증된 workspace 사이트는 사용자의 SIWC 프로필에 비어 있지 않은 `name` claim이 있을 때 `oai-authenticated-user-full-name`도 받을 수 있습니다. 전체 이름은 percent-encoded UTF-8이며, `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`과 함께 전달됩니다.

전체 이름은 선택 사항으로 다루고, 없을 때는 이메일로 대체하세요:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## 선택적 Dispatch 소유 ChatGPT 로그인

사이트에 선택적 또는 필수 ChatGPT 로그인이 필요할 때 `app/chatgpt-auth.ts`의 바로 사용할 수 있는 헬퍼를 import하세요:

- 선택적 로그인 UI에는 `getChatGPTUser()`를 사용합니다.
- 익명 방문자를 Sign in with ChatGPT로 보내야 하는 서버 렌더 페이지에는 `requireChatGPTUser(returnTo)`를 사용합니다.
- 브라우저 링크나 액션에는 `chatGPTSignInPath(returnTo)`와 `chatGPTSignOutPath(returnTo)`를 사용합니다.
- 로그인·로그아웃 후 이동할 목적지로 same-origin 상대 경로 `returnTo`를 전달합니다. 헬퍼가 검증하고 안전하게 인코딩합니다.
- 보호된 페이지는 요청별 신원 헤더에 의존하므로 `export const dynamic = "force-dynamic"`으로 표시하세요.

Dispatch가 `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, OAuth 쿠키, 신원 헤더 주입을 소유합니다. 이 예약 경로용 앱 라우트를 구현하지 마세요. 헬퍼를 import·호출하지 않는 라우트는 익명과 호환됩니다.

SIWC는 신원만 확립하며 workspace 멤버십을 증명하지 않습니다. workspace 전역 제한은 Sites 호스팅 플랫폼의 접근 정책 컨트롤을 사용하거나, 서버 측에서 명시적인 멤버십·허용 목록 검사를 강제하세요.

계정 페이지, 사용자별 대시보드, 저장된 기록, 현재 ChatGPT 사용자에 묶인 쓰기 액션에는 SIWC를 사용하세요. 공개 콘텐츠는 익명으로 두세요.

## 유용한 명령어

- `npm run dev`: 로컬 개발 시작
- `npm run build`: vinext 빌드 결과물 검증
- `npm test`: 스타터를 빌드하고 렌더된 로딩 스켈레톤 검증
- `npm run db:generate`: 스키마 변경 후 Drizzle 마이그레이션 생성

## 더 알아보기

- [vinext 문서](https://github.com/cloudflare/vinext)
- [Drizzle D1 가이드](https://orm.drizzle.team/docs/get-started/d1-new)
    