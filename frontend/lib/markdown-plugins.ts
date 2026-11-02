import remarkCjkFriendly from "remark-cjk-friendly"
import remarkGfm from "remark-gfm"

/**
 * 화면과 복사본의 모든 마크다운을 같은 규칙으로 읽는다.
 * remark-cjk-friendly: 표준 규칙은 `**용어(term)**은`처럼 괄호·따옴표 뒤에 한글이 바로 붙으면 굵게로 읽지 못해
 * 별표가 그대로 보인다. AI 답변에 자주 나오는 모양이라 한글 옆에서도 굵게로 읽게 한다.
 */
export const MARKDOWN_PLUGINS = [remarkGfm, remarkCjkFriendly]
