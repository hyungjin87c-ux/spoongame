# 인생 기록 결정 줄의 질문 — 사건 제목을 작은 윗줄로 (v0.4.1, SPEC-012 QF4, 2026-11-08 designer)

형진 님 v0.4.0 플레이테스트 피드백: 「인생 기록은 결정만 쓰지 말고, 어떤 질문에 대한 결정이었는지 질문도 작게 써 달라.」 확정된 것(SPEC-012 QF4·완료 기준 8): 질문 문자열은 **사건 제목**(`HistoryEntry.title`, 새 필드 없음 — 옛 저장에도 바로 나온다) · 부모 결정·흘러감·(나중의) 조르기 줄도 같은 모양 · 가린 줄은 제목도 가린다 · 서술 이벤트·나의 기록·단계·시대 줄·엔딩 연표는 그대로.

- 시안: `docs/design/mockups/log-question.html` — `?v=now`(지금) · `?v=1`(안 1 — 제목 윗줄만) · `?v=2`(**안 2 — 제목 → 고른 길 → 결과, 추천**), `&theme=dark` · `&text=200` · `&open=1`(가린 줄 펼침) · `&old=1`(제목 없는 옛 줄 표본). 제안 CSS는 이 파일 `<style>`의 「제안」 블록(developer가 `dash.css`로 옮길 글자).
- 촬영·측정: `scripts/design/shootLogQuestion.mjs` → `docs/design/screens/012/log-question-360.png`(지금 · 안 1 · 안 2 나란히) · `log-question-pc.png`(1280 지금 ↔ 안 2) · `log-question-states.png`(안 2 — 다크 · 옛 줄 · 글자 200%) · `log-question-veil.png`(안 2 — 가린 줄 접힘 ↔ 펼침) · `log-question-measure.json`(아래 표의 원본). 넘침 0, 300 KB 초과 0.
- `src/`·`tests/`는 읽기만 했다(developer가 같은 브랜치에서 고치는 중). 커밋하지 않았다.

## 0. 한눈에

| | 지금 | 안 1 — 제목 윗줄만 | **안 2 — 제목 → 고른 길 → 결과 (추천)** |
|---|---|---|---|
| 모양 | 「결과 문장 (선택: 고른 길)」 — 어떤 일에 대한 결정이었는지 없음 | 「**사건 제목**(작게)」 / 「결과 문장 (선택: 고른 길)」 | 「**사건 제목**(작게)」 / 「선택: 고른 길」 / 「결과 문장」 — 엔딩 연표와 같은 차례, 괄호 없음 |
| 제목 | — | 12px · 보조색 · 보통 굵기 · 윗줄 | 같음 |
| 결정 줄 높이 (360×740, 글자 100%) — 17세(최신·굵게) · 15세 · 12세 · 9세 · 4세 | 127 · 153 · 153 · 179 · 204 | +20 · +19 · +19 · +19 · +19 | +43 · +20 · +17 · +16 · +17 |
| 열 줄 목록 높이 (360) | 1265 | 1361 (+96, +7.6%) | 1378 (+113, +8.9%) |
| 결정 줄 높이 (1280, 가운데 열 536px) | 76(2줄) · 102 · 102 · 102 · 102 | — | 122 · 122 · 122 · 122 · 147 (줄마다 +20, 최신 줄 +46) |
| 바뀌는 것 | — | `LogList.tsx#EntryText` 윗줄 한 요소 + CSS 한 줄 | 같은 곳 + 결정 줄 세 줄 쌓기(괄호 제거) + CSS 두 줄 + 시험의 괄호 꼴 단언 |

