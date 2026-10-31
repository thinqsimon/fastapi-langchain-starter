/** 사용 안내 목차. 단원 id는 각 섹션 컴포넌트의 GuideSection id와 같아야 한다. */
export const GUIDE_TOC = [
    { id: "overview", label: "한눈에 보기" },
    { id: "start", label: "시작하기" },
    { id: "by-level", label: "숙련도별 사용법" },
    { id: "chat", label: "채팅: 구름 코치와 대화" },
    { id: "answer-level", label: "답변 수준 5단계" },
    { id: "diary", label: "배움일기 만들기" },
    { id: "review", label: "주간 회고와 복습" },
    { id: "notebook", label: "학습장" },
    { id: "skill", label: "/study-notes 스킬" },
    { id: "settings", label: "설정·계정·요금제" },
    { id: "mobile", label: "폰에서 쓰기" },
    { id: "faq", label: "자주 묻는 질문" },
] as const

function TocList() {
    return (
        <ol className="flex flex-col gap-1 text-sm">
            {GUIDE_TOC.map((item, index) => (
                <li key={item.id}>
                    <a href={`#${item.id}`} className="flex gap-2 rounded-md px-2 py-1 leading-6 hover:bg-muted">
                        <span className="w-5 shrink-0 text-right text-muted-foreground tabular-nums">{index + 1}.</span>
                        <span>{item.label}</span>
                    </a>
                </li>
            ))}
        </ol>
    )
}

/** 넓은 화면에서는 왼쪽에 고정된 목차, 좁은 화면에서는 접었다 펴는 목차. */
export function GuideToc() {
    return (
        <>
            <nav aria-label="사용 안내 목차" className="sticky top-0 hidden self-start lg:block">
                <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">목차</p>
                <TocList />
            </nav>
            <details className="rounded-xl border p-3 lg:hidden">
                <summary className="cursor-pointer text-sm font-medium">목차 펼치기</summary>
                <div className="mt-2">
                    <TocList />
                </div>
            </details>
        </>
    )
}
