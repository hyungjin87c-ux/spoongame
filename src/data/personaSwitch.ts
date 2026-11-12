/**
 * 맞춤 인생(기질·적성·직업·외모 영향) 롤백 스위치 (SPEC-018 PL1, `docs/data/persona-model.md` 6-3절) — `ASK_PET_ENABLED` 전례.
 *
 * `false`이면 새 판이 `persona`를 만들지 않고, 기질 갱신·적성 키움·자동 모드 끌림·`temper`·`apt`·`job`·`tailored` 조건이 모두 꺼진다(저장된 `persona`는 지우지 않고 그대로 통과시킨다).
 * 스위치가 꺼져 있는 판의 인생은 **변경 전과 비트 단위로 같다**(골든 `tests/personaCondition.test.ts`·`tests/eligibilityGoldenBoundary.test.ts`).
 *
 * **2단계(PL1~PL3 코어)에서는 `false`로 둔다**: 아직 이 값을 읽는 사건·화면이 없고, 켜면 자동 모드 선택 확률(`autoChoiceWeights`의 기질 보정 `TP`)이 바뀌어
 * 1단계 진행 골든(`eligibility-golden-progress.json` — 변경 전 코드의 자동 선택 기록)이 달라진다. 켜는 시점·골든 허용 규칙은 마스터가 3단계 때 정한다.
 * 시험은 `vi.mock('../src/data/personaSwitch', …)`로 켜서 돌린다.
 */
export const PERSONA_ENABLED: boolean = false;
