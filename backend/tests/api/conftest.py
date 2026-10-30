"""API 테스트 공용 fixture."""

import pytest
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.admin.models import LlmPlanRoute, LlmProvider
from app.domain.coupon.models import Coupon
from tests.api.accounts import ADMIN


@pytest.fixture
def admin_enabled(monkeypatch: pytest.MonkeyPatch, db_session: Session) -> None:
    """설정 파일 기준으로 ADMIN 계정을 관리자로 만들고, 키 암호화용 키도 준다.

    공급자 설정·쿠폰은 서버 전체의 것이라 E2E가 같은 로컬 DB에 남긴 행이 있을 수 있다.
    테스트 트랜잭션 안에서 지우고 시작한다(끝나면 되돌아간다).
    """
    db_session.query(LlmPlanRoute).delete()
    db_session.query(LlmProvider).delete()
    db_session.query(Coupon).delete()
    db_session.flush()
    monkeypatch.setattr(settings, "ADMIN_EMAILS", f" {ADMIN['email'].upper()} ,")
    monkeypatch.setattr(settings, "SETTINGS_ENCRYPTION_KEY", Fernet.generate_key().decode())
