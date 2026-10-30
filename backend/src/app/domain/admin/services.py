"""admin 도메인 - 비즈니스 로직.

관리자 화면(ADMIN-01·02·03)의 세 가지 일:
1. 공급자별 API 키 보관(`AdminLlmSettingsService.update_provider_key`)
2. 요금제별 라우팅(어느 공급자의 어느 모델을 어떤 순서로) 관리와, chat/diary가 부르는
   `active_provider_chain(plan)`
3. 사용자 검색·요금제 지정·"이 계정으로 테스트" 토큰(`AdminUserService`)
"""

import logging
import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppError, NotFoundError, ServiceUnavailableError
from app.core.plans import DEFAULT_PLAN, PLANS
from app.core.security import create_access_token, decrypt_secret, encrypt_secret
from app.domain.admin.models import LlmPlanRoute, LlmProvider
from app.domain.admin.repositories import LlmPlanRouteRepository, LlmProviderRepository
from app.domain.admin.schemas import (
    ALLOWED_PROVIDERS,
    ActingTokenResponse,
    AdminUserRead,
    ProviderKeyRead,
    ProviderKeyUpdate,
    RouteCreate,
    RouteRead,
    RouteUpdate,
)
from app.domain.auth.models import User
from app.domain.auth.repositories import UserRepository
from app.llm.providers import ProviderAttempt

logger = logging.getLogger(__name__)


class AdminLlmSettingsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.providers = LlmProviderRepository(db)
        self.routes = LlmPlanRouteRepository(db)

    # ----- 공급자 키 -----

    def _ensure_providers(self) -> dict[str, LlmProvider]:
        """세 공급자 행이 항상 있게 한다. 없는 것만 키 없이 만든다(기존 키는 그대로 둔다)."""
        rows = {row.provider: row for row in self.providers.list_all()}
        missing = [p for p in ALLOWED_PROVIDERS if p not in rows]
        for provider in missing:
            rows[provider] = self.providers.create(provider)
        if missing:
            self.db.commit()
        return rows

    def list_providers(self) -> list[ProviderKeyRead]:
        rows = self._ensure_providers()
        return [_to_key_read(rows[p]) for p in ALLOWED_PROVIDERS]

    def update_provider_key(self, provider: str, payload: ProviderKeyUpdate) -> ProviderKeyRead:
        row = self._ensure_providers().get(provider)
        if row is None:
            raise NotFoundError("등록되지 않은 공급자입니다.")
        row.encrypted_api_key = encrypt_secret(payload.api_key) if payload.api_key else None
        self.db.commit()
        # 키 값은 로그에 남기지 않는다.
        logger.info(
            "llm_provider_key_updated provider=%s has_key=%s",
            provider,
            row.encrypted_api_key is not None,
        )
        return _to_key_read(row)

    # ----- 요금제별 라우팅 -----

    def list_routes(self) -> list[RouteRead]:
        keys = self._key_presence()
        return [_to_route_read(route, keys) for route in self.routes.list_all()]

    def create_route(self, payload: RouteCreate) -> RouteRead:
        self._ensure_providers()
        route = self.routes.create(
            plan=payload.plan,
            provider=payload.provider,
            model=payload.model,
            priority=self.routes.next_priority(payload.plan),
        )
        self.db.commit()
        logger.info(
            "llm_route_created plan=%s provider=%s model=%s",
            route.plan,
            route.provider,
            route.model,
        )
        return _to_route_read(route, self._key_presence())

    def update_route(self, route_id: uuid.UUID, payload: RouteUpdate) -> RouteRead:
        route = self.routes.get(route_id)
        if route is None:
            raise NotFoundError("라우트를 찾을 수 없습니다.")

        fields = payload.model_fields_set
        if "model" in fields and payload.model:
            route.model = payload.model
        if "priority" in fields and payload.priority is not None:
            route.priority = payload.priority
        if "enabled" in fields and payload.enabled is not None:
            route.enabled = payload.enabled
        if "forced" in fields and payload.forced is not None:
            if payload.forced:
                self.routes.clear_forced_except(route.plan, route.id)
            route.forced = payload.forced

        self.db.commit()
        logger.info(
            "llm_route_updated id=%s plan=%s fields=%s", route.id, route.plan, sorted(fields)
        )
        return _to_route_read(route, self._key_presence())

    def delete_route(self, route_id: uuid.UUID) -> None:
        route = self.routes.get(route_id)
        if route is None:
            raise NotFoundError("라우트를 찾을 수 없습니다.")
        plan, provider = route.plan, route.provider
        self.routes.delete(route)
        self.db.commit()
        logger.info("llm_route_deleted id=%s plan=%s provider=%s", route_id, plan, provider)

    def active_provider_chain(self, plan: str = DEFAULT_PLAN) -> list[ProviderAttempt]:
        """이 요금제의 요청이 실제로 시도할 공급자 순서.

        1. 그 요금제의 라우트 중 켜져 있고 공급자 키가 있는 것만, 우선순위대로
        2. 강제 라우트가 있으면 그것 하나만(자동 전환 없음)
        3. 라우트가 하나도 없으면 free 요금제의 라우트로(새 요금제를 아직 설정하지 않았을 때)
        4. 그것도 없으면 빈 목록 → 호출부가 `.env`의 공급자 하나를 쓴다(설정을 건드린 적 없는 Fork)
        """
        if plan not in PLANS:
            plan = DEFAULT_PLAN
        keys = {row.provider: row.encrypted_api_key for row in self.providers.list_all()}

        def usable(candidates: list[LlmPlanRoute]) -> list[LlmPlanRoute]:
            return [r for r in candidates if r.enabled and keys.get(r.provider)]

        routes = usable(self.routes.list_for_plan(plan))
        if not routes and plan != DEFAULT_PLAN:
            routes = usable(self.routes.list_for_plan(DEFAULT_PLAN))
        forced = next((r for r in routes if r.forced), None)
        ordered = [forced] if forced is not None else routes

        attempts: list[ProviderAttempt] = []
        for route in ordered:
            try:
                attempts.append(
                    ProviderAttempt(
                        provider=route.provider,
                        model=route.model,
                        api_key=decrypt_secret(keys[route.provider] or ""),
                    )
                )
            except ServiceUnavailableError:
                # 암호화 키가 바뀌는 등으로 복호화를 못 하면 이 라우트만 건너뛴다.
                logger.warning("llm_provider_key_decrypt_failed provider=%s", route.provider)
        return attempts

    def _key_presence(self) -> dict[str, bool]:
        return {
            row.provider: row.encrypted_api_key is not None for row in self.providers.list_all()
        }


