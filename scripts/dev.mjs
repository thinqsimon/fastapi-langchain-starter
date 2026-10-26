#!/usr/bin/env node
// 두 서버에 같은 프로필을 전달한다. .env나 비밀값을 읽거나 출력하지 않는다.
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const [profile, target, ...extra] = process.argv.slice(2)
if (!["starter", "diary-coach"].includes(profile) || !["backend", "frontend"].includes(target)) {
    console.error("사용법: node scripts/dev.mjs <starter|diary-coach> <backend|frontend> [서버 옵션]")
    process.exit(1)
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const frontend = target === "frontend"
const child = spawn(
    frontend ? process.execPath : "uv",
    frontend
        ? [path.join(root, "frontend/node_modules/next/dist/bin/next"), "dev", ...extra]
        : ["run", "uvicorn", "app.main:app", "--reload", ...extra],
    {
        cwd: path.join(root, target),
        env: { ...process.env, APP_PROFILE: profile, NEXT_PUBLIC_APP_PROFILE: profile },
        stdio: "inherit",
        windowsHide: true,
    }
)
child.on("error", (error) => {
    console.error(error.message)
    process.exitCode = 1
})
child.on("exit", (code) => {
    process.exitCode = code ?? 1
})
process.on("SIGINT", () => child.kill("SIGINT"))
process.on("SIGTERM", () => child.kill("SIGTERM"))
