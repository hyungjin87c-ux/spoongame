CLASSIFICATION: 판독 완료
VERDICT: CHANGES_REQUESTED

# REV-005-HV-1 — QI6 선행: 무거운 장면 분류 판독 (M13)

- 대상: SPEC-005 HV1~HV8·부록 D 초안, `spec-005` 커밋 `73b92f9`의 데이터(코드 변경 없음). 검수자 reviewer(읽기 전용) — 리포트는 텍스트로 넘기고 마스터가 저장했다(2026-10-21).
- 판정: 부록 D 초안을 고친 뒤 마스터가 승인한다. 코드 변경 요구는 없다. 마스터 결정은 맨 아래 「마스터 결정 (M13)」 절.

## 0. 요약

- **부록 D 24개**: 가림 20개, 가리지 않음 2개(`school-money-gap`, `youth-factory-night`), 경계 2개(`senior-alone`, `middle-lonely-holiday` — 둘 다 가리지 않기를 권함).
- **경계 3개**: 모두 가리지 않음.
- **빠진 장면**: 이벤트 3개(`middle-health-check-later`, `senior-old-friend`, `school-chat-room`)와 이벤트 밖의 기록 줄 1종(상속 줄). 아이 사망 원인 문장은 마스터가 정할 일로 올림.
- **권고안 합계**: 이벤트 23개(140개 중 약 16%) + 상속 줄 1종 + 통계 슬라이드 1개.
- **지적**: R-462~R-475, 14건.
- 확인한 자료: 이벤트 140개(infant 35 · school 26 · youth 31 · middle 25 · senior 23), 부모용 문구 9개(`parentLabel`/`parentResult`), 인용, 기록 카드 7종, 사망 문장, 식구 카드 문구, 첫 화면 통계 슬라이드 모델.

## 1. 판정 기준 제안 (planner·마스터 확정용)

「가림 대상」은 사람이 다치거나 무언가를 잃는 장면이다. 받아들이는 사람의 실제 상처를 건드릴 수 있는 일로, 다음 다섯 가지를 말한다.

1. 몸의 병·부상·입원, 병이 나빠졌다는 통보.
2. 가까운 사람의 중병·간병·임종, 죽음을 앞둔 정리.
3. 관계가 끊기는 일: 떠나는 연인, 부부의 단절과 별거 갈림길, 자식과의 연락 단절.
4. 아이가 돌봄을 받지 못하거나 괴롭힘을 겪거나 지켜보는 일: 방임 암시, 따돌림, 온라인 따돌림.
5. 생계가 무너지는 일: 정리해고, 고립을 동반한 긴 미취업, 보증 빚, 집안 형편이 무너져 학업을 접는 일.

판단 단위는 **이벤트 하나**다. 카드의 상황(제목·본문)이 위 다섯에 해당하거나 그 일의 직접적인 갈림길이면(보증 부탁처럼) 카드 전체를 가린다. 선택지 하나의 결과만 아픈 경우(본인이 고른 담담한 이별 등)는 가리지 않는다. 선택지 단위 표지는 만들지 않는다.

가리지 않는 것은 세 갈래다.

- 많은 사람이 겪는 일상의 고단함과 슬픔: 형편의 차이, 경쟁, 고된 일, 외로움, 한 번의 실패, 노화의 불편. 이것은 이 게임이 보여 주려는 것 자체다(G1~G4).
- 게임 진행에 필요한 사실과 도움 정보.
- 사용자가 직접 쓰는 기록 카드.

경계 사례는 두 질문으로 가른다. ① 스위치 설명 「아픈 일이나 이별 같은 장면」에 문자 그대로 들어맞는가. ② 같은 결의 다른 장면과 판정이 일관된가.

**가릴 단위 약어** (아래 표에서 씀)

- **서술**: 제목·본문을 가린다. 인생 기록 줄과 엔딩 연표 줄이 「{나이}세 무거운 일이 있었습니다 · {분류}」와 「펼쳐 보기」로 바뀐다.
- **결정**: 제목, 상황 본문, 선택지 라벨, 영향 줄, 인용 박스, 결과 문장, 기록 줄의 「(선택: 라벨)」, 엔딩 연표 줄을 가린다.
- **부모**: 「결정」에 더해 부모용 라벨·결과도 가린다. 칩(「부모님의 결정」/「아이의 일」), 결정자 도장 낱말, 아이콘은 보인다.

