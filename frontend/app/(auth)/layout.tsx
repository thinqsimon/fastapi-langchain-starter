import { BrandLockup } from "@/components/brand-logo"

export default function AuthLayout({ children }: LayoutProps<"/">) {
    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
            <BrandLockup />
            {children}
        </main>
    )
}
