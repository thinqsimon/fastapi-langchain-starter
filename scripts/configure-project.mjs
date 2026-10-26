#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const [name, slug, profile] = process.argv.slice(2)
if (!name?.trim() || !/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(slug ?? "") || !["starter", "diary-coach"].includes(profile)) {
    console.error("사용법: node scripts/configure-project.mjs <이름> <slug> <starter|diary-coach>")
    process.exit(1)
}
if (/[\r\n$]/.test(name)) {
    console.error("서비스 이름에는 줄바꿈과 환경 변수 확장 문자($)를 사용할 수 없습니다.")
    process.exit(1)
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const examplePath = path.join(root, ".env.example")
let example = await fs.readFile(examplePath, "utf8")
for (const [key, value] of Object.entries({
    APP_PROFILE: profile,
    NEXT_PUBLIC_APP_PROFILE: profile,
    APP_NAME: JSON.stringify(name.trim()),
    NEXT_PUBLIC_APP_NAME: JSON.stringify(name.trim()),
})) {
    example = example.replace(new RegExp(`^${key}=.*$`, "m"), () => `${key}=${value}`)
}
await fs.writeFile(examplePath, example)
const renderPath = path.join(root, "render.yaml")
const render = await fs.readFile(renderPath, "utf8")
const configuredRender = render
    .replace(/^(    name: ).+$/m, `$1${slug}`)
    .replace(/(- key: APP_PROFILE\r?\n\s+value: ).+/, (_match, prefix) => `${prefix}${profile}`)
    .replace(/(- key: APP_NAME\r?\n\s+value: ).+/, (_match, prefix) => `${prefix}${JSON.stringify(name.trim())}`)
await fs.writeFile(renderPath, configuredRender)
