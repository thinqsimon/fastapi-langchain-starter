import { Callout, Code, GuideSection, GuideSub, P, Steps, Table, TerminalPanel } from "@/components/guide/primitives"

const SKILL_URL = "https://github.com/thinqsimon/claude-study-notes"

/** 9. /study-notes 스킬 */
export function SkillSection() {
    return (
        <GuideSection
            id="skill"
            title="/study-notes 스킬: AI 코딩 대화를 학습 노트로"
            lead="Claude Code와 OpenAI Codex에서 쓰는 스킬입니다. AI와 개발하며 나눈 대화에서 공부해야 할 개념과 문제해결 과정을 골라, 초보자용 학습 노트(Markdown)로 정리해 줍니다. 그 노트를 이 앱의 학습장에 올려 관리합니다."
        >
            <GuideSub title="무엇을 해 주나">
                <Table
                    caption="스킬의 핵심 동작"
                    head={["특징", "설명"]}
                    rows={[
                        [
                            "요약이 아니라 재강의",
                            "대화를 발췌하는 게 아니라, 그 개념을 처음 배우는 사람에게 가르치듯 처음부터 다시 설명합니다. 주제 하나가 A4 반 쪽~한 쪽 분량입니다.",
                        ],
                        ["증분 정리", "다시 실행하면 지난 정리 이후의 대화만 새 파일(_02, _03 …)로 정리합니다. 같은 내용을 두 번 쓰지 않습니다."],
                        ["설명 수준 5단계", "앱의 답변 수준과 같은 1 왕초보 · 2 입문 · 3 기초 · 4 실전 · 5 심화. 처음 한 번 묻고 기억합니다."],
                        ["앱이 읽는 구조", "노트가 ‘## N. 제목’ 단위라 학습장에 올리면 주제별로 나뉩니다. 둘째 줄의 유형·태그·난이도가 앱의 분류 기준입니다."],
                        [
                            "두 도구, 한 폴더",
                            "같은 스킬 폴더가 Claude Code(/study-notes)와 Codex($study-notes)에서 그대로 동작합니다. Python 3.10 이상, 표준 라이브러리만 씁니다.",
                        ],
                    ]}
                />
                <P>
                    저장소:{" "}
                    <a href={SKILL_URL} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">
                        {SKILL_URL}
                    </a>{" "}
                    (설치 절차, Windows 안내, 변경 내역이 함께 있습니다)
                </P>
            </GuideSub>

            <GuideSub id="skill-install" title="설치 (한 번만)">
                <P>
                    준비물은 <b>Claude Code 또는 Codex</b>, <b>Python 3.10 이상</b>입니다. Windows는 Git for Windows(Git Bash)도 설치해 두세요. 아래 셋 중 쓰는
                    도구에 맞는 방법 하나면 됩니다.
                </P>
                <P className="font-medium">방법 1. Claude Code 플러그인으로 설치 (권장 · Windows도 같음)</P>
                <P>Claude Code 채팅 입력칸에 아래 두 줄을 차례로 입력합니다. 첫 줄이 목록(마켓플레이스)을 등록하고, 둘째 줄이 설치합니다.</P>
                <TerminalPanel
                    title="Claude Code"
                    tone="claude"
                    lines={[
                        { type: "user", text: "/plugin marketplace add thinqsimon/claude-study-notes" },
                        { type: "ai", text: "마켓플레이스 ‘thinqsimon’을 추가했습니다." },
                        { type: "blank" },
                        { type: "user", text: "/plugin install study-notes@thinqsimon" },
                        { type: "ai", text: "플러그인 study-notes 를 설치했습니다. 다음 대화부터 /study-notes 스킬을 쓸 수 있습니다." },
                    ]}
                />
                <P className="font-medium">방법 2. Claude Code 스킬 폴더에 직접 복사 (macOS · Linux 터미널)</P>
                <TerminalPanel
                    title="터미널 (zsh · bash)"
                    tone="shell"
                    lines={[
                        { type: "cmd", text: "git clone https://github.com/thinqsimon/claude-study-notes.git" },
                        { type: "cmd", text: "mkdir -p ~/.claude/skills" },
                        { type: "cmd", text: "cp -R claude-study-notes/skills/study-notes ~/.claude/skills/" },
                        { type: "muted", text: "# 끝. Claude Code를 다시 열면 /study-notes 가 보입니다." },
                    ]}
                />
                <P className="font-medium">방법 3. Codex (CLI · VS Code 확장 · 데스크톱 앱)</P>
                <P>Codex 채팅에 아래 한 문장을 입력하면 내장 설치 스킬이 저장소에서 가져와 설치합니다. 직접 복사하려면 위 명령에서 폴더만 바꿉니다.</P>
                <TerminalPanel
                    title="Codex"
                    tone="codex"
                    lines={[
                        { type: "user", text: "$skill-installer 로 thinqsimon/claude-study-notes 저장소의 skills/study-notes 를 설치해줘" },
                        {
                            type: "ai",
                            text: "skills/study-notes 를 ~/.codex/skills/study-notes 에 설치했습니다. 다음 턴부터 $study-notes 로 부를 수 있습니다.",
                        },
                    ]}
                />
                <TerminalPanel
                    title="터미널 (직접 복사 · Codex)"
                    tone="shell"
                    lines={[
                        { type: "cmd", text: "git clone https://github.com/thinqsimon/claude-study-notes.git" },
                        { type: "cmd", text: "mkdir -p ~/.codex/skills" },
                        { type: "cmd", text: "cp -R claude-study-notes/skills/study-notes ~/.codex/skills/" },
                    ]}
                />
                <Callout kind="note" title="설치 뒤에는 도구를 다시 엽니다">
                    <p>Claude Code나 Codex를 완전히 종료했다가 다시 실행해야 새 스킬이 목록에 보입니다. 플러그인 방식은 설치 직후 다음 대화부터 됩니다.</p>
                </Callout>
            </GuideSub>

            <GuideSub id="skill-windows" title="Windows 사용자 안내 (꼭 읽어 주세요)">
                <P>
                    맥 기준 설명을 그대로 따라 하면 막히는 지점이 세 군데 있습니다. 그 부분만 맞추면 똑같이 동작합니다. 명령은 <b>PowerShell 또는 Git Bash</b>
                    에서 실행하고, 검은 명령 프롬프트(cmd.exe)는 쓰지 않습니다.
                </P>
                <Table
                    caption="맥과 Windows의 차이"
                    head={["막히는 지점", "맥 · 리눅스", "Windows에서는"]}
                    rows={[
                        [
                            "파이썬 실행 명령",
                            <Code key="1">python3</Code>,
                            <span key="2">
                                <Code>python</Code> (안 되면 <Code>py -3</Code>)
                            </span>,
                        ],
                        ["터미널(셸)", "bash, zsh", "PowerShell 또는 Git Bash. cmd.exe는 지원하지 않음"],
                        [
                            "홈 폴더 표기",
                            <Code key="3">~/StudyNotes</Code>,
                            <span key="4">
                                <Code>$HOME\StudyNotes</Code> 또는 <Code>%USERPROFILE%\StudyNotes</Code> (보통 C:\Users\이름\StudyNotes)
                            </span>,
                        ],
                    ]}
                />
                <Steps
                    items={[
                        {
                            title: "준비물 확인",
                            body: (
                                <>
                                    <p>PowerShell을 열고 두 줄을 실행합니다. 파이썬 3.10 이상과 git 버전이 나와야 합니다.</p>
                                    <TerminalPanel
                                        title="PowerShell"
                                        tone="powershell"
                                        lines={[
                                            { type: "cmd", text: "python --version" },
                                            { type: "out", text: "Python 3.12.4" },
                                            { type: "cmd", text: "git --version" },
                                            { type: "out", text: "git version 2.45.1.windows.1" },
                                        ]}
                                    />
                                    <p>
                                        <Code>python</Code>을 쳤는데 Microsoft Store가 열리면 파이썬이 없는 것입니다. python.org에서 설치하되 첫 화면의{" "}
                                        <b>“Add python.exe to PATH”</b>를 꼭 켜고, 설치 후 PowerShell을 다시 엽니다. git이 없으면 Git for Windows를 기본
                                        옵션으로 설치합니다.
                                    </p>
                                </>
                            ),
                        },
                        {
                            title: "설치",
                            body: (
                                <>
                                    <p>Claude Code 플러그인 방식은 맥과 같은 두 줄입니다. 직접 복사는 PowerShell에서 다음과 같이 합니다(쓰는 도구 쪽만).</p>
                                    <TerminalPanel
                                        title="PowerShell"
                                        tone="powershell"
                                        lines={[
                                            { type: "cmd", text: "git clone https://github.com/thinqsimon/claude-study-notes.git" },
                                            { type: "muted", text: "# Claude Code 용" },
                                            { type: "cmd", text: 'New-Item -ItemType Directory -Force "$HOME\\.claude\\skills" | Out-Null' },
                                            {
                                                type: "cmd",
                                                text: 'Copy-Item -Recurse -Force claude-study-notes\\skills\\study-notes "$HOME\\.claude\\skills\\"',
                                            },
                                            { type: "muted", text: "# Codex 용" },
                                            { type: "cmd", text: 'New-Item -ItemType Directory -Force "$HOME\\.codex\\skills" | Out-Null' },
                                            {
                                                type: "cmd",
                                                text: 'Copy-Item -Recurse -Force claude-study-notes\\skills\\study-notes "$HOME\\.codex\\skills\\"',
                                            },
                                        ]}
                                    />
                                </>
                            ),
                        },
                        {
                            title: "설치 확인",
                            body: (
                                <>
                                    <p>
                                        아래 한 줄을 실행해 JSON이 나오면 정상입니다. --cwd 뒤에는 AI와 대화한 프로젝트 폴더를 넣습니다. Codex는 .claude를
                                        .codex로, claude를 codex로 바꿉니다.
                                    </p>
                                    <TerminalPanel
                                        title="PowerShell"
                                        tone="powershell"
                                        lines={[
                                            {
                                                type: "cmd",
                                                text: 'python -I "$HOME\\.claude\\skills\\study-notes\\scripts\\study_notes.py" status --agent claude --cwd "C:\\Users\\이름\\프로젝트"',
                                            },
                                            {
                                                type: "out",
                                                text: '{ "agent": "claude", "project": "프로젝트", "run_count": 0, "unsummarized_messages": 42, … }',
                                            },
                                        ]}
                                    />
                                </>
                            ),
                        },
                        {
                            title: "사용",
                            body: (
                                <p>
                                    맥과 같습니다. 노트는 <Code>C:\Users\이름\StudyNotes\프로젝트\</Code>에 생기고, 탐색기 주소창에{" "}
                                    <Code>%USERPROFILE%\StudyNotes</Code>를 붙여 넣으면 바로 열립니다. 고른 설명 수준은 그 폴더의 <Code>settings.json</Code>에
                                    기억됩니다.
                                </p>
                            ),
                        },
                    ]}
                />
                <Table
                    caption="Windows에서 자주 나는 오류"
                    head={["증상", "원인", "해결"]}
                    rows={[
                        ["python3 : 용어가 … 인식되지 않습니다", "Windows에는 python3 명령이 없음", "python 또는 py -3 로 바꿔 실행"],
                        [
                            "python을 치면 Microsoft Store가 열림",
                            "파이썬 미설치 또는 PATH 미등록",
                            "설치 때 ‘Add to PATH’ 체크. 이미 설치했다면 설정 → 앱 → 앱 실행 별칭에서 python.exe 끄기",
                        ],
                        ["경로에 ~ 를 썼는데 파일을 못 찾음", "PowerShell은 프로그램에 넘기는 ~ 를 풀지 않음", "~ 대신 $HOME 또는 %USERPROFILE% 사용"],
                        ["$HOME, $PWD 가 빈 값", "cmd.exe에서 실행함", "PowerShell 또는 Git Bash에서 실행"],
                        ["한글이 ? 나 깨진 글자로 보임", "콘솔 인코딩(cp949)", "스크립트가 UTF-8로 출력함. 그래도 깨지면 chcp 65001 실행 후 재시도"],
                        [
                            "세션 기록을 찾을 수 없습니다",
                            "--cwd 가 AI와 대화한 폴더와 다름",
                            "대화한 프로젝트 폴더 경로를 정확히. Git Bash의 /c/Users/… 형태도 자동 변환됨",
                        ],
                    ]}
                />
            </GuideSub>

            <GuideSub id="skill-use" title="실제 사용: 입력하는 법">
                <P>
                    AI와 코딩하다가 정리하고 싶을 때, 채팅 입력칸에 한 줄만 입력합니다. Claude Code는 슬래시(<Code>/</Code>), Codex는 달러(<Code>$</Code>)로
                    시작합니다.
                </P>
                <Table
                    caption="입력 방법"
                    head={["입력", "도구", "뜻"]}
                    rows={[
                        [<Code key="1">/study-notes</Code>, "Claude Code", "지난 정리 이후의 대화를 기억된 설명 수준으로 정리"],
                        [<Code key="2">/study-notes 4</Code>, "Claude Code", "4단계 실전으로 정리하고, 다음에도 4단계로 기억"],
                        [<Code key="3">/study-notes 기초</Code>, "Claude Code", "이름으로도 고를 수 있음(왕초보·입문·기초·실전·심화)"],
                        [<Code key="4">$study-notes</Code>, "Codex", "Claude Code의 /study-notes 와 같음"],
                        [<Code key="5">$study-notes 3</Code>, "Codex", "3단계 기초로 정리하고 기억"],
                        ["“4단계로 정리해 줘”", "둘 다", "스킬을 부른 뒤 말로 단계를 말해도 됩니다"],
                    ]}
                />
                <P className="font-medium">처음 실행: 설명 수준을 묻습니다</P>
                <TerminalPanel
                    title="Claude Code"
                    tone="claude"
                    lines={[
                        { type: "user", text: "/study-notes" },
                        { type: "ai", text: "처음 실행이네요. 노트의 설명 수준을 골라 주세요. 고르기 전에는 2단계 입문으로 씁니다." },
                        { type: "out", text: "  1단계 왕초보  컴퓨터·IT 용어가 낯선 분      일상 비유 먼저, 용어는 바로 풀이, 코드는 최소" },
                        { type: "out", text: "  2단계 입문    비전공으로 막 입과한 분        핵심 용어와 한 줄 풀이, 짧은 코드와 주석" },
                        { type: "out", text: "  3단계 기초    변수·함수·조건문을 익힌 분     새 개념만 풀이, 단계별 예제와 이유" },
                        { type: "out", text: "  4단계 실전    웹 프로젝트를 만드는 분        동작 원리·설계 이유·장단점, 실무형 코드" },
                        { type: "out", text: "  5단계 심화    전공자·실무 경험자             기초 생략, 내부 동작·트레이드오프·공식 문서" },
                        { type: "ai", text: "번호(1~5)로 골라 주세요." },
                        { type: "blank" },
                        { type: "user", text: "2" },
                        { type: "ai", text: "2단계 입문으로 정리합니다. 지난 정리 이후 대화 95건을 읽는 중…" },
                    ]}
                />
                <P className="font-medium">정리가 끝나면: 노트 위치와 주제 목록을 보고합니다</P>
                <TerminalPanel
                    title="Claude Code"
                    tone="claude"
                    lines={[
                        { type: "ai", text: "배움노트를 만들었습니다." },
                        { type: "out", text: "  노트: /Users/me/StudyNotes/SpaceXyzDiary/SpaceXyzDiary_2026-10-28_02.md (2단계 입문, 주제 7개)" },
                        { type: "out", text: "  1. LAN 주소로 열면 “불러오는 중…”에서 멈춘다: Next 개발 서버의 출처 제한과 백엔드 CORS" },
                        { type: "out", text: "  2. 유일 제약의 범위 정하기: “파일명”에서 “프로젝트 + 파일명”으로" },
                        { type: "out", text: "  3. 기존 데이터를 깨지 않고 규칙 바꾸기 …" },
                        { type: "out", text: "  주제 목록: /Users/me/StudyNotes/index.md 에 7행 추가" },
                        { type: "ai", text: "단계를 바꾸려면 /study-notes 4 처럼 부르세요." },
                    ]}
                />
                <P className="font-medium">다음 실행: 지난번 이후만 새 파일로</P>
                <TerminalPanel
                    title="Codex"
                    tone="codex"
                    lines={[
                        { type: "user", text: "$study-notes" },
                        { type: "ai", text: "지난 정리(10-28 14:02) 이후 대화 31건을 2단계 입문으로 정리합니다…" },
                        { type: "out", text: "  노트: ~/StudyNotes/SpaceXyzDiary/SpaceXyzDiary_2026-10-28_03.md (주제 4개)" },
                        { type: "blank" },
                        { type: "user", text: "$study-notes" },
                        { type: "ai", text: "정리할 새 대화가 없습니다." },
                    ]}
                />
                <Callout kind="tip" title="Codex에서 쓰기 승인을 물어보면">
                    <p>
                        노트 폴더 <Code>~/StudyNotes</Code>는 프로젝트 폴더 밖이라 Codex의 샌드박스가 쓰기를 막을 수 있습니다. 노트를 쓰거나 등록할 때 승인을
                        물어보면 허용해 주세요. 대화 기록은 읽기만 합니다.
                    </p>
                </Callout>
            </GuideSub>

            <GuideSub id="skill-output" title="무엇이 만들어지나">
                <TerminalPanel
                    title="~/StudyNotes 폴더 구조"
                    tone="shell"
                    lines={[
                        { type: "out", text: "StudyNotes/" },
                        { type: "out", text: "  README.md            안내문(처음 실행 때 생김)" },
                        { type: "out", text: "  index.md             모든 프로젝트의 주제 목록 (날짜·프로젝트·주제·유형·태그·수준·요약·링크)" },
                        { type: "out", text: '  settings.json        기억한 설명 수준 (예: {"level": 3})' },
                        { type: "out", text: "  .state/              증분 정리용 체크포인트 (지우면 처음부터 다시 정리)" },
                        { type: "out", text: "  SpaceXyzDiary/       프로젝트마다 폴더" },
                        { type: "out", text: "    SpaceXyzDiary_2026-10-28_01.md   실행 1회마다 파일 하나" },
                        { type: "out", text: "    SpaceXyzDiary_2026-10-28_02.md" },
                    ]}
                />
                <P>노트 파일 하나의 구조입니다. 앱의 학습장은 이 구조를 읽어 주제별로 나눕니다.</P>
                <TerminalPanel
                    title="SpaceXyzDiary_2026-10-28_02.md"
                    tone="shell"
                    lines={[
                        { type: "out", text: "---" },
                        { type: "out", text: "title: SpaceXyzDiary 배움노트 #03 · 2단계 입문" },
                        { type: "out", text: "project: SpaceXyzDiary" },
                        { type: "out", text: "level: 2" },
                        { type: "out", text: "level_name: 입문" },
                        { type: "out", text: "topics: 7" },
                        { type: "out", text: "---" },
                        { type: "out", text: "# SpaceXyzDiary 배움노트 #03 · 2026-10-28 · 2단계 입문" },
                        { type: "out", text: "> 설명 수준: 2단계 입문. 비전공으로 막 입과한 분에게 맞춰 썼어요." },
                        { type: "out", text: ">" },
                        { type: "out", text: "> 이번 구간에서 한 일 요약 …" },
                        { type: "blank" },
                        { type: "out", text: "## 목차        ← 주제로 치지 않음" },
                        { type: "blank" },
                        { type: "out", text: "## 1. LAN 주소로 열면 “불러오는 중…”에서 멈춘다   ← 주제 하나" },
                        { type: "out", text: "> 한 줄 요약: 같은 서버라도 localhost 와 IP 주소는 브라우저에게 다른 출처다." },
                        { type: "out", text: "`유형` 문제해결 | `태그` nextjs, cors | `난이도` ★★☆   ← 앱의 유형·태그·난이도" },
                        { type: "out", text: "### 어떤 상황에서 나왔나 … ### 왜 필요한가 … ### 핵심 개념 …" },
                        { type: "out", text: "### 문제 → 원인 → 해결 → 재발 방지 … ### 명령어 / 코드 … ### 흔한 실수 … ### 자가 점검 질문 … ### 더 공부할 것" },
                    ]}
                />
                <Table
                    caption="주제 한 개의 소제목 흐름"
                    head={["소제목", "내용"]}
                    rows={[
                        ["어떤 상황에서 나왔나", "대화 속 맥락. 무엇을 하려다 이 개념이 등장했는가"],
                        ["왜 필요한가", "없으면 생기는 문제, 일상 비유"],
                        ["핵심 개념", "정의와 동작 원리. 전문 용어는 등장할 때마다 한 줄 풀이"],
                        ["이 프로젝트에서는 이렇게 썼다", "실제 사례를 교재 예제로 재구성"],
                        ["문제 → 원인 → 해결 → 재발 방지", "문제해결 유형일 때. 오류 메시지는 원문 그대로"],
                        ["명령어 / 코드", "블록마다 한 줄 설명, 옵션의 뜻 풀이"],
                        ["흔한 실수 · 자가 점검 질문 · 더 공부할 것", "초보자가 자주 틀리는 지점, 답이 달린 질문 2~3개, 다음에 배울 키워드"],
                    ]}
                />
            </GuideSub>

            <GuideSub id="skill-to-app" title="노트를 앱 학습장에 올리기">
                <Steps
                    items={[
                        {
                            title: "노트 파일을 찾습니다",
                            body: (
                                <p>
                                    맥은 Finder에서 ~/StudyNotes/프로젝트/, Windows는 탐색기 주소창에 %USERPROFILE%\StudyNotes. 파일명에 프로젝트 이름과 날짜가
                                    있어 고르기 쉽습니다.
                                </p>
                            ),
                        },
                        {
                            title: "앱의 학습장 → ‘학습장 올리기’",
                            body: (
                                <p>
                                    파일을 고르면 주제별로 나뉘어 저장되고 ‘신규’ 보기에 보입니다. 학습장 제목에 ‘· 2단계 입문’처럼 노트의 설명 수준이 붙습니다.
                                </p>
                            ),
                        },
                        { title: "보관하고, 읽고, 완료합니다", body: <p>지금 읽을 것은 바로 읽고, 나중에 볼 것은 ‘선택 → 보관’. 이해했으면 ‘학습 완료’.</p> },
                    ]}
                />
                <Callout kind="warn" title="올리기가 ‘서버에 연결할 수 없습니다’로 실패하면">
                    <p>
                        아주 긴 노트(수만 자 이상)는 서버 앞단의 보안 장치가 막는 경우가 확인되었습니다. 노트를 두세 파일로 나누어 올리거나, 스킬을 더 자주
                        실행해 노트를 짧게 유지하세요. 같은 파일명이라 거부된 것이면 메시지가 다릅니다(기존 학습장을 삭제한 뒤 올려 달라는 안내).
                    </p>
                </Callout>
            </GuideSub>

            <GuideSub id="skill-tips" title="사용 팁">
                <Table
                    caption="스킬을 값지게 쓰는 요령"
                    head={["팁", "설명"]}
                    rows={[
                        [
                            "남는 토큰을 공부로 바꾸기",
                            "AI 토큰이 리셋되기 전에 다 쓰지 못할 것 같을 때 실행하세요. 흘려보낼 토큰이 학습 노트가 됩니다. 넉넉한 날에는 노트 분량을 늘려 달라고 해도 좋습니다.",
                        ],
                        [
                            "실행 직전에 상위 모델로 바꾸기",
                            "노트 품질은 그때 쓰는 모델에 좌우됩니다. 실행 직전에 더 좋은 모델로 바꾸면(Claude Code는 /model, Codex는 설정) 설명이 깊고 정확해집니다. 코딩은 빠른 모델, 정리는 좋은 모델로 나눠 쓰세요.",
                        ],
                        [
                            "실행하기 좋은 순간",
                            "기능 하나를 끝냈을 때, 막혔던 문제를 막 해결했을 때, 대화가 길어져 AI가 앞부분을 요약해 버리기 전에. 마지막 한 번은 세션을 닫기 직전에.",
                        ],
                        [
                            "노트 폴더를 즐겨찾기에",
                            "~/StudyNotes를 Finder 즐겨찾기(Windows는 탐색기 ‘즐겨찾기에 고정’)에 두면 틈날 때 바로 엽니다. Finder에서 스페이스로 미리보기, VS Code는 Cmd+Shift+V(Windows Ctrl+Shift+V).",
                        ],
                        [
                            "index.md를 공부 목록으로",
                            "모든 프로젝트의 주제가 한 표에 모입니다. ‘문제해결’만 모아 복습하거나 태그로 같은 기술을 묶어 보세요. 주제 이름을 누르면 그 섹션으로 이동합니다.",
                        ],
                        [
                            "여러 프로젝트에서 그대로",
                            "어느 프로젝트 폴더에서 실행해도 프로젝트별 폴더에 쌓이고, 파일명에 프로젝트명이 붙어 날짜가 같아도 겹치지 않습니다.",
                        ],
                        [
                            "실력에 맞춰 단계 올리기",
                            "처음엔 2단계, 쉽게 느껴지면 3·4단계로. 이미 아는 기초 주제는 빠지고 원리와 설계 이유를 더 깊게 다룹니다. 어려우면 1단계로 내려 비유부터.",
                        ],
                        [
                            "마음에 안 들면 다시",
                            "노트가 짧거나 요약처럼 느껴지면 ~/StudyNotes/.state/<세션id>.json 을 지우고 다시 실행하세요. 단계를 바꿔 다시 실행해도 됩니다.",
                        ],
                        [
                            "공유하기 전에 한 번 훑기",
                            "스킬은 .env 값·토큰·이메일을 빼도록 되어 있지만, 대화에 비밀값이 섞였다면 공유 전에 노트를 한 번 훑어보세요.",
                        ],
                    ]}
                />
            </GuideSub>

            <GuideSub id="skill-trouble" title="문제가 생기면">
                <Table
                    caption="스킬 문제 해결"
                    head={["증상", "해결"]}
                    rows={[
                        ["세션 기록을 찾을 수 없습니다", "--session 없이 다시 실행하거나, --cwd 에 AI와 대화한 프로젝트 폴더를 넣습니다."],
                        [
                            "이 폴더에서 연 Codex 스레드 기록이 없습니다",
                            "Codex가 다른 폴더를 열고 있거나 --agent 가 틀렸습니다. Codex에서 연 작업 폴더를 --cwd 에 넣고 --agent codex 를 확인합니다.",
                        ],
                        ["처음부터 다시 정리하고 싶다", "~/StudyNotes/.state/<세션id>.json 을 지웁니다. 그 세션은 처음부터 다시 정리됩니다."],
                        ["설명 수준을 바꾸고 싶다", "/study-notes 4 처럼 부르거나, ~/StudyNotes/settings.json 의 level 값을 고칩니다."],
                        ["알 수 없는 설명 수준입니다", "1~5 숫자나 왕초보·입문·기초·실전·심화 중 하나로 다시 고릅니다."],
                        [
                            "Codex에서 오래된 대화가 안 잡힌다",
                            "Codex는 오래된 기록 파일을 지우는 것으로 보입니다. 대화가 끝난 직후에 정리하는 편이 안전합니다.",
                        ],
                    ]}
                />
                <P>
                    상태 확인은 <Code>python3 -I ~/.claude/skills/study-notes/scripts/study_notes.py status --agent claude --cwd &quot;$PWD&quot;</Code> 처럼
                    실행합니다(Codex는 경로의 .claude를 .codex로, claude를 codex로). 더 자세한 내용은 저장소 README에 있습니다.
                </P>
            </GuideSub>
        </GuideSection>
    )
}
