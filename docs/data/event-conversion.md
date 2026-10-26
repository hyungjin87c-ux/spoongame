# SPEC-004 GM1 설계 문서 A-2 — 지금 이벤트 140개 전환표 (`yearRange` 33개 · `track` 59개)

- 상태: **초안 r0 (마스터 승인 전)**. SPEC·`src/`·`src/data/events/*.json`을 고치지 않았다. 마스터가 승인한 뒤 developer가 MG2(GM4·GM10)에서 이 표대로 JSON을 바꾼다. reviewer는 33개 `yearRange`를 판독한다(GM0 마스터 결정 5).
- 작성: planner (GM1 설계 문서 A). 날짜 2026-10-27. 기록: `ai-log/2026-10-27_SPEC-004_spec-GM1A.md`.
- 근거: `docs/data/spec-004-baseline.md` 1절(후보 칸, 시대 제한 33개의 운명)·2절(정석 코스 59개)·마스터 결정 5 · SPEC-004 MG2·TL11·AL3·AL9 · `src/data/events/*.json` 5개 파일 전체(이벤트 140개: 영유아 35·학창 26·청년 31·중년 25·노년 23) · `src/core/eventLint.ts`(지금 시대 소재 목록) · `docs/data/timeline-schema.md` 7절(`WORD_YEARS`).
- 표기: **▲** 설계값. **확인 필요** = 웹을 열지 않아 사실 연도를 확인하지 못했다(제도·기술 연도는 일반 지식 수준이며 DC1·DC9·DC14가 확인한다). **C-번호** = 마스터가 정할 것(끝 12절).
- 한계: 명령 실행 도구가 없어 `baseline004.ts`를 다시 돌리지 못했다. 후보 칸에 주는 영향(6절)은 손계산·정성 판단이고, 재측정 절차와 합격 기준을 적었다.

## 1. 한눈에

| 항목 | 값 |
|---|---|
| 이벤트 | 140개(결정 90 + 서술 50). id·선택지 id는 바꾸지 않는다 |
| `yearRange`가 붙는 이벤트 | 33개(지금 시대 제한이 있던 것). 나머지 107개는 `yearRange` 없음(전 연도) |
| 주 규칙(GM0 결정 5) | 달력 연도 2000 기준: 지난 ≤ 2000 / 지금 ≥ 2001 / 다가올 ≥ 2026 |
| 주 규칙과 다르게 확정한 것 | **10개**(영유아 7 · 학창 2 · 중년 1) — 모두 본문 소재가 제도·기술 연도에 걸린 경우. 나머지 23개는 주 규칙 그대로 |
| 고아 2개 | `infant-care-alert` → 2016년 이후 · `infant-talking-toy` → 2023년 이후 (기술이 있는 연도) |
| 글자 그대로(L) 어느 세대에도 후보가 아니던 22개 | 주 규칙으로 20개가 살아나고(baseline 1-5), 남은 고아 2개를 기술 연도로 살려 **후보 없는 이벤트 0개** |
| `track` | 140개 모두에 단다. `standard` **17개** · `common` **123개** · `assembled` 0개(기존 이벤트에는 없음, 알파 신규 전용) |
| 정석 코스 59개의 분류 | `standard` 17(알파 변형 15 + 닫음 2) · `common` 42 |
| AL9 「알파용 대체 변형 ≥ 15▲」 | 변형 후보 **15** — 딱 하한이다. 여유가 0이므로 더 얹을 후보를 8절에 적었다 |
| 후보 칸 영향 | 주 규칙 R(2000)에 비해 알파 영유아의 소재가 늘고(고아 2개 + `infant-heat-day` 확대) Z 앞쪽·밀레니얼 끝·1940년대생 영유아의 소재가 줄며, 청년·중년·노년은 사실상 같다. 56칸 중 「모든 나이 ≥ 4」 43칸 유지가 합격 기준(6절) |
| 변환으로 안 풀리는 얇은 칸 | 어린이 8~9세 Z·알파·밀레니얼 · 19~21세 · 65세 · 96~100세 · 장년·노년 시대색 — 신규 작성 필요(7절) |

## 2. `yearRange`의 뜻과 변환 규칙

### 2-1. 형식

```json
{ "id": "infant-screen", "...": "...", "yearRange": { "from": 2010 }, "track": "common" }
```

- `yearRange: { from?: number, to?: number }` — **달력 연도(= 출생 연도 + 나이)** 가 `[from, to]` 안(닫힌 구간)일 때만 그 해의 후보가 된다. 한쪽이 없으면 열려 있다. `yearRange`가 없으면 모든 연도.
- 값은 데이터에만 있다(저장 대상 아님, MG2). 변환이 끝나면 `eras` 필드는 지운다(MG3). 이벤트 id·선택지 id·본문은 이 변환에서 **바꾸지 않는다**(SPEC-003 규칙 23).
- 출생 연도 1940 이후라서 `from`이 없는 이벤트도 **유효 연도 범위**는 `max(from, 1940 + 최소 나이)`부터다. 예) 노년 전용 이벤트(66세~)는 유효 범위가 2006년 이후다.

### 2-2. 주 규칙: `eras` 조합 → `yearRange` (GM0 결정 5, 기준 연도 2000)

| 지금의 `eras` | 주 규칙 `yearRange` | 해당 이벤트 수 |
|---|---|---:|
| `["past"]` | `{ to: 2000 }` | 10 |
| `["present"]` | `{ from: 2001 }` | 6 |
| `["future"]` | `{ from: 2026 }` | 7 |
| `["present","future"]` | `{ from: 2001 }` | 9 |
| `["past","present"]` | 없음(전 연도) | 1 |
| 없음 | 없음 | 107 |

`present`만 있는 6개에 **위쪽 끝(2025)을 두지 않는다**: 주 규칙 R은 「지금 = ≥ 2001」이고 GM0 기준선이 그 위에서 쟀기 때문이다. 이 6개는 전망 구간(2026~)에도 열린다 — 상한을 둘지는 C-01. `["past","present"]`(`youth-military`)도 같은 이유로 전 연도.

### 2-3. 이벤트별로 주 규칙을 고치는 기준

