import chatAssistantMessage from "@/public/guide/chat-assistant-message.webp"
import chatComposer from "@/public/guide/chat-composer.webp"
import chatExchange from "@/public/guide/chat-exchange.webp"
import chatPlusMenu from "@/public/guide/chat-plus-menu.webp"
import chatPlusMenuActive from "@/public/guide/chat-plus-menu-active.webp"
import chatSidebar from "@/public/guide/chat-sidebar.webp"
import chatSidebarCollapsed from "@/public/guide/chat-sidebar-collapsed.webp"
import diaryEdit from "@/public/guide/diary-edit.webp"
import diaryEntryCard from "@/public/guide/diary-entry-card.webp"
import diaryPicker from "@/public/guide/diary-picker.webp"
import diaryPreview from "@/public/guide/diary-preview.webp"
import diaryStudyReview from "@/public/guide/diary-study-review.webp"
import diaryTop from "@/public/guide/diary-top.webp"
import diaryWeeklyReview from "@/public/guide/diary-weekly-review.webp"
import notebookHelp from "@/public/guide/notebook-help.webp"
import notebookKeptView from "@/public/guide/notebook-kept-view.webp"
import notebookList from "@/public/guide/notebook-list.webp"
import notebookOverview from "@/public/guide/notebook-overview.webp"
import notebookSelectMode from "@/public/guide/notebook-select-mode.webp"
import notebookToolbar from "@/public/guide/notebook-toolbar.webp"
import notebookTopicActions from "@/public/guide/notebook-topic-actions.webp"
import notebookTopicDetail from "@/public/guide/notebook-topic-detail.webp"
import notebookTopicEdit from "@/public/guide/notebook-topic-edit.webp"
import settingsAnswerLevel from "@/public/guide/settings-card-2.webp"

import { Callout, Code, Figure, FigureRow, GuideSection, GuideSub, P, Steps, Table, Ui } from "@/components/guide/primitives"

