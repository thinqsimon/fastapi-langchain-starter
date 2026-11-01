"use client"

import { DiaryHeaderMessage, DiarySettingsSection } from "@/applications/diary-coach/components"
import { CloudAvatar, CoachChatHeader, CoachComposerMenu, CoachConversationMenuItems, CoachWelcome } from "@/applications/diary-coach/chat-experience"
import type { ConversationMenuExtra } from "@/components/chat/conversation-sidebar"
import type { AssistantPresentation } from "@/components/chat/message-list"
import type { Conversation } from "@/lib/api"
import { application } from "@/lib/application"

/** 공통 셸이 서비스별 컴포넌트 대신 참조하는 조립 지점. */
export function ApplicationHeaderContent() {
    return application.diaryEnabled ? <DiaryHeaderMessage /> : <div />
}

export function ApplicationSettingsSection() {
    return application.diaryEnabled ? <DiarySettingsSection /> : null
}

export function ApplicationChatHeader() {
    return application.diaryEnabled ? <CoachChatHeader /> : null
}

/** 메시지 입력칸 왼쪽의 + 메뉴. 스타터에는 부가 기능이 없어 아무것도 그리지 않는다. */
export function ApplicationComposerMenu() {
    return application.diaryEnabled ? <CoachComposerMenu /> : null
}

/** 대화 목록 '…' 메뉴 맨 위에 더하는 항목. 스타터에는 없다. */
export function applicationConversationMenuExtra(): ConversationMenuExtra | undefined {
    return application.diaryEnabled ? coachConversationMenuExtra : undefined
}

function coachConversationMenuExtra(conversation: Conversation, closeDrawer: () => void) {
    return <CoachConversationMenuItems conversation={conversation} onStart={closeDrawer} />
}

export function applicationChatPresentation(): { emptyState?: React.ReactNode; assistant?: AssistantPresentation } {
    return application.diaryEnabled ? { emptyState: <CoachWelcome />, assistant: { name: "구름 코치", avatar: <CloudAvatar /> } } : {}
}