1. **제도·기술·사회 현상에 연도 근거가 있고 본문 소재가 그것에 기대면** 그 연도로 좁힌다(근거 열에 쓴다). 근거가 약하면 주 규칙을 쓰고 「더 늦을 수 있음 — 확인 필요」를 적는다.
2. 본문 낱말이 `WORD_YEARS`(timeline-schema.md 7절)에 있으면 **그 낱말의 `[처음, 마지막]`이 이벤트의 유효 연도 범위를 포함**해야 한다(TL11). 이 표의 모든 값은 그 포함 관계를 이미 만족하게 맞췄다(4절 「낱말 대조」 열).
3. **인용(citation) 때문에 `yearRange`를 좁히지 않는다.** 인용은 기준 연도 ≤ 카드의 해일 때만 보이는 규칙(MG4)이 따로 있다.
4. 다른 사건의 **연표 줄과 같은 소재를 되풀이하지 않는다**(예: 2020~2022 실제 원격수업은 연표 H-S14·H-E18 변형이 맡는다).

## 3. 연도별 변화가 후보에 주는 뜻 (요약)

주 규칙 R과 다른 10개를 아래 표에 먼저 모았다. 「확정」 열이 4절 표의 값이다.

| id | 주 규칙 | 확정 | 바뀌는 칸 |
|---|---|---|---|
| infant-screen | ≥ 2001 | **≥ 2010** | 2001~2009 영유아(Z 앞쪽, 밀레니얼 1995~96년생)에게서 빠진다 |
| infant-village | ≤ 2000 | **≤ 1995** | 밀레니얼 1990~96년생 일부와 Z 1997~99년생에게서 빠진다 |
| infant-checkup | ≥ 2001 | **≥ 2008** | 2001~2007 영유아(Z 2001~04년생)에게서 빠진다 |
| infant-care-alert | 후보 없음 | **≥ 2016** | 알파 2014~2020년생 영유아에게 열린다 |
| infant-coal-winter | ≤ 2000 | **1955 ~ 1989** | 1940~49년생(1941~54년의 영유아)과 1985~99년생에게서 빠진다 |
| infant-talking-toy | 후보 없음 | **≥ 2023** | 알파 2018~2020년생 영유아에게 열린다 |
| infant-heat-day | 알파 2026 한 해 | **≥ 2018** | 알파 전 출생 연도 + Z 2012년생에게 열린다 |
| school-lunch | ≤ 2000 | **≤ 1998** | 1999~2000년의 8~16세(밀레니얼 1983~92년생 일부)에게서 빠진다 |
| school-chat-room | ≥ 2001 | **≥ 2010** | 밀레니얼 후반(1984~96년생)·Z 1997년생의 12~17세에서 빠진다 |
| middle-remote-work | ≥ 2001 | **≥ 2020** | 2001~2019년의 42~58세(1943~77년생: 베이비붐·86·X 앞쪽, 장년 55~58세 포함)에게서 빠진다 |

## 4. 시대 제한 33개의 `yearRange` 확정표

`—` = 열림(1940 또는 ∞). 「낱말 대조」는 본문·선택지 안의 `WORD_YEARS` 낱말과 그 범위(포함 관계 OK = ✓)다. 「주 규칙」과 다른 줄은 **굵게**.

### 4-1. 영유아 (13)

| id | 나이 | 원 eras | 소재 | **확정 `yearRange`** | 이유 | 낱말 대조 | 확인 필요 |
|---|---|---|---|---|---|---|---|
| infant-screen | 2~6 | present, future | 어른 손에 들린 화면 | **[2010, —]** | 손에 드는 기기 소재라 스마트폰 보급(H-C09 2009~12)을 따른다. 주 규칙(2001)이면 2001~2009 영유아가 「손에 들린 화면」을 보게 된다 | `손에 들린 화면`(2009) ✓ · `화면`(2001) ✓ | 스마트폰 일상 소재 연도(DC14) |
| infant-village | 1~6 | past | 문이 열려 있던 골목에서 이 집 저 집의 밥을 나눠 먹는 아이 | **[—, 1995]** | 아파트 단지 입주가 확산된 1기 신도시 시기(H-E05 1989~96) 이후에는 흔한 일상에서 물러난다. 주 규칙(2000)이면 Z 앞쪽(1997~99년생)에게 어색하게 열린다(baseline 1-5) | 해당 낱말 없음 | 주택 유형 통계(통계청) — 더 늦을 수 있음 |
| infant-checkup | 0~3 | present, future | 영유아 건강검진 | **[2008, —]** | 영유아 건강검진 제도가 2007년 말에 시작된 것으로 알려져 첫 온전한 해인 2008부터 | 해당 낱말 없음(「건강검진」은 표에 없음) | 제도 시행 연도(국민건강보험법·보건복지부, DC1) |
| infant-parental-leave | 0 | present | 누가 일을 쉬고 아이를 돌볼 것인가 | [2001, —] | 주 규칙 유지. 육아휴직 **급여**가 고용보험에서 나오기 시작한 2001년이 「쉴 수 있는 선택」이 현실이 된 해로 알려져 있다 | 「육아휴직」 낱말은 본문에 없음. 낱말 자체는 1988 ✓ | 급여 시작 연도(고용노동부) |
| infant-care-alert | 0~2 | future | 아이 곁의 돌봄 기계가 밤새 숨소리를 살핌 | **[2016, —]** (고아 해소) | 영유아 호흡·움직임을 감지하는 소비자 기기가 쓰이기 시작한 시기로 잡았다. 알파 2014~2020년생이 0~2세인 2016~2022년에 열린다 | `돌봄 기계`(2016) ✓ | **근거 약함** — 공식 통계가 없는 소비 제품이다. 확인 못 하면 reviewer 판독으로 설계값(▲) 표기 |
| infant-daycare-wait | 1~2 | present | 어린이집 대기 | [2001, —] | 주 규칙 유지. 어린이집(1991~)과 입소 대기가 사회 문제로 불거진 시기는 2000년대로 본다 | `어린이집`(1991) ✓ · `돌봄 도우미`(2001) ✓ | 대기 문제의 시작 연도(보건복지부) — 더 늦을 수 있음 |
| infant-coal-winter | 1~5 | past | 겨울밤 아랫목, 꺼지지 않게 번갈아 일어나는 연탄불 | **[1955, 1989]** | 연탄은 전후 도시에 퍼졌고 1980년대 말까지 가정 난방 연료였다. 주 규칙(≤ 2000)이면 1990년대 영유아에게 어색하다 | `연탄`·`아랫목`(마지막 1989) ✓ | 주택총조사 난방 연료(통계청) — **양끝 모두 ▲** |
| infant-market-day | 2~6 | past | 장날의 손, 장터 | [—, 2000] | 주 규칙 유지(장날 자체는 지금도 있으나 이 소재는 장터 중심 생활 기준) | `장터`(마지막 2000) ✓ | – |
| infant-talking-toy | 3~5 | future | 인공지능이 든 말하는 인형 | **[2023, —]** (고아 해소) | 대화형 인공지능이 일상으로 퍼진 시기(H-C12 2022~2025)의 첫 온전한 해. 알파 2018~2020년생이 3~5세인 2023~2025년에 열린다 | `인공지능`(2016) ✓ | 대화형 인공지능 확산 연도(DC1) |
| infant-heat-day | 2~6 | future | 한낮의 더위에 놀이터에 나가지 못함 | **[2018, —]** | 2018년은 폭염이 기록적이었던 해로 알려져 그 해부터 연다. 주 규칙(2026)이면 알파 2020년생 한 해뿐 | 해당 낱말 없음 | 폭염일수·폭염 재난 기록(기상청) |
| infant-noise | 2~6 | present | 이웃의 항의(아이가 뛰는 소리) | [2001, —] | 주 규칙 유지. 공동주택 층간소음이 사회 문제가 된 시기 | 「층간소음」 낱말은 본문에 없음. 낱말은 2000 ✓ | 사회 문제화 시점 |
| infant-kindergarten | 3~4 | present, future | 유치원 고르기 | [2001, —] | 주 규칙 유지. 선택지가 갈린 시기는 더 이를 수 있으나 `infant-village` 등과의 균형상 유지 | 해당 낱말 없음 | 유치원 취원율(교육부) — 확인되면 `from`을 낮출 수 있음 |
| infant-early-lessons | 5~6 | present, future | 취학 전의 시간표(학습지·영어 유치원) | [2001, —] | 주 규칙 유지 | `학습지`(1980) ✓ · `영어 유치원`(1998) ✓ | – |

