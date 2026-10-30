"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react"

import type { LlmProviderKey, LlmProviderName, LlmRoute, PlanName } from "@/lib/api"
import { FormStatus, useFormAction } from "@/components/settings/form-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PLANS, planLabel, providerLabel } from "@/lib/llm-labels"
import { routesOf, useAdminStore } from "@/store/admin"
import { useAuthStore } from "@/store/auth"

/** 공급자 순서와 예시 모델. 서버는 provider 값만 안다. */
const PROVIDERS: { provider: LlmProviderName; vendor: string; examples: string }[] = [
    { provider: "openai", vendor: "OpenAI", examples: "gpt-4o-mini, gpt-4o, gpt-4.1" },
    { provider: "anthropic", vendor: "Anthropic", examples: "claude-sonnet-4-5, claude-haiku-4-5" },
    { provider: "google_genai", vendor: "Google", examples: "gemini-2.5-flash, gemini-2.5-pro" },
]

const PLAN_HINTS: Record<PlanName, string> = {
    free: "기본 요금제. 라우트가 없으면 서버의 .env 설정(LLM_PROVIDER, LLM_MODEL)을 씁니다.",
    pro: "라우트가 없으면 free 요금제의 라우트를 그대로 씁니다.",
    max: "라우트가 없으면 free 요금제의 라우트를 그대로 씁니다.",
}

/** 관리자용 LLM 설정: 공급자 API 키와 요금제별 라우팅(ADMIN-01·03). */
export function ServerSettings() {
    const user = useAuthStore((state) => state.user)
    const providers = useAdminStore((state) => state.providers)
    const routes = useAdminStore((state) => state.routes)
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
                    <CardDescription>요금제별로 채팅·일기 생성이 어떤 공급자를 어떤 순서로 쓰는지입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    {error ? (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    ) : isLoading && providers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">불러오는 중…</p>
                    ) : (
                        <dl className="grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-2 text-sm leading-6">
                            {PLANS.map((plan) => (
                                <PlanSummaryRow key={plan} plan={plan} routes={routes} />
                            ))}
                        </dl>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>공급자 API 키</CardTitle>
                    <CardDescription>
                        키는 암호화해 저장하고 화면에 다시 보여주지 않습니다. 키가 없는 공급자는 어떤 요금제에서도 쓰이지 않습니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                    {PROVIDERS.map((info) => (
                        <ProviderKeyForm key={info.provider} info={info} row={providers.find((row) => row.provider === info.provider)} />
                    ))}
                </CardContent>
            </Card>

            <PlanRoutesCard routes={routes} providers={providers} />
        </>
    )
}

/** 한 요금제의 실제 호출 순서를 문장으로. 서버의 active_provider_chain()과 같은 규칙이다. */
export function describePlan(plan: PlanName, routes: LlmRoute[]) {
    const usable = (p: PlanName) => routesOf(routes, p).filter((route) => route.enabled && route.has_api_key)
    let active = usable(plan)
    let prefix = ""
    if (active.length === 0 && plan !== "free") {
        active = usable("free")
        prefix = "(free 라우트를 따름) "
    }
    const forced = active.find((route) => route.forced)
    if (forced) return `${prefix}강제 사용: ${providerLabel(forced.provider)} (${forced.model}). 우선순위와 자동 전환은 무시합니다.`
    if (active.length === 0) return "쓸 수 있는 라우트가 없어 서버의 .env 설정(LLM_PROVIDER, LLM_MODEL)을 그대로 씁니다."
    const order = active.map((route, index) => `${index + 1}. ${providerLabel(route.provider)} (${route.model})`).join(" → ")
    return `${prefix}우선순위 ${order}. 앞 공급자가 실패하면 다음으로 자동 전환합니다.`
}

function PlanSummaryRow({ plan, routes }: { plan: PlanName; routes: LlmRoute[] }) {
    return (
        <>
            <dt className="font-medium">{planLabel(plan)}</dt>
            <dd data-slot={`llm-plan-${plan}`} className="min-w-0 wrap-anywhere text-muted-foreground">
                {describePlan(plan, routes)}
            </dd>
        </>
    )
}