## 2. 부록 D 24개 판독

| # | 이벤트 id (제목) | 형식 | 분류 | 판정 | 가릴 단위 | 이유 |
|---|---|---|---|---|---|---|
| 1 | infant-neglect-night (불 꺼진 집) | 서술 | home | 가림 | 서술 | 방임하는 양육에서만 나온다. 어린아이가 불 꺼진 방에서 혼자 잠든다(방임 암시) |
| 2 | school-money-gap (말하지 않는 격차) | 서술 | – | **가리지 않음** | – | 형편 격차는 이 게임의 주제다. 같은 결인 school-lunch, school-academy-talk, school-supplies 「물려받은 것」은 목록에 없다 → R-462 |
| 3 | school-early-work (어려워진 집안 형편) | 부모 카드(13~16세) | home | 가림 | 부모 + 인용 c-100 | 집안 형편이 무너져 학교를 쉬는 갈림길. 실직·빚의 집안판이다 |
| 4 | school-family-priority (먼저 가야 할 사람) | 흘러감(전 구간) | home | 가림 | 부모 + 인용 c-097 | 형제 사이에서 학업 포기를 강요받는다. 「책가방을 접어 넣던 날」 |
| 5 | school-bully (교실의 한 아이) | 12세 이하 흘러감, 13~15세 본인 | school | 가림 | 12세 이하 부모 / 13세 이상 결정, 인용 c-050 | 따돌림을 지켜본다. 인용에 「학교폭력 실태조사」라는 주제가 그대로 있어 반드시 함께 가린다 |
| 6 | infant-fever (한밤의 열) | 부모 카드 | health | 가림 | 부모 | 아픈 아이 장면. 「넘긴다」를 고르면 이틀을 앓는다. 「아픈 일」에 문자 그대로 해당 |
| 7 | infant-hospital-stay (병실에서 보낸 며칠) | 부모 카드 | health | 가림 | 부모 | 아이의 입원 |
| 8 | middle-health-crisis (쓰러진 날) | 결정 | health | 가림 | 결정 | 갑자기 쓰러져 이송된다 |
| 9 | senior-illness (오래가는 통증) | 결정 | health | 가림 | 결정 | 오래가는 통증, 추가 검사 |
| 10 | senior-illness-later (점점 깊어지는 병) | 결정 | health | 가림 | 결정 | 병이 깊어지고 삶의 끝을 어디서 보낼지 고른다(「마지막까지 집에서」) |
| 11 | senior-fall (미끄러진 겨울날) | 결정 | health | 가림 | 결정 | 부상. 가장 가벼운 축이지만 노년 낙상은 실제 아픈 일이라 둔다 |
| 12 | middle-parents-care (부모님의 병환) | 결정 | loss | 가림 | 결정 + 인용 c-081 | 부모의 병과 돌봄. 분류 이름 주의 → R-469 |
| 13 | middle-parents-farewell (마지막 인사) | 결정 | loss | 가림 | 결정 | 부모의 임종·장례. 같은 해의 상속 줄도 함께 → R-468 |
| 14 | senior-spouse-care (곁을 지키는 일) | 결정 | loss | 가림 | 결정 + 인용 c-082 | 배우자 간병. 분류 이름 → R-469 |
| 15 | senior-last-wishes (마지막 정리) | 결정 | loss | 가림 | 결정 | 죽음을 앞둔 정리 |
| 16 | youth-partner-leaves (떠나간 사람) | 서술 | bond | 가림 | 서술 | 상대가 떠나는 이별 |
| 17 | middle-marriage-crisis (서먹해진 식탁) | 결정 | bond | 가림 | 결정 + 인용 c-096 | 부부의 단절과 별거 갈림길. 인용 「이혼 8만 8천 건」이 주제를 말한다 |
| 18 | senior-estranged-child (소원해진 자식) | 결정 | bond | 가림 | 결정 | 자식과 연락이 끊겼다 |
| 19 | senior-alone (혼자 사는 집) | 결정 | – | **경계 → 가리지 않음 권고** | – | 외로움은 이별이 아니다. 세 선택지 모두 회복(이웃·작은 동물·고요)이다 → R-464 |
| 20 | middle-lonely-holiday (혼자 맞는 명절) | 서술 | – | **경계 → 가리지 않음 권고** | – | 외로움. youth-lonely-city와 같은 결 → R-464 |
| 21 | youth-factory-night (멈추지 않는 기계) | 서술 | – | **가리지 않음** | – | 고된 노동은 일상의 고됨이고 잃는 것이 없다 → R-463 |
| 22 | youth-job-rejections (연락이 없는 날들) | 서술 | work | 가림(경계) | 서술 | 긴 미취업에 「방 안에서 보내는 날들」이라는 고립 암시가 더해진다. youth-exam-failed(한 번의 좌절)와 갈리는 지점이 고립 암시다 |
| 23 | middle-layoff (정리 대상이 된 아침) | 결정 | work | 가림 | 결정 + 인용 c-083 | 실직. 인용에 「정리해고」가 있다 |
| 24 | middle-debt-guarantee (보증을 서 달라는 부탁) | 결정 | work | 가림 | 결정 | 보증 빚의 갈림길. 「서 준다」를 고르면 −6,000만 원 |