### 4-2. 학창 (10)

| id | 나이 | 원 eras | 소재 | **확정 `yearRange`** | 이유 | 낱말 대조 | 확인 필요 |
|---|---|---|---|---|---|---|---|
| school-lunch | 8~16 | past | 각자의 점심(도시락) | **[—, 1998]** | 초등 전면 급식(1998)이 시작되면 「각자 도시락」이 흔한 풍경에서 빠진다. 가장 어린 나이(8세)를 기준으로 했다 | 해당 낱말 없음(「급식」 아님) | 급식 시행 연도(교육부) — 중·고교는 더 늦다 |
| school-early-work | 13~16 | past | 집안 형편이 어려워 학교를 쉬고 일을 돕는 아이 | [—, 2000] | 주 규칙 유지(1997~98 위기까지 포함) | 해당 낱말 없음 | 중·고교 진학률(교육부) |
| school-academy-night | 11~18 | present, future | 늦은 밤의 학원가 | [2001, —] | 주 규칙 유지. 과외 금지 해제(2000, H-S04) 이후의 풍경 | `학원`(2001) ✓ | – |
| school-family-priority | 12~17 | past | 형제가 많은 집, 누가 어디까지 공부할지 | [—, 2000] | 주 규칙 유지(`birthOrder ≥ 2` 조건이 이미 형제 수를 따진다) | 해당 낱말 없음 | – |
| school-chat-room | 12~17 | present, future | 단체 대화방 | **[2010, —]** | 모바일 메신저 단체 대화방은 스마트폰 보급(H-C09 2009~12) 이후. 주 규칙(2001)이면 밀레니얼 후반이 「밤마다 울리던 화면」을 보게 된다 | `단체 대화방`(2010) ✓ · `대화방`(1994) ✓ · `화면`(2001) ✓ | 모바일 메신저 보급(DC14) |
| school-long-walk | 8~13 | past | 먼 등굣길 | [—, 2000] | 주 규칙 유지 | 해당 낱말 없음 | – |
| school-academy-talk | 10~16 | present | 학원 이야기로 시작하는 대화 | [2001, —] | 주 규칙 유지 | `학원`(2001) ✓ | – |
| school-virtual-class | 8~15 | future | 화면 속의 교실 | [2026, —] | 주 규칙 유지. 2020~2022의 실제 원격수업은 연표 H-S14·H-E18 변형이 맡아 **중복을 피한다**. 이 이벤트는 전망 구간의 상시 원격·혼합 수업 소재 | `화면 속 교실`(2020) ✓ · `화면`(2001) ✓ | 2020 대안은 C-06 |
| school-after-hours | 7 | present, future | 학교가 끝난 뒤(돌봄 시간) | [2001, —] | 주 규칙 유지. 「학교 안 돌봄」 선택지의 도입 시기는 더 늦을 수 있다 | `학원`(2001) ✓ | 학교 안 돌봄 도입 연도(교육부, DC1) — 확인되면 `from`을 올린다 |
| school-first-walk | 7 | past | 처음 걷는 등굣길 | [—, 2000] | 주 규칙 유지 | 해당 낱말 없음 | – |

### 4-3. 청년 (6) · 중년 (3) · 노년 (1)

| id | 나이 | 원 eras | 소재 | **확정 `yearRange`** | 이유 | 낱말 대조 | 확인 필요 |
|---|---|---|---|---|---|---|---|
| youth-military | 20~24 | past, present | 정해진 날짜에 입영 | 없음(전 연도) | 주 규칙(과거 ∪ 지금 = 전 연도). 원래의 「다가올 세상 제외」는 전망 구간을 어떻게 볼지의 문제 | 해당 낱말 없음 | C-02 |
| youth-matchmaker | 23~34 | past | 어른들이 마련한 맞선 자리 | [—, 2000] | 주 규칙 유지 | `맞선`(마지막 2000) ✓ | – |
| youth-rent-hike | 24~38 | present | 오르는 월세 | [2001, —] | 주 규칙 유지 | 해당 낱말 없음 | – |
| youth-gig-work | 21~32 | present, future | 쪼개진 일자리 | [2001, —] | 주 규칙 유지. 본문에 `WORD_YEARS` 낱말(플랫폼·앱)이 없다. 플랫폼 노동의 확산(H-E17 2018~)은 연표 줄이 맡는다 | 해당 낱말 없음 | – |
| youth-machine-partner | 24~38 | future | 일을 나누는 새 동료(기계) | [2026, —] | 주 규칙 유지. 2022~25의 업무용 인공지능은 H-C12 연표 줄과 겹치지 않게 전망 구간으로 둔다 | 「기계」는 표에 없음 | – |
| youth-factory-night | 20~28 | past | 멈추지 않는 기계, 밤샘 근무 | [—, 2000] | 주 규칙 유지 | 해당 낱말 없음 | – |
| middle-new-skills | 40~55 | future | 하던 일의 상당 부분을 기계가 대신 | [2026, —] | 주 규칙 유지 | `기계가 대신`(2023) ✓ · `화면`(2001) ✓ | – |
| middle-remote-work | 42~58 | present, future | 집이 일터가 된 날들 | **[2020, —]** | 재택·원격 근무가 퍼진 것은 코로나19 시기(H-E18 2020~23). 주 규칙(2001)이면 2001~2019년 40~50대가 「출퇴근이 사라진」 일을 하게 된다 | 본문에 표의 낱말 없음(`재택근무` 2020 ✓) | 재택근무 확산 연도(고용노동부) |
| middle-both-working | 40~54 | present | 부부가 모두 일하며 아이를 키워 낸 시간 | [2001, —] | 주 규칙 유지 | 해당 낱말 없음 | – |
| senior-long-life | 72~95 | future | 생각보다 오래 사는 세상 | [2026, —] | 주 규칙 유지(기대수명 전망 구간) | 해당 낱말 없음 | – |

