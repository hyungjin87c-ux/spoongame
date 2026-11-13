# 2026-11-13 SPEC-018 PL5 측정 (report:persona 1000판)

- 대상 트리: spec-011 작업 트리(PL5 e4ee33d + 병역·재수 결정 후속 239 + 큰 갈림길 강제 슬롯 후속 241, 커밋 전).
- 명령: `npm run report:persona -- 1000` (밀레니얼, 시드 i×7919+13, 36세까지 자동 진행).
- 판정이 아니라 보고다. ▲ 기준을 넘지 못한 항목은 계수를 비틀지 않고 형진 님께 보고한다.

## 요약
- **8(a)·(b) 수저 1·5 짝 비교**: G1·G2는 쌍마다 한쪽에만 보이는 선택지가 각 2개다(미달 0쌍, Jaccard 거리 0.800). G3은 각 1개다(미달 0, 0.500).
  - G4(분야 카드)는 435/996쌍이 미달이다 — 분야 3개가 수저와 무관하게 겹친다. G5(세부 직업)는 186/996쌍 미달이다. 둘 다 PL4 후보 규칙이라 이번에 바꾸지 않았다(보고).
- **노출**: G1·G2 미노출 0~0.7%다(강제 슬롯 전 50판 측정은 72~88%). G2 노출은 맞춤 판 99.2%, 같은 시드 맞춤 없는 판의 옛 G2는 11.1%다.
- **8(c) 기질 총변동거리(기준 ≥ 0.15▲)**: G1 0.068~0.088, G2 0.085~0.135, G3 0.052~0.060, G4 0.007~0.009, G5 0.027~0.034로 모두 미달이다.
  - 활동 끌림(`actPull` 4, 합 상한 ±4)이 지금 세기 벡터에서 작게 작동한다. 직업 카드에는 끌림이 없다(설계 1-4절).
  - 사다리(`ACT_PULL` 2~8)로 올릴지는 형진 님께 보고한다.
- **8(e) 지배**: 칸별 최대 몫 53.4%(G3 수저 5 apply)로 60%를 넘는 칸이 없다.
- **9 적성 폭**: 수저 1에서 한 축이 높은 판 15.7%, 수저 5에서 한 축이 낮은 판 89.5%다(각 ≥ 5% 통과).
- **진로 일정(게임 나이)**: 여자 대학 23~24 · 비대학 19, 남자 대학 25~26 · 비대학 22다. 병역 줄은 20~21이고, 35세 직업 확정은 100%다.

## 원문
# 맞춤 인생 보고 (report:persona) — 밀레니얼 · 시드 i×7919+13 · 판수 1000 · 36세까지 자동 진행
갈림길: G1 `school-lessons` · G2 `school-high-pick` · G3 `school-exam` · G4 `job-pick-field` · G5 `job-pick-detail`

## ① 짝 시드 — 같은 출생에서 수저만 1·5 (8(a)·(b))

| 갈림길 | 두 판 모두 본 쌍 | 수저1에만 평균(최소) | 수저5에만 평균(최소) | (a) 기준 | (a) 미달 쌍 | Jaccard 거리 | (b) 기준 |
|---|---:|---:|---:|---:|---:|---:|---:|
| G1 | 997 | 2.00 (2) | 2.00 (2) | 각 ≥ 2 | 0 | 0.800 | ≥ 0.3 |
| G2 | 993 | 2.00 (2) | 2.00 (2) | 각 ≥ 2 | 0 | 0.800 | ≥ 0.3 |
| G3 | 360 | 1.00 (1) | 1.00 (1) | 각 ≥ 1 | 0 | 0.500 | ≥ 0.2 |
| G4 | 996 | 0.72 (0) | 0.72 (0) | 각 ≥ 1 | 435 | 0.329 | ≥ 0.2 |
| G5 | 996 | 1.98 (0) | 1.98 (0) | 각 ≥ 1 | 186 | 0.702 | ≥ 0.2 |

## ② 자연 집단 — 룰렛이 수저 1·5를 낸 판 (미노출 · 결정자 · (e) 지배 · 9)

| 갈림길 | 수저 | 미노출률(분모) | 결정자 부모/흘러감/본인 | (e) 최대 몫(칸 분모) |
|---|---:|---:|---|---|
| G1 | 1 | 0.0% (1000) | 1000/0/0 | afterschool 39.2% (1000)  |
| G1 | 5 | 0.1% (1000) | 999/0/0 | dojang 43.2% (585)  |
| G2 | 1 | 0.7% (1000) | 993/0/0 | nightwork 48.7% (959)  |
| G2 | 5 | 0.1% (1000) | 999/0/0 | general 43.6% (999)  |
| G3 | 1 | 54.7% (1000) | 263/0/190 | work 34.6% (453)  |
| G3 | 5 | 43.0% (1000) | 353/0/217 | apply 53.4% (570)  |
| G4 | 1 | 0.0% (997) | 0/0/999 | machine 48.2% (53)  |
| G4 | 5 | 0.0% (998) | 0/0/999 | clerk 41.8% (91)  |
| G5 | 1 | 0.0% (997) | 0/0/999 | pro-planner 42.3% (42)  |
| G5 | 5 | 0.0% (998) | 0/0/999 | clerk-corp 48.1% (47)  |