## 3. 경계 3개

| id (제목) | 판정 | 이유 |
|---|---|---|
| middle-health-check (검진 결과표) | 가리지 않음 | 정기 검진에서 수치 하나, 생활 습관 권고다. 진단·악화가 아니다. infant-checkup, senior-diet, middle-back-pain과 같은 축이다. 이것까지 가리면 건강 이야기가 모두 사라진다. 대신 뒤따르는 **middle-health-check-later는 가림**(R-465) |
| youth-work-pressure (끝나지 않는 일) | 가리지 않음 | 과로는 일상의 고됨이다. youth-gig-work, middle-remote-work 「경계를 흐리게」, middle-career-peak 「받아들인다」와 같은 결 |
| school-academy-night (늦은 밤의 학원가) | 가리지 않음 | 입시 경쟁은 게임 주제다(M3 부모 카드). 건강 −3·행복 −4는 스트레스이지 아픈 일이 아니다 |

## 4. 빠진 장면 (가림 추가 권고)

| 대상 | 형식 | 분류 | 가릴 단위 | 이유 |
|---|---|---|---|---|
| middle-health-check-later (다시 받은 결과) | 결정 | health | 결정 | 「지난번보다 나빠져… 의사의 표정이 더 굳어」. 악화 통보로 senior-illness와 무게가 같다 → R-465 |
| senior-old-friend (오래된 친구의 소식) | 결정 | loss | 결정 | 오랜 친구의 병, 마지막일 수 있는 방문. parents-care·spouse-care와 같은 결 → R-466 |
| school-chat-room (밤마다 울리던 화면) | 서술 | school | 서술 | 단체 대화방 사건으로 온라인 따돌림을 암시한다. `stood_up` 보너스로 따돌림 줄기와 이어져 있다 → R-467 |
| 상속 줄 「부모님이 남기신 재산을 물려받았습니다.」 (`src/data/lifeTable.ts:36`, `src/core/life.ts:239·263·294`) | 이벤트 밖 기록 줄 | loss | 줄 전체 | 부모의 죽음을 직접 말한다. 가린 farewell 줄 바로 뒤에 붙어 내용이 샌다. `eventId`가 없다 → R-468 |
| 사망 원인 문장 (20세 미만 「갑작스러운 병」「사고」, `src/data/lifeText.ts:13~17`) | 엔딩·연표 사망 줄 | – | 마스터 결정 | HV8대로 보이는 것을 권고한다(진행 정보, 낱말 하나). 다만 아이의 사망 원인을 가릴지는 M13에 한 줄로 결정 → R-470 |

**부모용 문구 9개는 가림 대상이 없다.** scholarship pass ×2, academy-night friends ×1, puppy keep/feed/pass ×6이다. puppy 「어느 날부터 강아지는 보이지 않았습니다」는 죽음 묘사가 없고 담담하다.

## 5. 가리지 않음 확인 (일상적 슬픔 — 과한 가림 금지)

