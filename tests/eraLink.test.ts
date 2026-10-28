import { describe, expect, it } from 'vitest';
import { FLASH_MS, goToLogRow, type LogRowLike } from '../src/ui/scene/eraLink';

/**
 * 시대의 창 칸 → 그해 인생 기록 줄로 가기 (SPEC-009 FM5, FT5, 검수 R-546). 이 저장소는 jsdom을 들이지 않으므로(시험 환경 node) **합성 줄 요소**로 이동·초점·`data-flash`를 본다.
 * 진짜 DOM에서의 클릭 → 스크롤·초점 이동은 e2e/family-scene.spec.ts가 본다.
 */
function fakeRow(): { row: LogRowLike; calls: string[]; attrs: Map<string, string> } {
  const calls: string[] = [];
  const attrs = new Map<string, string>();
  return {
    calls,
    attrs,
    row: {
      scrollIntoView: (o) => void calls.push(`scroll:${o.block}/${o.behavior}`),
      focus: (o) => void calls.push(`focus:${o?.preventScroll === true ? 'noScroll' : 'scroll'}`),
      setAttribute: (n, v) => void attrs.set(n, v),
      removeAttribute: (n) => void attrs.delete(n),
    },
  };
}
const later = (): { fn: (f: () => void, ms: number) => void; run: () => void; waited: number[] } => {
  const queue: Array<() => void> = [];
  const waited: number[] = [];
  return { fn: (f, ms) => { queue.push(f); waited.push(ms); }, run: () => queue.splice(0).forEach((f) => f()), waited };
};

describe('goToLogRow — 창 → 그해 줄', () => {
  it('그해 줄(`log-y<연도>`)을 찾아 화면에 넣고 초점을 주고 강조(data-flash)를 켠다 — 초점은 화면을 또 끌지 않는다(preventScroll)', () => {
    const { row, calls, attrs } = fakeRow();
    const asked: string[] = [];
    const t = later();
    const found = goToLogRow((id) => { asked.push(id); return id === 'log-y1980' ? row : null; }, 1980, false, t.fn);
    expect(found).toBe(true);
    expect(asked).toEqual(['log-y1980']);
    expect(calls).toEqual(['scroll:nearest/smooth', 'focus:noScroll']);
    expect(attrs.get('data-flash')).toBe('true');
  });

  it('강조는 잠깐(2.6초) 뒤에 꺼진다 — 줄 강조 애니메이션(2.4초)보다 조금 길다', () => {
    const { row, attrs } = fakeRow();
    const t = later();
    goToLogRow(() => row, 1987, false, t.fn);
    expect(t.waited).toEqual([FLASH_MS]);
    expect(FLASH_MS).toBeGreaterThan(2400);
    expect(attrs.has('data-flash')).toBe(true);
    t.run();
    expect(attrs.has('data-flash')).toBe(false);
  });

  it('움직임 줄이기면 부드러운 스크롤 대신 즉시(auto)', () => {
    const { row, calls } = fakeRow();
    goToLogRow(() => row, 1975, true, later().fn);
    expect(calls[0]).toBe('scroll:nearest/auto');
  });

  it('그해 줄이 없으면(그 해 덩어리가 아직 오지 않았거나 줄이 없는 해) 아무 일도 하지 않고 false다 — 타이머도 걸지 않는다', () => {
    const t = later();
    expect(goToLogRow(() => null, 1992, false, t.fn)).toBe(false);
    expect(t.waited).toEqual([]);
  });

  it('연타: 같은 줄을 두 번 누르면 강조가 다시 켜지고 두 타이머가 모두 끝나면 꺼진다(남지 않는다)', () => {
    const { row, attrs } = fakeRow();
    const t = later();
    goToLogRow(() => row, 1980, false, t.fn);
    goToLogRow(() => row, 1980, false, t.fn);
    expect(attrs.get('data-flash')).toBe('true');
    t.run();
    expect(attrs.has('data-flash')).toBe(false);
  });
});
