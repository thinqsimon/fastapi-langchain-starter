@AGENTS.md

# Frontend 규칙

Next.js 16(App Router) + TypeScript + Tailwind 4 + shadcn(base-nova) + zustand + axios.
코드 작성 전 위 AGENTS.md 지시대로 `node_modules/next/dist/docs/`의 해당 가이드를 확인한다.

- 라우트: `app/(auth)/` 비로그인 화면, `app/(main)/` 로그인 필요 화면
- API 호출은 `api/<도메인>.ts` 함수로만 (컴포넌트에서 axios 직접 호출 금지). 클라이언트는 `api/client.ts`
- 전역 상태는 `store/<이름>.ts`(zustand). 서버 데이터 캐시는 필요해질 때 결정(ADR)
- UI는 `npx shadcn@latest add <component>`로 `components/ui`에 추가 후 사용
- 환경 변수는 `NEXT_PUBLIC_` 접두사만 브라우저에서 사용 가능
- 포맷: prettier(4칸, 세미콜론 없음). 커밋 전 `../scripts/verify.sh frontend`
- E2E(`../scripts/e2e.sh`)에서 `getByRole("alert")`는 Next.js의 route announcer와 겹친다.
  화면 메시지를 찾을 땐 `page.locator('p[role="alert"]')`처럼 범위를 좁힌다
- 상태를 불러오는 로직은 컴포넌트 `useEffect` 안에서 직접 setState 하지 말고 `store/`의 zustand 액션으로 옮긴다
  (eslint `react-hooks/set-state-in-effect`가 막는다)
