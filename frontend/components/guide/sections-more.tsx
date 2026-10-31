import mChatConversation from "@/public/guide/m-chat-conversation.webp"
import mChatDrawer from "@/public/guide/m-chat-drawer.webp"
import mChatPlusMenu from "@/public/guide/m-chat-plus-menu.webp"
import mChatWelcome from "@/public/guide/m-chat-welcome.webp"
import mDiary from "@/public/guide/m-diary.webp"
import mNotebookDetail from "@/public/guide/m-notebook-detail.webp"
import mNotebookList from "@/public/guide/m-notebook-list.webp"
import settingsAccount from "@/public/guide/settings-card-1.webp"
import settingsPlanCoupon from "@/public/guide/settings-card-3.webp"
import settingsPreferences from "@/public/guide/settings-card-4.webp"

import { Callout, Figure, FigureRow, GuideSection, GuideSub, P, Steps, Table, Ui } from "@/components/guide/primitives"

/** 10. 설정·계정·요금제 */
export function SettingsSection() {
    return (
        <GuideSection
            id="settings"
            title="설정·계정·요금제"
            lead="계정 메뉴 → 설정. 카드 네 장(계정 정보, 답변 수준, 요금제와 쿠폰, 화면 설정)으로 되어 있습니다."
        >
            <GuideSub title="계정 정보">
                <Table
                    caption="계정 정보 카드"
                    head={["항목", "설명"]}
                    rows={[
                        ["이름", "헤더와 계정 메뉴에 보이는 이름. 바꾸고 ‘이름 저장’."],
                        ["이메일", "로그인 아이디입니다. 바꿀 때는 현재 비밀번호를 한 번 더 넣습니다."],
                        ["비밀번호", "8자 이상. 바꾸면 다른 기기의 로그인은 모두 끊기고 지금 화면은 유지됩니다."],
                    ]}
                />
                <Figure
                    src={settingsAccount}
                    alt="계정 정보 카드. 이름 저장, 이메일 변경(현재 비밀번호 확인), 비밀번호 변경 입력칸"
                    size="half"
                    caption="계정 정보 카드"
                />
            </GuideSub>

            <GuideSub title="요금제와 쿠폰">
                <P>
                    요금제는 <b>Free · Pro · Max</b> 세 가지이고, 요금제에 따라 답하는 AI 모델이 달라집니다. Free는 가장 가벼운 모델, Pro는 한 단계 위, Max는
                    가장 좋은 모델로 답합니다. 어떤 모델이 답했는지는 채팅 답변 아래에 표시됩니다.
                </P>
                <Steps
                    items={[
                        {
                            title: "쿠폰 코드를 받습니다",
                            body: <p>관리자(강사)가 카카오톡 선물처럼 코드를 보내 줍니다. 코드에는 요금제와 기간(7일~12개월)이 정해져 있습니다.</p>,
                        },
                        {
                            title: "설정 → 요금제와 쿠폰 → 쿠폰 코드에 입력하고 ‘등록’",
                            body: <p>등록되면 ‘Pro · 2026. 11. 7.까지’처럼 요금제와 만료일이 보입니다. 계정 메뉴에도 같은 값이 표시됩니다.</p>,
                        },
                        {
                            title: "남은 기간이 있는데 다른 쿠폰을 등록하면",
                            body: <p>남은 기간이 사라진다는 확인창이 뜹니다. 확인하면 새 쿠폰의 요금제와 기간으로 바뀝니다. 만료되면 Free로 돌아갑니다.</p>,
                        },
                    ]}
                />
                <Figure
                    src={settingsPlanCoupon}
                    alt="요금제와 쿠폰 카드. 현재 요금제 표시와 쿠폰 코드 입력칸, 등록 버튼"
                    size="half"
                    caption="요금제와 쿠폰 카드"
                />
                <Callout kind="note" title="사용량">
                    <p>
                        계정 메뉴의 ‘사용량’은 지금까지 쓴 AI 토큰 수와 추정 비용입니다. 모델이 여러 개 섞였으면 마우스를 올려 모델별 내역을 봅니다. 참고용
                        추정치입니다.
                    </p>
                </Callout>
            </GuideSub>

            <GuideSub title="화면 설정: 캐치프레이즈와 일기 푸터">
                <Table
                    caption="화면 설정 카드"
                    head={["항목", "어디에 쓰이나"]}
                    rows={[
                        ["캐치프레이즈", "헤더 가운데 문구. 길면 전광판처럼 흐릅니다. 폰에서는 로고 이름을 감추고 이 문구에 자리를 줍니다."],
                        ["일기 푸터", "일기를 저장할 때 맨 끝에 붙는 문구(감사 인사 등). 저장 시점 문구로 고정됩니다."],
                        ["기본값으로 되돌리기", "두 문구를 처음 값으로 되돌립니다."],
                    ]}
                />
                <Figure
                    src={settingsPreferences}
                    alt="화면 설정 카드. 캐치프레이즈와 일기 푸터 입력칸, 설정 저장·기본값으로 되돌리기 버튼"
                    size="half"
                    caption="화면 설정 카드"
                />
            </GuideSub>
        </GuideSection>
    )
}

