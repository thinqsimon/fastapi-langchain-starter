import { Fragment, type ReactNode } from "react"
import Markdown, { type Components, type ExtraProps } from "react-markdown"
import remarkGfm from "remark-gfm"

import { diaryFooter, diarySections, type DiaryDocumentInput } from "@/lib/diary-markdown"

/**
 * '전체 복사'의 서식(HTML)용 문서. 화면에 띄우지 않고 클립보드에만 넣는다.
 *
 * 붙여 넣는 곳(교육 플랫폼 편집기·노션·구글 문서)은 우리 CSS를 버리고 태그만 받아 자기 스타일로 다시 그린다.
 * 그래서 크기·여백 대신 태그와 빈 줄로 모양을 잡는다.
 * - 항목 제목(배운 것·배운 내용 상세·어려웠던 것·내일 할 것)은 모두 같은 단계(h3)로 맞춘다.
 * - 상세 안의 소제목은 제목 태그 대신 '▶ 굵은 글씨' 문단으로 바꿔 항목 제목보다 확실히 작게 보이게 한다
 *   (플랫폼은 h2·h3를 거의 같은 크기로 크게 그려 항목 제목과 소제목이 구분되지 않았다).
 * - 항목 사이, 그리고 상세 안의 소주제 사이에는 빈 문단을 넣는다. 여백 스타일은 사라져도 빈 줄은 남는다.
 */
function SubHeading({ children, node }: { children?: ReactNode } & ExtraProps) {
    // 본문 맨 앞의 소제목은 바로 위가 항목 제목이라 빈 줄을 넣지 않는다(빈 줄이 겹치지 않게).
    const first = node?.position?.start.offset === 0
    return (
        <>
            {!first && <BlankLine />}
            <p>
                <strong>▶ {children}</strong>
            </p>
        </>
    )
}

const BODY: Components = {
    h1: SubHeading,
    h2: SubHeading,
    h3: SubHeading,
    h4: SubHeading,
    h5: SubHeading,
    h6: SubHeading,
}

/** 빈 줄. 편집기 대부분이 내용 없는 문단을 지우지 않도록 <br>을 넣는다. */
function BlankLine() {
    return (
        <p>
            <br />
        </p>
    )
}

export function DiaryPasteDocument({ diary }: { diary: DiaryDocumentInput }) {
    const footer = diaryFooter(diary)
    return (
        <>
            {diary.title.trim() && <h1>{diary.title.trim()}</h1>}
            {diarySections(diary).map(({ heading, body }) => (
                <Fragment key={heading}>
                    <BlankLine />
                    <h3>{heading}</h3>
                    <Markdown remarkPlugins={[remarkGfm]} components={BODY}>
                        {body}
                    </Markdown>
                </Fragment>
            ))}
            {footer && (
                <>
                    <BlankLine />
                    <hr />
                    <Markdown remarkPlugins={[remarkGfm]}>{footer}</Markdown>
                </>
            )}
        </>
    )
}
