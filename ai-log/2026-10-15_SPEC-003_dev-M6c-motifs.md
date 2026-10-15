# 2026-10-15 SPEC-003 dev-M6c-motifs (형진 님 제공 소재 가공 + 소재 점검 도구)

- 누가: developer
- 무엇을: SPEC-003 M6c(소재 공급) 중 「형진 님 제공 소재」 가공만 했다. 형진 님이 직접 모은 톡톡 제목 목록(650건)을 읽고 생애 소재 판정·수위 판정 → 제외 → 유형화(AI가 새로 쓴 한 줄 요약) → `docs/data/story-motifs.json`, 출처 기록, 카드 아이디어 메모, 점검 스크립트와 테스트를 만들었다. AI 창작 보충(M6c-2)과 이벤트 제작(M7a/M7d)은 하지 않았다. `src/`·이벤트 데이터는 건드리지 않았고 새 의존성도 없다. commit·push는 하지 않았다.
- 이 로그에는 원문 제목을 적지 않았다(T4). 입력 파일은 저장소 밖에서 읽기만 했고 복사하지 않았다.

## 만든·바꾼 파일
| 파일 | 내용 |
|---|---|
| `docs/data/story-motifs.json` (신규) | 분류표 17개 + 소재 130개(m-001~m-130). 필드: id·category·summary·stage·era·sensitivity·seenCount·sourceKind·sourceBoards·collectedOn·usedBy. 전부 sourceKind 「형진 님 제공」, usedBy 비어 있음 |
| `docs/data/story-motifs-sources.md` (신규) | T1 불통과 판정(robots.txt 요지·확인일), 공급 경위, 카테고리별 건수, 제외 사유별 개수, 분류표 ↔ 톡톡 13개 대응표, 분포, 제공/창작 비율, 마스터 확인 요청·한계 |
| `docs/data/story-motifs-ideas.md` (신규) | 연쇄 사슬 8개, 시대·성별·수위 조건 메모, 통계 지표 후보 목록(이름만), 소재 130개 각각의 카드 아이디어·선택지 방향·지표 후보, 대표 5개 |
| `scripts/validateMotifsLib.ts` (신규) | 순수 규칙: `validateMotifs`(필수 필드·요약 15~60자·분류표·stage·era·sensitivity·seenCount 규칙·sourceKind·sourceBoards·basisId·collectedOn·usedBy·분량), `forbiddenPatternProblems`(URL·@계정·전화번호·따옴표 인용·「~님」 호칭), `parseCsv`·`titlesFromCsv`, `normalizeForOverlap`·`findOverlap`·`checkOverlap`·`overlapMessage`(6자 연속/제목 전체 포함, 제목 글자는 메시지에 없음) |
| `scripts/validateMotifs.ts` (신규) | CLI. `npm run check:motifs [-- <CSV 경로>] [--strict] [--file=<경로>]`. CSV가 있을 때만 원문 겹침 점검 |
| `package.json` (한 줄) | `scripts.check:motifs` 추가 |
| `tests/validateMotifs.test.ts` (신규) | 56개: 점검 규칙(가짜 데이터), 금지 패턴 5종 × 걸리는/통과하는 문장 5개씩, CSV 읽기, 원문 겹침(5자 통과·6자 걸림·띄어쓰기 우회·제목 전체 포함·메시지에 제목 없음), 실제 소재 목록·문서 일관성, 저장소에 제목 목록 CSV 없음 |
| `tests/buildConfig.test.ts` (한 줄) | vite-node를 쓰는 스크립트 목록에 `check:motifs` 추가(이 테스트가 정확한 목록을 고정하고 있었다) |
| `docs/TODO.md` | M6c 아래에 하위 항목 M6c-1 `[x]`(근거 기재), M6c-2 `[ ]`(창작 보충) 추가. M6c 본항목은 창작이 남아 `[ ]` 그대로 |

## 결과 (숫자)
- 입력 650건(톡톡 13개 카테고리 × 50). **소재로 쓴 제목 275건 → 유형 130개**, 제외 375건.
- 제외 사유별: 도배·연재물 62 · 실존 인물·상호 39 · 정치·정책 논쟁 8 · 뉴스성 사건·범죄·시사 11 · 집단·국적·성별 비하 소지 17 · 선정적·성적·민감 의료 12 · 자살·자해 0 · 홍보·모집·청원·광고 21 · 개인 고유 사건·식별 위험 3 · 생애와 무관한 잡담·질문 88 · 제목만으로 유형을 알 수 없음 114.
- 분류별 유형 수: 결혼·시댁·처가 14 · 맞벌이·가사 8 · 임신·출산·육아 18 · 연애·썸 17 · 이별·재회 4 · 군대 8 · 취업·면접 9 · 회사생활 16 · 알바 13 · 백수·고립 4 · 돈·빚·주거 7 · 가족 갈등 3 · 건강·마음 1 · 노후 2 · 학업·입시 1 · 친구·사회관계 2 · 외모·자존감 3.
- stage(복수): youth 123 · middle 58 · school 17 · senior 2 · infant 0. era: all 95 · present+future 26 · past+present 8 · present 1. 수위: normal 119 · dark-real 11. seenCount 1인 유형 53개, 최대 7.
- 제공 130 / 창작 0. EV5 총량 130건▲은 채웠지만 5건 이상인 분류는 9개(기준 10개) — 5건 미만 분류 8개는 창작으로 보충해야 한다.

