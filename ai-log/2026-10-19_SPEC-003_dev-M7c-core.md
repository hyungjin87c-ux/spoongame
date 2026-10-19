# 2026-10-19 · SPEC-003 · dev · M7c core — 자유 기록 「생각 남기기」의 로직·데이터·저장 (UI는 다음 단계)

- 누가: developer (마스터 지시 「M7c core 단계」 + 추가 지시 「designer 선행 완료 반영: 질문 최종 문구·D-73·D-79」)
- 무엇을: ① 기록 카드 7종 데이터 `src/data/notes.json`과 검증·문구 lint(`check:events`에 포함) ② 차례 판정 `core/notes.ts#dueNote`(RNG 없는 순수 함수)·소비·쓰기·파생 목록 ③ 입력 규칙 `core/noteText.ts`(`finalizeNote`·`sanitizeLive`·`cleanNoteForLoad`, `Intl.Segmenter` 없는 환경 대체 경로) ④ 저장: `HISTORY_KINDS`에 `note`, note 행 검증 분기, 게임 스키마 v8 유지, 설정 v3 → v4, 이름 한글 음절 화이트리스트(T2) ⑤ 세션 reducer의 `saveNote`·`dismissNote`·`setNoteCards`와 `advance`·`skip`·`choose`·`autoChoose`의 멈춤/소비, `advanceUntilDecision`의 옵션 `ignore | stop | consume` ⑥ 인용: ①만 c-037(`past` 추가), `usedBy` 역색인·`citationLinkProblems`·`gen:citations`·`check:citations`가 `notes.json`을 읽음 ⑦ 시험과 스케줄 보고(`npm run report:notes`) ⑧ 추가 지시: 질문을 `copy.md` 7-1 최종 문구로, D-73 c-049·c-088 요약 손질, D-79 c-037 확인
- 결과: 아래 6절 숫자. 인생 불변(세 시대 × 200판 × 일곱 가지 처리)·1000판 스케줄 불변식 위반 0·`sim:1000` 6000판 위반 0. UI는 만들지 않았고 배포 판의 동작은 그대로(2절).
- 다음: reviewer 검수(8절 확인 요청) → UI 단계(7절 인계 목록).

## 1. 한 일

