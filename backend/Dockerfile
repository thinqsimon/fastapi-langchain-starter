# 백엔드 컨테이너. 로컬에서 `docker compose --profile full up`으로 전체를 띄울 때 쓴다.
FROM python:3.13-slim

# uv는 의존성 설치가 빠르고 lock 파일을 그대로 재현한다.
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /usr/local/bin/uv

WORKDIR /app

# 의존성만 먼저 복사해 레이어 캐시를 활용한다(소스가 바뀌어도 재설치하지 않음).
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project

COPY . .
RUN uv sync --locked

EXPOSE 8000

# 컨테이너 기동 시 마이그레이션을 적용한 뒤 서버를 띄운다.
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