## 명령 결과 (Windows, 2026-10-15)
- `npm run typecheck`: 에러 0.
- `npm run check:motifs -- <형진 님 CSV 경로>`: 제목 650건 × 요약 130건 대조, **겹침 0건**, 오류 0, 경고 1(5건 이상 분류 9개 < 10, 제공분만 있어서). 처음 돌렸을 때 3건이 걸려 요약 3개를 다시 썼고(연속 6자 이상 일치), 다시 돌려 0건. `--strict`는 같은 이유로 의도대로 실패(종료 코드 1).
- `npm test`: tests/validateMotifs.test.ts 56 통과. 전체는 마지막 실행 결과를 아래 「최종 확인」에 적었다.
- `npm run check:todo`: `[x]` 26개 대조 실패 0·경고 0.

## 마스터가 알아야 할 것
1. 입력 파일은 10개가 아니라 **13개 카테고리**였다(SPEC-003 EV4의 13개와 같다. 「취업」=「취업과 면접」, 「백수&백조이야기」=「백수&백조 이야기」 표기만 다름).
2. **필드 하나 추가**: SPEC-003 「데이터 형식」이 `sourceKind`를 두 값으로 두면서 톡톡 카테고리를 적을 곳을 따로 말하지 않아 `sourceBoards`를 추가했다(제공분만 필수, 창작은 금지). 마음에 들지 않으면 필드 이름·위치를 바꾸면 되고 점검 도구의 상수 한 곳(`ALLOWED_KEYS`)이다.
3. **seenCount 규칙을 도구가 강제**한다: 제공분 ≥ 1(R3), 창작 = 0. 창작을 실제 사연처럼 보이게 하지 않으려는 장치다.
4. **분류표 17개는 내가 정했다**(SPEC에 정해진 목록이 없었음). 노후·건강·학업 등 제공분이 거의 없는 분류도 창작 보충용으로 넣었다.
5. 군대 소재 8개의 `era`는 지난·지금만 달았다(다가올 세상의 병역 제도가 미정). 복무 당사자 이벤트는 만들 때 `gender: male` 조건이 필요하다.
6. 입력 목록은 카테고리와 무관한 글이 많이 섞여 있었다(도배 62건, 연예인 기사 25건 등). 「헤어진 다음날」(48/50)·「남자들의 속깊은이야기」(49/50)는 거의 쓰지 못했다. 이별·재회 소재는 창작이 채워야 한다.
7. `package.json` 작업 트리의 줄바꿈이 CRLF이고 HEAD는 LF라서 `git diff`가 파일 전체를 바꾼 것처럼 보인다. 내 수정은 한 줄(`check:motifs`)이다(`git diff --ignore-space-at-eol`로 확인). 내가 만든 변화가 아니라 이미 그랬다(Edit 도구는 줄바꿈을 유지함을 확인).
8. 다른 에이전트의 파일(`docs/design/`, `src/assets/`, `src/styles/`, `scripts/checkContrast*`, `docs/data/korea-stats-sources.md`, `src/data/koreaStats.json`, `citations.json` 등)은 건드리지 않았다. `package.json`에서 충돌은 보이지 않았다.

## 정리
- 작업용 파일(제목 TSV, 유형 매핑 스크립트, 통계 파일)은 시스템 임시 폴더(스크래치패드)에만 두었고 작업 끝에 삭제했다. 저장소에 CSV·제목·행 번호 대응표가 없다(`tests/validateMotifs.test.ts`의 「원문 저장 금지(T4)」 테스트가 파일 이름과 CSV 머리 줄의 제목 목록 열 이름으로 지킨다 — 다른 에이전트가 같은 시각에 만든 통계 출처 CSV `docs/data/korea-life-data-sources.csv`가 있어 「CSV 전부 금지」로 짜면 오탐이 나서 내용 기준으로 좁혔고, 가짜 머리 줄 파일을 두어 테스트가 실패하는 것을 확인한 뒤 지웠다).
- 입력 CSV는 형진 님의 내려받기 폴더에 그대로 있다(수정·이동·삭제하지 않았다).

## 다음 단계
1. reviewer: M6c-1 검수 — 소재 표본 20건 판독(원문 복사·식별 정보·창작 오표기 없음), `sourceBoards` 필드 해석 확인, 요약 표현 점검. REV 파일 `docs/review/REV-003-M6c-1.md` 필요.
2. 마스터: `sourceBoards` 필드·분류표 17개·군대 era 결정 확인, 창작 보충(M6c-2) 범위 지시 — 부족 분류 8개와 이별·재회·노후·학업·건강·가족 갈등 등.
3. M7a/M7d: `story-motifs-ideas.md`의 카드 아이디어와 지표 후보를 입력으로 이벤트 제작(지표 값은 M6a 문서에서 원자료 확인 후).

## 최종 확인
- `npm run typecheck`: 에러 0. `npm test`: **27파일 1198 통과**(실패 0, 59초). `npm run check:motifs -- <CSV>`: 겹침 0건. `npm run check:todo`: 실패 0·경고 0. 스크래치패드의 작업 파일(제목 TSV·매핑 스크립트·통계)은 삭제 확인.