def _to_key_read(row: LlmProvider) -> ProviderKeyRead:
    return ProviderKeyRead(
        provider=row.provider,  # type: ignore[arg-type]
        has_api_key=row.encrypted_api_key is not None,
        updated_at=row.updated_at,
    )


def _to_route_read(route: LlmPlanRoute, keys: dict[str, bool]) -> RouteRead:
    return RouteRead(
        id=route.id,
        plan=route.plan,  # type: ignore[arg-type]
        priority=route.priority,
        provider=route.provider,  # type: ignore[arg-type]
        model=route.model,
        enabled=route.enabled,
        forced=route.forced,
        has_api_key=keys.get(route.provider, False),
    )


class AdminUserService:
    """사용자 검색, 요금제 지정(ADMIN-03), '이 계정으로 테스트'(ADMIN-02).

    테스트 토큰은 신고된 오류를 관리자가 그 계정 그대로 재현하기 위한 것. 감사 기록은 서버 로그.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    def search(self, query: str, limit: int = 20) -> list[AdminUserRead]:
        return [AdminUserRead.model_validate(u) for u in self.users.search(query.strip(), limit)]

    def set_plan(self, admin: User, target_id: uuid.UUID, plan: str) -> AdminUserRead:
        """구독 결제가 생기기 전까지는 관리자가 요금제를 손으로 지정한다."""
        target = self.users.get_by_id(target_id)
        if target is None:
            raise NotFoundError("사용자를 찾을 수 없습니다.")
        previous = target.plan
        target.plan = plan
        self.db.commit()
        logger.info(
            "admin_plan_changed admin=%s target=%s plan=%s previous=%s",
            admin.id,
            target.id,
            plan,
            previous,
        )
        return AdminUserRead.model_validate(target)

    def create_acting_token(self, admin: User, target_id: uuid.UUID) -> ActingTokenResponse:
        target = self.users.get_by_id(target_id)
        if target is None or not target.is_active:
            raise NotFoundError("사용자를 찾을 수 없습니다.")
        if target.id == admin.id:
            raise AppError("자기 계정은 테스트 대상이 될 수 없습니다.")

        minutes = settings.ADMIN_TEST_TOKEN_EXPIRE_MINUTES
        token = create_access_token(str(target.id), actor=str(admin.id), expires_minutes=minutes)
        logger.info(
            "admin_test_started admin=%s target=%s minutes=%s", admin.id, target.id, minutes
        )
        return ActingTokenResponse(
            access_token=token, expires_in=minutes * 60, user=AdminUserRead.model_validate(target)
        )
