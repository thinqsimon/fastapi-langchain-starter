import type { ReactNode } from "react"
import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { BlankLine, SubHeading } from "@/components/diary/diary-paste-document"
import type { NotebookTopic } from "@/lib/api/types"

type TopicPasteInput = Pick<NotebookTopic, "title" | "content">

/** 본문의 소제목(### 어떤 상황에서 나왔나 …). 붙여 넣은 곳에서 여백이 사라져도 나뉘어 보이게 앞에 빈 줄을 넣는다. */
function SectionHeading({ children }: { children?: ReactNode }) {
    return (
        <>
            <BlankLine />
            <h3>{children}</h3>
        </>
    )
}

/** 노트끼리 잇는 상대 링크(이전 노트: [제목](2026-10-27_02.md#…))는 붙여 넣은 곳에서 열리지 않는다. 웹 주소만 링크로 남긴다. */
function PasteLink({ href, children }: { href?: string; children?: ReactNode }) {
    return href && /^(https?:|mailto:)/i.test(href) ? <a href={href}>{children}</a> : <>{children}</>
}

const BODY: Components = {
    h1: SectionHeading,
    h2: SectionHeading,
    h3: SectionHeading,
    h4: SubHeading,
    h5: SubHeading,
    h6: SubHeading,
    a: PasteLink,
}

/** 주제 제목(#) 다음에 노트 본문을 그대로 잇는다. 화면처럼 메타 줄(유형·태그·난이도)은 넣지 않는다. */
export function topicToMarkdown(topic: TopicPasteInput): string {
    return [`# ${topic.title.trim()}`, topic.content.trim()].filter(Boolean).join("\n\n") + "\n"
}

/**
 * 학습장 주제 '클립보드에 복사'의 서식(HTML)용 문서. 화면에 띄우지 않고 클립보드에만 넣는다.
 * 일기 '전체 복사'(DiaryPasteDocument)와 같은 규칙으로 교육 플랫폼 편집기에 맞춘다:
 * 제목은 h1, 본문의 소제목은 모두 h3, 더 깊은 제목(####~)은 '▶ 굵은 글씨' 문단.
 */
export function TopicPasteDocument({ topic }: { topic: TopicPasteInput }) {
    return (
        <>
            <h1>{topic.title.trim()}</h1>
            <Markdown remarkPlugins={[remarkGfm]} components={BODY}>
                {topic.content}
            </Markdown>
        </>
    )
}