- 9 적성 폭(15세): 수저 1에서 한 축이 높은 판 15.7% · 수저 5에서 한 축이 낮은 판 89.5% (기준 각 ≥ 5%)
- G2 노출: 맞춤 판 새 G2 99.2% · 같은 시드 맞춤 없는 판 옛 G2 11.1% (분모 1000 — 1절 2 「새 G2 미노출률 ≤ 옛 G2」)

## ③ 기질 짝 — 같은 시드·같은 수저에서 출생 기질만 (8(c), 기준 ≥ 0.15▲)

| 갈림길 | 수저 1: 최대 TV (쌍) | 수저 5: 최대 TV (쌍) |
|---|---:|---:|
| G1 | 0.068 (warm↔quiet) | 0.088 (warm↔quiet) |
| G2 | 0.085 (warm↔quiet) | 0.135 (warm↔quiet) |
| G3 | 0.060 (curious↔warm) | 0.052 (curious↔warm) |
| G4 | 0.009 (warm↔quiet) | 0.007 (curious↔steady) |
| G5 | 0.034 (curious↔steady) | 0.027 (curious↔easy) |

(기질 6종 × 수저마다 250판 — 두드러진 기질 65 · 나머지 32로 덮어썼다)

## (f) 칸별 보이는 id 집합 (G1·G2: 예술·운동 단계 / G3: 칸 없음) — content-018-PL5.md 2절과 대조

### G1
- 수저1 art:high sport:low: dojang · afterschool · housework (10)
- 수저1 art:high sport:mid: dojang · afterschool · housework (8)
- 수저1 art:low sport:high: dojang · afterschool · housework (8)
- 수저1 art:low sport:low: dojang · afterschool · housework (209)
- 수저1 art:low sport:mid: dojang · afterschool · housework (241)
- 수저1 art:mid sport:high: dojang · afterschool · housework (11)
- 수저1 art:mid sport:low: dojang · afterschool · housework (231)
- 수저1 art:mid sport:mid: dojang · afterschool · housework (282)
- 수저5 art:high sport:low: dojang · lesson · academies (9)
- 수저5 art:high sport:mid: dojang · lesson · academies (12)
- 수저5 art:low sport:high: dojang · academies · sportclub (12)
- 수저5 art:low sport:low: dojang · academies · sportclub (179)
- 수저5 art:low sport:mid: dojang · academies · sportclub (223)
- 수저5 art:mid sport:high: dojang · lesson · academies (16)
- 수저5 art:mid sport:low: dojang · lesson · academies (224)
- 수저5 art:mid sport:mid: dojang · lesson · academies (324)

### G2
- 수저1 art:high sport:low: general · vocational · nightwork (10)
- 수저1 art:high sport:mid: general · vocational · nightwork (11)
- 수저1 art:low sport:high: general · vocational · athlete (13)
- 수저1 art:low sport:low: general · vocational · nightwork (173)
- 수저1 art:low sport:mid: general · vocational · nightwork (245)
- 수저1 art:mid sport:high: general · vocational · athlete (21)
- 수저1 art:mid sport:low: general · vocational · nightwork (217)
- 수저1 art:mid sport:mid: general · vocational · nightwork (303)
- 수저5 art:high sport:high: general · exam · arts (1)
- 수저5 art:high sport:low: general · exam · arts (16)
- 수저5 art:high sport:mid: general · exam · arts (20)
- 수저5 art:low sport:high: general · exam · arts (23)
- 수저5 art:low sport:low: general · exam · arts (132)
- 수저5 art:low sport:mid: general · exam · arts (216)
- 수저5 art:mid sport:high: general · exam · arts (33)
- 수저5 art:mid sport:low: general · exam · arts (209)
- 수저5 art:mid sport:mid: general · exam · arts (349)

### G3
- 수저1 : apply · work · night (453)
- 수저5 : apply · retry · work (570)

## 진로 일정 (결정 후속 239) — 게임 나이(한국 나이 = +1)

| 수저 | 집단 | 판 | 첫 분야 카드 중앙값 | 병역 줄 중앙값 | 35세 직업 확정 |
|---:|---|---:|---:|---:|---:|
| 1 | 여자 · 대학 | 156 | 23 | - | 100.0% |
| 1 | 여자 · 비대학 | 333 | 19 | - | 100.0% |
| 1 | 남자 · 대학 | 145 | 25 | 20 | 100.0% |
| 1 | 남자 · 비대학 | 366 | 22 | 20 | 100.0% |
| 5 | 여자 · 대학 | 210 | 24 | - | 100.0% |
| 5 | 여자 · 비대학 | 322 | 19 | - | 100.0% |
| 5 | 남자 · 대학 | 218 | 26 | 21 | 100.0% |
| 5 | 남자 · 비대학 | 250 | 22 | 20 | 100.0% |

exit 0