function ProviderKeyForm({ info, row }: { info: (typeof PROVIDERS)[number]; row?: LlmProviderKey }) {
    const saveKey = useAdminStore((state) => state.saveKey)
    const [apiKey, setApiKey] = useState("")
    const { result, isPending, run } = useFormAction()
    const label = providerLabel(info.provider)
    const hasKey = row?.has_api_key === true
    const id = `admin-key-${info.provider}`

    return (
        <form
            aria-label={`${label} 키`}
            className="flex flex-col gap-2"
            onSubmit={(event) => {
                event.preventDefault()
                if (!apiKey.trim()) return
                void run(async () => {
                    await saveKey(info.provider, apiKey.trim())
                    setApiKey("")
                    return "키를 저장했습니다."
                }, "키를 저장하지 못했습니다.")
            }}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={id} className="font-semibold">
                    {label}
                </Label>
                <span className="text-xs text-muted-foreground">{info.vendor}</span>
                <Badge tone={hasKey ? "ok" : "muted"}>{hasKey ? "키 있음" : "키 없음"}</Badge>
            </div>
            <div className="flex gap-2">
                <Input
                    id={id}
                    type="password"
                    autoComplete="off"
                    className="min-w-0 flex-1"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={hasKey ? "저장된 키가 있습니다. 바꾸려면 새 키를 입력" : "새 키를 입력"}
                />
                <Button type="submit" disabled={isPending || !apiKey.trim()}>
                    저장
                </Button>
                {hasKey && (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        onClick={() =>
                            void run(async () => {
                                await saveKey(info.provider, "")
                                return "키를 지웠습니다."
                            }, "키를 지우지 못했습니다.")
                        }
                    >
                        키 지우기
                    </Button>
                )}
            </div>
            <FormStatus result={result} />
        </form>
    )
}