| 구분 | 내용 | 주요 파일 |
|---|---|---|
| 카드 데이터 | 7종(번호 순)·수동 질문·라벨 주제. 형식은 content-M7c 1-5절 + 확장 3가지(`triggers[].minAge`, `unlessSeen`, `timing`) | `src/data/notes.json`, `src/data/noteCards.ts`(로더·검증) |
| 검증·lint | `validateNoteFile`(스키마·조건 문법 재사용·때와 나이 창 일관성), `lintNoteFile`(한 문장·`?` 하나·「있습니까?」류 끝·조사 에게/에게도/의·S1 안전 낱말·S2 이유 캐묻기·S4 감정 낱말·R8 시대 낱말·≤ 52자), `noteCardPoolProblems`(읽는 플래그가 켜지는지·본 이벤트 id가 실제인지·이벤트 id와 겹침) | `src/core/noteCards.ts`, `src/core/events.ts#conditionProblems#citationShapeProblems#NOTE_ID_PREFIX`(기존 검증기를 export·분리), `scripts/validateEvents.ts` |
| id 예약 | 이벤트 id는 `note-`로 시작할 수 없다(`validateEventFiles`가 막는다) — `seen`에서 키가 섞이지 않게 | `src/core/events.ts#checkEvent`, `docs/data/events-schema.md` |
| 차례 판정 | `dueNote(game)`: 인생 단계 · `pending === null`(해의 첫머리) · 이미 본 카드 제외 · 판당 ≤ 7 · 마지막 자동 카드와 간격 ≥ 2년(소비한 카드도 센다) · 나이 창 · 조건 · 적격 갈래(`triggers` any-of) · 제외 이벤트 · 때(`asap` / 시드로 정한 흉내 나이 이후, 변형 조건이 맞으면 바로) · 번호 순. 흔들림 `noteJitterAge = 최소 + mixSeed(시드, FNV-1a(카드 id)) % 폭`. `Date`·`Math.random`·`rngState`를 쓰지 않는다 | `src/core/notes.ts` |
| 소비·쓰기 | `consumeNote`(`seen`만), `writeNote`(finalize → 연표 `note` 줄 + 자동 카드면 소비; 못 하면 같은 객체: 인생 단계 아님·글이 문자열 아님·40개 도달·`expectCount` 불일치·뜰 차례가 아닌 카드·빈 입력), `notesOf`(연표에서 파생한 `{age, cardId\|null, text}`), `noteCount`, `lifeLineCount`, `noteQuestion`(변형 선택 + 이름) | `src/core/notes.ts` |
| 입력 규칙 | `finalizeNote`: 읽는 양 20,000 → NFC → 그래핌 단위 글자 처분(3-3절 표, 이모지 4종은 시퀀스째 보존, 12코드 포인트 넘으면 앞 요소까지) → 줄바꿈 통일·공백 접기·빈 줄 제거 → 3줄(넘는 줄은 앞 줄에 공백으로) → 그래핌 140·단위 400 자르기(끝 공백 걷음) → 더 안 바뀔 때까지 되풀이(멱등을 구조로 보장). `sanitizeLive`: 앞뒤 공백·공백 접기 없이 같은 처분 + 줄 모양 + 한도(저장될 글 기준 이분 탐색). `cleanNoteForLoad`: 거부하지 않고 위험한 글자만, 이모지 안의 ZWJ·변이 선택자·태그는 앞뒤 글자를 보고 판단(Segmenter에 기대지 않음) | `src/core/noteText.ts` |
| 저장 | `HISTORY_KINDS`에 `note`. `validHistoryEntry`: note 행 `text`는 문자열이면 통과(숨은 문자 거부·길이 400 거부 없음), 문자열이 아니면 손상; `title`·`eventId`는 기존 검사. `parseGame`이 `withCleanNotes`로 위험한 글자를 걷고 보이는 글자가 없으면 그 줄만 버림. 게임 스키마 v8 유지. 설정 v4: `noteCards`(기본 true, 읽기 허용 [1,2,3,4]). 이름: `CHARACTER_NAME_PATTERN = /^[가-힣]{3,5}$/` | `src/core/storage.ts`, `src/core/types.ts`, `src/core/state.ts`, `index.html`(첫 그림 전 테마 스크립트도 v4 허용) |
| reducer·세션 | `saveNote`·`dismissNote`·`setNoteCards`; `advance`·`skip`은 적격 카드를 만나면 **수동 + 켜짐 → 멈춤(같은 세션 객체)** / **자동 모드·카드 끔 → 소비**; `choose`·`autoChoose`가 해를 마친 직후의 새 해 첫머리 카드도 소비 모드에서는 바로 소비; `advanceUntilDecision(state, pool, 'ignore' \| 'stop' \| 'consume')`(기본 ignore = 기존 동작, `stoppedForNote`) | `src/core/session.ts`, `src/core/life.ts` |
| 인용 | ① `note-infant-memory` → `c-037`(`eras`에 past, `eraPrefix.past` 「지금의 연구로는」, 표시 84자), 나머지 여섯은 `noCitation`(② ③ ④ ⑥ ⑦ D, ⑤ X1). `usedByIndex(events, notes)`·`citationLinkProblems(events, table, notes)`·`syncedCitationsText(text, events, notes)`·`check:citations`·`gen:basis`가 기록 카드를 읽음. `citationCoverage`·`connectedCitationIds`는 이벤트만 받아 MD2 판정에서 기록 카드가 빠진다 | `src/data/citations.json`, `src/core/citations.ts`, `scripts/syncCitationsLib.ts`·`syncCitations.ts`, `scripts/basisDoc.ts`, `docs/data/events-stats-basis.md` |
| 스케줄 보고 | 세 시대 × 두 전략 × N판을 `dueNote` 소비 모드로 끝까지 돌려 불변식(판당 ≤ 7·종류당 ≤ 1·한 해 ≤ 1장·간격 ≥ 2년·창 밖 0)을 검사하고 평균·도달률·결정 겹침을 보고 | `scripts/noteScheduleLib.ts`, `scripts/noteSchedule.ts`(`npm run report:notes`) |
| 추가 지시 | 질문 11문장을 copy.md 7-1 최종 문구로(① 「다섯 살 무렵을」 ② 「있습니까?」 ③ 기본 「마음이 갔던」 ④ 기본 「만나 마음을」 ⑥ 「있습니까?」 수동 「{이름}의 마음에」). D-73: c-049·c-088 요약을 손질안으로. D-79 확인 | `src/data/notes.json`, `src/data/citations.json` |

