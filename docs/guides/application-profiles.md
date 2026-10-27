# 스타터킷과 배움일기 코치 실행

서비스 브랜치는 `service/diary-coach`이며 기본 프로필은 기존 서비스와 같은 `diary-coach`다.
브랜치를 바꾸는 작업과 실행 프로필 선택은 서로 독립적이다.

## 개발 실행

기존 README의 의존성 설치와 로컬 DB·마이그레이션 준비 후 저장소 루트에서 실행한다.
각 명령은 별도 터미널에서 실행한다. Node 런처는 비밀 파일을 읽거나 출력하지 않는다.

```sh
# 공통 스타터킷
node scripts/dev.mjs starter backend
node scripts/dev.mjs starter frontend

# 배움일기 코치
node scripts/dev.mjs diary-coach backend
node scripts/dev.mjs diary-coach frontend
```

서버 옵션도 전달할 수 있다. 예: `node scripts/dev.mjs starter backend --port 8001`.
포트를 바꾸면 프론트엔드의 `NEXT_PUBLIC_API_BASE_URL`과 백엔드 CORS도 맞춘다.
두 구성을 동시에 띄우려면 각 구성에 다른 포트와 필요에 따라 별도 로컬 DB를 사용한다.

## 환경 변수로 직접 실행

| 변수 | 적용 시점 | 값 |
|---|---|---|
| `APP_PROFILE` | 백엔드 시작 | `starter` 또는 `diary-coach` |
| `NEXT_PUBLIC_APP_PROFILE` | 프론트엔드 dev 시작 또는 build | 같은 프로필 |
| `APP_NAME` | 백엔드 시작 | 선택 사항, 비우면 프로필 기본 이름 |
| `NEXT_PUBLIC_APP_NAME` | 프론트엔드 build | 선택 사항, 비우면 프로필 기본 이름 |

백엔드는 저장소 루트 `.env`를 읽지만 Next.js는 루트 `.env`를 자동으로 읽지 않는다.
프론트엔드 값은 실행 환경이나 `frontend/.env.local`에 넣는다. 런처를 쓰면 프로필은
자동으로 맞춰진다. 이름을 바꿀 경우 두 이름 설정도 맞춘다.
배포 환경에서는 각 플랫폼에 같은 프로필을 지정하고 프론트엔드를 다시 빌드한다.
공개 변수에 API 키나 DB 비밀번호를 넣지 않는다.

## 제공 기능

starter는 회원·계정 설정, 대화·SSE, LLM 공급자, 사용량과 선택적 RAG를 제공한다.
diary-coach는 여기에 일기, 회고, 학습장(마크다운 노트 업로드), 캐치프레이즈와 푸터 설정을 추가한다.
starter에서 `/api/diary`, `/api/notebooks`, `/api/me/preferences`, 화면 `/diary`·`/notebook`은 404다.
공통 API 주소와 요청·응답 형식은 기존과 같다.

기존 테이블과 Alembic 이력은 두 모드에서 보존한다. 프로필은 기능 노출을 선택하며
샘플 코드를 물리적으로 삭제하거나 DB 테이블을 제거하는 기능이 아니다.

## 검증

기존 `./scripts/verify.sh`와 서비스 프로필 E2E를 실행한다. starter E2E는 다음처럼 실행한다.

```sh
APP_PROFILE=starter NEXT_PUBLIC_APP_PROFILE=starter ./scripts/e2e.sh
```

CI는 기존 서비스 E2E와 starter 전용 E2E를 각각 실행한다.
실제 LLM 호출은 하지 않으며 `LLM_PROVIDER=fake`를 사용한다.
프로필 변경과 운영 배포는 별도 작업이며 운영 데이터에 테스트를 실행하지 않는다.

구조와 DB 보존 원칙: [ADR-0007](../decisions/ADR-0007-application-profiles.md).
