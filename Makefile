# 사람·에이전트·CI가 모두 같은 진입점을 쓴다.
.PHONY: init db dev-backend dev-frontend migrate migration verify fork-verify clean-test-accounts

init:            ## 최초 1회: .env 생성, 의존성 설치, DB 기동, 마이그레이션
	./scripts/init.sh

db:              ## 로컬 Postgres(pgvector) 기동
	docker compose up -d db

dev-backend:     ## http://localhost:8000 (docs: /docs)
	cd backend && uv run fastapi dev src/app/main.py

dev-frontend:    ## http://localhost:3000
	cd frontend && npm run dev

migrate:         ## 마이그레이션 적용
	cd backend && uv run alembic upgrade head

migration:       ## 모델 변경 후 마이그레이션 생성: make migration m="add users"
	cd backend && uv run alembic revision --autogenerate -m "$(m)"

verify:          ## 단일 품질 게이트 (커밋 전·CI 동일)
	./scripts/verify.sh

fork-verify:     ## 새 폴더에 clone해 문서대로 실행되는지 검증
	./scripts/fork-verify.sh

clean-test-accounts: ## @example.com 테스트 계정 정리. 기본은 목록만, 삭제: make clean-test-accounts args="--delete"
	./scripts/clean-test-accounts.sh $(args)
