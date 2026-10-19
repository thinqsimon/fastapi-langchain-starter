# 아키텍처

> 산출물 "스타터킷 설계서"의 ②·④ 항목 원본. 구현이 진행되면 함께 갱신한다.

## 전체 구성

```mermaid
flowchart LR
    U[사용자] --> FE[Next.js 프론트엔드<br/>app · api · store]
    FE -- REST / SSE + JWT --> R
    subgraph BE[FastAPI 백엔드]
        R[routers] --> S[services] --> RP[repositories]
        S --> L[llm 모듈<br/>providers · prompts · chains · rag]
        C[core<br/>config · security · exceptions · logging]
    end
    RP --> DB[(PostgreSQL<br/>+ pgvector)]
    L --> LLM[LLM API]
```

## 배포 흐름

```mermaid
flowchart LR
    P[git push / PR] --> CI[GitHub Actions CI<br/>scripts/verify.sh]
    CI -- 실패 --> X[배포 중단]
    CI -- main 성공 --> G[배포 게이트<br/>workflow_run success]
    G --> D[자동 배포 TBD] --> H["/health 확인"]
```

## 요청 흐름 (채팅 스트리밍)
1. 로그인 → access/refresh JWT 발급
2. 프론트가 `Authorization: Bearer`로 `POST /api/chat/{id}/stream` 호출
3. router가 토큰 검증 → `ChatService` 호출
4. service가 repository로 대화 이력 조회 → `get_chat_model()` + 프롬프트로 스트리밍 호출
5. 토큰을 SSE로 전달, 종료 시 assistant 메시지와 토큰 사용량 저장
6. 프론트가 토큰을 실시간 렌더링
