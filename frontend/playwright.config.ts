import { defineConfig, devices } from "@playwright/test"

const PORT = 3100
const BASE_URL = `http://localhost:${PORT}`

// 백엔드는 scripts/e2e.sh가 띄운다(프론트엔드만 여기서 관리).
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? "line" : "list",
    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8010",
        },
    },
})
