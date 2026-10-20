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

/** 버전 글자 `x.y.z`(각 0~9999의 정수) — 새 소식(NT)의 버전과 설정 `notesSeen`이 쓰는 꼴 */
export const VERSION_PATTERN = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;

/**
 * 두 버전 `x.y.z`의 순서: 앞이 더 낮으면 음수, 같으면 0, 높으면 양수. 꼴이 맞지 않는 글자는 `null` (비교할 수 없다 — 호출한 쪽이 「본 적 없음」으로 본다).
 * 문자열 비교가 아니라 숫자 비교다(`0.10.0`이 `0.9.0`보다 높다).
 */
export function compareVersions(a: string, b: string): number | null {
  const ma = VERSION_PATTERN.exec(a);
  const mb = VERSION_PATTERN.exec(b);
  if (ma === null || mb === null) return null;
  for (let i = 1; i <= 3; i++) {
    const d = Number(ma[i]) - Number(mb[i]);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * 첫 화면 푸터의 「새 소식」 링크 옆에 「새」 표시를 달 것인가 (SPEC-005 NT4): 지금 버전(`current`)이 마지막으로 본 버전(`seen`)보다 높으면 참.
 * `seen`이 빈 글자이거나 꼴이 맞지 않으면 「본 적 없음」이라 참(처음 온 사람에게는 새 소식이 있다). 지금 버전의 꼴을 읽을 수 없으면(빌드 상수가 없는 환경의 `0.0.0`은 꼴이 맞지만
 * 노트가 없다 — 꼴이 아예 틀린 값) 비교할 수 없으므로 거짓 — 알리지 않는다.
 */
export function hasUnseenNotes(current: string, seen: string): boolean {
  if (!VERSION_PATTERN.test(current)) return false;
  const order = compareVersions(current, seen);
  return order === null ? true : order > 0;
}