| id | 이유 |
|---|---|
| school-lunch, school-academy-talk, school-supplies 「물려받은 것」 | 형편 격차. 게임 주제(R-462와 묶임) |
| school-mirror | 겉모습을 두고 말이 오가는 장면. 놀림 묘사가 없다(외모가 낮을 때의 효과는 숫자만) |
| school-after-hours 「혼자 집에서」, infant-stories 「혼자 놀다 잠들게」 | 흔한 돌봄 공백. neglect-night(밤, 부모 부재)와 결이 다르다 |
| infant-moving | 형편 때문의 이사. 일상 |
| youth-exam-failed | 한 번의 좌절. 고립 암시가 없다 |
| youth-marriage, youth-marriage-again, youth-second-chance 「헤어지기로」 | 선택지 하나의 결과이고 본인이 고른 담담한 이별이다. 카드 주제는 결혼 |
| youth-colleague | 부당한 지시. 직장 갈등이고 괴롭힘 묘사가 없다 |
| youth-gig-work, youth-rent-hike, youth-housing 「빚을 내서라도」, youth-exam-prep 「기한 없이」, middle-home-loan | 일상의 생계 압박. 주택 대출은 빚 위기가 아니다 |
| middle-job-again | 실직 뒤 다시 일하는 회복 장면 |
| middle-child-leaves, middle-child-school 「권한다」 | 자연스러운 독립, 세대 갈등 |
| middle-back-pain, senior-stairs, senior-diet, infant-checkup, infant-vaccine | 노화와 관리. 진단·악화가 아니다 |
| senior-photo 「몇은 이제 곁에 없었습니다」, senior-classmates 「이름이 하나둘 줄어드는 나이」 | 회상 속의 담담한 언급. 사별 장면이 아니다 |
| senior-move-home 「돌봄이 있는 곳」, senior-retire, senior-gathering 「집에서 조용히」 | 노년의 일상 |
| youth-lonely-city, youth-single-years | 외로움(R-464와 묶임) |
| infant-new-sibling, infant-sibling-toy, youth-military, school-exam 「한 해 더」 | 일상 |
| 첫 화면 조사망률·기대수명·고령 빈곤·1인 가구 | HV7에 동의. 인구 통계이지 장면이 아니다 |

## 6. 가리지 말아야 할 것 (진행·도움·사실)

- **상담전화 안내**: 「힘든 마음을 혼자 견디지 않아도 됩니다.」와 「자살예방 상담전화 109 (24시간)」는 「펼쳐 보기」 뒤로 숨기지 않고 같은 슬라이드에 늘 보인다.
- **사망 기록**: 엔딩 첫 줄 「N세에 세상을 떠났습니다…」, 연표의 사망 줄(HV8, R-470 참고).
- **대시보드 사실**: 식구 카드의 「병환 중」·「세상을 떠남」·「이혼」, 스탯·자산 미터, 영향 애니메이션. 스위치 설명의 약속 「일어나는 일은 같아요」 그대로다 → R-471.
- **결정자 표지**: 부모·흘러감 카드의 칩, 줄의 도장 낱말과 아이콘, 첫 부모 카드 안내 한 줄.
- **기록 카드 ⑤·⑥**: ⑤ `note-illness`는 가린 건강 장면 직후에 뜨지만 질문이 일반적이고 건너뛸 수 있어 HV8을 유지한다.
- **가림의 접근성 (확인 사항)**
  - 가린 결정 카드도 「결정할 일이 있다」는 사실과 버튼 두 개는 보여야 한다.
  - 「이번에는 자동으로 고르기」 뒤 남은 가린 기록 줄도 「펼쳐 보기」로 고른 길과 결과를 열 수 있어야 한다. HV4①의 펼침이 결정 줄에도 똑같이 적용된다는 점을 명시하면 좋다.
  - live region은 원문을 읽지 않는다.

## 7. 자살률 슬라이드 가림 단위 (HV7)

| 요소 | 켜면 |
|---|---|
| 표제어 h3 「삶을 스스로 마감하는 사람은 얼마나 될까?」 | 「무거운 주제 · 마음 건강 통계」로 바꿈 |
| 공식 통계명 줄 「자살률(2025년)」 | 가림 |
| 값 27.8, 단위 「명」, 기준 줄 「인구 10만 명당」 | 가림 |
| 그래프와 그 읽기 이름(`chartLabel`) | 가림 |
| 정의 줄(「고의적 자해(자살)로 숨진…」), 출처 줄, 기준(basis) 줄 | 가림. 펼치면 보임 |
| 슬라이드 `article`의 aria-label(`{insight}, {officialText}`, `src/ui/StatsCarousel.tsx:55`) | 분류 문구로 바꿈 |
| 점 버튼 이름 `dotLabel(i, count, s.insight)` (`:298`, 지금은 점이 안 보임) | 분류 문구로 바꿈 |
| `slide__help` 묶음(helpLead + 이름·번호·시간, aside 이름) | **늘 보임** |
| 「펼쳐 보기」 | 1개, `aria-expanded` |

