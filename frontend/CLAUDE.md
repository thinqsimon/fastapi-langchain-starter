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