/** 4. 채팅 */
export function ChatSection() {
    return (
        <GuideSection id="chat" title="채팅: 구름 코치와 대화" lead="모르는 것을 편하게 묻는 곳입니다. 대화는 자동으로 저장되고, 나중에 일기의 재료가 됩니다.">
            <GuideSub title="화면 구성">
                <FigureRow>
                    <Figure
                        src={chatSidebar}
                        alt="왼쪽 대화 목록. 맨 위 새 대화 버튼과 그 아래 지난 대화 제목들"
                        size="crop"
                        caption="대화 목록. 제목은 첫 메시지로 자동으로 붙고, 제목 옆 ‘삭제’로 지웁니다."
                    />
                    <div className="flex flex-col gap-3">
                        <Table
                            caption="채팅 화면의 요소"
                            head={["요소", "설명"]}
                            rows={[
                                [<Ui key="1">새 대화</Ui>, "빈 대화를 시작합니다. 주제가 바뀌면 새 대화로 나누는 것이 일기 만들기에 좋습니다."],
                                ["대화 목록", "누르면 그 대화가 열립니다. 이미 일기로 만든 대화도 그대로 남습니다."],
                                ["코치 소개 줄", "빈 대화에서만 보입니다. 첫 메시지를 보내면 사라져 대화 칸이 넓어집니다."],
                                [<Ui key="2">사용법 동영상 열기</Ui>, "시연 영상을 새 탭에서 엽니다. 대화가 시작된 뒤에는 + 메뉴 안에 있습니다."],
                                ["입력칸", "Enter로 보내고, Shift+Enter로 줄을 바꿉니다. 최대 3줄까지 자라납니다."],
                            ]}
                        />
                    </div>
                </FigureRow>
                <Figure
                    src={chatComposer}
                    alt="입력칸. 왼쪽 + 버튼, 가운데 메시지 입력칸, 오른쪽 보내기 버튼"
                    caption="입력칸. 왼쪽 + 가 부가 기능 메뉴, 오른쪽이 보내기입니다."
                />
                <Figure
                    src={chatSidebarCollapsed}
                    alt="대화 목록을 접은 채팅 화면. 헤더 왼쪽 끝 버튼으로 다시 펼친다"
                    caption="헤더 왼쪽 끝 버튼으로 대화 목록을 접으면 대화 칸이 넓어집니다. 다시 누르면 펼쳐집니다."
                />
            </GuideSub>

            <GuideSub title="질문하고 답 받기">
                <P>
                    답변은 글자가 흘러나오듯 실시간으로 표시됩니다. 답변 아래에는 <b>어느 AI 모델이 답했는지</b>(예: OpenAI · gpt-4o-mini)가 작게 붙습니다.
                    요금제에 따라 쓰는 모델이 달라지고, 한 공급자가 느리거나 실패하면 다음 공급자로 자동 전환되기 때문에 같은 대화 안에서도 모델이 바뀔 수
                    있습니다.
                </P>
                <Figure
                    src={chatExchange}
                    alt="내 질문(오른쪽 검은 말풍선)과 구름 코치의 답변(왼쪽, 구름 아바타)"
                    caption="내 말은 오른쪽, 코치의 답은 왼쪽에 보입니다."
                />
                <Figure
                    src={chatAssistantMessage}
                    alt="코치 답변 하나. 본문 아래 ‘OpenAI · gpt-4.1-mini’ 표기"
                    caption="답변 아래의 모델 표기. 어떤 모델이 답했는지 알 수 있어 답변 품질을 비교할 때 참고가 됩니다."
                />
                <Callout kind="tip" title="좋은 질문 요령">
                    <p>
                        오늘 들은 용어를 그대로 적고 “이게 뭐예요?”, “왜 필요해요?”, “예시로 보여 줘”처럼 짧게 이어 물으세요. 코치는 고른 답변 수준에 맞춰
                        설명하지만, 대화 중에 <b>“더 쉽게”</b>, <b>“더 자세히”</b>라고 말하면 그 요청이 먼저입니다.
                    </p>
                </Callout>
            </GuideSub>

            <GuideSub title="+ 메뉴 (입력칸 왼쪽)">
                <P>
                    입력칸 왼쪽 <Ui>+</Ui>를 누르면 부가 기능 메뉴가 위로 열립니다. 여기서 일기 초안을 만들고, 시연 영상을 열고, 답변 수준을 바로 바꿉니다.
                </P>
                <FigureRow>
                    <Figure
                        src={chatPlusMenu}
                        alt="빈 대화에서 연 + 메뉴. ‘이 대화로 일기 만들기’는 흐리게, 아래에 답변 수준 1~5단계 목록"
                        size="crop"
                        caption="빈 대화에서는 ‘이 대화로 일기 만들기’가 흐립니다(답변이 있어야 만들 수 있음)."
                    />
                    <Figure
                        src={chatPlusMenuActive}
                        alt="대화 중 연 + 메뉴. ‘이 대화로 일기 만들기’가 활성, 답변 수준에 1단계 체크"
                        size="crop"
                        caption="답변이 끝난 대화에서는 바로 일기 초안을 만들 수 있습니다. 체크 표시가 지금 쓰는 답변 수준입니다."
                    />
                </FigureRow>
                <Table
                    caption="+ 메뉴 항목"
                    head={["항목", "하는 일"]}
                    rows={[
                        [
                            <Ui key="1">이 대화로 일기 만들기</Ui>,
                            "지금 열린 대화로 일기 초안을 만들고 일기 화면으로 이동합니다. 답변이 끝난 뒤에만 눌리며, 저장하지 않은 초안이 있으면 바꿀지 먼저 묻습니다.",
                        ],
                        [<Ui key="2">사용법 동영상 열기</Ui>, "시연 영상(PC·폰 화면판)을 새 탭에서 엽니다."],
                        ["답변 수준 1~5단계", "누르는 즉시 저장되어 다음 답변부터 적용됩니다. 설정 화면의 ‘답변 수준’과 같은 값입니다."],
                    ]}
                />
            </GuideSub>
        </GuideSection>
    )
}