- **추천 안 2.** 형진 님이 바란 것은 「질문 + 고른 답」이고, 질문 바로 아래에 답이 오는 차례가 그 짝을 눈으로 잇는다. 엔딩 연표(`TimelineBody`: 제목 → 고른 길 → 결과)와 같은 차례라 같은 기록을 두 곳에서 같은 꼴로 읽고, 낭독(live region)도 「17세, 입시를 앞둔 해, 선택: …, 결과」 순으로 읽힌다. 모바일에서 안 1과 높이 차이가 거의 없다(열 줄 목록 1361 ↔ 1378, 괄호 꼴은 어차피 360에서 둘째 줄로 내려가므로). 손해는 PC에서 줄마다 한 줄(+20px)과 시험의 괄호 꼴 단언을 고치는 손.
- 안 1은 가장 작은 변경이다(제목 한 줄만 더함). 질문과 답 사이에 결과 문장이 끼어 짝이 멀고, SPEC-012 완료 기준 8 ②의 「고른 길 → 결과」 차례와도 어긋나므로 고르면 완료 기준 문구를 「지금 꼴 그대로」로 손본다.
- 두 안 모두 색 토큰·본문 글자 크기(16px)·고른 길 글자(14px 보조색, `.log__text em`)·도장 아이콘·`data-testid="log-by"`·`data-by`를 바꾸지 않는다. 새로 쓰는 글자(기호)도 없다 — 글꼴 조각 영향 0.
- design-taste `inspect --app`(1280·360) 전(`?v=now`)·후(`?v=2`): **0 FAIL · 2 WARN 같음**(`palette-cream` 확정 바탕 토큰 · `unused-canvas` 표본 장이 3열 중 가운데 열만 둬 양옆이 빈다 — 실제 화면은 3열). 새 경고 0(8절).

## 1. 지금 (코드와 실측)

| 자리 | 지금 |
|---|---|
| 결정 줄 DOM (`LogList.tsx#EntryText`) | `<span class="log__text">{결과 문장} <em>(선택: {고른 길})</em></span>` · 부모·흘러감은 `<em class="log__by log__by--{by}" data-testid="log-by" data-by="{by}">[아이콘]({어머니가 이렇게 정했습니다\|이렇게 흘러갔습니다}: {고른 길})</em>` — `title`은 저장돼 있지만 그리지 않는다 |
| 글자 | 결과 문장 16px `--c-text`(최신 줄 굵게) · em 14px `--c-text-2` 정체(`.log__text em`) · 나이 칸 3.1rem 14px `--c-text-2` |
| 엔딩 연표 (`EndingScreen.tsx#TimelineBody`) | `<strong>{제목}</strong>` → `<span class="tl-picked">[아이콘]{도장}: {고른 길}` 또는 `선택: {고른 길}</span>` → `<span class="tl-text">{결과}</span>` — 이미 세 줄 쌓기(`.timeline li > span:last-child` flex column), 14px, 제목·고른 길 굵게 |
| 가린 줄 (`Veil.tsx`) | `.veil__line`(안내 「무거운 일이 있었습니다 · {분류}」 + 도장 낱말 + 「펼쳐 보기」) → `.veil__body`(hidden ↔ 펼침, flex column)에 `EntryText` 그대로 |
| 실측 360×740 | 결정 줄 127(최신, 2줄 + 괄호) · 153 · 153 · 179 · 204px — 괄호 꼴 「(선택: …)」은 폭 228px에서 거의 늘 둘째 줄로 내려간다 |

## 2. 제안 규격 (토큰)