## 2. UI 단계 전 배포 판의 동작 — 결정과 이유 (지시 7항)

**결정: 앱의 세션 reducer가 기록 카드를 보지 않게 한다.** `App.tsx`의 `appReducer = (s, a) => sessionReducer(s, a, undefined, 'ignore')`. `noteCards` 기본값은 core에서 true 그대로다.

- 대안 「`dueNote`가 있으면 App이 `dismissNote`를 쏘는 임시 소비 effect」는 배포 판의 동작을 바꾼다: ① 「다음 결정으로」가 카드 해마다 멈췄다가 시트 없이 다시 눌러야 하고(판당 5~7번) ② 소비 표시(`seen`의 `note-` 키)가 저장에 남아 UI가 생긴 뒤 그 판의 카드를 잃는다.
- `ignore`는 카드를 소비하지도 `seen`에 쓰지도 않아 **게임 저장·진행·「다음 결정으로」가 지금 배포 판과 같다**(설정 저장에 `noteCards` 필드 하나만 더해진다)(tests/noteInvariance.test.ts의 「시트 없는 판」이 순수 엔진과 상태 전체가 같음을 보고, `sim:1000`·`pipelineLib`도 이 처리로 돈다).
- UI 단계에서 `appReducer` 감싸기를 걷으면 기본값 `live`(수동 + 켜짐이면 멈추고 시트가 뜬다)가 된다.
- `resetKey`(App.tsx)는 이번에 고쳤다: `history.length` → `lifeLineCount(history)`(note 줄 제외) — 수동 기록 한 줄이 올해 진행률을 되감지 않는다(5-3절).
- 설정 v4가 저장되면 이전 번들(오래 열어 둔 탭)은 설정을 기본값으로 읽는다(저장 키·버전 규칙의 기존 성질). 게임 저장은 v8 그대로라 영향이 없다.

## 3. 판단 사항 (마스터·reviewer 확인 요청)

1. **이름 패턴은 `{3,5}`** — 지시문은 「이름 풀 전체를 통과하는 가장 좁은」인데 지금 풀은 성 1자 + 이름 2자 = 정확히 3자다. 데이터 검증기(`validateOfficialRows`)가 이름 2~3자를 허용하고 성은 1~2자가 가능하므로, 풀 갱신이 저장을 무효화하지 않도록 **검증된 데이터 영역(성 1~2 + 이름 2~3)**까지 열었다. `{3}`으로 좁히려면 한 줄(`CHARACTER_NAME_PATTERN`)이다. 풀 전체 통과 시험(`tests/storageNotes.test.ts`)은 어느 쪽이든 풀이 바뀌면 먼저 깨진다.
2. **글자 수 표시는 「저장될 글의 그래핌 수」(`liveGraphemes`)** — content-M7c는 「`sanitizeLive` 결과의 그래핌 수」라 했는데, 같은 문서의 「`finalizeNote(sanitizeLive(x)) = finalizeNote(x)`」와 함께 지키려면 `sanitizeLive`의 한도를 저장될 글 기준으로 재야 하고(연속 공백이 많은 붙여넣기가 접힌 뒤 140자 안이면 그대로 둔다), 그러면 입력란 글의 그래핌 수가 140을 넘을 수 있다. 표시는 `liveGraphemes`(= 저장될 글의 수, 끝 공백 제외, 항상 ≤ 140)를 쓰면 140/140을 넘는 표시가 없다. 속성 시험 1만 개가 두 등식을 모두 잠근다.
3. **40개 상한은 자동 카드·수동 기록 합쳐 한 인생 note 행 전체**(FR5 「합」). 수동 기록을 40개 채우면 이후 자동 카드는 「적어두고 살기」가 막히고 「마음속에 담고 살기」만 된다(UI는 40개 안내 상태 — copy.md 7-2 ⑨).
4. **`broke_up`과 `has_partner`·`married`가 함께 켜진 판**은 ④ 변형 순서상 「함께하는 사람」 문장을 받는다(첫 변형은 `has_partner`·`married` 없음을 요구).
5. 입력 읽는 양 20,000단위·1MB 붙여넣기: 결과가 읽은 앞부분에서만 나오는 것을 시험이 잠근다(`Z`를 20,000 뒤에 둠). 시간은 보고만(7.9ms).