/** 5. 답변 수준 5단계 */
export function AnswerLevelSection() {
    return (
        <GuideSection
            id="answer-level"
            title="답변 수준 5단계"
            lead="같은 질문이라도 설명의 어휘와 깊이가 달라집니다. 채팅 답변, 일기 초안, 주간 회고, 그리고 /study-notes 스킬의 노트까지 모두 같은 다섯 단계를 씁니다."
        >
            <Table
                caption="답변 수준 다섯 단계"
                head={["단계", "이런 분에게", "설명하는 방식", "예: ‘API’를 설명하면"]}
                rows={[
                    [
                        <b key="1">1단계 왕초보</b>,
                        "컴퓨터·IT 용어가 낯선 분",
                        "중학생도 아는 쉬운 말. 일상 비유 먼저, 용어는 나오자마자 풀이, 코드는 최소로",
                        "식당의 주문 창구 같은 거예요. 손님이 정해진 방식으로 주문하면 주방이 음식을 내주듯, 프로그램이 정해진 방식으로 부탁하면 결과를 돌려줘요.",
                    ],
                    [
                        <b key="2">2단계 입문</b>,
                        "비전공으로 막 입과한 분",
                        "핵심 용어를 소개하고 한 줄로 풀이. 비유 다음에 짧은 코드와 주석, 흔한 실수",
                        "프로그램끼리 약속한 요청·응답 방식이에요. 예를 들어 날씨 API에 도시 이름을 보내면 기온을 돌려줍니다. 요청 주소와 응답 형식이 정해져 있어요.",
                    ],
                    [
                        <b key="3">3단계 기초</b>,
                        "변수·함수·조건문을 익힌 분",
                        "아는 용어는 그대로, 새 개념만 풀이. 단계별 예제와 그렇게 되는 이유",
                        "함수를 호출하듯 다른 프로그램의 기능을 부르는 통로입니다. HTTP 요청으로 주소·메서드·본문을 보내고 JSON 응답을 받는 흐름을 예제로 봅니다.",
                    ],
                    [
                        <b key="4">4단계 실전</b>,
                        "웹 프로젝트를 만드는 분",
                        "동작 원리·설계 이유·장단점. 실무형 코드와 디버깅 방법",
                        "REST 설계 규칙, 상태 코드와 오류 응답 형식, 인증 토큰 처리, 프론트에서 호출할 때의 CORS와 재시도 전략을 다룹니다.",
                    ],
                    [
                        <b key="5">5단계 심화</b>,
                        "전공자·실무 경험자",
                        "기초 생략. 정확한 용어로 간결하게, 내부 동작·트레이드오프·공식 문서",
                        "멱등성과 캐시 가능성, 버전 관리 전략, 스키마 계약(OpenAPI)과 호환성 깨짐, 속도 제한과 백프레셔 같은 설계 판단을 비교합니다.",
                    ],
                ]}
            />
            <P>
                고르기 전에는 <b>2단계 입문</b>으로 답합니다. 단계는 세 곳에서 고를 수 있고 어디서 골라도 같은 값이 저장됩니다.
            </P>
            <Steps
                items={[
                    {
                        title: "처음 로그인했을 때 채팅 위의 안내에서",
                        body: <p>“어떤 수준으로 설명해 드릴까요?” 아래 단계 버튼을 누릅니다. ‘나중에’를 누르면 다음 방문 때 다시 보입니다.</p>,
                    },
                    { title: "대화 중에 + 메뉴에서", body: <p>입력칸 왼쪽 + 메뉴 아래쪽 ‘답변 수준’에서 누르면 바로 저장됩니다.</p> },
                    {
                        title: "설정 화면의 ‘답변 수준’ 카드에서",
                        body: <p>단계마다 대상·방식 설명과 ‘API’ 예시 문장을 보면서 고르고 ‘수준 저장’을 누릅니다.</p>,
                    },
                ]}
            />
            <Figure
                src={settingsAnswerLevel}
                alt="설정의 답변 수준 카드. 1~5단계 라디오 목록, 고른 단계의 ‘API’ 설명 예시, 수준 저장 버튼"
                caption="설정 → 답변 수준. 지금 쓰는 단계에 ‘사용 중’이 표시되고, 아래에 그 단계의 예시 문장이 보입니다."
            />
            <Callout kind="tip" title="어떤 단계로 시작할까">
                <p>
                    잘 모르겠으면 2단계로 시작하고, 답이 쉽게 느껴지면 3·4단계로 올리세요. 반대로 용어가 어렵다고 느끼면 1단계로 내려 비유부터 읽어 보세요.
                    단계를 바꾸면 <b>다음 답변부터</b> 적용되고, 이미 받은 답변은 그대로입니다.
                </p>
                <p>/study-notes 스킬도 같은 다섯 단계를 씁니다. 앱과 스킬을 같은 단계로 맞춰 두면 채팅·일기·노트의 눈높이가 같아집니다.</p>
            </Callout>
        </GuideSection>
    )
}

