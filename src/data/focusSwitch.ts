/**
 * 올해의 초점 롤백 스위치 (SPEC-018 PL10, `docs/data/focus-spend-model.md` 4절 · M4) — `GATE_TOGETHER`(`core/careerTrack.ts`)와 같은 방식이고 `PERSONA_ENABLED`와 독립이다.
 *
 * `false`이면 (a) `focusEffectiveOf`가 늘 `null`이라 추첨에 초점이 닿지 않고(곱은 리터럴 1 — 변경 전과 바이트 동일) (b) 화면이 패널을 보이지 않으며 (c) `setFocus`가 무시된다.
 * **저장된 `focus`는 지우지 않고 통과시킨다**(다시 켜면 이어진다). 시험·측정은 `core/focus.ts#withFocusEnabled`로 한 호출 동안만 바꾼다.
 */
export const FOCUS_ENABLED: boolean = true;
