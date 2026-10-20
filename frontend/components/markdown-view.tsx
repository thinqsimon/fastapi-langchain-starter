import { cn } from "cn"
import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

// 태그마다 필요한 값만 넘긴다(react-markdown이 주는 node 등 DOM에 없는 속성이 새지 않게).
const COMPONENTS: Components = {
    h1: ({ children }) => <h3 className="mt-3 text-base font-semibold first:mt-0">{children}</h3>,
    h2: ({ children }) => <h3 className="mt-3 text-base font-semibold first:mt-0">{children}</h3>,
    h3: ({ children }) => <h3 className="mt-3 text-sm font-semibold first:mt-0">{children}</h3>,
    h4: ({ children }) => <h4 className="mt-2 text-sm font-medium first:mt-0">{children}</h4>,
    p: ({ children }) => <p className="leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-4">
            {children}
        </a>
    ),
    blockquote: ({ children }) => <blockquote className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>,
    code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
    pre: ({ children }) => <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
    table: ({ children }) => (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">{children}</table>
        </div>
    ),
    th: ({ children }) => <th className="border px-2 py-1 font-medium">{children}</th>,
    td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
}

/**
 * LLM이 쓴 마크다운(예: '배운 내용 상세')을 소제목·목록으로 보여준다.
 * 원본 HTML은 그리지 않는다(react-markdown 기본값). 내용에 스크립트가 섞여도 실행되지 않는다.
 */
export function MarkdownView({ children, className }: { children: string; className?: string }) {
    return (
        <div className={cn("flex min-w-0 flex-col gap-2 text-sm wrap-anywhere", className)}>
            <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
                {children}
            </Markdown>
        </div>
    )
}
