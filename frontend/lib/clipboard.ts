/**
 * 마크다운 글자와 서식(HTML)을 함께 클립보드에 넣는다.
 * 붙여 넣는 곳이 고른다: 노션·구글 문서·워드·메일은 서식으로, 메모장·카톡·깃허브는 마크다운 글자로 붙는다.
 * 서식 복사를 지원하지 않는 브라우저에서는 마크다운 글자만 넣는다.
 */
export async function copyRichText(plainText: string, html: string): Promise<void> {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/plain": new Blob([plainText], { type: "text/plain" }),
                    "text/html": new Blob([html], { type: "text/html" }),
                }),
            ])
            return
        } catch {
            // 일부 브라우저는 text/html 쓰기를 막는다. 글자만이라도 넣는다.
        }
    }
    await navigator.clipboard.writeText(plainText)
}