관찰: 상담전화 이름 「자살예방 상담전화」가 주제를 드러낸다. 그래도 공식 서비스 이름의 정확성이 우선이므로 바꾸거나 순화하지 않는다.

## 8. 분류별 권고 목록 (화면 이름은 designer 확정)

| kind | 장면(권고안) | 화면 이름 후보 |
|---|---|---|
| home | infant-neglect-night, school-early-work, school-family-priority | 「집안 사정」 |
| school | school-bully, school-chat-room | 「또래 사이」 |
| health | infant-fever, infant-hospital-stay, middle-health-check-later, middle-health-crisis, senior-illness, senior-illness-later, senior-fall | 「건강」 |
| loss | middle-parents-care, middle-parents-farewell, senior-spouse-care, senior-last-wishes, senior-old-friend, (상속 줄) | 「돌봄과 이별」 |
| bond | youth-partner-leaves, middle-marriage-crisis, senior-estranged-child | 「멀어진 사이」 |
| work | youth-job-rejections, middle-layoff, middle-debt-guarantee | 「일과 생계」 |

## 9. 지적

- **R-462 [중간]** SPEC-005 부록 D 「가정·형편」 행 — `school-money-gap`이 들어가 있다. 같은 결인 `school-lunch`, `school-academy-talk`, `school-supplies` 「물려받은 것」은 빠져 있어 일관되지 않다. 형편 차이는 게임의 주제이고 「아픈 일·이별」도 아니다. — 기대: 제외(가리지 않음). 넣으려면 셋도 함께 넣어야 하는데, 그러면 켠 판에서 출발선의 격차가 대부분 가려진다.
- **R-463 [중간]** 부록 D 「일과 돈의 위기」 행과 HV2의 「고된 노동」 — `youth-factory-night`. 밤샘 근무의 고됨은 `youth-work-pressure`, `youth-gig-work`, `youth-night-study`와 같은 일상의 고단함이고 잃는 것이 없다. — 기대: 제외하고, HV2의 「고된 노동」 낱말도 뺀다. HV5의 효과 예시는 그대로 유효하다.
- **R-464 [중간·마스터 결정]** 「관계의 단절·외로움」 행 — `senior-alone`, `middle-lonely-holiday`. 외로움은 이별이 아니다. 같은 결인 `youth-lonely-city`, `youth-single-years`는 빠져 있다. `senior-alone`은 선택지가 모두 회복이라 가리면 따뜻한 장면을 감추게 된다. — 기대: 둘 다 제외. 남긴다면 `youth-lonely-city`도 추가한다.
- **R-465 [중간]** 누락 — `middle-health-check-later`(병 악화 통보). — 기대: 가림, health, 결정 단위.
- **R-466 [중간]** 누락 — `senior-old-friend`(가까운 사람의 병). — 기대: 가림, loss, 결정 단위.
- **R-467 [중간]** 누락 — `school-chat-room`(온라인 따돌림 암시, `stood_up`으로 school-bully와 이어짐). bully만 가리면 같은 주제가 반쪽만 가려진다. — 기대: 가림, school, 서술 단위.
- **R-468 [중간]** 누락 — 상속 줄. `src/data/lifeTable.ts:36`의 `INHERIT_NOTE_TEXT`를 `src/core/life.ts:239·263·294`가 기록 줄로 남긴다. 부모의 죽음을 말하고, 가린 `middle-parents-farewell` 줄 바로 뒤에서 내용이 샌다. — 기대: 가림, loss. 이 줄에는 `eventId`가 없어 이벤트의 `heavy` 표지로는 잡히지 않으므로, 상수 쪽 표지나 줄 종류로 표지하는 방식을 SPEC에 적는다.
- **R-469 [중간]** 분류 이름의 사실성 — loss에 죽음이 없는 돌봄 장면과 본인의 임종 준비가 섞여 있다. 가린 줄에는 분류 이름만 보이므로 이름이 「사별」·「이별」이면 일어나지 않은 죽음을 알리는 오정보가 된다. — 기대: 분류 이름은 그 분류의 모든 장면에 참이어야 한다(예: 「돌봄과 이별」). bond 이름도 loss와 겹치지 않게 짓는다. 이름 목록도 `heavy` 표 시험에 묶는다.
- **R-470 [낮음·마스터 결정]** `src/data/lifeText.ts:13~17`의 사망 원인 — 20세 미만은 「갑작스러운 병」「사고」, 20~59세는 「사고」가 후보에 있다. 부록 D·HV2의 「사고 사망의 묘사가 없다」는 「묘사는 없고 원인 낱말 '사고'가 59세 이하 후보에 있다」로 정확히 고친다. — 기대: 사망 기록은 보이게 두기를 권고한다(HV8). 20세 미만 원인 문장을 가릴지는 M13에 한 줄로 결정한다.
- **R-471 [낮음]** HV8 「가려지지 않는 것」 목록 보완 — `src/data/familyText.ts:9~24`의 식구 카드 상태 문구, 스탯·자산 미터와 영향 표시, 결정자 칩·도장·아이콘, 첫 부모 카드 안내, 기록 카드 ⑤가 빠져 있다. — 기대: 이 항목들을 명시한다. 없으면 developer가 가리거나 QA가 「새는 곳」으로 실패 처리할 수 있다.
- **R-472 [낮음]** HV7의 가림 단위 — 7절 표처럼 명시한다. 특히 눈에 안 보이는 읽기 이름 두 곳(`src/ui/StatsCarousel.tsx:55` article aria-label, `:298` dotLabel)과 `chartLabel`. — 기대: 상담전화 묶음은 펼침 영역 밖에 두고, 이름은 바꾸지 않는다.
- **R-473 [낮음]** 부록 D 표기 — `infant-fever`는 1~5세(표에는 1~6), `middle-lonely-holiday`는 42~60세(표의 42~58 범위 밖). — 기대: 나이를 고치고, 권고안을 반영하면 합계를 「이벤트 23개(약 16%) + 상속 줄 + 통계 슬라이드 1」로 바꾼다.
- **R-474 [낮음]** HV4와 완료 기준 11의 「같은 시드·같은 선택이면 상태 전체가 같다」 — `gentleUsed`는 정의상 다르고, e2e라면 `play`(플레이 시간)도 다를 수 있다. — 기대: 비교에서 이 필드들을 뺀다는 점을 SPEC과 `tests/gentle.test.ts` 설명에 적는다.
- **R-475 [중간]** SPEC 안에서 어긋남 — HV3 「켜면 그 시점 이후의 장면부터, 이미 지난 줄은 그대로」와 HV4④ 「엔딩 연표의 같은 줄도 가려진 채」가 맞지 않는다. 줄마다 가렸는지를 저장할 필드가 SV1(`by`·`gentleUsed`·`heavy`)에 없다. 판 도중 다시 끌 때 어떤 줄이 보이는지도 정해지지 않았다. — 기대: 둘 중 하나로 확정한다.
  - (A) 화면 규칙: 지금 설정이 켜져 있으면 모든 heavy 줄을 가리고 언제든 펼칠 수 있다. 저장 필드가 늘지 않아 단순하다. 권고안.
  - (B) 줄 단위 기록: `HistoryEntry`에 `veiled?: true` 같은 필드를 SV1에 추가하고, 엔딩은 그 표지를 따른다.

