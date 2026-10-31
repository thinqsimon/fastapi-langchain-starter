// 백엔드 스키마(backend/src/app/domain/auth/schemas.py)와 짝을 이룬다.
// FE-02에서 OpenAPI 자동 생성으로 대체할 예정.

export type User = {
    id: string
    email: string
    display_name: string
    is_active: boolean
    /** 서버 설정(.env ADMIN_EMAILS)에 적힌 관리자인지. "관리자" 메뉴를 보여줄지 정한다. */
    is_admin: boolean
    /** 요금제(free/pro/max). 서버가 이 값으로 LLM 공급자·모델을 고른다(ADMIN-03). */
    plan: PlanName
    /** 유료 요금제 만료 시각(쿠폰으로 생긴 기한). null이면 기한 없음. */
    plan_expires_at: string | null
    /** 답변 수준 1~5. null이면 아직 고르지 않았다(서버는 2단계로 답한다). */
    answer_level: number | null
    created_at: string
}

/** 답변 수준 한 단계. 이름은 관리자가 바꿀 수 있고, 대상·방식·예시는 서버가 정한다. */
export type AnswerLevelInfo = {
    level: number
    name: string
    default_name: string
    audience: string
    style: string
    example: string
}

export type PlanName = "free" | "pro" | "max"

/** 서버가 langchain에 넘기는 공급자 이름. 화면 표시명은 lib/llm-labels.ts에서 붙인다. */
export type LlmProviderName = "openai" | "anthropic" | "google_genai"

/** 공급자 API 키 상태. 키 원문은 절대 내려오지 않는다. */
export type LlmProviderKey = {
    provider: LlmProviderName
    has_api_key: boolean
    updated_at: string
}

/** 요금제별 라우트 한 줄: 이 요금제에서 이 공급자의 이 모델을 priority 순서로 쓴다. */
export type LlmRoute = {
    id: string
    plan: PlanName
    priority: number
    provider: LlmProviderName
    model: string
    enabled: boolean
    forced: boolean
    /** 공급자 키가 없으면 켜 두어도 쓰이지 않는다. */
    has_api_key: boolean
}

export type LlmRoutePatch = Partial<{
    model: string
    priority: number
    enabled: boolean
    forced: boolean
}>

/** 관리자 사용자 검색 결과 한 명. */
export type AdminUser = {
    id: string
    email: string
    display_name: string
    is_active: boolean
    plan: PlanName
    plan_expires_at: string | null
    created_at: string
}

// 요금제 쿠폰(backend/src/app/domain/coupon/schemas.py)
export type CouponPlan = "pro" | "max"
export type CouponDuration = "7d" | "15d" | "1m" | "3m" | "6m" | "12m"
export type CouponStatus = "active" | "redeemed" | "expired" | "revoked"
export type CouponValidDays = 7 | 14 | 30 | 90

export type Coupon = {
    id: string
    /** XXXX-XXXX-XXXX */
    code: string
    plan: CouponPlan
    duration: CouponDuration
    duration_label: string
    /** 이 시각까지 등록해야 한다. */
    expires_at: string
    memo: string | null
    batch_id: string
    status: CouponStatus
    created_at: string
    redeemed_at: string | null
    redeemed_by_email: string | null
    plan_until: string | null
    revoked_at: string | null
}

export type CouponCreate = {
    plan: CouponPlan
    duration: CouponDuration
    valid_days: CouponValidDays
    quantity: number
    memo?: string
}

export type CouponRedeemResult = {
    plan: PlanName
    plan_expires_at: string
    message: string
}

/** "이 계정으로 테스트" 토큰. 리프레시 토큰은 없다. */
export type ActingToken = {
    access_token: string
    token_type: string
    expires_in: number
    user: AdminUser
}

export type TokenPair = {
    access_token: string
    refresh_token: string
    token_type: string
}

export type ApiErrorBody = {
    error: {
        code: string
        message: string
        details?: { field: string; message: string }[]
    }
}

export type Conversation = {
    id: string
    title: string
    created_at: string
    updated_at: string
}

export type Message = {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    created_at: string
    /** 답한 공급자·모델. 사용자 메시지와 예전 답변은 null. */
    provider: string | null
    model: string | null
}

