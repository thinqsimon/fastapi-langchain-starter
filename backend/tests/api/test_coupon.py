"""COUPON-01: 관리자 쿠폰 발급·취소, 사용자 등록 규칙, 요금제 기한 만료를 실제 DB에서 검증한다."""

import logging
import re
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.domain.auth.models import User
from app.domain.coupon.models import Coupon
from app.domain.coupon.periods import add_duration
from tests.api.accounts import ADMIN, MEMBER
from tests.api.test_diary import auth_headers

ADMIN_URL = "/api/admin/coupons"
REDEEM = "/api/coupons/redeem"
CODE_RE = re.compile(r"^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$")


def _issue(api_client: TestClient, headers: dict[str, str], **payload: object) -> list[dict]:
    body = {"plan": "pro", "duration": "1m", **payload}
    res = api_client.post(ADMIN_URL, json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def _me(api_client: TestClient, headers: dict[str, str]) -> dict:
    return api_client.get("/api/auth/me", headers=headers).json()


def _close(actual_iso: str, expected: datetime, seconds: int = 120) -> bool:
    actual = datetime.fromisoformat(actual_iso)
    return abs((actual - expected).total_seconds()) <= seconds


def test_issue_is_admin_only_and_validated(api_client: TestClient, admin_enabled: None) -> None:
    member = auth_headers(api_client, MEMBER)
    admin = auth_headers(api_client, ADMIN)

    assert (
        api_client.post(
            ADMIN_URL, json={"plan": "pro", "duration": "1m"}, headers=member
        ).status_code
        == 403
    )
    assert api_client.get(ADMIN_URL, headers=member).status_code == 403
    bad = [
        {"plan": "free", "duration": "1m"},
        {"plan": "pro", "duration": "2m"},
        {"plan": "pro", "duration": "1m", "quantity": 0},
        {"plan": "pro", "duration": "1m", "quantity": 21},
        {"plan": "pro", "duration": "1m", "valid_days": 10},
    ]
    assert [api_client.post(ADMIN_URL, json=b, headers=admin).status_code for b in bad] == [422] * 5


def test_issue_makes_unique_codes_with_share_fields(
    api_client: TestClient, admin_enabled: None, caplog: pytest.LogCaptureFixture
) -> None:
    admin = auth_headers(api_client, ADMIN)
    with caplog.at_level(logging.INFO):
        coupons = _issue(
            api_client,
            admin,
            plan="max",
            duration="3m",
            valid_days=7,
            quantity=3,
            memo=" 11월 이벤트 ",
        )
    assert "coupon_issued" in caplog.text

    assert len(coupons) == 3 and len({c["code"] for c in coupons}) == 3
    assert all(CODE_RE.match(c["code"]) for c in coupons)
    assert len({c["batch_id"] for c in coupons}) == 1
    first = coupons[0]
    assert (first["plan"], first["duration"], first["duration_label"], first["memo"]) == (
        "max",
        "3m",
        "3개월",
        "11월 이벤트",
    )
    assert (
        first["status"] == "active"
        and first["redeemed_at"] is None
        and first["redeemed_by_email"] is None
    )
    assert _close(first["expires_at"], datetime.now(UTC) + timedelta(days=7))

    # 목록에도 같은 코드가 있고 상태 필터가 동작한다.
    listed = api_client.get(ADMIN_URL, headers=admin).json()
    assert {c["code"] for c in coupons} <= {c["code"] for c in listed}
    assert (
        api_client.get(ADMIN_URL, params={"status_filter": "redeemed"}, headers=admin).json() == []
    )


def test_revoke_only_unused(api_client: TestClient, admin_enabled: None) -> None:
    admin = auth_headers(api_client, ADMIN)
    coupon = _issue(api_client, admin)[0]

    res = api_client.post(f"{ADMIN_URL}/{coupon['id']}/revoke", headers=admin)
    assert res.status_code == 200 and res.json()["status"] == "revoked" and res.json()["revoked_at"]
    assert api_client.post(f"{ADMIN_URL}/{coupon['id']}/revoke", headers=admin).status_code == 409
    assert (
        api_client.post(
            f"{ADMIN_URL}/00000000-0000-0000-0000-000000000000/revoke", headers=admin
        ).status_code
        == 404
    )
    assert (
        api_client.get(ADMIN_URL, params={"status_filter": "revoked"}, headers=admin).json()[0][
            "code"
        ]
        == coupon["code"]
    )


def test_redeem_applies_plan_from_now_and_marks_coupon_used(
    api_client: TestClient, admin_enabled: None, caplog: pytest.LogCaptureFixture
) -> None:
    admin = auth_headers(api_client, ADMIN)
    member = auth_headers(api_client, MEMBER)
    coupon = _issue(api_client, admin, plan="pro", duration="1m")[0]
    assert _me(api_client, member)["plan"] == "free"

    # 하이픈 없이 소문자로 넣어도 된다.
    with caplog.at_level(logging.INFO):
        res = api_client.post(
            REDEEM, json={"code": coupon["code"].replace("-", "").lower()}, headers=member
        )
    assert res.status_code == 200, res.text
    body = res.json()
    expected_until = add_duration(datetime.now(UTC), "1m")
    assert body["plan"] == "pro" and body["message"] == "Pro 1개월 쿠폰을 등록했어요."
    assert _close(body["plan_expires_at"], expected_until)
    assert "coupon_redeemed" in caplog.text

    me = _me(api_client, member)
    assert me["plan"] == "pro" and _close(me["plan_expires_at"], expected_until)

    used = next(
        c for c in api_client.get(ADMIN_URL, headers=admin).json() if c["code"] == coupon["code"]
    )
    assert used["status"] == "redeemed" and used["redeemed_by_email"] == MEMBER["email"]
    assert _close(used["plan_until"], expected_until)


def test_redeem_rejects_unknown_used_revoked_and_expired(
    api_client: TestClient, admin_enabled: None, db_session: Session
) -> None:
    admin = auth_headers(api_client, ADMIN)
    member = auth_headers(api_client, MEMBER)
    used, revoked, expired = _issue(api_client, admin, quantity=3)

    assert (
        api_client.post(REDEEM, json={"code": "ZZZZ-ZZZZ-ZZZZ"}, headers=member).status_code == 404
    )
    assert api_client.post(REDEEM, json={"code": used["code"]}, headers=member).status_code == 200
    res = api_client.post(REDEEM, json={"code": used["code"]}, headers=member)
    assert res.status_code == 409 and res.json()["error"]["message"] == "이미 사용한 쿠폰이에요."

    api_client.post(f"{ADMIN_URL}/{revoked['id']}/revoke", headers=admin)
    res = api_client.post(REDEEM, json={"code": revoked["code"]}, headers=member)
    assert res.status_code == 409 and res.json()["error"]["message"] == "취소된 쿠폰이에요."

    row = db_session.query(Coupon).filter_by(code=expired["code"].replace("-", "")).one()
    row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.flush()
    res = api_client.post(REDEEM, json={"code": expired["code"]}, headers=member)
    assert (
        res.status_code == 409 and res.json()["error"]["message"] == "등록 기한이 지난 쿠폰이에요."
    )
    assert any(
        c["code"] == expired["code"]
        for c in api_client.get(
            ADMIN_URL, params={"status_filter": "expired"}, headers=admin
        ).json()
    )


def test_same_plan_extends_higher_needs_confirm_lower_is_rejected(
    api_client: TestClient, admin_enabled: None
) -> None:
    admin = auth_headers(api_client, ADMIN)
    member = auth_headers(api_client, MEMBER)
    pro_a, pro_b = _issue(api_client, admin, plan="pro", duration="7d", quantity=2)
    (max_c,) = _issue(api_client, admin, plan="max", duration="15d")
    (pro_d,) = _issue(api_client, admin, plan="pro", duration="7d")

    # 첫 Pro: 지금부터 7일. 같은 Pro를 또 넣으면 그 뒤에 7일을 이어 붙인다.
    first = api_client.post(REDEEM, json={"code": pro_a["code"]}, headers=member).json()
    second = api_client.post(REDEEM, json={"code": pro_b["code"]}, headers=member).json()
    assert _close(
        second["plan_expires_at"],
        datetime.fromisoformat(first["plan_expires_at"]) + timedelta(days=7),
        seconds=5,
    )

    # 상위(Max)는 확인이 필요하다. 확인하면 지금부터 15일이고 남은 Pro는 사라진다.
    res = api_client.post(REDEEM, json={"code": max_c["code"]}, headers=member)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "CONFIRM_REQUIRED"
    assert res.json()["error"]["details"]["current_plan"] == "pro"
    assert _me(api_client, member)["plan"] == "pro"  # 아직 바뀌지 않았다
    res = api_client.post(REDEEM, json={"code": max_c["code"], "confirm": True}, headers=member)
    assert res.status_code == 200 and res.json()["plan"] == "max"
    assert _close(res.json()["plan_expires_at"], datetime.now(UTC) + timedelta(days=15))

    # 하위(Pro)는 Max 이용 중엔 거부되고 쿠폰은 살아 있다.
    res = api_client.post(REDEEM, json={"code": pro_d["code"]}, headers=member)
    assert res.status_code == 409 and "Max가 끝난 뒤" in res.json()["error"]["message"]
    assert (
        next(
            c for c in api_client.get(ADMIN_URL, headers=admin).json() if c["code"] == pro_d["code"]
        )["status"]
        == "active"
    )


def test_unlimited_plan_set_by_admin_rejects_same_plan_coupon(
    api_client: TestClient, admin_enabled: None
) -> None:
    admin = auth_headers(api_client, ADMIN)
    member = auth_headers(api_client, MEMBER)
    member_id = api_client.get(
        "/api/admin/users", params={"q": MEMBER["email"]}, headers=admin
    ).json()[0]["id"]
    api_client.patch(f"/api/admin/users/{member_id}/plan", json={"plan": "pro"}, headers=admin)
    assert _me(api_client, member)["plan_expires_at"] is None

    (coupon,) = _issue(api_client, admin, plan="pro", duration="1m")
    res = api_client.post(REDEEM, json={"code": coupon["code"]}, headers=member)
    assert res.status_code == 409 and "기한 없이" in res.json()["error"]["message"]


def test_expired_paid_plan_falls_back_to_free_on_next_request(
    api_client: TestClient, db_session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    member = auth_headers(api_client, MEMBER)
    user = db_session.query(User).filter_by(email=MEMBER["email"]).one()
    user.plan = "max"
    user.plan_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.flush()

    with caplog.at_level(logging.INFO):
        me = _me(api_client, member)
    assert me["plan"] == "free" and me["plan_expires_at"] is None
    assert "plan_expired" in caplog.text

    # 아직 기한이 남은 요금제는 그대로다.
    user.plan = "pro"
    user.plan_expires_at = datetime.now(UTC) + timedelta(days=1)
    db_session.flush()
    assert _me(api_client, member)["plan"] == "pro"