/** 6. 배움일기 */
export function DiarySection() {
    return (
        <GuideSection
            id="diary"
            title="배움일기 만들기"
            lead="대화 하나를 골라 초안을 만들고, 내 말로 다듬어 저장합니다. 저장한 일기는 카드로 쌓이고, 주간 회고와 복습의 재료가 됩니다."
        >
            <GuideSub title="초안 만드는 두 가지 방법">
                <Steps
                    items={[
                        {
                            title: "채팅에서: + 메뉴 → ‘이 대화로 일기 만들기’",
                            body: (
                                <p>
                                    지금 열린 대화로 바로 만듭니다. 만드는 동안 채팅 위에 ‘대화 속 배움과 어려웠던 점을 정리하고 있어요’가 보이고, 끝나면 일기
                                    화면으로 옮겨 갑니다.
                                </p>
                            ),
                        },
                        {
                            title: "일기 화면에서: ‘일기로 만들 채팅’을 고르고 ‘초안 만들기’",
                            body: (
                                <p>지난 대화 중 하나를 골라 만듭니다. 목록에는 아직 일기로 만들지 않은 대화(또는 일기 뒤에 새 대화가 생긴 대화)만 보입니다.</p>
                            ),
                        },
                    ]}
                />
                <Figure
                    src={diaryTop}
                    alt="일기 화면 위쪽. ‘일기로 만들 채팅’ 선택 상자와 초안 만들기 버튼, 그 아래 제목·오늘 배운 것 입력칸"
                    caption="일기 화면. 위에서 채팅을 고르거나, 채팅 없이 직접 써도 됩니다."
                />
                <Figure
                    src={diaryPicker}
                    alt="‘일기로 만들 채팅’ 상자. 채팅 제목과 마지막 대화 시각이 있는 선택 목록과 초안 만들기 버튼"
                    caption="채팅 고르기. 제목 옆에 마지막 대화 시각이 보여 어떤 대화인지 구분할 수 있습니다."
                />
                <Callout kind="note" title="초안은 자동 저장되지 않습니다">
                    <p>
                        초안을 만든 뒤 <Ui>저장</Ui>을 눌러야 남습니다. 저장하지 않은 초안이 있는데 다른 대화로 초안을 또 만들면 바꿀지 묻습니다. 화면을
                        새로고침하면 저장하지 않은 초안은 사라집니다. 초안이 마음에 안 들면 <Ui>초안 버리기</Ui>로 비울 수 있습니다.
                    </p>
                </Callout>
            </GuideSub>

            <GuideSub title="일기의 항목">
                <Table
                    caption="일기 항목과 채우는 규칙"
                    head={["항목", "무엇이 들어가나", "요령"]}
                    rows={[
                        [
                            "제목",
                            "오늘 날짜 + 그날 배운 핵심 단어. 같은 날 두 번째 일기부터 날짜 뒤에 (2), (3)이 붙습니다.",
                            "핵심 단어는 코치가 대화에서 뽑습니다. 마음에 안 들면 고치세요.",
                        ],
                        ["오늘 배운 것", "대화에서 배운 내용의 요약.", "두세 문장으로 ‘내가 이해한 말’로 바꿔 쓰면 복습할 때 더 잘 읽힙니다."],
                        [
                            "배운 내용 상세",
                            "주제마다 ### 소제목으로 나눈 자세한 설명. 복습용 보충 설명이 함께 들어갑니다.",
                            "‘작성’과 ‘미리보기’를 오가며 서식을 확인하세요. 이 항목이 복습의 원문이 됩니다.",
                        ],
                        [
                            "어려웠던 것",
                            "대화에서 막혔던 부분.",
                            "여기 적힌 내용이 ‘어려웠던 내용 복습’ 목록에 올라갑니다. 솔직하게 남길수록 복습이 쉬워집니다.",
                        ],
                        ["내일 할 것", "대화에서 다음에 할 일을 말했을 때만 채워집니다.", "비워 두면 이 항목 없이 저장됩니다. 코치가 지어내지 않습니다."],
                        [
                            "푸터",
                            "설정의 ‘일기 푸터’ 문구가 저장할 때 맨 끝에 붙습니다.",
                            "저장 시점의 문구로 고정됩니다. 나중에 설정을 바꿔도 지난 일기는 그대로입니다.",
                        ],
                    ]}
                />
                <Figure
                    src={diaryEdit}
                    alt="일기 수정 화면. 제목, 오늘 배운 것, 배운 내용 상세(작성·미리보기 전환)가 채워져 있다"
                    caption="초안이 채워진 모습(수정 화면도 같은 구성). 고친 뒤 ‘저장’ 또는 ‘수정 저장’을 누릅니다."
                />
            </GuideSub>

            <GuideSub title="지난 일기: 프리뷰, 전체 복사, 수정, 삭제">
                <P>저장한 일기는 화면 아래 ‘지난 일기’에 최근 순으로 쌓입니다. 카드마다 네 가지 버튼이 있습니다.</P>
                <Figure
                    src={diaryEntryCard}
                    alt="지난 일기 카드. 제목과 날짜, 프리뷰 보기·전체 복사·수정·삭제 버튼, 배운 것 본문"
                    caption="일기 카드. 제목 옆 ‘프리뷰 보기’, ‘전체 복사’, ‘수정’, ‘삭제’."
                />
                <Table
                    caption="일기 카드의 버튼"
                    head={["버튼", "하는 일"]}
                    rows={[
                        [<Ui key="1">프리뷰 보기</Ui>, "일기를 문서 형태로 크게 보여 줍니다. 제출 전에 전체 모양을 확인할 때 좋습니다."],
                        [
                            <Ui key="2">전체 복사</Ui>,
                            "제목부터 푸터까지 통째로 복사합니다. 마크다운 글자와 서식이 함께 들어가, 교육 플랫폼·노션 편집기에는 서식으로, 메모장·카카오톡에는 마크다운 글자로 붙습니다.",
                        ],
                        [<Ui key="3">수정</Ui>, "위 작성 칸에 그 일기를 불러옵니다. 고치고 ‘수정 저장’을 누르거나 ‘취소’합니다."],
                        [<Ui key="4">삭제</Ui>, "일기를 지웁니다. 그 일기의 복습 메모와 완료 표시도 함께 사라집니다."],
                    ]}
                />
                <Figure
                    src={diaryPreview}
                    alt="일기 프리뷰 창. 제목, 배운 것, 배운 내용 상세가 문서처럼 보이고 위에 전체 복사·닫기 버튼"
                    caption="프리뷰 창. 여기서도 ‘전체 복사’를 할 수 있습니다."
                />
                <Callout kind="tip" title="같은 대화로 다시 만들면">
                    <p>
                        이미 일기로 만든 대화에 새 메시지를 더 주고받은 뒤 다시 초안을 만들면, 코치는 <b>추가된 대화만</b> 읽어 새 일기를 씁니다. 하루에 여러
                        주제를 공부했다면 대화를 주제별로 나누고 각각 일기로 만드세요.
                    </p>
                </Callout>
            </GuideSub>
        </GuideSection>
    )
}

