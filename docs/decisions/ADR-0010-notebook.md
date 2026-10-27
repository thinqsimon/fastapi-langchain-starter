# ADR-0010: 학습장 — /study-notes 마크다운 노트 업로드와 주제별 관리

- 날짜: 2026-10-27
- 상태: 채택
- 기능: NOTE-01

## 범위

사용자가 Claude Code 글로벌 스킬 `/study-notes`로 만든 학습 노트(`~/StudyNotes/<프로젝트>/YYYY-MM-DD_NN.md`)를
배움일기 코치에 올려 주제별로 읽고·고치고·학습 완료를 표시하며 관리하려는 요청이다.
헤더 메뉴 '채팅'과 '일기' 사이에 **학습장**을 추가하고, 왼쪽 학습장(파일)별 주제 목록·오른쪽 본문의 2단 화면을 만든다.

새 도메인 `notebook`을 추가한다. `study`·`learning`이라는 이름은 COACH-02 복습 기능이 이미 쓰고 있다.
기존 diary API·마이그레이션은 건드리지 않고, starter 프로필에는 메뉴·화면·API를 노출하지 않는다.
운영 DB에 직접 적용하거나 배포하지 않는다. DOC-02보다 사용자 요청을 우선한다.

## 저장 정책

- 파일 하나 = 학습장(`notebooks`) 하나, 펜스 밖의 `## 제목` 하나 = 주제(`notebook_topics`) 하나.
- 파싱은 서버의 순수 모듈(`domain/notebook/parser.py`)이 맡는다. 1행이 `---`이고 닫는 `---`까지 전부
  `key: value`일 때만 frontmatter로 읽고, 코드 펜스(```/~~~) 안은 본문으로 본다. `## 목차`는 건너뛰고
  `## 1.` 번호는 있어도 없어도 되며 순서는 등장 순이다. 주제 안의 `` `유형` … | `태그` … | `난이도` ★★☆ ``
  메타 줄은 유형·태그·난이도로 읽은 뒤 본문에서 뺀다. 제목은 frontmatter `title` → 첫 `#` → 파일명 순이다.
  주제가 없으면 본문 전체가 주제 하나, 내용이 없으면 400이다. 닫히지 않은 펜스는 파일 끝까지 본문이다.
- 업로드는 브라우저가 파일을 읽어 JSON `{filename, content}`로 보낸다(RAG 문서 업로드와 같은 방식, 50만 자 제한).
  multipart와 새 의존성을 쓰지 않는다.
- 같은 계정·**같은 프로젝트**(frontmatter `project`)에 같은 파일명을 다시 올리면 **409**로 거부한다
  (`uq_notebooks_user_project_filename`, NOTE-02에서 `(user_id, filename)`에서 변경). 앱에서 고친 내용과 완료 표시가
  실수로 지워지지 않게 하기 위해서다. `/study-notes` 노트는 프로젝트마다 `YYYY-MM-DD_NN.md`로 이름이 같아
  파일명만으로는 다른 프로젝트의 노트까지 막혔다. `project`가 없는 일반 md와 직접 만든 학습장(`filename` NULL)은
  PostgreSQL이 유니크 비교에서 NULL을 서로 다르게 보므로 중복 검사 없이 추가된다. 덮어쓰기로 바꾸려면
  `NotebookService.upload`의 중복 검사 한 곳만 고치면 된다. 스킬 v1.3.0부터는 새 노트 파일명에
  `<프로젝트>_` 접두사가 붙어 파일명 자체도 겹치지 않는다(기존 노트는 이름을 바꾸지 않는다).
- 원본 md 파일은 저장하지 않는다. 앱에서 수정한 제목·유형·태그·난이도·본문과 완료 표시는 DB에만 있다.
- 태그는 쉼표로 이어 Text에 저장하고 API에서는 `list[str]`로 다룬다(배열 컬럼을 쓰지 않아 이식성이 높다).
- 학습장 삭제는 ORM cascade와 FK `ON DELETE CASCADE`로 주제를 함께 지운다. 주제 번호(`position`)는 최댓값+1로
  매겨 지운 번호를 다시 쓰지 않는다.
- 완료 표시는 주제 단위이며 일기 복습(`diary_study_progress`)과 독립이다.

## API와 데이터

- `GET /api/notebooks`: 본인 학습장 목록(최근순). 주제는 본문 없이 요약만
- `POST /api/notebooks/upload {filename, content}`: 파일 → 학습장 1 + 주제 N (400 내용 없음, 409 같은 프로젝트의 같은 파일)
- `POST /api/notebooks {title}`: 빈 학습장
- `PATCH /api/notebooks/{id} {title}` · `DELETE /api/notebooks/{id}`
- `POST /api/notebooks/{id}/topics {title, content?, kind?, tags?, difficulty?}`
- `GET /api/notebooks/topics/{topic_id}`: 본문 포함 상세
- `PATCH /api/notebooks/topics/{topic_id}`: 보낸 필드만 수정(`completed` 포함) · `DELETE /api/notebooks/topics/{topic_id}`

`notebooks(user_id)` 인덱스와 `(user_id, project, filename)` 유일 제약, `notebook_topics(notebook_id)` 인덱스를 둔다.
주제의 소유자는 학습장과 JOIN해 확인하며 타인 ID는 404, 비로그인은 401이다.
라우터는 `api.py`의 `diary_enabled` 블록 안에서만 지연 import 한다(starter가 샘플 코드를 import하지 않는다는
기존 테스트를 유지).

프론트엔드는 `api/notebook.ts`와 Zustand `notebook` 스토어를 쓴다. 계정 세대·조회 버전·주제 선택 버전을
구분해 로그아웃이나 늦은 응답이 새 상태를 덮지 않게 한다. 768px 이상은 2단, 그 미만은 한 창씩 보여 주고
'목록'으로 돌아간다. 본문 렌더와 미리보기는 일기의 `DiaryDocument`를 재사용한다.
