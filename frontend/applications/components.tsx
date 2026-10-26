"use client"

import { DiaryHeaderMessage, DiarySettingsSection } from "@/applications/diary-coach/components"
import { application } from "@/lib/application"

/** 공통 셸이 서비스별 컴포넌트 대신 참조하는 조립 지점. */
export function ApplicationHeaderContent() {
    return application.diaryEnabled ? <DiaryHeaderMessage /> : <div />
}

export function ApplicationSettingsSection() {
    return application.diaryEnabled ? <DiarySettingsSection /> : null
}