## 4. 시험 (새 파일 · 바뀐 시험)

| 파일 | 내용 |
|---|---|
| `tests/notes.test.ts` (49) | 3-8절 A1~A18, 문자 처분표 코드 포인트별, 이모지 4종 + 변이 선택자·태그·홀수 깃발·12코드 포인트 상한, 멱등, `sanitizeLive` 규칙, `cleanNoteForLoad`, **시드 고정 난수 1만 개**: throw 0·≤ 140글자·≤ 400단위·≤ 3줄·위험한 글자 0·멱등·불러오기 고정점·`finalizeNote(sanitizeLive(x)) = finalizeNote(x)`(공허 통과 방지 카운터 포함), `Intl.Segmenter` 제거 환경 2천 개 |
| `tests/noteCards.test.ts` | 데이터가 1-3절 표와 같음, 질문 11문장 = copy.md 7-1 글자까지, lint가 실제로 잡음(16가지 나쁜 문장), S3 전제 대조, 검증기 음성 시험, 인용(① c-037 세 세상 ≤ 100자·나머지 null·MD2 제외), `dueNote` 카드별 표 시험, `advanceUntilDecision` 세 옵션, 세션 reducer(멈춤·소비·응답·연타·40개·showTitle·꺼진 동안 지나간 카드·다시 태어나기), **1000판 × 세 시대 스케줄** |
| `tests/noteInvariance.test.ts` | 완료 기준 2: 쓴 판·건너뛴 판·자동 모드 판·카드 끈 판·「다음 결정으로」 판·시트 없는 판·순수 엔진의 **상태 전체**(note 줄·`seen`의 note- 키 제외)가 같음 — 세 시대 × 200판, 저장→복원이 쓴 글까지 같음 |
| `tests/storageNotes.test.ts` | H6 (a)~(f), 거부하지 않고 걷음·빈 줄만 버림, 40개·엔딩 새로고침, 이름 화이트리스트(풀 전체 통과·19가지 거부), 설정 v3 → v4 |
| `tests/feedbackUrl.test.ts` (확장) | 연표에 note 줄이 있어도(특수문자·긴 글·그림 문자) 주소에 글의 조각이 없고 기록 없는 판의 주소와 같음 |
| 바뀐 기존 시험 | `tests/storage.test.ts`·`tests/titleSession.test.ts`·`tests/ending.test.ts`(설정에 `noteCards`), `tests/themeInline.test.ts`·`e2e/theme-first-paint.spec.ts`(v4 허용, 모르는 버전은 5), `tests/storageLife.test.ts`(이름은 한글만 통과), `tests/citations.test.ts`·`tests/citationLink.test.ts`(기록 카드 `usedBy`, 지난 세상 연구 3 → 4건), `tests/life.test.ts`(세션 묶음은 카드를 끈 세션으로 — 약화 아님: 같은 단언을 하되 상태 비교는 `lifeView`로 note 흔적만 뺀다), `tests/buildConfig.test.ts`(`report:notes`), `e2e/saves.ts`(설정 버전 4), `e2e/{ending,first-screen,m4-dashboard}.spec.ts`(저장된 설정에 `noteCards: true`) |

시험이 이빨이 있는지 변이로 확인했다(원본 복구 확인): 간격 검사 제거 → 5개 실패 / `writeNote`가 정규화 건너뜀 → 3 / note 행에 숨은 문자 거부 재사용 → 6 / `settleNotes` 무력화 → 1 / NFC 제거 → 1 / consume이 소비 안 함 → 2 / 소비가 스탯을 바꿈 → 3.

## 5. 1000판 스케줄 보고 (`npm run report:notes` — 세 시대 × 두 전략 × 1000판, 위반 0)

