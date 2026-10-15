# 샘플앱: AI 배움일기 코치

스타터킷을 Fork해 새 서비스를 만드는 **실제 예시**. 이 앱을 만들며 바꾼 지점이 곧 사용 가이드의 "커스터마이징" 절이 된다.

| 변경 지점 | 위치 (예정) | feature |
|---|---|---|
| 코치 페르소나 프롬프트 | `backend/src/app/llm/prompts/diary_coach.py` | SAMPLE-01 |
| `DiaryEntry` 모델·마이그레이션 | `backend/src/app/domain/diary/` | SAMPLE-01 |
| 대화 → 일기 초안 생성 서비스 | `domain/diary/services.py` | SAMPLE-01 |
| 일기 목록·상세·주간 회고 화면 | `frontend/app/(main)/diary/` | SAMPLE-02 |

기획 상세: [docs/plans/04_샘플앱_배움일기코치_기획.md](../../docs/plans/04_샘플앱_배움일기코치_기획.md)
