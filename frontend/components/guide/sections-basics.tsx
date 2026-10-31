import Link from "next/link"

import accountMenu from "@/public/guide/account-menu.webp"
import chatWelcome from "@/public/guide/chat-welcome.webp"
import header from "@/public/guide/header.webp"
import signin from "@/public/guide/signin.webp"
import signinDemoButton from "@/public/guide/signin-demo-button.webp"
import signup from "@/public/guide/signup.webp"

import { Callout, Code, Figure, FigureRow, GuideSection, GuideSub, P, Steps, Table, Ui } from "@/components/guide/primitives"

const SKILL_URL = "https://github.com/thinqsimon/claude-study-notes"

/** 1. 한눈에 보기 */
export function OverviewSection({ demoVideos }: { demoVideos: { desktop: string; phone: string } | null }) {
    return (
        <GuideSection
            id="overview"
            title="한눈에 보기"
            lead="배움일기 코치는 공부하다 생긴 궁금함을 AI 코치에게 묻고, 그 대화를 배움일기로 남기고, 한 주를 돌아보고, 따로 공부할 주제를 학습장에 모아 두는 앱입니다."
        >
            <Table
                caption="앱의 네 가지 화면과 하는 일"
                head={["화면", "하는 일", "언제 쓰나"]}
                rows={[
                    [
                        <Ui key="c">채팅</Ui>,
                        "구름 코치와 대화합니다. 답변 수준(1~5단계)을 고르면 내 눈높이에 맞춰 설명합니다.",
                        "공부하다 막힐 때, 개념을 확인하고 싶을 때",
                    ],
                    [
                        <Ui key="d">일기</Ui>,
                        "대화 하나를 골라 배움일기 초안을 만들고, 내 말로 다듬어 저장합니다. 주간 회고와 어려웠던 내용 복습도 여기 있습니다.",
                        "수업이 끝났을 때, 주말에 한 주를 돌아볼 때",
                    ],
                    [
                        <Ui key="n">학습장</Ui>,
                        "Claude Code·Codex에서 /study-notes 스킬로 만든 학습 노트를 올려 주제별로 읽고, 보관하고, 학습 완료를 표시합니다.",
                        "AI와 코딩한 뒤 개념을 따로 공부할 때",
                    ],
                    [
                        <Ui key="s">설정</Ui>,
                        "이름·이메일·비밀번호, 답변 수준, 요금제와 쿠폰, 캐치프레이즈·일기 푸터를 바꿉니다.",
                        "처음 가입했을 때, 쿠폰을 받았을 때",
                    ],
                ]}
            />
            <P>
                기본 흐름은 <b>대화하기 → 입력칸 왼쪽 + 메뉴로 일기 초안 만들기 → 내 말로 다듬어 저장하기</b>입니다. 여기에 주말의 <b>주간 회고</b>와 AI 코딩
                도구에서 만든 노트를 올리는 <b>학습장</b>이 더해집니다.
            </P>
            <Callout kind="note" title="영상으로 먼저 보기">
                <p>
                    3~4분짜리 시연 영상이 있습니다. 로그인 화면의 <Ui>사용법 시연</Ui> 버튼이나 채팅 화면의 <Ui>사용법 동영상 열기</Ui>로도 열립니다.
                </p>
                {demoVideos && (
                    <p className="flex flex-wrap gap-x-4 gap-y-1">
                        <a href={demoVideos.desktop} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                            PC 화면판 보기
                        </a>
                        <a href={demoVideos.phone} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                            폰 화면판 보기
                        </a>
                    </p>
                )}
            </Callout>
        </GuideSection>
    )
}

