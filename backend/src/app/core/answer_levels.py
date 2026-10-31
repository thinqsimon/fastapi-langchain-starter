"""답변 수준(CHAT-03). 고른 단계에 맞춰 채팅·일기 초안·주간 회고의 어휘와 설명 깊이를 바꾼다.

AX 풀스택 입과자(성인) 대상이라 어느 단계든 존댓말이고, 바뀌는 것은 어휘·설명 깊이·예시 방식이다.
단계 번호와 설명(대상·방식·예시)은 여기서 관리하고, 단계 이름만 관리자가 화면에서 바꿀 수 있다
(answer_level_names 테이블, 없으면 default_name). 모델에게 주는 지시는 llm/prompts/answer_level.py.
"""

from dataclasses import dataclass
from typing import Literal

AnswerLevel = Literal[1, 2, 3, 4, 5]
ANSWER_LEVELS: tuple[AnswerLevel, ...] = (1, 2, 3, 4, 5)
# 아직 고르지 않은 사용자(users.answer_level이 NULL)는 이 단계로 답한다.
DEFAULT_ANSWER_LEVEL: AnswerLevel = 2
NAME_MAX_LENGTH = 20


@dataclass(frozen=True)
class LevelInfo:
    default_name: str
    # 화면에 보이는 "누구를 위한 단계인지"와 "어떻게 답하는지"
    audience: str
    style: str
    # 'API'를 이 단계로 설명한 예. 고를 때 차이를 바로 느끼게 보여 준다.
    example: str


LEVEL_INFO: dict[int, LevelInfo] = {
    1: LevelInfo(
        default_name="왕초보",
        audience="컴퓨터·IT 용어가 낯선 분",
        style="중학생도 아는 쉬운 말, 일상 비유 먼저, 용어는 바로 풀이, 코드는 최소로",
        example=(
            "API는 식당의 주문 창구 같은 거예요. 손님이 정해진 방식으로 주문하면 주방이 "
            "음식을 내주듯, 프로그램이 정해진 방식으로 부탁하면 결과를 돌려줘요."
        ),
    ),
    2: LevelInfo(
        default_name="입문",
        audience="비전공으로 막 입과한 분",
        style="핵심 용어 소개와 한 줄 풀이, 비유 다음 짧은 코드와 주석, 흔한 실수",
        example=(
            "API(Application Programming Interface)는 프로그램끼리 정해진 규칙으로 요청과 "
            "응답을 주고받는 창구예요. 날씨 앱은 날씨 API에 요청을 보내 받은 결과를 "
            "화면에 보여 줘요."
        ),
    ),
    3: LevelInfo(
        default_name="기초",
        audience="변수·함수·조건문을 익힌 분",
        style="아는 용어는 그대로, 새 개념만 풀이, 단계별 예제와 그렇게 되는 이유",
        example=(
            "API는 다른 프로그램의 기능을 함수처럼 불러 쓰는 약속이에요. "
            "fetch('/api/weather')로 요청하면 서버가 JSON을 돌려주고, "
            "그 값을 변수에 담아 화면에 그립니다."
        ),
    ),
    4: LevelInfo(
        default_name="실전",
        audience="웹 프로젝트를 만드는 분",
        style="동작 원리·설계 이유·장단점, 실무형 코드와 디버깅 방법",
        example=(
            "REST API는 리소스를 URL로, 동작을 HTTP 메서드로 표현합니다. 상태 코드로 결과를 "
            "구분하고, 실패했을 때 재시도할지 클라이언트가 판단할 수 있게 설계해야 합니다."
        ),
    ),
    5: LevelInfo(
        default_name="심화",
        audience="전공자·실무 경험자",
        style="기초 생략, 정확한 용어로 간결하게, 내부 동작·트레이드오프·공식 문서",
        example=(
            "REST API 설계에서는 리소스 모델링, 멱등성, 버전 관리, 페이지네이션 전략이 핵심입니다. "
            "PUT과 PATCH의 의미 차이와 캐시 헤더 설계가 클라이언트 재시도 정책에 영향을 줍니다."
        ),
    ),
}


def effective_answer_level(level: int | None) -> int:
    """사용자가 고르지 않았거나 알 수 없는 값이면 기본 단계(2 입문)로 답한다."""
    return level if level is not None and level in LEVEL_INFO else DEFAULT_ANSWER_LEVEL
