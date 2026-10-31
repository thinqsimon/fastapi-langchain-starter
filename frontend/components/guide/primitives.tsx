import Image, { type StaticImageData } from "next/image"
import type { ReactNode } from "react"
import { CircleAlert, Lightbulb, Info } from "lucide-react"

import { cn } from "@/lib/utils"

/** 사용 안내의 큰 단원. id는 목차 링크와 `/guide#id` 주소가 쓴다. */
export function GuideSection({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-4 flex-col gap-5 border-t pt-8 first:border-t-0 first:pt-0">
            <div className="flex flex-col gap-2">
                <h2 id={`${id}-title`} className="text-2xl font-semibold tracking-tight">
                    {title}
                </h2>
                {lead && <p className="text-sm leading-7 text-muted-foreground">{lead}</p>}
            </div>
            {children}
        </section>
    )
}

/** 단원 안의 소제목. */
export function GuideSub({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
    return (
        <div id={id} className="flex scroll-mt-4 flex-col gap-3">
            <h3 className="text-lg font-semibold">{title}</h3>
            {children}
        </div>
    )
}

/** 본문 문단. 줄 간격을 넉넉히 둔다. */
export function P({ children, className }: { children: ReactNode; className?: string }) {
    return <p className={cn("text-sm leading-7", className)}>{children}</p>
}

/** 화면 스크린샷. 테두리를 둘러 앱 화면과 구분하고, 아래에 설명을 단다. */
export function Figure({
    src,
    alt,
    caption,
    size = "full",
    priority,
}: {
    src: StaticImageData
    alt: string
    caption?: ReactNode
    /** full: 글 너비, half: 절반, phone: 폰 세로 화면, crop: 부분 캡처(원래 크기 이하) */
    size?: "full" | "half" | "phone" | "crop"
    priority?: boolean
}) {
    const width = { full: "w-full", half: "w-full sm:max-w-md", phone: "w-full max-w-[260px]", crop: "w-full max-w-sm" }[size]
    return (
        <figure className={cn("flex flex-col gap-2", width)}>
            <Image
                src={src}
                alt={alt}
                priority={priority}
                sizes={size === "full" ? "(min-width: 1024px) 760px, 100vw" : "(min-width: 640px) 448px, 100vw"}
                className="h-auto w-full rounded-xl border bg-background shadow-sm"
            />
            {caption && <figcaption className="text-xs leading-5 text-muted-foreground">{caption}</figcaption>}
        </figure>
    )
}

/** 스크린샷 여러 장을 나란히. 좁은 화면에서는 세로로 쌓인다. */
export function FigureRow({ children }: { children: ReactNode }) {
    return <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">{children}</div>
}

/** 팁·주의·참고 상자. */
export function Callout({ kind = "tip", title, children }: { kind?: "tip" | "warn" | "note"; title?: string; children: ReactNode }) {
    const style = {
        tip: { icon: Lightbulb, box: "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30", label: "팁" },
        warn: { icon: CircleAlert, box: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30", label: "주의" },
        note: { icon: Info, box: "border-border bg-muted/50", label: "참고" },
    }[kind]
    const Icon = style.icon
    return (
        <div role="note" className={cn("flex gap-3 rounded-xl border p-4 text-sm leading-6", style.box)}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex min-w-0 flex-col gap-1">
                <p className="font-medium">{title ?? style.label}</p>
                <div className="flex flex-col gap-2 text-muted-foreground [&_b]:text-foreground">{children}</div>
            </div>
        </div>
    )
}

/** 번호가 붙은 따라 하기 단계. 각 항목은 제목(굵게)과 설명으로 이루어진다. */
export function Steps({ items }: { items: { title: ReactNode; body?: ReactNode }[] }) {
    return (
        <ol className="flex flex-col gap-3">
            {items.map((item, index) => (
                <li key={index} className="flex gap-3">
                    <span
                        aria-hidden
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                    >
                        {index + 1}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1 text-sm leading-6">
                        <p className="font-medium">{item.title}</p>
                        {item.body && <div className="flex flex-col gap-2 text-muted-foreground [&_b]:text-foreground">{item.body}</div>}
                    </div>
                </li>
            ))}
        </ol>
    )
}

/** 화면의 버튼·메뉴 이름을 본문에서 가리킬 때. */
export function Ui({ children }: { children: ReactNode }) {
    return <b className="rounded border bg-muted px-1.5 py-0.5 text-[0.85em] font-medium whitespace-nowrap text-foreground">{children}</b>
}

/** 짧은 명령·경로. */
export function Code({ children }: { children: ReactNode }) {
    return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] break-all">{children}</code>
}

/** 간단한 표. 첫 행이 머리글이다. */
export function Table({ head, rows, caption }: { head: ReactNode[]; rows: ReactNode[][]; caption?: string }) {
    return (
        <div className="overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-left text-sm">
                {caption && <caption className="sr-only">{caption}</caption>}
                <thead className="bg-muted/60">
                    <tr>
                        {head.map((cell, index) => (
                            <th key={index} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                                {cell}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t align-top">
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="px-3 py-2 leading-6">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export type TerminalLine = {
    /** cmd: 셸 명령, user: AI 도구에 입력한 말, ai: AI의 응답, out: 명령 출력, muted: 설명(회색), blank: 빈 줄 */
    type: "cmd" | "user" | "ai" | "out" | "muted" | "blank"
    text?: string
}

/**
 * 터미널·AI 도구 화면을 흉내 낸 패널. 실제 입력 문구를 선명하게 보여 주고 복사할 수 있다.
 * tone이 claude·codex면 채팅창처럼(입력 줄 강조), shell이면 명령줄처럼 보인다.
 */
export function TerminalPanel({ title, tone = "shell", lines }: { title: string; tone?: "shell" | "claude" | "codex" | "powershell"; lines: TerminalLine[] }) {
    const prompt = { shell: "$", powershell: "PS>", claude: ">", codex: "›" }[tone]
    return (
        <div data-slot="terminal" className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-md">
            <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
                <span aria-hidden className="flex gap-1.5">
                    <i className="size-2.5 rounded-full bg-red-500/80" />
                    <i className="size-2.5 rounded-full bg-amber-400/80" />
                    <i className="size-2.5 rounded-full bg-emerald-500/80" />
                </span>
                <span className="text-xs text-zinc-400">{title}</span>
            </div>
            <pre className="overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-6 whitespace-pre-wrap">
                {lines.map((line, index) => {
                    if (line.type === "blank") return <span key={index}>{"\n"}</span>
                    if (line.type === "cmd")
                        return (
                            <span key={index} className="block">
                                <span className="text-emerald-400">{prompt} </span>
                                <span className="font-semibold text-white">{line.text}</span>
                            </span>
                        )
                    if (line.type === "user")
                        return (
                            <span key={index} className="my-1 block rounded-md border border-sky-800/60 bg-sky-950/50 px-2 text-sky-100">
                                <span className="text-sky-400">{prompt} </span>
                                <span className="font-semibold">{line.text}</span>
                            </span>
                        )
                    if (line.type === "ai")
                        return (
                            <span key={index} className="block text-zinc-200">
                                <span className="text-violet-400">⏺ </span>
                                {line.text}
                            </span>
                        )
                    if (line.type === "muted")
                        return (
                            <span key={index} className="block text-zinc-500 italic">
                                {line.text}
                            </span>
                        )
                    return (
                        <span key={index} className="block text-zinc-400">
                            {line.text}
                        </span>
                    )
                })}
            </pre>
        </div>
    )
}