### 4-4. 낱말 대조 요약

- 33개 모두 `WORD_YEARS` 포함 관계를 만족한다. 한 번 어긋났다가 맞춘 곳: `infant-daycare-wait`의 「돌봄 도우미」 — 낱말 처음을 2007로 두면 이벤트 시작(2001)과 어긋나 일반 명사 기준 2001로 둔다(근거 약함 — timeline-schema.md 7절에 확인 필요 표시).
- `yearRange`가 없는 이벤트 107개는 지금 lint가 이미 모든 시대의 금지어를 피하게 하므로, `WORD_YEARS` 번역 뒤에도 같은 낱말 제약을 받는다. 노년 전용·중년 전용처럼 최소 나이가 큰 이벤트의 **유효 연도 범위**가 2005 이후 또는 1980 이후라서 일부 낱말이 이전보다 넓게 허용되나, 현재 데이터에는 해당 낱말이 없다(스마트폰·인터넷·휴대전화 등을 `src/data/events`에서 검색해 0건).

## 5. 고아 2개의 처리

`infant-care-alert`(곁을 지키는 기계)·`infant-talking-toy`(말을 받아 주는 인형)는 알파가 2013~2020년생이라 달력 2026년 이후 영유아가 없어 어떤 규칙으로도 후보가 없었다(baseline 1-5). GM0 결정 5에 따라 **기술이 있는 연도로 `yearRange`를 준다**.

| id | `yearRange` | 열리는 세대·출생 연도 | 상태 |
|---|---|---|---|
| infant-care-alert | `{ from: 2016 }` | 알파 2014~2020 (0~2세가 2016~2022) | 근거 약함 — 확인 필요 |
| infant-talking-toy | `{ from: 2023 }` | 알파 2018~2020 (3~5세가 2023~2025) | 연표 H-C12와 같은 시기 — 확인 필요 |

본문은 바꾸지 않는다(「돌봄 기계」「인공지능이 들어 있어 … 대답했습니다」). 근거를 끝내 못 찾으면 제목·소재를 일반 명사로 조정할지 reviewer가 판독한다(C-03).

## 6. 후보 칸에 주는 영향과 재점검 절차

### 6-1. 방향 (손계산·정성)

- 주 규칙 R(2000)을 기준선(baseline 1-2절: 56칸 중 43칸이 모든 나이 ≥ 4, 빈 나이 0칸)으로 삼고 10개 이벤트만 달라진다(3절). 청년·중년·노년에는 영향이 거의 없다(`middle-remote-work`가 장년 55~58세의 2001~2019년 후보를 1개 줄인다 — 장년 칸 최소 후보 5가 4가 될 수 있음, 여전히 ≥ 4).
- 영유아는 **양쪽으로 움직인다**: 고아 3개(`care-alert`·`talking-toy`·`heat-day` 확대)가 알파 영유아에게 열리고, `screen`·`checkup`·`village`·`coal-winter`가 Z 앞쪽·밀레니얼 끝·1940년대생 영유아에게서 빠진다. 1940~49년생 영유아(이미 얇은 칸, baseline 1-6의 2순위)는 `coal-winter`를 잃어 연표 후보와 소재가 더 필요해진다.
- 8~9세(Z·알파)의 후보 2~3개는 **그대로**다. 이 칸을 채우는 `school-lunch`·`school-long-walk`(지난)은 닫혀 있고 `school-virtual-class`는 2026년 이후에만 열린다(C-06).

### 6-2. 재측정 절차와 합격 기준 (developer, GM4~GM10에서)

1. `scripts/baseline004Lib.ts`의 규칙 R을 이 문서 4절의 `yearRange` 표로 바꿔 `baseline004.ts cells`를 다시 돌린다.
2. 합격: (a) 56칸 중 「모든 나이 ≥ 4」인 칸 수가 **43 이상**(기준선과 같거나 많다) (b) 후보 0인 나이가 0칸 유지 (c) 영유아 × 모든 세대 칸의 최소 후보 ≥ 4 (d) 본문 낱말의 `WORD_YEARS` 포함 위반 0 (e) 33개 중 `yearRange`가 비어 있거나 `from > to`인 것 0.
3. 4 미만으로 남는 칸(7절)은 신규 작성 목록으로 문서화한다(MG2).

## 7. 변환으로 해결되지 않는 얇은 칸 — 신규 작성 필요

baseline 1-6의 칸 중 이 변환이 건드리지 않는 것을 신규 이벤트(처음부터 `yearRange`·`track`을 달아 작성, TL11)로 채운다. 소재 창고 요청은 baseline 마스터 결정 6(노년기·1940~50년대 어린 시절·영유아기 부모 시점·Z·알파 초등 시기·20세 전후)이 맡는다.