/** 2. 시작하기 */
export function StartSection() {
    return (
        <GuideSection id="start" title="시작하기" lead="가입부터 첫 화면까지. 5분이면 됩니다.">
            <GuideSub title="가입과 로그인">
                <Steps
                    items={[
                        {
                            title: "로그인 화면에서 ‘회원가입’을 누릅니다",
                            body: (
                                <p>
                                    이름, 이메일, 비밀번호(8자 이상)를 넣고 <Ui>가입하기</Ui>를 누르면 바로 로그인된 채 채팅 화면이 열립니다. 이메일은 로그인
                                    아이디로 쓰이니 자주 쓰는 주소를 넣으세요.
                                </p>
                            ),
                        },
                        {
                            title: "다음부터는 이메일과 비밀번호로 로그인합니다",
                            body: (
                                <p>
                                    로그인 상태는 브라우저에 유지됩니다. 비밀번호를 바꾸면 다른 기기의 로그인은 모두 끊기고, 지금 쓰는 화면은 그대로 유지됩니다.
                                </p>
                            ),
                        },
                        {
                            title: "비밀번호를 잊었다면 관리자(강사)에게 초기화를 요청합니다",
                            body: (
                                <p>
                                    관리자가 기본 암호 또는 정한 암호로 초기화해 주면, 그 암호로 로그인한 뒤 <Ui>설정 → 계정 정보</Ui>에서 새 비밀번호로
                                    바꾸세요.
                                </p>
                            ),
                        },
                    ]}
                />
                <FigureRow>
                    <Figure
                        src={signin}
                        alt="로그인 화면. 로고 아래 사용법 시연 버튼, 이메일·비밀번호 입력칸과 로그인 버튼, 회원가입 링크"
                        caption="로그인 화면"
                    />
                    <Figure src={signup} alt="회원가입 화면. 이름·이메일·비밀번호 입력칸과 가입하기 버튼" caption="회원가입 화면" />
                </FigureRow>
                <Figure
                    src={signinDemoButton}
                    alt="사용법 시연 버튼"
                    size="crop"
                    caption="로고 아래 ‘사용법 시연’ 버튼. PC에서는 PC 화면판, 폰에서는 폰 화면판 영상이 새 탭에서 열립니다."
                />
            </GuideSub>

            <GuideSub title="첫 화면 둘러보기">
                <P>
                    로그인하면 채팅 화면이 열립니다. 가운데에 구름 코치의 인사와 추천 질문 두 개가 있고, 아래에 메시지 입력칸이 있습니다. 왼쪽은 대화 목록,
                    위쪽은 어느 화면에서나 보이는 헤더입니다.
                </P>
                <Figure
                    src={chatWelcome}
                    alt="로그인 직후 채팅 화면. 왼쪽 대화 목록, 가운데 구름 코치 인사와 추천 질문, 아래 입력칸"
                    caption="로그인 직후 채팅 화면"
                    priority
                />
                <Figure
                    src={header}
                    alt="헤더. 왼쪽에 로고와 채팅·학습장·일기 메뉴, 가운데 캐치프레이즈, 오른쪽에 계정 버튼"
                    caption="헤더. 어느 화면에서나 같은 자리에 있습니다."
                />
                <Table
                    caption="헤더의 구성"
                    head={["자리", "무엇", "설명"]}
                    rows={[
                        ["왼쪽 끝", "대화 목록 버튼", "채팅 화면에서만 보입니다. 대화 목록을 접거나 폅니다(폰에서는 서랍으로 엽니다)."],
                        ["왼쪽", "로고와 메뉴", "로고를 누르면 채팅으로 갑니다. 채팅·학습장·일기 메뉴로 화면을 바꿉니다."],
                        ["가운데", "캐치프레이즈", "설정에서 바꿀 수 있는 나만의 문구. 길면 전광판처럼 흐릅니다."],
                        ["오른쪽 끝", "계정 버튼(내 이름)", "누르면 오른쪽에서 계정 메뉴가 열립니다. 폰에서는 아이콘만 보입니다."],
                    ]}
                />
            </GuideSub>

            <GuideSub title="계정 메뉴">
                <P>
                    오른쪽 위 내 이름(폰에서는 사람 아이콘)을 누르면 계정 메뉴가 열립니다. 이름·이메일·요금제·가입일·사용량을 보여 주고, 아래 버튼으로 이
                    <Ui>사용 안내</Ui>와 <Ui>설정</Ui>에 가거나 <Ui>로그아웃</Ui>합니다.
                </P>
                <Figure
                    src={accountMenu}
                    alt="계정 메뉴. 계정 정보(이름·이메일·요금제·가입일·사용량)와 사용 안내·설정·로그아웃 버튼"
                    size="crop"
                    caption="계정 메뉴. 사용량은 지금까지 쓴 AI 토큰과 추정 비용입니다."
                />
            </GuideSub>
        </GuideSection>
    )
}

