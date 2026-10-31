import type { Metadata } from "next"

import { ByLevelSection, OverviewSection, StartSection } from "@/components/guide/sections-basics"
import { AnswerLevelSection, ChatSection, DiarySection, NotebookSection, ReviewSection } from "@/components/guide/sections-features"
import { FaqSection, MobileSection, SettingsSection } from "@/components/guide/sections-more"
import { SkillSection } from "@/components/guide/sections-skill"
import { GuideToc } from "@/components/guide/toc"
import { application } from "@/lib/application"

export const metadata: Metadata = { title: `사용 안내 · ${application.name}` }

/**
 * 사용 안내(일반 사용자용). 계정 메뉴의 '사용 안내'로 연다. `/guide#notebook`처럼 단원 id를 붙이면 그 단원부터 보인다.
 * 내용은 components/guide/sections-*.tsx, 스크린샷은 public/guide/ 에 있다.
 */
export default function GuidePage() {
    return (
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-y-auto p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:p-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-10">
            <GuideToc />
            <article className="flex min-w-0 flex-col gap-10">
                <header className="flex flex-col gap-2">
                    <h1 className="text-3xl font-semibold tracking-tight">사용 안내</h1>
                    <p className="text-sm leading-7 text-muted-foreground">
                        {application.name}의 모든 기능을 화면과 함께 설명합니다. 처음이라면 ‘시작하기’와 ‘숙련도별 사용법’부터, AI 코딩 도구를 쓴다면
                        ‘/study-notes 스킬’ 단원을 보세요.
                    </p>
                </header>
                <OverviewSection demoVideos={application.demoVideos} />
                <StartSection />
                <ByLevelSection />
                <ChatSection />
                <AnswerLevelSection />
                <DiarySection />
                <ReviewSection />
                <NotebookSection />
                <SkillSection />
                <SettingsSection />
                <MobileSection />
                <FaqSection />
            </article>
        </div>
    )
}
