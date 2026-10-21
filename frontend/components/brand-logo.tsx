import { cn } from "cn"

/** 서비스 이름. 화면·탭·홈 화면 아이콘 이름이 모두 이 값을 쓴다. */
export const APP_NAME = "배움일기 코치"

/**
 * 로고(A안 · 열정 노트: 펼친 노트 위로 피어오르는 불꽃).
 * 원본은 public/brand/logo.svg 하나다. 32px 이하는 세부를 뺀 작은 크기용(스크립트가 생성)을 쓴다.
 * 아이콘 파일(파비콘·홈 화면)은 `npm run icons`로 같은 원본에서 다시 만든다.
 */
export function LogoMark({ size = 28, className, decorative = false }: { size?: number; className?: string; decorative?: boolean }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element -- 작은 SVG라 next/image 최적화가 필요 없다
        <img
            src={size <= 32 ? "/brand/logo-small.svg" : "/brand/logo.svg"}
            width={size}
            height={size}
            alt={decorative ? "" : `${APP_NAME} 로고`}
            className={cn("shrink-0", className)}
        />
    )
}

/** 로고 + 서비스 이름. 로그인·가입 화면 위쪽에 쓴다. */
export function BrandLockup() {
    return (
        <div className="flex flex-col items-center gap-3 text-center">
            <LogoMark size={64} decorative />
            <div className="flex flex-col gap-1">
                <p className="text-2xl font-black tracking-tight">
                    배움일기 <span className="text-[#2563EB]">코치</span>
                </p>
                <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">LEARNING DIARY COACH</p>
            </div>
        </div>
    )
}
