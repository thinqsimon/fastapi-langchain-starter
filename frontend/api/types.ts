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
    entry_date: string
    learned: string
    difficult: string
    next_plan: string
    created_at: string
    updated_at: string
}

export type DiaryDraft = Pick<DiaryEntry, "learned" | "difficult" | "next_plan">

export type WeeklyReview = {
    week_start: string
    week_end: string
    entry_count: number
    grown: string
    repeated_difficulty: string
    suggestion: string
}