export type ConversationDetail = Conversation & { messages: Message[] }

export type DiaryEntry = {
    id: string
    conversation_id: string | null
    entry_date: string
    /** 그날 몇 번째 일기인지(1부터) */
    day_sequence: number
    title: string
    learned: string
    /** 주제별 '### 소제목' 마크다운 */
    learned_detail: string
    difficult: string
    /** 비어 있으면 null — 항목 없이 저장된 것 */
    next_plan: string | null
    /** 저장할 때의 푸터. 나중에 설정을 바꿔도 그대로다. 없으면 null */
    footer: string | null
    created_at: string
    updated_at: string
}

/** 일기 입력칸. 새로 쓰기와 수정이 함께 쓴다. */
export type DiaryForm = {
    title: string
    learned: string
    learned_detail: string
    difficult: string
    next_plan: string
}

/** 채팅으로 만든 초안. 출처 정보는 저장할 때 그대로 돌려보낸다. */
export type DiaryDraft = DiaryForm & {
    conversation_id: string
    source_last_message_at: string
    entry_date: string
}

export type DiaryEntryCreate = DiaryForm & {
    entry_date?: string
    conversation_id?: string
    source_last_message_at?: string
}

/** 일기로 만들 수 있는 채팅(마지막 일기 이후 새 대화가 있는 것만) */
export type EligibleConversation = {
    id: string
    title: string
    last_message_at: string
    /** 이 채팅으로 이미 쓴 일기 수 */
    diary_count: number
}

export type Preferences = {
    catchphrase: string
    diary_footer: string
}

export type WeeklyReview = {
    week_start: string
    week_end: string
    entry_count: number
    grown: string
    repeated_difficulty: string
    suggestion: string
}

export type SavedWeeklyReview = WeeklyReview & { id: string; created_at: string }

export type StudyItem = {
    entry_id: string
    title: string
    entry_date: string
    difficult: string
    learned: string
    learned_detail: string
    completed: boolean
    note: string
    reviewed_at: string | null
}

export type ModelUsage = {
    provider: string | null
    model: string
    message_count: number
    input_tokens: number
    output_tokens: number
    estimated_cost_usd: string
}

export type UsageSummary = {
    /** 가장 많이 쓴 모델. 자세한 내역은 by_model. */
    model: string
    message_count: number
    input_tokens: number
    output_tokens: number
    total_tokens: number
    estimated_cost_usd: string
    by_model: ModelUsage[]
}

// 학습장(backend/src/app/domain/notebook/schemas.py)

/** 학습장 안의 주제 요약(목록용, 본문 없음). 백엔드 TopicSummary */
export type NotebookTopicSummary = {
    id: string
    notebook_id: string
    /** 학습장 안에서의 순서(1부터) */
    position: number
    title: string
    /** 개념·문제해결·도구·명령어·설계결정·워크플로 등. 없으면 null */
    kind: string | null
    tags: string[]
    /** ★ 개수(1~5). 없으면 null */
    difficulty: number | null
    completed: boolean
    /** 보관함(나중에 공부할 주제)에 넣었는지 */
    kept: boolean
    /** 보관한 시각. 보관하지 않았으면 null */
    kept_at: string | null
    updated_at: string
}

/** 주제 상세(본문 포함). 백엔드 TopicRead */
export type NotebookTopic = NotebookTopicSummary & { content: string; created_at: string }

/** 학습장. 올린 md 파일 하나 또는 직접 만든 것(filename null). 백엔드 NotebookRead */
export type Notebook = {
    id: string
    title: string
    filename: string | null
    project: string | null
    /** H1 뒤의 '>' 요약 */
    summary: string | null
    topics: NotebookTopicSummary[]
    created_at: string
    updated_at: string
}

/** 주제 만들기 입력. 백엔드 TopicCreate */
export type NotebookTopicInput = {
    title: string
    content?: string
    kind?: string | null
    tags?: string[]
    difficulty?: number | null
}

/** 주제 수정 입력(보낸 필드만 바뀐다). 백엔드 TopicUpdate */
export type NotebookTopicPatch = Partial<NotebookTopicInput> & { completed?: boolean; kept?: boolean }