| 칸 | 지금 후보 | 필요한 것 |
|---|---|---|
| 어린이 8~9세 × Z·알파(밀레니얼 1990년대생) | 2~3 | 2004~2032년 초등 시기의 **실제 연도** 일반 이벤트 3~4개 (`track: common`, `yearRange` 2004~) |
| 19~21세 × 전 세대 | 4~7 | 졸업·성년 첫해 이벤트 (`common`) |
| 65세 | 1 (`senior-retire` 하나) | 은퇴 의례 말고 65세에 열리는 이벤트 — 알파 판은 `senior-retire`를 닫으므로 **알파는 65세 후보 0**이 된다. `assembled` 신규 필요 |
| 96~100세 | 2~4 | 초고령 이벤트 |
| 영유아 × 1940~44년 | 연표 후보 0 | 전쟁 전후 영유아 이벤트 (`yearRange` 1940~1955) |
| 장년·노년 × 전 세대 (시대색 ≤ 0.7) | 0.3~0.7 | `common` 일반 이벤트 + 연표 장년·노년 변형 |

## 8. 정석 코스 59개의 `track` 표지

### 8-1. 기준

`track`은 **알파 판에서의 취급**을 정한다(AL3). 그 밖의 세대에서는 `standard`·`common` 모두 지금처럼 나온다.

- **`standard`**: 정석 코스의 순서를 전제하거나 문(플래그)을 여는 이벤트. 알파 판에서는 (a) **알파용 변형**(문장·조건을 바꾼 짝)으로 대체하거나 (b) **닫는다**. 판정 기준(하나라도 해당):
  - S1 입직·진학의 단선 경로: 입시 → `college`, 첫 직장 → `has_career`, 시험 준비·합격·불합격
  - S2 결혼·출산 순서: 「식」「함께 살기」, 아이를 `married`에 묶는 조건
  - S3 내 집 마련 목표: 자가를 목표로 하는 선택지, `married` 배제 조건
  - S4 은퇴 의례: 정년·내려놓을 때
  - S5 직급 사다리: 조직을 이끄는 자리 제안
- **`common`**: 순서를 전제하지 않는 이벤트. 알파 판에서도 그대로 나온다. 정석 코스 목록(baseline 2절)에 있어도 아이의 입학 의례, 일 축·관계 축·돌봄 축의 **안쪽 사건**(직장 갈등, 연애, 이별, 자녀 양육, 사업, 실직, 월세 인상)은 `common`이다. 결혼·자녀·일터 낱말이 나오는 `common` 이벤트는 해당 상태 플래그를 이미 요구한다(상태 어휘 규칙).
- `assembled`(알파 전용)는 기존 이벤트에 없다. 알파 신규 이벤트(AL9 ≥ 30▲)가 이 값을 가진다.

알파 판이 켜 줘야 하는 **문 플래그**(`common` 이벤트가 기대는 것)는 8-4절에 적었다 — 문서 B의 생애 보드 ↔ 플래그 대응표와 맞출 항목이다.

### 8-2. `standard` 17개 (알파 변형 15 · 닫음 2)

| id | 단계·나이 | 문 | 코드 | 알파 처리 | 변형 방향 / 닫는 이유 |
|---|---|---|---|---|---|
| school-exam | 학창 16~19 | 켜는: `college`, `early_work` | S1 | 변형 | 배움 축 전환점(정규 과정 / 독학·프로젝트 / 일 먼저). 같은 플래그를 켜서 뒤 사슬을 잇는다 |
| youth-first-job | 청년 22~32 | 켜는: `has_career` (+ `family_business`) | S1 | 변형 | 일 축 첫 전환점(고용 1곳 / 프로젝트·N잡 / 창작·창업). 「월급날이 일정한 곳」 문구를 조립형 문장으로 |
| youth-exam-prep | 청년 21~30 | 켜는: `exam_prep`, `has_career` | S1 | 변형 | 배움 축 「독학·수험」 — 자격·역량 인증 준비 |
| youth-exam-passed | 청년 23~38 | 기대는: `exam_prep` → 켜는: `has_career`, `passed_exam` | S1 | 변형 | prep 변형의 짝 |
| youth-exam-failed | 청년 23~38 | 기대는: `exam_prep` | S1 | 변형 | prep 변형의 짝 |
| middle-career-peak | 중년 40~52 | 기대는: `has_career` | S5 | 변형 | 「조직을 이끄는 자리」 → 프로젝트·팀을 이끄는 자리(일 축) |
| youth-marriage | 청년·중년 27~45 | 기대는: `has_partner` → 켜는: `married` | S2 | 변형 | 관계 축(동거·파트너 / 결혼). 「식을 올리고」 문장 교체 |
| youth-marriage-again | 청년·중년 30~48 | 기대는: `has_partner`, `marriage_waited` | S2 | 변형 | 위의 짝 |
| youth-second-chance | 청년·중년 26~56 | 기대는: `has_partner`, `reunited` | S2 | 변형 | 위의 짝 |
| youth-child | 청년 27~39 | 기대는: **`married`** → 켜는: `has_child` | S2 | 변형 | 돌봄 축(자녀) 선행 조건을 `married`에서 관계 축 상태로 바꾼다(AL2 (a): 자녀 돌봄은 자녀 플래그가 물리적 필요, 결혼은 아님) |
| youth-child-again | 청년·중년 33~44 | 기대는: **`married`**, `child_postponed` | S2 | 변형 | 위의 짝 |
| youth-housing | 청년 22~36 | 기대는(배제): `own_home`, **`married`** → 켜는: `renting`, `lives_with_parents`, `own_home` | S3 | 변형 | 거처 축 전환점(부모 집 / 공유·단기 / 이동 거주 / 임차 장기 / 자가). 「빚을 내서라도 집을 마련」은 선택지의 하나일 뿐 |
| middle-home-loan | 중년 40~55 | 켜는: `own_home` | S3 | 변형 | 거처 축(옮김·줄임·머묾). 자가 이동을 목표로 쓰지 않음 |
| middle-retirement-prep | 중년 55~64 | – | S4 | 변형 | AL7 점진적 은퇴 준비(일을 줄이고 재교육·돌봄·건강으로) |
| senior-retire | 노년 65~70 | – | S4 | 변형(대체) | 「일을 내려놓는 날」 닫고 「일을 줄여 가는」 `assembled` 신규가 대신한다. 그 신규가 AL9의 15번째 변형이다 |
| middle-both-working | 중년 40~54 | 기대는: `married`, `has_child`, `has_career` | S2 | 닫음 | 「부부가 모두 일하며 아이를 키워 낸」 문장이 정석 순서 전제. `{ from: 2001 }`이라 알파 40~54세(2053~)에 전망 구간이 된다 |
| youth-matchmaker | 청년 23~34 | 켜는: `has_partner`, `met_intro` | S2 | 닫음 | 어른이 마련한 맞선. `{ to: 2000 }`이라 알파에는 이미 닫혀 있다(표지만 `standard`) |

