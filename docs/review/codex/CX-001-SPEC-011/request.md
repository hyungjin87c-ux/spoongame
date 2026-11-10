# CX-001 검증 요청 — SPEC-011 어린 시절 조르기 코어 (파일럿)

| 항목 | 값 |
|---|---|
| 리뷰 ID | CX-001 |
| 유형 | A 구현 감사 + B 적대적 QA (한 번에) |
| 대상 브랜치 | `review/CX-001` (코드는 커밋 `901f13865c34b444783e81e59bb4e39a7409de23` 그대로, 이 요청서만 더함) |
| 비교 기준 | 커밋 `b658c3a`(SPEC-011 확정) → `901f138`(코어·재측정 완료) |
| 레인 | CRITICAL — 확률·결정론 해시, 저장·복원, 밸런스 보정, 배포 뒤 바꾸기 어려운 이름(`parent_strained`) |
| 작성 | Claude Code 마스터, 2026-11-10 |

## 1. 검증자에게 (먼저 읽기)
- 너는 독립 검증자다. 코드를 고치거나 커밋·배포하지 않는다. 결과는 같은 폴더의 `findings.md` **한 파일**로만 낸다(형식: `../TEMPLATE-findings.md`).
- 시험을 돌리거나 재현용 임시 시험을 만들어 실행해도 된다. 임시 파일은 커밋하지 않는다.
- **이 첫 검증에서는 다음을 읽지 않는다**(기존 검수 결론과 독립하기 위해): `docs/review/`(이 요청 폴더와 `codex/TEMPLATE-*` 제외), `qa/`, `ai-log/`, `docs/TODO.md`, `wiki/`, `.coding-rules.md`는 읽어도 된다(규칙 ID `CR-…`를 지적에 붙이면 좋다).
- 저장소 밖 폴더나 외부 자료를 끌어오지 않는다. 문장(카피) 품질·취향, 코드 스타일 차이는 결함이 아니다.
- 지적에는 파일·줄, 실제 영향, 근거, **재현 방법**(시험 코드나 시드·상태)을 단다. 재현을 못 했으면 「미확인」으로 표시한다.

## 2. 원본 요구와 합격 기준
- 명세: `docs/spec/SPEC-011-어린시절조르기.md` — 「할 것」 DS1·DS2·DS4·AK1~AK6·AK10과 「완료 기준」, 「안 할 것」.
- 설계값의 정본: `docs/data/ask-model.md`(확률식 2-3절, 효과 표 2-4절, 1-4절 종류당 1장, 10-1절 함께 사는 부모), `docs/data/parent-decision-model.md`(R1a, 2-9 개정).
- 요약: 4~12세에 장난감·배움(반려동물은 스위치로 꺼짐) 조르기 카드가 판당 최대 3장(종류당 1장) 나온다. 선택은 조른다·떼쓴다·참는다. 들어줌 확률 `p`는 재력과 부모와의 사이 `C`로 정해지고(하한 있음), 판정 난수 `u1`·`u2`는 진행 RNG가 아니라 가족 시드 해시(`FAMILY_TAG.ASK = 20`, 종류 번호, 나이×2+칸)에서 나온다. 떼쓰기가 거절되면 `u2 < s(C)`일 때 `parent_strained`(관계 −1)가 켜진다. 저장 스키마 버전은 올리지 않는다.

## 3. 변경 파일과 영향 범위 (코어 중심)
| 영역 | 파일 |
|---|---|
| 판정·해결 | `src/core/ask.ts`(`askGrantChance`·`askRolls`·`askOutcomeOf`), `src/data/askTable.ts`(`ASK_EFFECTS`·`ASK_PET_ENABLED`) |
| 사건 풀·자격 | `src/core/events.ts`(`askPeers`·`isEventEligible`), `src/core/eventLint.ts`, `scripts/validateEvents.ts`, `src/data/events/ask.json`·`ask-pet.json`·`index.ts` |
| 결정자·주어 | `src/core/parentSubject.ts`(`coParentsOf`), `src/core/parentDecision.ts`, `src/data/parentDecisionTable.ts`(`parentWording`, R1a, 분류표) |
| 진행·자동 모드 | `src/core/life.ts`(`resolveChoiceCore` 경로, `autoChoiceWeights`의 `ev.ask` 분기), `src/core/history.ts`, `src/core/familyModel.ts` |
| 저장 | `src/core/storage.ts`, `src/core/types.ts` |
| 밸런스 | 부모·흘러감 카드 효과 +1 보정(사건 JSON 50곳 안팎), `src/data/timingTable.ts`, `src/data/finalDistribution.ts`, `scripts/askReport*.ts` |