/** 7. 주간 회고와 복습 */
export function ReviewSection() {
    return (
        <GuideSection id="review" title="주간 회고와 복습" lead="일기 화면 아래쪽에 있습니다. 위의 ‘주간 회고·복습 바로가기’ 링크로 바로 내려갈 수 있습니다.">
            <GuideSub title="주간 회고">
                <Steps
                    items={[
                        { title: "‘회고 기준 날짜’를 고릅니다", body: <p>그 날짜가 속한 월요일부터 일요일까지의 일기를 사용합니다. 기본값은 오늘입니다.</p> },
                        {
                            title: "‘회고 만들기’를 누릅니다",
                            body: (
                                <p>
                                    코치가 그 주의 일기를 읽고 성장한 점, 반복된 어려움, 다음 주 제안 세 항목으로 정리해 바로 저장합니다. 그 주에 일기가 없으면
                                    만들 수 없습니다.
                                </p>
                            ),
                        },
                        {
                            title: "‘저장된 회고’에서 다시 엽니다",
                            body: (
                                <p>
                                    한 주에 한 편을 보관합니다. 저장 당시의 일기를 바탕으로 하므로, 일기를 더 쓴 뒤 새로 정리하려면 ‘회고 삭제’ 후 다시
                                    만드세요.
                                </p>
                            ),
                        },
                    ]}
                />
                <Figure
                    src={diaryWeeklyReview}
                    alt="주간 회고 카드. 회고 기준 날짜, 저장된 회고 목록, 성장한 점·반복된 어려움·다음 주 제안 본문"
                    caption="주간 회고. 저장된 회고를 고르면 아래에 내용이 펼쳐집니다."
                />
            </GuideSub>

            <GuideSub title="어려웠던 내용 복습">
                <P>일기의 ‘어려웠던 것’이 복습 목록에 모입니다. 항목을 펼치면 그 일기의 원문(배운 내용 상세)이 보이고, 아래에 메모를 남길 수 있습니다.</P>
                <Table
                    caption="복습 화면의 요소"
                    head={["요소", "설명"]}
                    rows={[
                        [<Ui key="1">공부할 것 / 끝낸 것</Ui>, "아직 복습 중인 항목과 완료한 항목을 나눠 봅니다."],
                        ["원문 펼치기", "그 일기의 상세 내용을 그 자리에서 읽습니다. 일기 화면을 오갈 필요가 없습니다."],
                        [<Ui key="2">메모 저장</Ui>, "이해한 것, 다시 볼 것, 질문을 짧게 남깁니다. 메모는 완료 여부와 상관없이 보존됩니다."],
                        [<Ui key="3">완료 / 다시 복습</Ui>, "이해했으면 완료로 보내고, 다시 보고 싶으면 ‘다시 복습’으로 되돌립니다."],
                    ]}
                />
                <Figure
                    src={diaryStudyReview}
                    alt="어려웠던 내용 복습 카드. 공부할 것·끝낸 것 필터, 일기별 항목과 메모 입력칸, 완료 버튼"
                    caption="복습 목록. 일기마다 한 항목이 생깁니다."
                />
                <Callout kind="note">
                    <p>일기의 ‘어려웠던 것’을 고치면 그 항목의 완료 표시만 풀리고 메모는 남습니다. 일기를 삭제하면 복습 항목도 함께 사라집니다.</p>
                </Callout>
            </GuideSub>
        </GuideSection>
    )
}

