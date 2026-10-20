// 백엔드 스키마(backend/src/app/domain/auth/schemas.py)와 짝을 이룬다.
// FE-02에서 OpenAPI 자동 생성으로 대체할 예정.

export type User = {
    id: string
    email: string
    display_name: string
    is_active: boolean
    created_at: string
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

export type UsageSummary = {
    model: string
    message_count: number
    input_tokens: number
    output_tokens: number
    total_tokens: number
    estimated_cost_usd: string
}