## 10. 확인한 자료

- 이벤트: `src/data/events/infant.json`, `school.json`, `youth.json`, `middle.json`, `senior.json`
- 부모 결정·문구: `src/data/parentDecisionTable.ts`, `src/data/lifeText.ts`, `src/data/lifeTable.ts`, `src/data/endingText.ts`, `src/data/familyText.ts`, `src/data/titleText.ts`
- 진행 로직: `src/core/life.ts`, `src/core/family.ts`
- 기록 카드·통계: `src/data/notes.json`, `src/data/statHeadlines.ts`, `src/data/koreaStats.json`(suicide-rate), `src/data/citations.json`(c-050·c-081·c-082·c-083·c-096·c-097·c-100)
- 화면: `src/core/carousel.ts`, `src/ui/StatsCarousel.tsx`, `src/ui/dash/LogList.tsx`
- 문서: `docs/design/copy.md` 9-5절. `docs/TODO.md`에 HV 항목 중 [x]로 바뀐 것은 없다.

## 마스터 결정 (M13 — 2026-10-21)

판정 기준(1절)과 가릴 단위 약어(서술·결정·부모)를 그대로 채택한다. 지적별 결정:

| ID | 결정 |
|---|---|
| R-462 | 수용 — `school-money-gap` 제외(형편 격차는 게임 주제) |
| R-463 | 수용 — `youth-factory-night` 제외, HV2의 「고된 노동」 낱말 삭제 |
| R-464 | 수용 — `senior-alone`·`middle-lonely-holiday` 제외(외로움은 이별이 아니고, `senior-alone`의 세 선택지는 회복 장면). `youth-lonely-city`도 넣지 않는다 |
| R-465·R-466·R-467 | 수용 — `middle-health-check-later`(health·결정), `senior-old-friend`(loss·결정), `school-chat-room`(school·서술) 추가 |
| R-468 | 수용 — 상속 줄을 loss로 가린다. `eventId`가 없는 기록 줄은 **줄을 만드는 쪽의 상수 표지**(예: 상속 줄을 만들 때 그 줄에 `heavy` 분류를 붙이거나 상수 → 분류 표)로 잡는다. 구현 방식은 developer가 정하되 저장 스키마는 v8 유지(SV1 — 줄에 필드를 더하면 선택 필드) |
| R-469 | 수용 — 분류 화면 이름은 그 분류의 **모든 장면에 참**이어야 한다(일어나지 않은 죽음을 알리지 않음). 후보 「집안 사정 · 또래 사이 · 건강 · 돌봄과 이별 · 멀어진 사이 · 일과 생계」를 designer가 확정하고, 이름 목록을 `heavy` 표 시험에 묶는다 |
| R-470 | **사망 기록은 원인 낱말까지 그대로 보인다**(20세 미만 포함). 이유: 사망은 판의 끝을 알리는 진행 정보이고, 원인은 묘사 없는 낱말 하나이며, 이 게임은 죽음을 완곡어로 가리지 않는다(copy.md 엔딩 원칙). HV2의 「사고 사망의 묘사가 없다」는 「묘사는 없고 원인 낱말 '사고'가 59세 이하 사망 원인 후보에 있다」로 고친다 |
| R-471 | 수용 — HV8 목록에 식구 카드 상태 문구, 스탯·자산 미터와 영향 표시, 결정자 칩·도장·아이콘, 첫 부모 카드 안내, 기록 카드 ⑤·⑥을 명시 |
| R-472 | 수용 — HV7을 7절 표대로(상담전화 묶음은 펼침 영역 밖·이름 그대로, 읽기 이름 두 곳과 `chartLabel`도 가림) |
| R-473 | 수용 — 나이 정정(`infant-fever` 1~5, `middle-lonely-holiday`는 제외되므로 표에서 빠짐), 합계 「이벤트 23개(140개 중 약 16%) + 상속 줄 1종 + 통계 슬라이드 1」 |
| R-474 | 수용 — 「상태 전체가 같다」 비교에서 `gentleUsed`와 플레이 시간(`play`)을 뺀다고 SPEC·시험 설명에 적는다 |
| R-475 | **(A) 화면 규칙 채택** — 가림은 **지금의 설정값으로 화면이 정한다**: 켜져 있으면 지난 줄을 포함한 모든 heavy 줄·카드·엔딩 연표 줄이 가려지고 언제든 펼칠 수 있으며, 끄면 모두 원문으로 보인다. 줄마다 가렸는지 저장하지 않는다(저장 필드 증가 없음). `gentleUsed`는 판 도중 한 번이라도 켜졌으면 참. HV3의 「이미 지난 줄은 그대로」 문장은 삭제 |

- 6절 접근성 확인 사항(가린 결정 카드도 결정할 일이 있다는 사실·버튼 둘, 자동 고르기 뒤 가린 줄도 펼쳐서 고른 길·결과를 볼 수 있음, live region은 원문을 읽지 않음)을 HV4에 명시한다.
- 최종 목록: home 3 · school 2 · health 7 · loss 5(+ 상속 줄) · bond 3 · work 3 = **이벤트 23개** + 상속 줄 1종 + 자살률 슬라이드 1.
- 반영: planner가 SPEC-005 HV2~HV8·부록 D·완료 기준 11에 옮긴다. 다음: designer QI6 시안(분류 이름·가린 줄·가린 카드·스위치) → developer QI6.
