/**
 * 「시대의 창」 칸 → 그해 인생 기록 줄로 가기 (SPEC-009 FM5, FT5, family-scene.md 5-4절). 칸 전체가 링크 하나(초점 정지점 1)이고, 누르면 인생 기록의 그해 시대 줄(`#log-y<year>`)로 가서
 * 초점을 주고 잠깐 강조(`data-flash`)한다. 주소(#)는 바꾸지 않는다 — 뒤로가기 기록을 더럽히지 않는다.
 * 줄이 아직 없으면(그 해 덩어리가 오지 않았거나 줄이 없는 해) 아무 일도 하지 않는다(링크의 기본 이동도 막는다).
 * 문서를 직접 만지지 않고 찾아 주는 함수와 타이머를 받는다 — 합성 요소로 시험하려고(`tests/eraLink.test.ts`, 실제 브라우저는 `e2e/family-scene.spec.ts`).
 */

/** 줄 요소가 해야 하는 일 (DOM `HTMLElement`의 일부) */
export interface LogRowLike {
  scrollIntoView(options: ScrollIntoViewOptions): void;
  focus(options?: FocusOptions): void;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** 강조가 머무는 시간(ms) — 줄 강조 애니메이션(2.4초)보다 조금 길다 */
export const FLASH_MS = 2600;

/** 그해 줄로 간다. 줄을 찾으면 true */
export function goToLogRow(find: (id: string) => LogRowLike | null, year: number, reduced: boolean, later: (fn: () => void, ms: number) => void): boolean {
  const row = find(`log-y${year}`);
  if (row === null) return false;
  row.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  row.focus({ preventScroll: true });
  row.setAttribute('data-flash', 'true');
  later(() => row.removeAttribute('data-flash'), FLASH_MS);
  return true;
}