변형 15(S1 5 · S5 1 · S2 5 · S3 2 · S4 2) + 닫음 2 = 17. AL9의 「알파용 대체 변형 ≥ 15▲」는 **정확히 하한**이다. 여유를 두려면 아래 후보를 `common` → `standard`로 올려 변형을 쓰는 안이 있다(C-04): `middle-layoff`(「정리 대상」이 공채 조직 전제), `youth-startup`·`middle-business`(알파는 창업이 일 축 상태라 변형 없이 가능 — 비추천), `senior-spouse-care`·`middle-marriage-crisis`(`married` 요구 — 관계 축 대응표가 정하면 불필요).

### 8-3. `common` 42개 (정석 코스 목록에 있으나 알파에도 그대로)

| 구분 | id |
|---|---|
| 입학·돌봄 의례 (6) | infant-kindergarten · school-first-day · school-supplies · school-first-walk · school-after-hours · school-career-choice |
| 군 복무 (1) | youth-military |
| 일 축 안쪽 (14) | youth-gig-work · youth-startup · middle-business · middle-layoff · middle-job-again · youth-work-pressure · youth-colleague · youth-workplace-romance · youth-machine-partner · youth-job-rejections · youth-factory-night · middle-new-skills · middle-remote-work · middle-own-shop-year |
| 관계 축 안쪽 (11) | youth-meeting · youth-approached · youth-reunion · youth-meeting-again · middle-marriage-crisis · youth-partner-leaves · youth-lonely-city · youth-single-years · middle-lonely-holiday · senior-spouse-care · senior-alone |
| 돌봄 축·노년 (자녀·손주·거처 이동) (9) | middle-child-grows · middle-child-school · middle-child-leaves · middle-late-child · senior-gathering · senior-grandchildren · senior-move-home · senior-estranged-child · senior-grandchild-visit |
| 거처 축 (1) | youth-rent-hike |

6 + 1 + 14 + 11 + 9 + 1 = 42. (`school-career-choice`는 알파의 학창기 「진로 탐색」 씨앗(AL1)이라 `common` 그대로 쓴다.)

### 8-4. 알파 판이 켜 줘야 하는 문 플래그 (문서 B 대응표와 맞출 항목)

`common` 이벤트와 알파 변형이 서로 이어지려면 알파의 생애 보드 상태가 아래 플래그를 켜야 한다. 이 문서는 플래그 이름만 고정하고, 어느 보드 상태가 어느 플래그를 켜는지는 문서 B가 정한다.

| 플래그 | 이것에 기대는 `common` 이벤트 | 켜는 `standard`(알파 변형이 같은 플래그를 켠다) |
|---|---|---|
| `has_career` | youth-work-pressure · youth-colleague · youth-workplace-romance · youth-machine-partner · middle-new-skills · middle-remote-work · middle-business · middle-layoff | youth-first-job · youth-exam-prep/passed |
| `own_business` | middle-own-shop-year | (common이 켬: youth-startup · middle-business) |
| `has_partner` · `married` | middle-marriage-crisis · senior-spouse-care · youth-partner-leaves · (notFlags) youth-meeting 계열 | youth-marriage 계열 |
| `has_child` | middle-child-* · senior-gathering/grandchildren/estranged-child/grandchild-visit | youth-child 계열 |
| `renting` · `own_home` · `lives_with_parents` | youth-rent-hike | youth-housing · middle-home-loan |

## 9. 나머지 `common` 81개 (정석 코스 목록 밖)

정석 코스 59개를 뺀 81개는 모두 `common`이다. 이 중 `yearRange`가 붙은 것은 4-1~4-3의 영유아·학창 일부(`infant-village`·`infant-checkup`·`infant-care-alert`·`infant-daycare-wait`·`infant-coal-winter`·`infant-market-day`·`infant-talking-toy`·`infant-heat-day`·`infant-noise`·`infant-screen`·`infant-parental-leave`·`infant-early-lessons`, `school-lunch`·`school-early-work`·`school-academy-night`·`school-family-priority`·`school-chat-room`·`school-long-walk`·`school-academy-talk`·`school-virtual-class` 등)다. 전체 한 줄 표는 부록에 있다.

## 10. `yearRange` 없는 107개의 점검 관찰 (참고 — 변환 대상 아님)

범위가 없는 이벤트도 연표가 생기면 **그 해의 사실과 어긋나는 선택지**가 보일 수 있다. 읽다가 눈에 띈 것만 적는다(전수 점검이 아니다). 처리는 `WORD_YEARS` lint가 걸리는지 먼저 보고, 걸리지 않으면 그대로 둔다.

| id | 관찰 |
|---|---|
| school-tutoring | 선택지 「과외 선생님을 붙인다」(`tutor`)가 1980~1999년(과외 금지, H-S04)에 열린다. 연표 H-S04 변형과 어긋난다. 선택지를 `requires`로 연도 제한할지, 라벨을 「집으로 오는 선생님」으로 바꿀지 reviewer가 판독(선택지 id는 바꾸지 않음) |
| school-parttime | 16~19세의 주말 일 — 1950~60년대 학창기에 어울리는지(고학·가게 일 소재는 있다) 판독. 문구는 「주말에 일을 해 볼 곳」이라 일반적 |
| youth-night-study | 「낮에는 일하고 밤에는 배울 수 있는 길」 — 야간 과정이 흔했던 시기를 가정. 문구는 일반적이라 그대로 가능 |

## 11. 변환 시험·단언 (MG2)

1. 140개 모두 `track`이 있고 값은 `standard`/`common`/`assembled` 중 하나다(`tests/events.test.ts`).
2. 이벤트 id·선택지 id가 변환 전후 같다(기존 시험 「표본 20개 id」의 확대 — 140개 전수).
3. `yearRange`가 있는 이벤트는 정확히 이 문서 4절의 33개이고 값이 표와 같다(문서 ↔ 데이터 일치 시험).
4. `eras` 필드가 데이터에 남아 있지 않다.
5. 본문·선택지 낱말의 `WORD_YEARS` 포함 위반 0(timeline-schema.md 7절 규칙).
6. 알파 판 시뮬레이션: `standard` 17개 중 변형 15개는 알파 변형이 나오고 원본은 나오지 않으며, 닫음 2개는 알파 판에서 0건.
7. 6절 재점검의 합격 기준.