/** 3. 숙련도별 사용법 */
export function ByLevelSection() {
    return (
        <GuideSection
            id="by-level"
            title="숙련도별 사용법"
            lead="처음 쓰는 날, 매일 쓰는 법, AI 코딩 도구까지 연결하는 법. 자기에게 맞는 단계부터 읽으세요. 답변 수준 1~5단계는 다음 단원에서 따로 설명합니다."
        >
            <GuideSub title="1단계. 처음 쓰는 날 (10분 코스)">
                <Steps
                    items={[
                        {
                            title: "답변 수준을 고릅니다",
                            body: (
                                <p>
                                    처음 로그인하면 채팅 위에 <b>어떤 수준으로 설명해 드릴까요?</b> 안내가 보입니다. 잘 모르겠으면 <Ui>2단계 입문</Ui>을
                                    누르세요. 나중에 입력칸 왼쪽 <Ui>+</Ui> 메뉴나 설정에서 언제든 바꿉니다.
                                </p>
                            ),
                        },
                        {
                            title: "추천 질문 하나를 눌러 봅니다",
                            body: (
                                <p>
                                    ‘오늘 배운 개념을 예시로 설명해 줘’를 누르면 바로 대화가 시작됩니다. 코치가 되묻는 말에 오늘 배운 것을 편하게 적어 보세요.
                                </p>
                            ),
                        },
                        {
                            title: "두세 번 더 묻습니다",
                            body: (
                                <p>
                                    “왜 그렇게 돼요?”, “예시를 하나 더”, “더 쉽게”처럼 이어서 물으세요. 대화가 길수록 일기 초안이 풍부해집니다. 답변 아래에는
                                    어느 AI 모델이 답했는지 작게 표시됩니다.
                                </p>
                            ),
                        },
                        {
                            title: "+ 메뉴에서 ‘이 대화로 일기 만들기’를 누릅니다",
                            body: (
                                <p>
                                    답변이 끝난 뒤 입력칸 왼쪽 <Ui>+</Ui>를 눌러 <Ui>이 대화로 일기 만들기</Ui>를 고르면, 코치가 대화를 읽고 일기 초안을 만든 뒤
                                    일기 화면으로 옮겨 줍니다(수십 초 걸릴 수 있습니다).
                                </p>
                            ),
                        },
                        {
                            title: "내 말로 다듬어 저장합니다",
                            body: (
                                <p>
                                    초안은 자동 저장되지 않습니다. 제목·배운 것·상세·어려웠던 것을 읽어 보고 고친 뒤 <Ui>저장</Ui>을 누르세요. 저장하면 아래
                                    ‘지난 일기’에 카드로 쌓입니다.
                                </p>
                            ),
                        },
                        {
                            title: "프리뷰와 전체 복사를 써 봅니다",
                            body: (
                                <p>
                                    일기 카드의 <Ui>프리뷰 보기</Ui>로 문서처럼 보고, <Ui>전체 복사</Ui>로 교육 플랫폼이나 노션에 서식 그대로 붙여 넣을 수
                                    있습니다.
                                </p>
                            ),
                        },
                    ]}
                />
            </GuideSub>

            <GuideSub title="2단계. 매일 쓰는 법">
                <Table
                    caption="하루와 한 주의 사용 루틴"
                    head={["때", "하는 일", "요령"]}
                    rows={[
                        [
                            "수업 중",
                            "막힐 때마다 채팅에 묻기",
                            "주제가 바뀌면 ‘새 대화’로 시작하세요. 대화 하나 = 일기 하나가 되기 때문에, 주제별로 나누면 일기가 또렷해집니다.",
                        ],
                        [
                            "수업 끝",
                            "그 대화로 일기 만들기",
                            "같은 날 두 번째 일기부터 제목에 (2), (3)이 붙습니다. ‘내일 할 것’은 대화에 있을 때만 채워지니 비어 있어도 괜찮습니다.",
                        ],
                        [
                            "제출할 때",
                            "전체 복사",
                            "일기 카드의 ‘전체 복사’는 마크다운과 서식을 함께 넣어 줍니다. 교육 플랫폼 편집기에는 서식으로, 메모장·카톡에는 글자로 붙습니다. 학습장 주제는 본문 위 ‘클립보드에 복사’로 같은 방식으로 복사합니다.",
                        ],
                        ["주말", "주간 회고 만들기", "일기 화면 아래 ‘주간 회고’에서 날짜를 고르고 ‘회고 만들기’. 한 주에 한 편이 저장됩니다."],
                        ["틈날 때", "어려웠던 내용 복습", "일기의 ‘어려웠던 것’이 복습 목록에 모입니다. 원문을 펼쳐 읽고 메모를 남기고, 이해했으면 ‘완료’."],
                        ["처음 한 번", "설정 다듬기", "캐치프레이즈(헤더 문구)와 일기 푸터(일기 끝에 붙는 인사말)를 내 것으로 바꾸세요."],
                    ]}
                />
                <Callout kind="tip" title="이미 일기로 만든 채팅은 목록에서 사라집니다">
                    <p>
                        일기 화면의 ‘일기로 만들 채팅’ 목록에는 아직 일기로 만들지 않은 대화만 보입니다. 그 채팅에 대화를 더 나누면 다시 나타나고, 그때 만드는
                        일기는 <b>새로 추가된 대화만</b> 다룹니다.
                    </p>
                </Callout>
            </GuideSub>

            <GuideSub title="3단계. AI 코딩 도구까지 연결하기 (Claude Code·Codex 사용자)">
                <P>
                    Claude Code나 OpenAI Codex로 코딩하는 분이라면, 그 대화 속에서 빠르게 지나간 개념을 <Code>/study-notes</Code> 스킬로 학습 노트(md)로 뽑아낸
                    뒤 이 앱의 학습장에 올려 공부할 수 있습니다.
                </P>
                <Steps
                    items={[
                        {
                            title: "스킬을 한 번 설치합니다",
                            body: <p>Claude Code에서는 명령 두 줄, Codex에서는 한 문장이면 됩니다. 자세한 절차는 아래 스킬 단원에 있습니다.</p>,
                        },
                        {
                            title: "평소처럼 AI와 코딩합니다",
                            body: <p>기능 하나를 끝냈을 때, 막혔던 문제를 막 해결했을 때가 정리하기 좋은 순간입니다.</p>,
                        },
                        {
                            title: "채팅에 /study-notes 를 입력합니다",
                            body: (
                                <p>
                                    처음엔 설명 수준(1~5단계)을 묻습니다. 숫자로 답하면 지난 정리 이후의 대화만 읽어 <Code>~/StudyNotes/&lt;프로젝트&gt;/</Code>
                                    에 노트 파일을 만듭니다.
                                </p>
                            ),
                        },
                        {
                            title: "학습장에 올립니다",
                            body: (
                                <p>
                                    앱의 <Ui>학습장 → 학습장 올리기</Ui>에서 그 md 파일을 고르면 주제별로 나뉘어 저장됩니다. 시간이 없으면 <Ui>선택</Ui>으로
                                    골라 <Ui>보관</Ui>해 두고, 나중에 <Ui>보관함</Ui>에서 모아 공부하세요.
                                </p>
                            ),
                        },
                    ]}
                />
                <P>
                    바로 가기:{" "}
                    <Link href="#skill" className="underline underline-offset-4">
                        /study-notes 스킬 단원
                    </Link>{" "}
                    ·{" "}
                    <Link href="#notebook" className="underline underline-offset-4">
                        학습장 단원
                    </Link>{" "}
                    ·{" "}
                    <a href={SKILL_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                        스킬 저장소(GitHub)
                    </a>
                </P>
            </GuideSub>
        </GuideSection>
    )
}
