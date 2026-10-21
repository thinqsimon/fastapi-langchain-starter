/** 프리뷰·복사에 쓰는 일기 한 편. 저장한 일기와 작성 중인 초안이 함께 쓴다. */
export type DiaryDocumentInput = {
    title: string
    learned: string
    learned_detail: string
    difficult: string
    next_plan: string | null
    footer: string | null
}

/**
 * 제목(#)이나 구분선(---, ***, ===)으로 읽히는 줄은 앞에 \\를 붙인다.
 * 그냥 쓴 글의 한 줄이 문서의 큰 제목이나 푸터 구분선으로 바뀌어 구조가 깨지는 것을 막는다.
 * 목록·코드 같은 다른 표기는 그대로 살린다.
 */
function escapeBlockMarkers(line: string): string {
    if (/^#{1,6}(\s|$)/.test(line)) return `\\${line}`
    if (/^([-*_=])(\s*\1){2,}\s*$/.test(line)) return `\\${line}`
    return line
}

/** 그냥 쓴 글은 줄바꿈 하나가 마크다운에서 합쳐지므로 문단으로 나눠 그대로 보이게 한다. */
function paragraphs(text: string): string {
    return text
        .trim()
        .split(/\n\s*\n|\n/)
        .map((line) => escapeBlockMarkers(line.trim()))
        .filter(Boolean)
        .join("\n\n")
}

/** 일기의 항목(컬럼) 하나. 본문은 마크다운이다. */
export type DiarySection = { heading: string; body: string }

/**
 * 비어 있지 않은 항목만 순서대로 돌려준다.
 * 순서: 배운 것 → 배운 내용 상세 → 어려웠던 것 → 내일 할 것(있을 때만).
 */
export function diarySections(diary: DiaryDocumentInput): DiarySection[] {
    return [
        { heading: "배운 것", body: paragraphs(diary.learned) },
        // 상세는 이미 '### 소제목' 마크다운이라 그대로 둔다.
        { heading: "배운 내용 상세", body: diary.learned_detail.trim() },
        { heading: "어려웠던 것", body: paragraphs(diary.difficult) },
        { heading: "내일 할 것", body: paragraphs(diary.next_plan ?? "") },
    ].filter((section) => section.body.trim())
}

/** 푸터를 문단으로 정리한 것. 없으면 빈 문자열 */
export function diaryFooter(diary: DiaryDocumentInput): string {
    return diary.footer?.trim() ? paragraphs(diary.footer) : ""
}

/**
 * 일기 전체를 마크다운 한 문서로 만든다.
 * 순서: 제목 → 항목들(diarySections) → 푸터(있을 때만). 비어 있는 항목은 넣지 않는다.
 */
export function diaryToMarkdown(diary: DiaryDocumentInput): string {
    const blocks: string[] = []
    if (diary.title.trim()) blocks.push(`# ${diary.title.trim()}`)
    for (const { heading, body } of diarySections(diary)) blocks.push(`## ${heading}\n\n${body}`)
    const footer = diaryFooter(diary)
    if (footer) blocks.push(`---\n\n${footer}`)
    return blocks.join("\n\n") + "\n"
}

/** 프리뷰·복사할 내용이 있는지(제목만 있으면 없는 것으로 본다) */
export function hasDiaryContent(diary: DiaryDocumentInput): boolean {
    return [diary.learned, diary.learned_detail, diary.difficult, diary.next_plan ?? ""].some((text) => text.trim())
}