## 12. 마스터가 정할 것 (추천 포함)

| # | 질문 | 추천 | 대안·비고 |
|---|---|---|---|
| **C-01** | `present`만 있던 6개(`infant-parental-leave`·`infant-daycare-wait`·`infant-noise`·`school-academy-talk`·`youth-rent-hike`·`middle-both-working`)의 위쪽 끝 | 두지 않는다(주 규칙 R·GM0 기준선과 같음). 전망 구간에서도 열리고 전망 표시는 줄 라벨이 맡는다 | 2025로 자르면 전망 구간(2026~)에 사는 Z 후반·알파의 해당 나이 후보가 줄어든다(예: `youth-rent-hike` 24~38세가 알파에게는 전부 닫힌다). 대신 「현재 조건이 전망 구간에 이어진다」는 단정을 피한다(PJ8 정신) |
| **C-02** | `youth-military`(병역)를 전망 구간에도 허용 | 허용(전 연도). 문장은 현재 서술 그대로이고 새 수치를 만들지 않는다 | 병역자원 감소 전망(국방부 공식 전망) 확인 전에는 미래 병역 제도를 단정하지 않는다. 2026년 이후 제외 시 20세 칸(Z 후반·알파) 후보 3 → 2 (baseline 1-4에서 20세는 이미 가장 얇은 칸) |
| **C-03** | 고아 2개의 값(2016 · 2023) | 승인. `care-alert`는 근거가 약해 reviewer 판독 후 소재 조정 가능 | 끝내 못 찾으면 제목·소재를 일반 명사로 조정하거나 폐기 |
| **C-04** | `track` 분류 17/42 | 승인. 문서 B(생애 보드 ↔ 플래그 대응표) 병합 때 재판독. AL9 하한(15)에 여유를 두려면 변형 후보를 더 올린다(`middle-layoff` 등, 8-2절 끝) | |
| **C-05** | 7절의 얇은 칸 신규 작성 요청 | 소재 창고 요청(baseline 결정 6)과 GM6 신규 이벤트(`yearRange`·`track` 처음부터)로 | |
| **C-06** | `school-virtual-class`: 2026 이후(추천) vs 2020 이후 | 2026 이후 + 2020~22는 연표가 맡는다 | 2020 이후로 열면 Z 후반·알파 8~9세 칸이 1개 늘지만 연표 H-S14·H-E18 변형과 소재가 겹친다 |
| **C-07** | 인용 기준 연도와 `yearRange`의 관계 | `yearRange`는 인용 때문에 좁히지 않는다(MG4가 따로 규칙을 가진다) | |
| **C-08** | `infant-village`(≤1995)·`infant-coal-winter`(1955~1989)·`school-lunch`(≤1998)의 근거 | 사회 변화 일반 지식 수준이라 DC1·DC9가 확인할 때까지 ▲. reviewer 판독에서 반려되면 주 규칙(≤2000)으로 되돌린다 | |

## 부록. 140개 한 줄 전환표

`yearRange`: `—` 열림, `없음` 제한 없음. 원 eras가 없으면 `–`. `track`은 `S` = standard, `C` = common. 파일 순서·이벤트 순서는 `src/data/events/*.json`과 같다.

### infant.json (35)

| id | 나이 | 원 eras | yearRange | track |
|---|---|---|---|:-:|
| infant-first-word | 1 | – | 없음 | C |
| infant-care | 1~5 | – | 없음 | C |
| infant-fever | 1~5 | – | 없음 | C |
| infant-stories | 2~6 | – | 없음 | C |
| infant-screen | 2~6 | present, future | [2010, —] | C |
| infant-new-sibling | 2~4 | – | 없음 | C |
| infant-village | 1~6 | past | [—, 1995] | C |
| infant-grandparent-song | 1~6 | – | 없음 | C |
| infant-neglect-night | 1~6 | – | 없음 | C |
| infant-hovering | 1~6 | – | 없음 | C |
| infant-free-play | 2~6 | – | 없음 | C |
| infant-vaccine | 0 | – | 없음 | C |
| infant-hundred-days | 0 | – | 없음 | C |
| infant-night-wake | 0~1 | – | 없음 | C |
| infant-meal-start | 0~1 | – | 없음 | C |
| infant-checkup | 0~3 | present, future | [2008, —] | C |
| infant-parental-leave | 0 | present | [2001, —] | C |
| infant-care-alert | 0~2 | future | [2016, —] | C |
| infant-first-steps | 1 | – | 없음 | C |
| infant-first-birthday | 1 | – | 없음 | C |
| infant-daycare-wait | 1~2 | present | [2001, —] | C |
| infant-follow-sibling | 1~5 | – | 없음 | C |
| infant-coal-winter | 1~5 | past | [1955, 1989] | C |
| infant-tantrum | 2~3 | – | 없음 | C |
| infant-market-day | 2~6 | past | [—, 2000] | C |
| infant-talking-toy | 3~5 | future | [2023, —] | C |
| infant-heat-day | 2~6 | future | [2018, —] | C |
| infant-noise | 2~6 | present | [2001, —] | C |
| infant-questions | 3~5 | – | 없음 | C |
| infant-kindergarten | 3~4 | present, future | [2001, —] | C |
| infant-sibling-toy | 3~6 | – | 없음 | C |
| infant-hospital-stay | 3~6 | – | 없음 | C |
| infant-moving | 3~6 | – | 없음 | C |
| infant-early-lessons | 5~6 | present, future | [2001, —] | C |
| infant-first-book | 6~7 | – | 없음 | C |

### school.json (26)

| id | 나이 | 원 eras | yearRange | track |
|---|---|---|---|:-:|
| school-lunch | 8~16 | past | [—, 1998] | C |
| school-friend | 8~13 | – | 없음 | C |
| school-tutoring | 10~16 | – | 없음 | C |
| school-first-love | 15~19 | – | 없음 | C |
| school-exam | 16~19 | – | 없음 | S |
| school-early-work | 13~16 | past | [—, 2000] | C |
| school-bully | 9~15 | – | 없음 | C |
| school-club | 11~17 | – | 없음 | C |
| school-teacher-notice | 12~18 | – | 없음 | C |
| school-scholarship | 15~19 | – | 없음 | C |
| school-friend-quarrel | 11~17 | – | 없음 | C |
| school-academy-night | 11~18 | present, future | [2001, —] | C |
| school-family-priority | 12~17 | past | [—, 2000] | C |
| school-career-choice | 14~17 | – | 없음 | C |
| school-parttime | 16~19 | – | 없음 | C |
| school-puppy | 8~14 | – | 없음 | C |
| school-mirror | 12~16 | – | 없음 | C |
| school-money-gap | 12~18 | – | 없음 | C |
| school-chat-room | 12~17 | present, future | [2010, —] | C |
| school-long-walk | 8~13 | past | [—, 2000] | C |
| school-academy-talk | 10~16 | present | [2001, —] | C |
| school-virtual-class | 8~15 | future | [2026, —] | C |
| school-first-day | 7 | – | 없음 | C |
| school-supplies | 7 | – | 없음 | C |
| school-after-hours | 7 | present, future | [2001, —] | C |
| school-first-walk | 7 | past | [—, 2000] | C |

