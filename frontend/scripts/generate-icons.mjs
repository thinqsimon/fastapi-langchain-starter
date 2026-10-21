// 로고 원본 하나(public/brand/logo.svg)에서 작은 크기용 로고·파비콘·앱 아이콘을 만든다. 실행: npm run icons
// 렌더링은 E2E용으로 이미 설치된 Playwright 크로미움을 쓴다(새 의존성 없음).
//   자세한 로고(40px 이상)        → 아이폰 홈 화면 아이콘, 웹앱 매니페스트 아이콘
//   작은 크기용(data-detail 요소 제거: 줄무늬·불꽃 속) → public/brand/logo-small.svg, favicon.ico, app/icon.svg
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const logo = await readFile(join(root, "public/brand/logo.svg"), "utf8")
// 32px 이하에서는 뭉개지는 세부(data-detail)를 뺀다.
const small = logo.replace(/<path data-detail="[^"]*"[^>]*\/>/g, "")
// 아이폰은 아이콘 모서리를 직접 둥글게 깎으므로 꽉 찬 정사각형으로 준다(투명 모서리는 검게 보인다).
const fullBleed = logo.replace('rx="14"', 'rx="0"')

const browser = await chromium.launch()
const page = await browser.newPage()

async function png(svg, size) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`)
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}

/** PNG를 그대로 담는 ICO(Windows 아이콘) 파일을 만든다. */
function ico(images) {
    const header = Buffer.alloc(6 + images.length * 16)
    header.writeUInt16LE(0, 0)
    header.writeUInt16LE(1, 2)
    header.writeUInt16LE(images.length, 4)
    let offset = header.length
    images.forEach(({ size, data }, i) => {
        const at = 6 + i * 16
        header.writeUInt8(size >= 256 ? 0 : size, at)
        header.writeUInt8(size >= 256 ? 0 : size, at + 1)
        header.writeUInt16LE(1, at + 4)
        header.writeUInt16LE(32, at + 6)
        header.writeUInt32LE(data.length, at + 8)
        header.writeUInt32LE(offset, at + 12)
        offset += data.length
    })
    return Buffer.concat([header, ...images.map((image) => image.data)])
}

const icoImages = []
for (const size of [16, 32, 48]) icoImages.push({ size, data: await png(small, size) })

await mkdir(join(root, "public/icons"), { recursive: true })
const outputs = {
    "app/favicon.ico": ico(icoImages),
    "public/brand/logo-small.svg": small,
    "app/icon.svg": small,
    "app/apple-icon.png": await png(fullBleed, 180),
    "public/icons/icon-192.png": await png(logo, 192),
    "public/icons/icon-512.png": await png(logo, 512),
}
for (const [path, data] of Object.entries(outputs)) {
    await writeFile(join(root, path), data)
    console.log("✓", path)
}
await browser.close()
