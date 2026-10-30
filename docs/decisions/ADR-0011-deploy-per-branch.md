# ADR-0011 브랜치별 배포 대상 분리

- 상태: 채택 (2026-10-30)
- 관련: [ADR-0004](ADR-0004-deployment.md) 배포 구성, [ADR-0007](ADR-0007-application-profiles.md) 애플리케이션 프로필

## 맥락
저장소 하나에서 두 서비스를 운영한다. 둘은 DB·백엔드·프론트가 모두 따로다.

| 브랜치 | 서비스 | 프론트 (Vercel) | 백엔드 (Render) | DB (Supabase) |
|---|---|---|---|---|
| `main` | 배움일기 코치 1 | 1pk.kr | diary-coach.onrender.com | diaryHelper |
| `service/diary-coach` | 배움일기 코치 2 | dc.1pk.kr | fastapi-langchain-starter.onrender.com | LearnDiary |

배포 게이트(`deploy.yml`)는 `main` 하나만 알았다. 시크릿 `RENDER_DEPLOY_HOOK_URL`과 변수 `BACKEND_URL`도
저장소에 한 벌뿐이라 코치 1만 자동 배포됐고, 코치 2는 Render 대시보드에서 수동 배포해 왔다.
10/30에 저장소 기본 브랜치를 `service/diary-coach`로 바꾸면서 이 불일치가 드러났다.

## 결정
**브랜치 → GitHub Environment**로 매핑하고, 배포에 필요한 값은 Environment 단위로 둔다.

| 브랜치 | Environment | 변수 `BACKEND_URL` | 시크릿 `RENDER_DEPLOY_HOOK_URL` |
|---|---|---|---|
| `main` | `production` | diary-coach.onrender.com | 코치 1 Render 서비스의 훅 |
| `service/diary-coach` | `diary-coach` | fastapi-langchain-starter.onrender.com | 코치 2 Render 서비스의 훅 |

- `deploy.yml`은 두 브랜치의 CI 완료를 모두 받고, `workflow_run.head_branch`로 Environment를 고른다
- Render는 두 서비스 모두 **Deploy Hook** 방식(자동 배포 끔)으로 통일한다. CI를 통과한 커밋만 배포되게 하기 위해서다
- Vercel은 프로젝트마다 Production Branch를 해당 브랜치로 둔다. 워크플로는 관여하지 않는다
- DB는 각 Render 서비스의 `DATABASE_URL`이 가리키는 곳에만 마이그레이션이 적용된다. 워크플로·로컬에서 운영 DB에 접속하는 단계는 두지 않는다

## 결과
- 어느 브랜치에 push해도 "CI → 배포 게이트 → 해당 서비스 배포 → `/health` 확인"이 같은 모양으로 돈다
- `workflow_run` 워크플로는 **기본 브랜치의 파일**로 실행되므로, `deploy.yml`은 두 브랜치에서 같은 내용을 유지해야 한다
- 새 서비스 브랜치를 추가하려면: Environment 생성 → 변수·시크릿 입력 → `deploy.yml`의 `branches`와 Environment 매핑에 한 줄 추가

## 대안
- **Render 자동 배포(GitHub 연결)**: 설정은 쉽지만 CI 실패 커밋도 배포된다. 배포 게이트 요구사항과 어긋난다
- **브랜치별 워크플로 파일 분리**: 파일이 늘고, 기본 브랜치의 파일만 실행되는 `workflow_run` 특성 때문에 오히려 헷갈린다
