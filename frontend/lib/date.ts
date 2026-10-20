/** 사용자 기기 기준 오늘(YYYY-MM-DD). 서버는 UTC라 한국 새벽에는 하루 늦기 때문에 화면이 보낸다. */
export function localToday(now = new Date()): string {
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 10)
}

/** 목록에 보여줄 짧은 날짜·시각(예: 10. 20. 오후 3:05) */
export function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })
}