| 시대 / 전략 | 판당 평균 카드 | 70세 이상 판 평균 | 분포(0~7장) | 결정 카드와 같은 해 |
|---|---|---|---|---|
| 지난 / 자동 | 6.38 | 6.45 (881판) | 0·2·1·2·0·11·572·412 | 27.5% |
| 지난 / 수동 흉내 | 6.48 | 6.54 (875판) | 0·2·1·3·0·7·479·508 | 27.4% |
| 지금 / 자동 | 6.41 | 6.45 (931판) | 0·1·1·0·0·10·558·430 | 28.6% |
| 지금 / 수동 흉내 | 6.52 | 6.56 (934판) | 0·1·1·1·0·5·454·538 | 28.4% |
| 다가올 / 자동 | 6.52 | 6.55 (954판) | 0·1·0·0·0·4·467·528 | 28.4% |
| 다가올 / 수동 흉내 | 6.60 | 6.63 (961판) | 0·1·0·0·1·5·382·611 | 28.5% |

- **판당 평균 6.38~6.60장**(기획자 추정 6.0~7.0 안). 7장이 가득 찬 판은 40~61%, 6장인 판이 38~57%(⑤가 조건부라서).
- 종류별 도달률(전체): ① 100% · ② 99.4~99.6% · ③ 99.7~99.9% · ④ 99.4~99.9% · **⑤ 41.3~61.3%**(70세 이상 판은 45.7~63.4%) · ⑥ 99.4~99.9% · ⑦ 98.6~99.7%. ⑤만 조건부(큰 병 사건 또는 35세 이상 건강 ≤ 35)이고 나머지 여섯은 거의 모든 판에 뜬다.
- 뜬 나이(평균): ① 5.0 · ② 15.0 · ③ 19.9~20.0 · ④ 27.7~28.9 · ⑤ 66.9~74.4(조건이 늦게 차서 노년 쪽에 몰린다) · ⑥ 28.9~34.2 · ⑦ 50.0.
- **결정 카드와 같은 해에 겹친 기록 카드 27.4~28.6%**(카드 번호별 ① 34~35% · ② 32~34% · ③ 26~29% · ④ 17~27% · ⑤ 6~11% · ⑥ 29~32% · ⑦ 27~30%). 기록 카드는 해의 첫머리, 결정 카드는 해의 끝이라 시트가 이어서 열리고(NC-7) 동시에 열리는 일은 없다. 판당 약 1.8번 「기록 시트 → 결정 시트」가 이어진다.

## 6. 실행 결과

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 (브라우저 쪽 + Node 쪽) |
| `npm test` | **99개 파일 모두 통과, 3155개 통과 · 1개 건너뜀**(시작 때 95개 파일. 새 파일: notes·noteCards·noteInvariance·storageNotes + 도우미 helpers/notes.ts) |
| `npm run sim:1000` | 6000판 위반 0·예외 0 (세 시대 × 두 전략 × 1000판, 걸음 불변식 497,622·저장→복원 201,940) |
| `npm run check:events` | 통과 — 이벤트 140개 + 기록 카드 7종(질문 문구·풀 교차·인용 연결) |
| `check:todo` · `check:citations` · `check:basis` · `check:dist` · `check:economy` | 모두 통과 — `check:todo` [x] 150개 근거 대조 실패 0·경고 0, `check:citations` 일치(인용 49건 연결), `check:basis` 일치(기록 카드 행 1줄 더해짐), `check:dist`·`check:economy` 통과 |
| `npm run e2e` | **첫 전체 실행 2807개 통과 · 12개 실패 → 모두 원인 확인 후 재실행 통과**: 저장된 설정 전체를 비교하던 단언 3곳(`ending.spec.ts`·`first-screen.spec.ts`·`m4-dashboard.spec.ts`, 두 프로젝트)이 `noteCards: true`를 기대하도록 고침(내 코드가 만든 정당한 변화) / `m3-word-breaks.spec.ts` 룰렛 낱말 끊김 6개는 시험 도중 vitest·변이 시험을 동시에 돌린 부하에서 흔들린 것으로 단독 재실행에서 118개 모두 통과(룰렛은 이번 작업과 무관). 회귀 0 |
| `npm run report:notes` | 위반 0 (5절) |
| 성능(보고) | `finalizeNote` 1MB 7.9ms · 20,000단위 한글 20.4ms · `sanitizeLive` 최악 21ms |

