/**
 * 맞춤 인생(기질·적성·직업·외모 영향) 롤백 스위치 (SPEC-018 PL1, `docs/data/persona-model.md` 6-3절) — `ASK_PET_ENABLED` 전례.
 *
 * `false`이면 새 판이 `persona`를 만들지 않고, 기질 갱신·적성 키움·자동 모드 끌림·`temper`·`apt`·`job`·`tailored` 조건·진로 트랙·`LOOKERA`·`HIREYEAR`가 모두 꺼진다(저장된 `persona`는 지우지 않고 그대로 통과시킨다 —
 * 이미 `hired`인 판의 `job`·`has_career`·`jobMul`은 확정이라 소득은 유지). **외모 표준 표(`LOOKW`·사업 외모 항 삭제)는 되돌리지 않는다** — `persona`가 없는 판·끈 판에도 적용하는 밸런스 변경이다(F11, 6-3절).
 * 스위치가 꺼져 있는 판의 인생은 외모 표준 표 예외 목록(설계 4B) 말고는 **변경 전과 비트 단위로 같다**(골든 `tests/personaCondition.test.ts`·`tests/eligibilityGoldenBoundary.test.ts`는 이 스위치를 끈 경로로 고정한다).
 *
 * **3b단계(PL16)에서 `true`로 켰다**(2·3a단계 출하 값은 `false`). 시험은 꺼야 할 때 `vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: false }))`를 쓴다.
 */
export const PERSONA_ENABLED: boolean = true;
