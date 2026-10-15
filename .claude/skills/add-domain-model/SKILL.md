---
name: add-domain-model
description: 백엔드에 새 도메인(예: diary)과 DB 모델을 추가할 때 사용. 폴더 스캐폴드, 등록 지점 수정, 마이그레이션 생성까지 수행한다.
---
# 도메인·모델 추가 (`<name>` = 소문자 단수, 예: diary)

1. `backend/src/app/domain/<name>/`에 `__init__.py routers.py services.py repositories.py models.py schemas.py` 생성
   - 형식은 기존 도메인(예: `domain/auth`)을 그대로 따른다
2. `models.py`: `from app.core.database import Base` 상속, 테이블명 복수형, `created_at`/`updated_at`(UTC)
3. 등록 지점 3곳 수정
   - `backend/src/app/api.py`: `api_router.include_router(...)`
   - `backend/src/app/models.py`: 모델 import
   - `backend/pyproject.toml` `[tool.importlinter]` layers 계약의 `containers`에 `app.domain.<name>` 추가
4. DB가 떠 있으면 `make migration m="add <name>"` → 생성 파일 검토 → `make migrate`
5. `backend/tests/api/test_<name>.py` 생성, `./scripts/verify.sh backend`
