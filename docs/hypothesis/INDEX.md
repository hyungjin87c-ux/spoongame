# 제품 가설·반론 장부

게임의 핵심 가설과 검증 결과를 따로 관리한다. **실측과 추정을 칸으로 나눈다.** 레드팀(Codex C 유형) 결과는 각 가설 파일의 「반론」 절에 붙인다.

- 가설 상태: PROPOSED · CHALLENGED · TEST_PLANNED · TESTING · SUPPORTED · REFUTED · INCONCLUSIVE · SUPERSEDED · ARCHIVED
- 반론 상태: OPEN · UNDER_TEST · MITIGATED · CONFIRMED · DISPROVED · ACCEPTED_RISK
- 레드팀 판정: CHALLENGE · CAUTION · SUPPORTED · INCONCLUSIVE
- 사전 평가: 중요도 0~3 · 근거 수준 0~3 · 검증 가능성 0~2 · 실행 가능성 0~2
- 사후 성과: LEVEL 0 검증 안 됨 · 1 검증 지식 확보 · 2 검증으로 결정 개선 · 3 기준선 대비 실측 개선

| ID | 가설 | 상태 | 사전(중요·근거·검증·실행) | LEVEL | 근거 |
|---|---|---|---|---|---|
| [HYP-001](HYP-001.md) | 출생 수저 분포가 실제 소득 분위와 맞는다 | PROPOSED | 3·2·2·2 (추정) | 0 | `docs/data/realism-calibration.md` |
| [HYP-002](HYP-002.md) | 부모 재력과 학력·소득의 조건부 상관이 실제 이동성 통계와 맞는다 | PROPOSED | 3·2·2·1 (추정) | 0 | `docs/data/dc10-mobility-inequality.md`, `docs/data/economy-model.md` |
| [HYP-003](HYP-003.md) | 개인의 선택과 구조적 제약이 균형 있게 느껴진다 | PROPOSED | 3·1·1·2 (추정) | 0 | 엔딩 분포, 플레이테스트 |
| [HYP-004](HYP-004.md) | 게임이 무력감·편견이 아니라 공감을 만든다 | PROPOSED | 3·0·1·1 (추정) | 0 | 플레이테스트 |
| [HYP-005](HYP-005.md) | 교육 효과(불평등 이해)를 잴 수 있다 | PROPOSED | 2·0·1·1 (추정) | 0 | 측정 수단 없음 |