| 항목 | 값 | 근거 |
|---|---|---|
| 제목 글자 크기 | `--fs-xs` 12px | 「작게」 — 프로젝트 하한(이보다 작게 쓰지 않는다). 인생 기록 안의 선례: 시대 줄 연도 `.log__year`·표지 `.log__tl`·나의 기록 라벨 `.log__note-label`이 모두 12px |
| 제목 색 | `--c-text-2` | 카드 면 위 대비 **8.65:1**(라이트 #4f4a41/#fffdf8) · **8.78:1**(다크 #c4bfb2/#1c212c) — 완료 기준 8 ① ≥ 4.5. 나이 칸·고른 길과 같은 보조색이라 「나이 · 제목 · 고른 길」이 한 식구로 묶이고 결과 문장(본문색)만 앞으로 나온다. `--c-text-3`(5.78 / 5.96)도 통과하지만 출처·주석용이라 쓰지 않았다 |
| 제목 굵기 | `--fw-regular` 400 — **최신 줄(`.log__row--latest` 굵게)에서도 보통** | 「크기·색·굵기」 셋으로 작게. 굵은 최신 줄에서 제목까지 굵으면 작게 보이지 않는다 |
| 제목 줄 높이 | `--lh-body` 1.6 → 19.2px | 나이 칸(14px × 1.6 = 22.4, 2px 내림)과 첫 줄이 거의 같은 높이라 나이와 제목이 나란히 선다 |
| 세 줄 사이 간격(안 2) | 2px | 한 줄의 안쪽 간격은 줄 사이(`.log__row` 12px 여백 + 1px 선)보다 분명히 좁게 — 한 덩어리로 읽힌다. 글자 200%에서도 2px 그대로(덩어리 유지) |
| 고른 길(안 2) | 기존 `.log__text em` 그대로(14px · `--c-text-2` · 정체), 괄호 없음, 「선택: 」(`DASH_TEXT.logChoicePrefix`) · 도장 「{주어}가 이렇게 정했습니다: 」(`decidedByText`) 글자 그대로 | 연표 `.tl-picked`의 글과 같다. 괄호는 문장 뒤에 붙는 꼴이라 제 줄을 가지면 뺀다 |
| 결과 문장 | 본문 16px `--c-text`, 최신 줄 굵게 — 지금 그대로 | |
| 강제 색상 | 제목 `CanvasText`(토큰 매핑) — 위치·크기로 구분하므로 색이 없어도 같은 모양 | |
| 줄 간격·여백·아래선 | 바꾸지 않는다(`.log__row` padding 12px 4px, 1px `--c-border`) | |

제안 CSS(시안 `<style>` 「제안」 블록 — `dash.css` 인생 기록 블록 `.log__text em` 아래에 붙인다. 시안의 `html.lq-on`·`html.lq-2` 접두는 변형 선택용이라 뺀다):

```css
/* SPEC-012 QF4 — 결정 줄의 질문 자리 = 사건 제목(HistoryEntry.title). 본문보다 작게: 12px · 보조색 · 보통 굵기(최신 줄이 굵어도). 제목이 없는 줄(옛 저장)은 이 요소가 없다 */
.log__q { display: block; font-size: var(--fs-xs); line-height: var(--lh-body); color: var(--c-text-2); font-weight: var(--fw-regular); }
/* 안 2: 제목 → 고른 길 → 결과를 세 줄로 쌓는다(엔딩 연표 .timeline li > span:last-child와 같은 쌓기). 고른 길(em)은 .log__text em 규칙 그대로 */
.log__text--q { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
```

## 3. 줄 종류별 모양 (안 2 기준 — 시안 `?v=2`)

| 줄 | 보이는 것 | 시안 줄 |
|---|---|---|
| 본인 선택 | 「입시를 앞둔 해」(작게) / 「선택: 지금 성적으로 갈 수 있는 곳에 지원한다」(14px 보조) / 「원서를 내고 결과를 기다렸습니다. …」(본문) | 17세(최신·굵게 — 제목만 보통), 15세 |
| 부모 결정 — 한 분과 사는 해 | 「성적표를 받은 저녁」 / 「[집 아이콘] 어머니가 이렇게 정했습니다: 방과 후에 따로 배운다」 / 「방과 후마다 …」 — 주어는 `subjectOf(age)`(SPEC-011 DS1) | 12세 |
| 부모 결정 — 두 분 | 「집 앞의 강아지」 / 「[집 아이콘] 부모님이 이렇게 정했습니다: 강아지를 집에 들이기로 한다」(`parentLabel`) / 「어른들이 …」(`parentResult`) | 9세 |
| 흘러감 | 「동생이 생겼다」 / 「[물결 아이콘] 이렇게 흘러갔습니다: 서운해서 울며 어른에게 매달린다」 / 「어른이 동생을 안을 때마다 …」 | 4세 |
| 가린 줄(무거운 장면 가리기 켬) | 접힘: 「무거운 일이 있었습니다 · 건강」 + 「[집 아이콘](부모님이 이렇게 정했습니다)」 + 「펼쳐 보기 ▾」 — **제목도 `.veil__body` 안이라 함께 가려진다**(HV 규칙). 펼침: 안내 줄 아래 「한밤의 열」 / 「[집 아이콘] 부모님이 이렇게 정했습니다: 바로 병원으로 간다」 / 「밤길을 달려 …」(`.veil__body`는 이미 flex column이라 세 줄이 그대로 쌓인다) | 3세, `&open=1` |
| 제목 없는 줄(옛 저장 일부) | 윗줄 없이 지금 모양 「결과 문장 (선택: 고른 길)」 — 안 2에서도 괄호 꼴 그대로(세 줄 쌓기는 제목이 있는 줄에만) | `&old=1` |
| 시대의 창 줄과 나란히 | 시대 줄(오디색 겹선 + 「시대의 창」 표지 12px 굵게 + 문장)은 그대로. 결정 줄의 제목(12px 보통·보조색)은 표지와 크기가 같지만 색·굵기·선이 달라 섞이지 않는다 | 17세·12세·7세 시대 줄 |
| 서술 이벤트 · 단계 · 나의 기록 | 바뀌지 않는다(제목을 그리지 않는다 — QF4 「바뀌지 않는 것」) | 7세 단계 줄 |
| 조르기 줄(SPEC-011 AK, 다음 배포) | 같은 부품 — 제목 / 「[아이콘] {조르기 도장}: 고른 길」 / 결과 | — |

## 4. 측정 (`log-question-measure.json`)

| 경우 | 지금 | 안 1 | 안 2 | 비고 |
|---|---|---|---|---|
| 360×740 · 결정 줄 17세(최신) / 15세 / 12세 / 9세 / 4세 | 127 / 153 / 153 / 179 / 204 | 147 / 172 / 172 / 198 / 223 | 170 / 173 / 170 / 195 / 221 | 글 칸 폭 228px. 안 2가 안 1보다 작은 줄도 있다(괄호 꼴의 둘째 줄이 사라져서) |
| 360 · 열 줄 목록 | 1265 | 1361 | 1378 | 시대 줄 3·단계 1·가린 줄 1 포함 |
| 360 · 가린 줄 접힘 / 펼침 | 113 / — | 113 / — | 113 / 237 | 접힘은 세 안이 같다 |
| 1280 · 결정 줄(가운데 열 536px, 글 칸 404px) | 76 / 102 / 102 / 102 / 127 | — | 122 / 122 / 122 / 122 / 147 | PC는 줄마다 +20(제목 한 줄), 최신 줄은 괄호가 같은 줄에 있던 터라 +46 |
| 360 · 글자 200% · 17세 줄 | — | — | 464 | 넘침 0, 겹침 0 — 세 줄 모두 낱말 단위로 접힌다 |
| 360 · 다크 | — | — | 제목 `rgb(196,191,178)` = `--c-text-2` | 대비 8.78:1 |

- 결정 줄은 한 판에 30~40줄쯤이라 인생 기록 전체는 안 2 기준 약 +600~800px(360)·+800px(1280) 길어진다. 영역은 `max-height 520px` 스크롤이라 화면은 커지지 않고, 보던 줄 위치 보정(`LogList.tsx`)은 줄 높이를 더하지 않고 실제 밀린 거리를 재므로 영향 없다.

## 5. 접근성

- 대비: 제목 8.65 / 8.78(2절). 고른 길·결과는 기존 조합 그대로.
- 색에만 의존하지 않는다: 결정자는 지금처럼 아이콘 + 도장 글자. 제목은 크기·굵기·위치(윗줄)로 구분된다 — 강제 색상에서도 같다.
- 낭독: 줄 목록은 `aria-live="polite" aria-relevant="additions"`라 새 줄 하나가 통째로 읽힌다 — 안 2는 「17세 입시를 앞둔 해 선택: … 원서를 내고 …」 순서라 질문 → 답 → 결과로 들린다. 제목 요소에 별도 `aria-label`·역할을 두지 않는다(글자 그대로가 이름).
- 가린 줄: 제목이 `.veil__body` 안이라 `hidden`과 함께 접근성 트리·찾기에서 빠진다(HV: 제목·본문·선택지·결과 모두 가림 대상). 펼침 버튼 이름 「펼쳐 보기 3세 건강」 그대로.
- 360 · 글자 200%: 가로 넘침 0(촬영 스크립트가 `scrollWidth > clientWidth`·화면 밖 요소를 전수 검사).
- 시험용 표지 제안: 제목 `data-testid="log-q"`(시안에 그렇게 달았다).

## 6. developer 인계 (안 2 기준 — 형진 님이 안 1을 고르면 ②의 쌓기·괄호 부분만 뺀다)

① **`dash.css`** 인생 기록 블록 `.log__text em` 아래에 2절의 CSS 두 줄.

② **`src/ui/dash/LogList.tsx#EntryText`** — 제목이 있는 결정 줄만 세 줄 쌓기, 나머지는 지금 그대로(diff 뼈대, 그대로 옮기지 말고 타입·린트에 맞춘다):

```tsx
function EntryText({ h, subject }: { h: HistoryEntry; subject: CoParents }) {
  // SPEC-012 QF4: 제목이 있는 결정 줄은 「사건 제목(작게) → 고른 길 → 결과」 세 줄. 제목 없는 옛 줄·서술 줄은 지금 모양
  const stacked = h.choice !== undefined && h.title !== undefined && h.title !== '';
  const pickText = h.by !== undefined ? `${decidedByText(h.by, subject)}: ${h.choice}` : `${DASH_TEXT.logChoicePrefix}${h.choice}`;
  const pick = h.choice ? (
    h.by !== undefined ? (
      <em className={`log__by log__by--${h.by}`} data-testid="log-by" data-by={h.by}>
        <Icon name={deciderIconOf(h.by)} className="icon--xs" />{stacked ? pickText : `(${pickText})`}
      </em>
    ) : (
      <em className={stacked ? 'log__pick' : undefined}>{stacked ? pickText : `(${pickText})`}</em>
    )
  ) : null;
  if (stacked) return (<><span className="log__q" data-testid="log-q">{h.title}</span>{pick}<span className="log__result">{h.text}</span></>);
  return (<>{h.text}{pick ? <> {pick}</> : null}</>);
}
```

- `render()`의 보통 줄: `<span className={`log__text${stacked ? ' log__text--q' : ''}`}>` — `stacked` 판정을 작은 도우미(`isStackedEntry(h)`)로 빼 두 곳이 같은 조건을 쓴다. 가린 줄의 `span.log__text.veil`은 `.veil__body`가 이미 flex column이라 그대로.
- `eventId`로 사건 풀을 조회하지 않는다(완료 기준 8 ⑥). `title`은 `life.ts#resolveChoiceCore`가 이미 저장한다.

③ **문구(`docs/design/copy.md`)** — designer가 확정 뒤 고친다: 62행 「선택 결과는 문장 뒤 괄호 「(선택: {선택지 이름})」」과 941행 「({표지}: {라벨})」 꼴은 **제목이 없는 줄에만** 남고, 제목이 있는 결정 줄은 「{제목} / {표지}: {라벨} / {결과}」 세 줄(엔딩 연표 12-2 「펼친 모양」과 같은 꼴). 12-2 표 「결정 줄의 표지」 행은 그대로(접힌 줄의 도장 낱말 꼴 불변).

④ **시험·e2e** — 괄호 꼴 글자를 단언하는 곳을 같은 변경에서 고친다(grep `(선택: |이렇게 정했습니다: |이렇게 흘러갔습니다: ` — `tests/logOrder.test.tsx`·`eraLog.test.tsx`·`parentCard.test.tsx`·`gentle.test.tsx`·`dashboard.test.tsx`, `e2e/log-order.spec.ts`·`gentle.spec.ts`·`parent-card-text.spec.ts` 등, developer가 확인). 새 단언: 제목 있는 결정 줄에 `[data-testid="log-q"]`가 있고 글자가 `title`과 같다 · 제목 없는 줄에는 없다 · 가린 줄은 접힘에서 `log-q`가 접근성 트리에 없고 펼치면 있다 · 서술 줄(`kind: 'event'`)에 `log-q` 0.

⑤ **`tests/designAssets.test.ts` 시안 계약(읽기만 했다 — developer 몫)**: 이 시안을 넣기 **전부터** 2개 단언이 실패한다(어제 `controls-compact.html` 때문). 지금 `npm test -- tests/designAssets.test.ts` 결과 2 failed / 86 passed:
  - 639행 「화면 시안 수 … toBe(13)」: 받은 값 **15**(controls-compact + log-question). 둘 다 수저 아이콘이 직접 나오지 않는 표본 장이라 638행 제외 정규식에 `|controls-compact|log-question`을 더하는 것이 맞다(note-rows·title-005-compare의 전례). 단, 640행의 「시안이 있고 수저 아이콘 없음」 목록에는 controls-compact를 넣을 수 없다(머리의 수저 칩 1개가 있다) — log-question만 넣는다. controls-compact를 화면 시안으로 세려면 13 → 14.
  - 1340행 「도구 줄이 있는 모든 시안」 목록: 받은 값에 `controls-compact.html`이 더 있다 — 목록에 더하거나 `btn--tool` glob에서 뺀다. log-question.html에는 도구 줄이 없어 이 단언과 무관하다.

⑥ 확정 뒤 `design-system.md`에 「결정 줄의 질문(v0.4.1)」 절(2절 표)과 16-1 측정표 갱신 — designer(QF8).

## 7. 형진 님이 정할 것

1. **안 2(제목 → 고른 길 → 결과) / 안 1(제목 윗줄만)** — 추천 안 2(0절). 안 2를 고르면 PC에서 결정 줄이 한 줄씩 길어진다(102 → 122px).
2. (선택) 제목 색을 더 물릴지 — 지금 제안은 `--c-text-2`(나이·고른 길과 같은 보조색). 더 흐리게 두고 싶으면 `--c-text-3`(출처용, 5.78:1)도 대비는 통과한다. 시안은 `--c-text-2`다.

## 8. 검사 기록 (design-taste-frontend)

- `inspect.mjs --app --widths 1280,360` 전(`?v=now` → `.taste-skill/012/log-question/before`)·후(`?v=2` → `…/after`): **0 FAIL · 2 WARN 같음**. `[palette-cream]`(확정 바탕 토큰 `--c-bg` #f9f7f2·`--c-surface` #fffdf8 — 규칙 9 예외) · `[unused-canvas]` @1280(표본 장이 3열 대시보드의 가운데 열 536px만 보여 양옆 382·213px이 빈다 — 실제 화면은 3열이라 해당 없음). 처음 검사에서 머리 없는 표본이라 `[no-title]` FAIL이 났고, 살아가기 화면 머리(h1 이름·나이·연도 줄, `controls-compact.html`과 같은 DOM)를 시안에 넣어 0 FAIL(시안이 실제 화면의 위쪽과 같아졌다). `--allow`는 쓰지 않았다.
- `lint.mjs --app docs/design/mockups/log-question.html`: 0 FAIL · 1 WARN `[em-dash]`(한국어 주석·설명의 줄표 — 규칙 10, 화면 글에는 없다). `src`는 손대지 않아 `lint.mjs --app src`는 돌리지 않았다.
- 촬영 스크립트: 뷰포트 7경우 × 변형 넘침 0, PNG 4장 모두 ≤ 300 KB(282 · 220 · 235 · 126).
- 전·후 그림은 `docs/design/screens/012/log-question-360.png`(지금 = 전, 안 2 = 후)·`log-question-pc.png`이고 `.taste-skill/`은 저장소에 올리지 않는다.
