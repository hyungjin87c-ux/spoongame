/**
 * 빌드 버전 표기 (SPEC-003 FS7·DB7·QM2-7). 이슈 보고에서 어느 빌드인지 알 수 있게 첫 화면 푸터에 `v<버전> (<커밋 7자>)`로 적는다.
 * 값은 빌드 때 vite가 상수로 넣고(vite.config.ts → define), 이 함수는 문구만 만든다. 커밋을 알 수 없으면(깃 없는 빌드) 「개발 빌드」.
 * 커밋은 **배포된 커밋**이다: CI(`GITHUB_SHA`) 빌드는 그 앞 7자, 로컬 빌드는 작업 트리 `HEAD` 앞 7자이고 커밋되지 않은 변경이 있으면 끝에 「+」가 붙는다(`abc1234+`) — 배포본과 같다고 오해되지 않게.
 */
export function formatBuildLabel(version: string, commit: string | null | undefined): string {
  const v = version.trim() === '' ? '0.0.0' : version.trim();
  const m = /^([0-9a-f]{7,40})(\+?)$/.exec((commit ?? '').trim().toLowerCase());
  return m === null ? `v${v} (개발 빌드)` : `v${v} (${m[1].slice(0, 7)}${m[2]})`;
}