function PlanRoutesCard({ routes, providers }: { routes: LlmRoute[]; providers: LlmProviderKey[] }) {
    const [plan, setPlan] = useState<PlanName>("free")
    const planRoutes = routesOf(routes, plan)

    return (
        <Card>
            <CardHeader>
                <CardTitle>요금제별 라우팅</CardTitle>
                <CardDescription>
                    요금제마다 어느 공급자의 어떤 모델을 어떤 순서로 쓸지 정합니다. 위에서부터 시도하고, 실패하면 다음으로 넘어갑니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div role="tablist" aria-label="요금제" className="flex gap-1 rounded-lg bg-muted p-1">
                    {PLANS.map((candidate) => (
                        <button
                            key={candidate}
                            type="button"
                            role="tab"
                            aria-selected={plan === candidate}
                            onClick={() => setPlan(candidate)}
                            className={`min-h-9 flex-1 rounded-md px-3 text-sm font-medium transition-colors ${plan === candidate ? "bg-background shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            {planLabel(candidate)}
                            <span className="ml-1 text-xs text-muted-foreground">{routesOf(routes, candidate).length}</span>
                        </button>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">{PLAN_HINTS[plan]}</p>

                {planRoutes.length === 0 ? (
                    <p data-slot="routes-empty" className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                        {planLabel(plan)} 요금제에 라우트가 없습니다.
                    </p>
                ) : (
                    <ol aria-label={`${planLabel(plan)} 라우트`} className="flex flex-col gap-3">
                        {planRoutes.map((route, index) => (
                            <RouteRow key={route.id} route={route} index={index} count={planRoutes.length} />
                        ))}
                    </ol>
                )}

                <AddRouteForm plan={plan} providers={providers} />
            </CardContent>
        </Card>
    )
}

function RouteRow({ route, index, count }: { route: LlmRoute; index: number; count: number }) {
    const updateRoute = useAdminStore((state) => state.updateRoute)
    const removeRoute = useAdminStore((state) => state.removeRoute)
    const moveRoute = useAdminStore((state) => state.moveRoute)
    const [model, setModel] = useState(route.model)
    const { result, isPending, run } = useFormAction()
    const name = `${planLabel(route.plan)} ${index + 1}번 라우트`
    const modelId = `route-model-${route.id}`

    function act(action: () => Promise<unknown>, message: string, fallback: string) {
        void run(async () => {
            await action()
            return message
        }, fallback)
    }

    return (
        <li className="rounded-lg border p-3">
            <form
                aria-label={name}
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                    event.preventDefault()
                    if (!model.trim()) return
                    act(() => updateRoute(route.id, { model: model.trim() }), "모델을 저장했습니다.", "저장하지 못했습니다.")
                }}
            >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">
                        {index + 1}. {providerLabel(route.provider)}
                    </span>
                    <Badge tone={route.enabled ? "ok" : "muted"}>{route.enabled ? "사용 중" : "꺼짐"}</Badge>
                    {route.forced && <Badge tone="warn">강제 사용 중</Badge>}
                    {!route.has_api_key && <Badge tone="warn">키 없음 · 쓰이지 않음</Badge>}
                    <span className="ml-auto flex gap-1">
                        <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`${name} 위로`}
                            disabled={isPending || index === 0}
                            onClick={() => act(() => moveRoute(route.id, -1), "순서를 바꿨습니다.", "순서를 바꾸지 못했습니다.")}
                        >
                            <ArrowUp />
                        </Button>
                        <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`${name} 아래로`}
                            disabled={isPending || index === count - 1}
                            onClick={() => act(() => moveRoute(route.id, 1), "순서를 바꿨습니다.", "순서를 바꾸지 못했습니다.")}
                        >
                            <ArrowDown />
                        </Button>
                        <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`${name} 삭제`}
                            disabled={isPending}
                            onClick={() => act(() => removeRoute(route.id), "라우트를 지웠습니다.", "지우지 못했습니다.")}
                        >
                            <Trash2 />
                        </Button>
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor={modelId}>모델</Label>
                    <div className="flex gap-2">
                        <Input
                            id={modelId}
                            className="min-w-0 flex-1"
                            value={model}
                            onChange={(event) => setModel(event.target.value)}
                            maxLength={100}
                            required
                        />
                        <Button type="submit" variant="outline" disabled={isPending || model.trim() === route.model}>
                            저장
                        </Button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                            act(
                                () => updateRoute(route.id, { enabled: !route.enabled }),
                                route.enabled ? "이 라우트를 껐습니다." : "이 라우트를 켰습니다.",
                                "바꾸지 못했습니다."
                            )
                        }
                    >
                        {route.enabled ? "사용 끄기" : "사용 켜기"}
                    </Button>
                    <Button
                        type="button"
                        variant={route.forced ? "secondary" : "outline"}
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                            act(
                                () => updateRoute(route.id, { forced: !route.forced }),
                                route.forced ? "강제 사용을 해제했습니다." : "이 라우트만 강제로 씁니다.",
                                "바꾸지 못했습니다."
                            )
                        }
                    >
                        {route.forced ? "강제 해제" : "강제 사용"}
                    </Button>
                </div>
                <FormStatus result={result} />
            </form>
        </li>
    )
}

function AddRouteForm({ plan, providers }: { plan: PlanName; providers: LlmProviderKey[] }) {
    const addRoute = useAdminStore((state) => state.addRoute)
    const [provider, setProvider] = useState<LlmProviderName>("openai")
    const [model, setModel] = useState("")
    const { result, isPending, run } = useFormAction()
    const example = PROVIDERS.find((info) => info.provider === provider)?.examples ?? ""
    const hasKey = providers.find((row) => row.provider === provider)?.has_api_key

    return (
        <form
            aria-label={`${planLabel(plan)} 라우트 추가`}
            className="flex flex-col gap-2 rounded-lg border border-dashed p-3"
            onSubmit={(event) => {
                event.preventDefault()
                if (!model.trim()) return
                void run(async () => {
                    await addRoute(plan, provider, model.trim())
                    setModel("")
                    return "라우트를 추가했습니다."
                }, "추가하지 못했습니다.")
            }}
        >
            <p className="text-sm font-medium">라우트 추가</p>
            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={`route-add-provider-${plan}`}>공급자</Label>
                    <select
                        id={`route-add-provider-${plan}`}
                        value={provider}
                        onChange={(event) => setProvider(event.target.value as LlmProviderName)}
                        className="h-9 rounded-md border border-input bg-transparent px-3 text-base shadow-xs md:text-sm"
                    >
                        {PROVIDERS.map((info) => (
                            <option key={info.provider} value={info.provider}>
                                {providerLabel(info.provider)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Label htmlFor={`route-add-model-${plan}`}>모델</Label>
                    <Input
                        id={`route-add-model-${plan}`}
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        placeholder={example}
                        maxLength={100}
                    />
                </div>
                <div className="flex items-end">
                    <Button type="submit" disabled={isPending || !model.trim()}>
                        라우트 추가
                    </Button>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                예: {example}. {hasKey === false && `${providerLabel(provider)} 키가 없어 추가해도 쓰이지 않습니다.`}
            </p>
            <FormStatus result={result} />
        </form>
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
