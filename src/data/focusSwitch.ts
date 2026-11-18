/**
 * 올해의 초점 롤백 스위치 (SPEC-018 PL10, `docs/data/focus-spend-model.md` 4절 · M4) — `GATE_TOGETHER`(`core/careerTrack.ts`)와 같은 방식이고 `PERSONA_ENABLED`와 독립이다.
 *
 * `false`이면 (a) `focusEffectiveOf`가 늘 `null`이라 추첨에 초점이 닿지 않고(곱은 리터럴 1 — 변경 전과 바이트 동일) (b) 화면이 패널을 보이지 않으며 (c) `setFocus`가 무시된다.
 * **저장된 `focus`는 지우지 않고 통과시킨다**(다시 켜면 이어진다). 시험·측정은 `core/focus.ts#withFocusEnabled`로 한 호출 동안만 바꾼다.
 *
 * **출하 값 `false`(결정 후속 268, 2026-11-18)**: 지금 사건 풀에서는 고른 주제를 그 시기에 한 번도 만나지 못하는 판이 얇은 칸에서 33~56%라
 * 「다가가는 일」 사건을 먼저 채우고 경제식 재설계 배포에 화면(PL12)과 함께 켠다(`ai-log/2026-11-18_SPEC-018_PL10-dev.md` 6절).
 */
export const FOCUS_ENABLED: boolean = false;