/** 8. 학습장 */
export function NotebookSection() {
    return (
        <GuideSection
            id="notebook"
            title="학습장"
            lead="AI 코딩 도구(Claude Code·Codex)에서 /study-notes 스킬로 만든 학습 노트(md)를 올려, 주제별로 읽고 고치고 보관하고 학습 완료를 표시하는 곳입니다."
        >
            <Figure
                src={notebookOverview}
                alt="학습장 화면. 왼쪽에 학습장(파일)별 주제 목록과 보기·상태 필터, 오른쪽에 고른 주제의 본문과 수정·완료 취소·보관·삭제 버튼"
                caption="왼쪽은 학습장(파일)별 주제 목록, 오른쪽은 고른 주제의 본문입니다. 가운데 경계선을 끌어 목록 너비를 바꿀 수 있습니다(두 번 누르면 기본 너비)."
                priority
            />

            <GuideSub title="올릴 수 있는 파일">
                <P>
                    <Code>/study-notes</Code> 스킬이 만든 학습 노트(<Code>.md</Code>)만 올릴 수 있습니다. 노트는 <Code>~/StudyNotes/&lt;프로젝트&gt;/</Code>에{" "}
                    <Code>&lt;프로젝트&gt;_YYYY-MM-DD_NN.md</Code> 이름으로 생깁니다. 일반 메모·회의록 md, txt, json 등은 거부됩니다. 스킬 설치와 사용법은 다음
                    단원에 있습니다.
                </P>
                <Steps
                    items={[
                        {
                            title: "‘학습장 올리기’를 누르고 md 파일을 고릅니다",
                            body: (
                                <p>파일 하나가 학습장 하나가 되고, 노트 안의 ‘## N. 제목’이 주제 하나씩이 됩니다. 목차와 코드 블록은 주제로 치지 않습니다.</p>
                            ),
                        },
                        {
                            title: "‘신규’ 보기에서 방금 올린 주제를 확인합니다",
                            body: (
                                <p>
                                    주제를 누르면 오른쪽에 본문이 열립니다. 제목 아래에 유형·태그·난이도가 붙어 있고, 노트의 ‘한 줄 요약’이 인용문으로 보입니다.
                                </p>
                            ),
                        },
                        {
                            title: "읽고, 고치고, 보관하거나 완료합니다",
                            body: (
                                <p>
                                    본문 위 버튼으로 수정·학습 완료·보관·클립보드에 복사·삭제를 합니다. 보관과 완료 표시는 계정에 저장되어 다른 기기에서도
                                    같습니다. <Ui>클립보드에 복사</Ui>는 제목과 본문을 마크다운 글자와 서식으로 함께 복사해, 교육 플랫폼·노션 편집기에 서식
                                    그대로 붙여 넣을 수 있습니다.
                                </p>
                            ),
                        },
                    ]}
                />
                <FigureRow>
                    <Figure
                        src={notebookToolbar}
                        alt="학습장 올리기, 새 학습장, 도움말 버튼과 보기(신규·전체·보관함)·상태(공부할 것·끝낸 것) 필터"
                        size="crop"
                        caption="학습장 도구 모음과 필터"
                    />
                    <Figure
                        src={notebookTopicActions}
                        alt="주제 본문 위의 수정, 완료 취소, 보관, 클립보드에 복사, 삭제 버튼"
                        size="crop"
                        caption="주제 본문 위의 버튼. 완료한 주제는 ‘완료 취소’, 보관한 주제는 ‘보관 해제’로 바뀝니다."
                    />
                </FigureRow>
                <Callout kind="warn" title="같은 파일은 다시 올릴 수 없습니다">
                    <p>
                        같은 프로젝트의 같은 파일명은 거부됩니다(다른 프로젝트의 같은 이름은 올라갑니다). 고친 노트를 다시 올리려면 기존 학습장을{" "}
                        <b>삭제한 뒤</b> 올리세요. 앱에서 고친 내용과 보관·완료 표시는 함께 사라지니, 앱에서 고치는 쪽을 권합니다.
                    </p>
                </Callout>
            </GuideSub>

            <GuideSub title="보기와 필터">
                <Table
                    caption="학습장 목록의 보기와 상태 필터"
                    head={["버튼", "보이는 것", "언제 쓰나"]}
                    rows={[
                        [<Ui key="1">신규</Ui>, "아직 보관하지 않은 주제. 숫자는 그 개수.", "방금 올린 노트를 훑어보며 보관할 것을 고를 때"],
                        [<Ui key="2">전체</Ui>, "모든 주제", "전체를 한눈에 볼 때"],
                        [<Ui key="3">보관함</Ui>, "나중에 공부하려고 보관한 주제. 숫자는 그 개수.", "시간이 났을 때 골라 둔 것만 공부할 때"],
                        [
                            <Ui key="4">공부할 것 / 끝낸 것</Ui>,
                            "학습 완료 여부로 좁힙니다. 다시 누르면 해제.",
                            "보기와 함께 조합할 수 있습니다(예: 보관함 + 공부할 것)",
                        ],
                    ]}
                />
                <FigureRow>
                    <Figure
                        src={notebookList}
                        alt="전체 보기의 목록. 학습장 제목 아래 주제 7개, 완료한 주제에 체크, 보관한 주제에 책갈피 표시"
                        size="half"
                        caption="전체 보기. 완료는 파란 체크, 보관은 주황 책갈피로 표시됩니다."
                    />
                    <Figure
                        src={notebookKeptView}
                        alt="보관함 보기의 목록. 보관한 주제 2개만 보인다"
                        size="half"
                        caption="보관함 보기. 보관한 주제만 남습니다."
                    />
                </FigureRow>
            </GuideSub>

            <GuideSub title="주제 골라 보관하기 (선택 모드)">
                <P>
                    시간이 없을 때는 일단 올려 두고, <Ui>선택</Ui>을 눌러 주제를 여러 개 고른 뒤 아래 <Ui>보관</Ui>을 누르세요. 학습장 제목 옆 체크박스로 그
                    학습장의 주제를 한 번에 고를 수 있습니다. 주제 하나는 본문 위 <Ui>보관</Ui> 버튼으로 바로 표시합니다.
                </P>
                <Figure
                    src={notebookSelectMode}
                    alt="선택 모드의 목록. 학습장과 주제마다 체크박스, 아래에 선택 수와 보관·보관 해제·취소 버튼"
                    size="half"
                    caption="선택 모드. 아래 막대에서 고른 수를 보며 보관·보관 해제합니다."
                />
            </GuideSub>

            <GuideSub title="주제 읽기와 고치기">
                <Figure
                    src={notebookTopicDetail}
                    alt="주제 본문. 제목, 유형·태그·난이도, 한 줄 요약 인용문, 어떤 상황에서 나왔나·왜 필요한가·핵심 개념 소제목"
                    caption="주제 본문. 노트의 소제목 구조(상황 → 왜 필요한가 → 핵심 개념 → …)가 그대로 보입니다."
                />
                <Figure
                    src={notebookTopicEdit}
                    alt="주제 수정 화면. 제목·유형·태그·난이도 입력칸과 본문 편집칸(작성·미리보기 전환), 저장·취소 버튼"
                    caption="‘수정’을 누르면 제목·유형·태그·난이도·본문을 고칠 수 있습니다. ‘미리보기’로 서식을 확인하세요."
                />
                <Table
                    caption="그 밖의 기능"
                    head={["기능", "설명"]}
                    rows={[
                        [<Ui key="1">새 학습장</Ui>, "업로드 없이 빈 학습장을 만듭니다. 직접 정리한 공부 내용을 쌓을 때 씁니다."],
                        [<Ui key="2">새 주제</Ui>, "학습장 제목 아래 버튼. 그 학습장에 주제를 직접 씁니다."],
                        [<Ui key="3">이름 바꾸기 / 삭제</Ui>, "학습장 제목 아래 버튼. 학습장을 지우면 안의 주제가 모두 사라집니다."],
                        ["목록 너비 조절", "넓은 화면에서 목록과 본문 사이 경계를 끌어 조절합니다. 두 번 누르면 기본 너비. 키보드 화살표로도 됩니다."],
                        [<Ui key="4">도움말</Ui>, "화면 안에서 보는 짧은 안내입니다."],
                    ]}
                />
                <Figure src={notebookHelp} alt="학습장 사용 안내 창. 올릴 수 있는 파일, 보기와 필터, 보관과 완료 설명" size="half" caption="도움말 창" />
            </GuideSub>
        </GuideSection>
    )
}
