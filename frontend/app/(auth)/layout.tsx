import { cn } from "cn"
import { SquarePlay } from "lucide-react"

import { BrandLockup } from "@/components/brand-logo"
import { buttonVariants } from "@/components/ui/button"
import { application } from "@/lib/application"

export default function AuthLayout({ children }: LayoutProps<"/">) {
    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
            <div className="flex flex-col items-center gap-5">
                <BrandLockup />
                {/* 처음 온 사람이 가입 전에 사용 흐름을 영상으로 본다. 화면 폭에 맞는 영상 버튼 하나만 보인다:
                    좁은 화면(768px 미만, 채팅 목록이 서랍으로 바뀌는 기준)은 폰 화면판, 넓은 화면은 PC 화면판. */}
                {application.demoVideos && (
                    <>
                        <DemoVideoLink href={application.demoVideos.phone} className="md:hidden" />
                        <DemoVideoLink href={application.demoVideos.desktop} className="hidden md:inline-flex" />
                    </>
                )}
            </div>
            {children}
        </main>
    )
}

/** 새 탭으로 연다. 유튜브 앱이 있는 폰에서는 앱이 열린다. */
function DemoVideoLink({ href, className }: { href: string; className: string }) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "min-h-10 rounded-xl px-4", className)}>
            <SquarePlay className="size-4 text-red-600" />
            사용법 시연
        </a>
    )
}
