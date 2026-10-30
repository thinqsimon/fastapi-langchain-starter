import { ApplicationSettingsSection } from "@/applications/components"
import { EmailForm, PasswordForm, ProfileForm } from "@/components/settings/account-forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
    return (
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] *:shrink-0 sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <h1 className="text-xl font-semibold">설정</h1>

            <Card>
                <CardHeader>
                    <CardTitle>계정 정보</CardTitle>
                    <CardDescription>이름, 이메일, 비밀번호를 바꿉니다.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    <ProfileForm />
                    <EmailForm />
                    <PasswordForm />
                </CardContent>
            </Card>

            <ApplicationSettingsSection />
        </div>
    )
}
