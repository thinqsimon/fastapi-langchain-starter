import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

// 인쇄된 문서처럼 보이게 한다. 복사할 때도 이 화면을 그대로 HTML로 옮기므로 제목 단계(h1~h3)를 지킨다.
const COMPONENTS: Components = {
    h1: ({ children }) => <h1 className="text-2xl font-bold">{children}</h1>,
    h2: ({ children }) => <h2 className="mt-6 border-b pb-1 text-lg font-semibold">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-4 text-base font-semibold">{children}</h3>,
    h4: ({ children }) => <h4 className="mt-3 text-sm font-semibold">{children}</h4>,
    p: ({ children }) => <p className="mt-2 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-4">
            {children}
        </a>
    ),
    blockquote: ({ children }) => <blockquote className="mt-2 border-l-2 pl-3 text-muted-foreground">{children}</blockquote>,
    code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
    pre: ({ children }) => <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
    hr: () => <hr className="my-6" />,
    table: ({ children }) => (
        <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">{children}</table>
        </div>
    ),
    th: ({ children }) => <th className="border px-2 py-1 font-medium">{children}</th>,
    td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
}

/** 일기 한 편을 문서(마크다운 프리뷰) 형태로 보여준다. 원본 HTML은 그리지 않는다. */
export function DiaryDocument({ markdown }: { markdown: string }) {
    return (
        <article data-slot="diary-document" className="min-w-0 text-sm wrap-anywhere text-foreground">
            <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
                {markdown}
            </Markdown>
        </article>
    )
}