/** 11. 폰에서 쓰기 */
export function MobileSection() {
    return (
        <GuideSection id="mobile" title="폰에서 쓰기" lead="같은 주소를 폰 브라우저로 열면 폰에 맞는 화면이 됩니다. 기능은 같고 배치만 다릅니다.">
            <Table
                caption="폰에서 달라지는 점"
                head={["PC", "폰"]}
                rows={[
                    ["대화 목록이 왼쪽에 붙어 있음", "헤더 왼쪽 끝 버튼을 누르면 서랍처럼 열림. 대화를 고르면 닫힘"],
                    ["헤더에 로고 이름과 내 이름", "로고 아이콘과 사람 아이콘만. 가운데 캐치프레이즈에 자리를 줌"],
                    ["학습장이 목록·본문 두 칸", "한 번에 한 칸. 주제를 누르면 본문, 뒤로 가면 목록"],
                    ["입력칸 3줄까지 자람", "같음. 키보드가 올라와도 입력칸이 가려지지 않음"],
                    ["시연 영상 PC 화면판", "폰 화면판(세로 영상)이 열림"],
                ]}
            />
            <FigureRow>
                <Figure src={mChatWelcome} alt="폰의 채팅 첫 화면" size="phone" caption="채팅 첫 화면" />
                <Figure src={mChatDrawer} alt="폰에서 연 대화 목록 서랍" size="phone" caption="대화 목록 서랍" />
                <Figure src={mChatConversation} alt="폰의 대화 화면" size="phone" caption="대화 화면" />
                <Figure src={mChatPlusMenu} alt="폰에서 연 + 메뉴" size="phone" caption="+ 메뉴" />
            </FigureRow>
            <FigureRow>
                <Figure src={mNotebookList} alt="폰의 학습장 목록" size="phone" caption="학습장 목록" />
                <Figure src={mNotebookDetail} alt="폰의 학습장 주제 본문" size="phone" caption="주제 본문(뒤로 가면 목록)" />
                <Figure src={mDiary} alt="폰의 일기 화면" size="phone" caption="일기 화면" />
            </FigureRow>
            <Callout kind="tip" title="홈 화면에 추가하면 앱처럼">
                <p>
                    아이폰 Safari는 공유 버튼 → ‘홈 화면에 추가’, 안드로이드 크롬은 메뉴 → ‘홈 화면에 추가’. 아이콘이 생기고 주소창 없이 전체 화면으로 열립니다.
                </p>
            </Callout>
        </GuideSection>
    )
}

/** 12. 자주 묻는 질문 */
export function FaqSection() {
    return (
        <GuideSection id="faq" title="자주 묻는 질문" lead="막히는 순간에 보는 짧은 답입니다.">
            <Table
                caption="자주 묻는 질문"
                head={["질문", "답"]}
                rows={[
                    [
                        "답변이 오래 걸리거나 ‘서버에 연결할 수 없습니다’가 떠요",
                        "AI 공급자가 느리거나 바뀌는 중일 수 있습니다. 잠시 뒤 다시 보내세요. 일기 초안·주간 회고는 최대 2분까지 기다립니다. 계속되면 관리자에게 알려 주세요.",
                    ],
                    [
                        "‘일기로 만들 채팅’ 목록에 내 대화가 없어요",
                        "이미 일기로 만든 대화는 목록에서 빠집니다. 그 대화에 메시지를 더 주고받으면 다시 보이고, 그때 만드는 일기는 추가된 대화만 다룹니다. 채팅 화면의 + 메뉴로도 만들 수 있습니다.",
                    ],
                    ["+ 메뉴의 ‘이 대화로 일기 만들기’가 흐려요", "답변이 끝난 뒤에만 눌립니다. 대화가 비어 있거나 답변이 오는 중이면 흐립니다."],
                    [
                        "초안을 만들었는데 새로고침했더니 사라졌어요",
                        "초안은 저장 전까지 화면에만 있습니다. 다시 만들거나, 다음부터는 고친 뒤 바로 ‘저장’을 누르세요.",
                    ],
                    ["같은 날 일기를 두 번 썼더니 제목에 (2)가 붙어요", "정상입니다. 같은 날 두 번째 일기부터 날짜 뒤에 순번이 붙어 구분됩니다."],
                    ["주간 회고를 새로 만들고 싶어요", "한 주에 한 편만 보관합니다. ‘회고 삭제’를 누른 뒤 ‘회고 만들기’를 다시 누르세요."],
                    [
                        "학습장에 md를 올렸는데 거부돼요",
                        "/study-notes 스킬이 만든 노트만 올라갑니다. 같은 프로젝트의 같은 파일명도 거부되니 기존 학습장을 삭제한 뒤 올리세요.",
                    ],
                    [
                        "긴 노트를 올리면 ‘서버에 연결할 수 없습니다’가 떠요",
                        "아주 긴 노트는 서버 앞단에서 막히는 경우가 있습니다. 파일을 나누어 올리거나 스킬을 더 자주 실행해 노트를 짧게 유지하세요.",
                    ],
                    ["답변 수준을 바꿨는데 답이 그대로예요", "다음 답변부터 적용됩니다. 대화 중 ‘더 쉽게 설명해 줘’처럼 직접 말하면 즉시 반영됩니다."],
                    ["비밀번호를 잊었어요", "관리자(강사)에게 초기화를 요청하세요. 초기화된 암호로 로그인한 뒤 설정에서 새 비밀번호로 바꿉니다."],
                    ["다른 기기에서도 로그인했는데 끊겼어요", "비밀번호를 바꾸면 다른 기기의 로그인이 모두 끊깁니다. 새 비밀번호로 다시 로그인하세요."],
                    [
                        "Claude Code·Codex가 없어도 쓸 수 있나요",
                        "네. 채팅·일기·회고·복습은 앱만으로 됩니다. 학습장은 ‘새 학습장’·‘새 주제’로 직접 써도 됩니다.",
                    ],
                ]}
            />
            <P>
                더 궁금한 점은 채팅에서 구름 코치에게 물어보거나, 이 안내의 각 단원을 다시 보세요. 화면 안의 <Ui>도움말</Ui>(학습장)과{" "}
                <Ui>사용법 동영상 열기</Ui>(채팅)도 있습니다.
            </P>
        </GuideSection>
    )
}