designer 쪽 파일(`docs/design/`·`scripts/design/`·`tests/designAssets.test.ts`)은 건드리지 않았다(중간 전체 실행에서 `tests/designAssets.test.ts` 4개가 designer 작업 중이라 실패했으나 마지막 전체 실행에서는 모두 통과).

## 7. UI 단계로 넘기는 것

1. **시트는 파생 상태**: `const due = inLife && !showTitle && !superseded && noteResponse(settings) === 'stop' ? dueNote(game) : null`. 시트가 열린 동안 `useYearClock.running`·자동 선택 타이머·`advance`가 멈춘다(reducer는 이미 `advance`·`skip`을 막는다). 일시정지 중에도 파생이라 시트가 뜬다. 시트가 열려 있는 동안 `noteOpen`을 App 수준 값으로 내보낸다(LM5).
2. **`App.tsx#appReducer` 감싸기를 걷는다** (`sessionReducer`를 그대로 — 기본 `live`). 그 순간 모든 기존 e2e의 기본 설정에 `noteCards: false`가 필요하다(`e2e/saves.ts#settingsEnvelope`의 기본값 + 설정 없이 시작하는 e2e는 `addInitScript`로). `tool-note` 「준비 중」 단언(`tests/dashboard.test.tsx`·`dashText.test.ts`·`e2e/m4-*`)과 `dashText.ts#toolSoon`을 바꾼다.
3. **시트 응답 액션**: 「1. 적어두고 살기」 `saveNote{cardId, text: 입력란 값, expectCount}` — 자동 카드는 `expectCount` 없이도 멱등(소비됨), 수동 기록은 열 때의 `noteCount(game)`를 들고 간다. 「2. 마음속에 담고 살기」 `dismissNote{cardId}`(수동은 그냥 닫기). 빈 입력은 `finalizeNote(raw).empty`(reducer도 같은 객체를 돌려준다). 「끄기/켜기」 `setNoteCards{on}`.
4. **입력란**: `onChange`에서 `sanitizeLive(value)`; 글자 수 표시는 `liveGraphemes(value)`(저장될 글 기준); 알림은 `finalizeNote(value)`의 `truncated`(140 초과로 줄임)·`linesMerged`(3줄 초과)와 남은 글자 `140 − liveGraphemes`로. 4번째 줄을 만드는 Enter는 `sanitizeLive`가 이미 무시한다(값이 안 바뀐다). IME 조합 중에는 값을 다시 쓰지 않는다(3-5절). 40개는 `noteCount(game) >= NOTE_LIMITS.total`로 안내 상태.
5. **질문**: `noteQuestion(card | null, game)`(변형 선택 + 이름). 카드의 인용은 `citationFor(card, era, calendarYear(birthYear, age))`(① 외에는 null → 박스 요소 없음). 연표 라벨은 `HistoryEntry.title`(주제)이고 수동은 `NOTE_MANUAL.topic`. 카드별 `maxLength`가 생기면 `finalizeNote(raw, limit)`·`sanitizeLive(raw, limit)`의 둘째 인자.
6. **표시**: 연표 `kind === 'note'` 줄만 `NoteText`로(`LogCard`·`TimelineItem`). 글을 읽는 분기는 두지 않는다(S8). `notesOf(game)`는 파생 목록.
7. **designer 최종 문구가 바뀌면** `notes.json`의 `prompt`만 고치고 `tests/noteCards.test.ts`의 `FINAL` 표(11문장 + 글자 수)를 같이 고친다.
8. **T3**: 「e-나라지표」 하이픈 묶기(`core/glue.ts`)와 `m7b-cite-lines` 허용 목록 이름 정리·칸 수 92는 UI 단계(D-73 ②③). 데이터(c-049·c-088)는 이번에 반영했다.

## 8. reviewer 확인 요청

- 3절의 판단 1·2(이름 패턴 범위, 글자 수 표시 기준)가 지시와 어긋나지 않는지.
- `finalizeNote`의 「되풀이해 고정점에 도달」 방식이 멱등 보장으로 충분한지(상한 8번, 시험에서는 1~3번이면 끝난다).
- note 행 `title`·`eventId`에 기존 검사를 그대로 둔 것(H2).
- `advanceUntilDecision`의 `stoppedForNote` 같은 선택 필드를 `RunResult`에 더한 것.
