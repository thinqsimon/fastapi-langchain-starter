# Backend 규칙

실행은 항상 `backend/`에서 `uv run ...`. Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic, LangChain.

## 도메인 폴더 = 기능 단위
`src/app/domain/<name>/`
| 파일 | 역할 | 의존 가능 |
|---|---|---|
| `routers.py` | `APIRouter`, 요청 검증, `Depends`로 인증·세션 주입 | services, schemas |
| `services.py` | 비즈니스 로직, 트랜잭션 경계, LLM 호출 | repositories, schemas, `app.llm` |
| `repositories.py` | SQLAlchemy 쿼리만 | models |
| `models.py` | ORM 모델 (`app.core.database.Base` 상속) | — |
| `schemas.py` | Pydantic 요청/응답 | — |

새 도메인 추가 시: `app/api.py`에 라우터 등록, `app/models.py`에 모델 import,
`pyproject.toml`의 import-linter `containers`에 추가, `make migration`.

## 규칙
- 서비스 예외는 `app.core.exceptions`의 `NotFoundError`/`ConflictError`/`UnauthorizedError` 등 사용
- 로깅은 `logging.getLogger(__name__)`. print 금지. 토큰·비밀번호·API 키는 로그 금지
- 시간은 UTC(`datetime.now(UTC)`), PK는 정수 또는 UUID로 도메인마다 통일
- 테스트: `tests/api/test_<domain>.py`. LLM은 `app.llm.fake` 사용
- 커밋 전 `../scripts/verify.sh backend`