### youth.json (31)

| id | 나이 | 원 eras | yearRange | track |
|---|---|---|---|:-:|
| youth-military | 20~24 | past, present | 없음 | C |
| youth-work-pressure | 22~39 | – | 없음 | C |
| youth-first-job | 22~32 | – | 없음 | S |
| youth-meeting | 24~36 | – | 없음 | C |
| youth-marriage | 27~45 | – | 없음 | S |
| youth-marriage-again | 30~48 | – | 없음 | S |
| youth-partner-leaves | 31~50 | – | 없음 | C |
| youth-reunion | 25~50 | – | 없음 | C |
| youth-second-chance | 26~56 | – | 없음 | S |
| youth-meeting-again | 30~46 | – | 없음 | C |
| youth-matchmaker | 23~34 | past | [—, 2000] | S |
| youth-approached | 22~36 | – | 없음 | C |
| youth-child | 27~39 | – | 없음 | S |
| youth-child-again | 33~44 | – | 없음 | S |
| youth-workplace-romance | 24~38 | – | 없음 | C |
| youth-housing | 22~36 | – | 없음 | S |
| youth-exam-prep | 21~30 | – | 없음 | S |
| youth-exam-passed | 23~38 | – | 없음 | S |
| youth-exam-failed | 23~38 | – | 없음 | S |
| youth-friend-wedding | 25~36 | – | 없음 | C |
| youth-colleague | 24~38 | – | 없음 | C |
| youth-startup | 26~39 | – | 없음 | C |
| youth-night-study | 20~28 | – | 없음 | C |
| youth-return-school | 23~36 | – | 없음 | C |
| youth-rent-hike | 24~38 | present | [2001, —] | C |
| youth-gig-work | 21~32 | present, future | [2001, —] | C |
| youth-machine-partner | 24~38 | future | [2026, —] | C |
| youth-lonely-city | 20~28 | – | 없음 | C |
| youth-single-years | 30~39 | – | 없음 | C |
| youth-job-rejections | 21~30 | – | 없음 | C |
| youth-factory-night | 20~28 | past | [—, 2000] | C |

### middle.json (25)

| id | 나이 | 원 eras | yearRange | track |
|---|---|---|---|:-:|
| middle-business | 40~52 | – | 없음 | C |
| middle-parents-care | 45~62 | – | 없음 | C |
| middle-health-check | 40~55 | – | 없음 | C |
| middle-health-check-later | 53~64 | – | 없음 | C |
| middle-health-crisis | 48~64 | – | 없음 | C |
| middle-new-skills | 40~55 | future | [2026, —] | C |
| middle-remote-work | 42~58 | present, future | [2020, —] | C |
| middle-child-school | 52~62 | – | 없음 | C |
| middle-child-leaves | 58~64 | – | 없음 | C |
| middle-child-grows | 42~54 | – | 없음 | C |
| middle-late-child | 48~58 | – | 없음 | C |
| middle-home-loan | 40~55 | – | 없음 | S |
| middle-career-peak | 40~52 | – | 없음 | S |
| middle-layoff | 45~58 | – | 없음 | C |
| middle-job-again | 46~62 | – | 없음 | C |
| middle-friend-reunion | 42~58 | – | 없음 | C |
| middle-marriage-crisis | 42~58 | – | 없음 | C |
| middle-hobby | 42~60 | – | 없음 | C |
| middle-parents-farewell | 52~64 | – | 없음 | C |
| middle-debt-guarantee | 42~55 | – | 없음 | C |
| middle-retirement-prep | 55~64 | – | 없음 | S |
| middle-both-working | 40~54 | present | [2001, —] | S |
| middle-back-pain | 42~60 | – | 없음 | C |
| middle-lonely-holiday | 42~60 | – | 없음 | C |
| middle-own-shop-year | 42~62 | – | 없음 | C |

### senior.json (23)

| id | 나이 | 원 eras | yearRange | track |
|---|---|---|---|:-:|
| senior-retire | 65~70 | – | 없음 | S |
| senior-gathering | 66~82 | – | 없음 | C |
| senior-illness | 68~90 | – | 없음 | C |
| senior-illness-later | 78~100 | – | 없음 | C |
| senior-grandchildren | 68~82 | – | 없음 | C |
| senior-estate | 68~85 | – | 없음 | C |
| senior-move-home | 70~90 | – | 없음 | C |
| senior-travel | 66~78 | – | 없음 | C |
| senior-estranged-child | 66~85 | – | 없음 | C |
| senior-spouse-care | 70~90 | – | 없음 | C |
| senior-alone | 70~90 | – | 없음 | C |
| senior-new-device | 66~82 | – | 없음 | C |
| senior-long-life | 72~95 | future | [2026, —] | C |
| senior-last-wishes | 80~100 | – | 없음 | C |
| senior-old-friend | 66~85 | – | 없음 | C |
| senior-fall | 72~92 | – | 없음 | C |
| senior-classmates | 66~82 | – | 없음 | C |
| senior-diet | 66~88 | – | 없음 | C |
| senior-memoir | 68~90 | – | 없음 | C |
| senior-stairs | 68~90 | – | 없음 | C |
| senior-photo | 66~92 | – | 없음 | C |
| senior-grandchild-visit | 68~88 | – | 없음 | C |
| senior-quiet-pride | 70~95 | – | 없음 | C |

집계: 35 + 26 + 31 + 25 + 23 = **140** · `yearRange` 있음 **33**(영유아 13 · 학창 10 · 청년 6 · 중년 3 · 노년 1) · `track: S` **17**(학창 1 · 청년 11 · 중년 4 · 노년 1) · `track: C` 123.
