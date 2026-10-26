import { notFound } from "next/navigation"

import { application } from "@/lib/application"

export default function DiaryLayout({ children }: { children: React.ReactNode }) {
    if (!application.diaryEnabled) notFound()
    return children
}
