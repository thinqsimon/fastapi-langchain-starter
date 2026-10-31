"use client"

import { useState } from "react"
import Link from "next/link"
import { CircleHelp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const SKILL_URL = "https://github.com/thinqsimon/claude-study-notes"

/** 학습장 사용 안내 창. 올릴 수 있는 파일과 화면 사용법을 한 곳에 모았다. */
export function NotebookHelp() {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button size="sm" variant="ghost" title="학습장 사용 안내" onClick={() => setOpen(true)}>
                <CircleHelp />
                도움말
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>학습장 사용 안내</DialogTitle>
                        <DialogDescription>AI와 공부하며 만든 학습 노트를 올려 주제별로 읽고 관리하는 곳입니다.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 text-sm leading-6">
                        <section className="flex flex-col gap-1">
                            <h3 className="font-semibold">올릴 수 있는 파일</h3>
                            <p>
                                Claude Code·Codex 스킬 <code className="rounded bg-muted px-1">/study-notes</code>가 만든 학습 노트(<code>.md</code>)만 올릴 수
                                있습니다. 노트는 <code className="rounded bg-muted px-1">~/StudyNotes/&lt;프로젝트&gt;/</code>에 생깁니다. 일반 메모·회의록 md,
                                txt, json 등은 거부됩니다.
                            </p>
                            <p>
                                스킬 설치와 사용법:{" "}
                                <Link href="/guide#skill" className="underline underline-offset-4">
                                    사용 안내의 스킬 단원
                                </Link>{" "}
                                또는{" "}
                                <a href={SKILL_URL} target="_blank" rel="noreferrer" className="break-all underline underline-offset-4">
                                    {SKILL_URL}
                                </a>
                            </p>
                            <p>
                                같은 프로젝트의 같은 파일은 다시 올릴 수 없습니다. 고친 파일을 다시 올리려면 기존 학습장을 삭제한 뒤 올리세요(앱에서 고친 내용과
                                보관·완료 표시는 사라집니다).
                            </p>
                        </section>
                        <section className="flex flex-col gap-1">
                            <h3 className="font-semibold">보기와 필터</h3>
                            <ul className="list-disc pl-5">
                                <li>
                                    <b>신규</b>: 아직 보관하지 않은 주제. 방금 올린 노트를 확인하는 곳
                                </li>
                                <li>
                                    <b>전체</b>: 모든 주제
                                </li>
                                <li>
                                    <b>보관함</b>: 나중에 공부하려고 보관한 주제
                                </li>
                                <li>
                                    <b>공부할 것 / 끝낸 것</b>: 학습 완료 여부로 좁히기. 다시 누르면 해제
                                </li>
                            </ul>
                        </section>
                        <section className="flex flex-col gap-1">
                            <h3 className="font-semibold">보관과 완료</h3>
                            <ul className="list-disc pl-5">
                                <li>
                                    시간이 없을 때는 일단 올려 두고, <b>선택</b>을 눌러 주제를 고른 뒤 <b>보관</b>하세요. 학습장 제목 옆 체크박스로 한 번에 고를
                                    수 있습니다
                                </li>
                                <li>
                                    주제 하나는 본문 위 <b>보관</b> 버튼으로 바로 표시합니다
                                </li>
                                <li>
                                    다 공부한 주제는 <b>학습 완료</b>로 표시합니다. 보관·완료 표시는 계정에 저장됩니다
                                </li>
                            </ul>
                        </section>
                        <section className="flex flex-col gap-1">
                            <h3 className="font-semibold">그 밖에</h3>
                            <ul className="list-disc pl-5">
                                <li>
                                    <b>수정</b>으로 제목·유형·태그·난이도·본문을 고칩니다(작성/미리보기 전환)
                                </li>
                                <li>
                                    <b>클립보드에 복사</b>로 제목과 본문을 복사해 교육 플랫폼·노션에 서식 그대로 붙여 넣습니다
                                </li>
                                <li>
                                    <b>새 학습장</b>·<b>새 주제</b>로 업로드 없이 직접 쓸 수 있습니다
                                </li>
                                <li>넓은 화면에서는 목록과 본문 사이를 끌어 목록 너비를 바꿉니다(두 번 누르면 기본 너비)</li>
                            </ul>
                        </section>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
