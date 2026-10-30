"use client"

import { useEffect, useState } from "react"

import type { LlmProviderName, LlmProviderPatch, LlmProviderSetting } from "@/api"
import { FormStatus, useFormAction } from "@/components/settings/form-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAdminStore } from "@/store/admin"
import { useAuthStore } from "@/store/auth"

/** 화면에 보여줄 이름과 예시 모델. 서버는 provider 값만 안다. */
const PROVIDER_INFO: Record<LlmProviderName, { label: string; vendor: string; examples: string }> = {
    openai: { label: "OpenAI", vendor: "OpenAI", examples: "gpt-4o-mini, gpt-4o, gpt-4.1-mini" },
    anthropic: { label: "Claude", vendor: "Anthropic", examples: "claude-sonnet-4-5, claude-haiku-4-5" },
    google_genai: { label: "Gemini", vendor: "Google", examples: "gemini-2.5-flash, gemini-2.5-pro" },
}

export function providerLabel(provider: LlmProviderName) {
    return PROVIDER_INFO[provider].label
}

/** 관리자용 서버 설정 화면. OpenAI/Claude/Gemini 키·모델·우선순위·강제 사용을 관리한다. */
export function ServerSettings() {
    const user = useAuthStore((state) => state.user)
    const providers = useAdminStore((state) => state.providers)
    const isLoading = useAdminStore((state) => state.isLoading)
    const error = useAdminStore((state) => state.error)
    const load = useAdminStore((state) => state.load)
    const isAdmin = user?.is_admin === true

    useEffect(() => {
        if (isAdmin) void load()
    }, [isAdmin, load])

    if (!isAdmin) {
        return (
            <Card>
                <CardContent>
                    <p role="alert" className="text-sm text-destructive">
                        관리자만 볼 수 있는 화면입니다.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>지금 동작</CardTitle>
                    <CardDescription>채팅과 일기 생성이 어떤 공급자를 어떤 순서로 쓰는지입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    {error ? (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    ) : (
                        <p data-slot="llm-plan" className="text-sm leading-6">
                            {isLoading && providers.length === 0 ? "불러오는 중…" : describePlan(providers)}
                        </p>
                    )}
                </CardContent>
            </Card>

            {providers.map((row) => (
                <ProviderCard key={row.provider} row={row} />
            ))}
        </>
    )
}

/** 실제 호출 순서를 사람이 읽을 문장으로. 서버의 active_provider_chain()과 같은 규칙이다. */
export function describePlan(providers: LlmProviderSetting[]) {
    const active = providers.filter((row) => row.enabled && row.has_api_key)
    const forced = active.find((row) => row.forced)
    if (forced) {
        return `강제 사용: ${providerLabel(forced.provider)} (${forced.model}). 우선순위와 자동 전환은 무시하고 이 공급자만 씁니다.`
    }
    if (active.length === 0) {
        return "키가 있고 켜진 공급자가 없어 서버의 .env 설정(LLM_PROVIDER, LLM_MODEL)을 그대로 씁니다."
    }
    const order = [...active]
        .sort((a, b) => a.priority - b.priority)
        .map((row, index) => `${index + 1}. ${providerLabel(row.provider)} (${row.model})`)
        .join(" → ")
    return `우선순위 ${order}. 앞 공급자가 한도 초과 등으로 실패하면 다음 공급자로 자동 전환합니다.`
}

function ProviderCard({ row }: { row: LlmProviderSetting }) {
    const save = useAdminStore((state) => state.save)
    const info = PROVIDER_INFO[row.provider]
    const [model, setModel] = useState(row.model)
    const [apiKey, setApiKey] = useState("")
    const [priority, setPriority] = useState(String(row.priority))
    const { result, isPending, run } = useFormAction()
    const ids = { model: `admin-${row.provider}-model`, key: `admin-${row.provider}-key`, priority: `admin-${row.provider}-priority` }

    function patch(input: LlmProviderPatch, message: string, fallback: string) {
        void run(async () => {
            await save(row.provider, input)
            return message
        }, fallback)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                    {info.label}
                    <span className="text-sm font-normal text-muted-foreground">{info.vendor}</span>
                    <Badge tone={row.has_api_key ? "ok" : "muted"}>{row.has_api_key ? "키 있음" : "키 없음"}</Badge>
                    <Badge tone={row.enabled ? "ok" : "muted"}>{row.enabled ? "사용 중" : "꺼짐"}</Badge>
                    {row.forced && <Badge tone="warn">강제 사용 중</Badge>}
                </CardTitle>
                <CardDescription>우선순위 {row.priority}번. 키가 있고 켜져 있어야 실제로 쓰입니다.</CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    aria-label={`${info.label} 설정`}
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        const input: LlmProviderPatch = { model: model.trim(), priority: Number(priority) }
                        // 키 칸을 비워 두면 저장된 키를 그대로 둔다(화면이 키 원문을 다시 받지 않으므로).
                        if (apiKey.trim()) input.api_key = apiKey.trim()
                        void run(async () => {
                            await save(row.provider, input)
                            setApiKey("")
                            return "저장했습니다."
                        }, "저장하지 못했습니다.")
                    }}
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={ids.model}>모델</Label>
                        <Input id={ids.model} value={model} onChange={(event) => setModel(event.target.value)} maxLength={100} required />
                        <p className="text-xs text-muted-foreground">예: {info.examples}. 공급자 문서의 모델 ID를 그대로 적습니다.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor={ids.key}>API 키</Label>
                        <div className="flex gap-2">
                            <Input
                                id={ids.key}
                                type="password"
                                autoComplete="off"
                                className="min-w-0 flex-1"
                                value={apiKey}
                                onChange={(event) => setApiKey(event.target.value)}
                                placeholder={row.has_api_key ? "저장된 키가 있습니다. 바꾸려면 새 키를 입력" : "새 키를 입력"}
                            />
                            {row.has_api_key && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isPending}
                                    onClick={() => patch({ api_key: "" }, "키를 지웠습니다.", "키를 지우지 못했습니다.")}
                                >
                                    키 지우기
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">키는 암호화해 저장하고 화면에 다시 보여주지 않습니다.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor={ids.priority}>우선순위</Label>
                        <select
                            id={ids.priority}
                            value={priority}
                            onChange={(event) => setPriority(event.target.value)}
                            className="h-9 w-32 rounded-md border border-input bg-transparent px-3 text-base shadow-xs md:text-sm"
                        >
                            {[1, 2, 3].map((value) => (
                                <option key={value} value={value}>
                                    {value}번째
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground">작은 번호부터 시도합니다. 강제 사용이 켜진 공급자가 있으면 순위는 무시됩니다.</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "저장 중…" : "저장"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() =>
                                patch({ enabled: !row.enabled }, row.enabled ? "이 공급자를 껐습니다." : "이 공급자를 켰습니다.", "바꾸지 못했습니다.")
                            }
                        >
                            {row.enabled ? "사용 끄기" : "사용 켜기"}
                        </Button>
                        <Button
                            type="button"
                            variant={row.forced ? "secondary" : "outline"}
                            disabled={isPending}
                            onClick={() =>
                                patch(
                                    { forced: !row.forced },
                                    row.forced ? "강제 사용을 해제했습니다." : `${info.label}만 강제로 씁니다.`,
                                    "바꾸지 못했습니다."
                                )
                            }
                        >
                            {row.forced ? "강제 해제" : "강제 사용"}
                        </Button>
                    </div>
                    <FormStatus result={result} />
                </form>
            </CardContent>
        </Card>
    )
}

function Badge({ tone, children }: { tone: "ok" | "muted" | "warn"; children: React.ReactNode }) {
    const color = tone === "ok" ? "bg-emerald-100 text-emerald-800" : tone === "warn" ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground"
    return (
        <span data-slot="provider-badge" className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
            {children}
        </span>
    )
}
