import { notFound } from "next/navigation"

import { application } from "@/lib/application"

/** 학습장은 일기와 같은 게이팅을 따른다(diary-coach 프로필 전용). */
export default function NotebookLayout({ children }: { children: React.ReactNode }) {
    if (!application.diaryEnabled) notFound()
    return children
}
