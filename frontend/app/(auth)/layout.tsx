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
                {/* 처음 온 사람이 가입 전에 사용 흐름을 영상으로 본다. 새 탭으로 열고, 유튜브 앱이 있는 폰에서는 앱이 열린다. */}
                {application.demoVideoUrl && (
                    <a
                        href={application.demoVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "outline" }), "min-h-10 rounded-xl px-4")}
                    >
                        <SquarePlay className="size-4 text-red-600" />
                        사용법 시연
                    </a>
                )}
            </div>
            {children}
        </main>
    )
}