같은 범위에 SPEC-013(시대의 창)·014(질문 문장)·015(외모 서술) 커밋이 섞여 있다 — **검증 범위 밖**이다(아래 6절).

## 4. 시험 결과 (작성자 측)
- 커밋 메시지 기준 `npm test` 5,111개 통과(전체 약 19~25분). `npm run typecheck` 통과.
- 관련 시험 파일: `tests/ask*.test.ts(x)`(11개), `parentSubject*`, `parentDecision*`, `storage*`(특히 `askStorage`·`storageParent`), `familyCard`, `autoEconomy`, `pacing`, `impact`, `stat20Guard`, `citationLink`.
- 빠른 실행 예: `npm ci` → `npm run typecheck` → `npx vitest run tests/ask tests/parentSubject tests/storage` (전체는 오래 걸린다).

## 5. 검증 질문
1. `askGrantChance`·`askRolls`가 설계 문서 2-3절 식·하한·단조성(재력↑·사이↑ → `p`↑)과 일치하는가? 경계(재력 1·5단계, `C` 1·5, 0명 부모)에서 범위를 벗어나거나 NaN이 날 수 있는가?
2. 결정론: 같은 상태 → 같은 결과인가? 세 선택지 중 무엇을 골라도 이후 진행 RNG 상태가 같은가? 사건 id·시대 분할이 바뀌어도 `u1`·`u2`가 같은가(종류 번호 기반)? `FAMILY_TAG.ASK`가 다른 태그와 충돌하는가?
3. 종류당 1장·판당 3장 상한이 `askPeers`·`isEventEligible`로 모든 경로(저장 후 복원, 자동 모드, 「다음 결정으로」)에서 지켜지는가?
4. 저장·복원: 조르기 카드가 `pending`인 저장을 열면 같은 카드가 뜨는가? 조르기 이전 버전 저장(`tests/fixtures` 등)이 열리는가? `parent_strained`·`seen`이 복원 뒤 이중 적용되는 경로가 있는가?
5. `parent_strained`의 관계 −1이 `closenessOf`의 1~5 자르기와 만나 생기는 이상(이미 1단계, 5단계 흡수 — 명세 AK5-1이 의도한 흡수 외)이 있는가?
6. 자동 모드 기대 효과 분기가 `u1`·`u2`를 읽지 않고 순수·결정론인가? 효과가 데이터에 없는 `beg`·`tantrum`을 다른 전략·통계 코드가 0효과로 오독하는 곳이 남았는가?
7. +1 보정 50곳과 판 길이 한도(36·41)가 다른 시대·수저 구간에서 확률 분포를 의도치 않게 바꾸는 회귀가 있는가?
8. 그 밖에 기존 시험이 놓친 실패 경로(상태 전이 순서, 연타, 13세 경계, 반려동물 스위치 켜짐 시 정합).

## 6. 제외 범위
- 조르기 **문장**(copy) 품질과 시대어 — 별도 판독을 거쳤다.
- 화면 배치·CSS·글꼴(AK8 고정 한 줄의 모양).
- 반려동물 사건 켜짐 상태의 콘텐츠(스위치 꺼짐으로 출시) — 단, 스위치 자체의 정합(질문 8)은 범위 안.
- SPEC-013·014·015 코드.

## 7. 알려진 제약
- 반려동물(`ASK_PET_ENABLED`)은 꺼져 있다. 출시 뒤에는 끄지 않는다는 정책이 있다.
- 「다음 결정으로」는 조르기 카드 앞에서 멈추며, 코드 변경 없이 시험만 고쳤다(명세 AK6 ②).
- 부모 사이 5단계에서는 −1이 흡수되어 말이 안 바뀔 수 있다(의도, 명세 AK5-1).
- 이 커밋은 이미 v0.5.0으로 배포된 코드의 일부다(배포 커밋 `ffe18e7`).
