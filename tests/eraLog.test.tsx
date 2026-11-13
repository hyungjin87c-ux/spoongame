import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EraRow } from '../src/core/eraWindow';
import type { HistoryEntry } from '../src/core';
import { lifeLineCount } from '../src/core/notes';
import { HEAVY_KIND_NAME_MAX } from '../src/data/gentleText';
import { SCENE_TEXT } from '../src/data/sceneText';
import { EraLogRow } from '../src/ui/dash/EraRow';
import { LogCard } from '../src/ui/dash/LogCard';
import { isEraRow, logRows, mergeLogRows } from '../src/ui/dash/logOrder';

/**
 * 인생 기록의 「시대의 창」 줄 (SPEC-009 FM5, FM2d, family-scene.md 5-4절): 저장하지 않는 파생 줄 — 끼워 넣는 자리, 기존 기록과의 분리(저장·판 길이 모델에 닿지 않음), 줄의 구조(세 겹 구분·id·초점), 가리기.
 * 승인된 문장이 0이라 데이터가 없을 때는 인생 기록이 이전과 똑같다는 것도 단언한다.
 */

const e = (age: number, kind: HistoryEntry['kind'], text: string, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({ age, kind, text, ...extra });
const BASE: HistoryEntry[] = [
  e(0, 'stage', '태어났습니다.'),
  e(2, 'event', '열이 났습니다.', { eventId: 'infant-fever' }),
  e(2, 'choice', '병원에 갔습니다.', { eventId: 'infant-care', choice: '병원에 간다' }),
  e(7, 'stage', '학교에 들어갈 나이가 되었습니다.'),
];
const row = (age: number, year: number, over: Partial<EraRow> = {}): EraRow => ({ age, year, line: `${year}년의 한 줄입니다.`, heavy: false, veiled: false, forecast: false, ...over });

describe('mergeLogRows — 끼워 넣기', () => {
  it('시대 줄이 없으면 logRows(history)와 **같은 배열 내용**이고 모든 줄이 기존 줄이다(승인된 그림 0장일 때 인생 기록은 이전과 같다)', () => {
    const merged = mergeLogRows(BASE, []);
    expect(merged).toEqual(logRows(BASE));
    expect(merged.some(isEraRow)).toBe(false);
    expect(mergeLogRows([], [row(0, 1980)])).toEqual([]);
  });

  it('시대 줄은 그해의 첫 기록 앞(시간순)에 서고, 0세는 출생 줄 바로 뒤다 — 화면(최신순)에서는 그해 기록들 아래·앞 해 위', () => {
    const merged = mergeLogRows(BASE, [row(0, 1980), row(2, 1982), row(5, 1985), row(7, 1987)]);
    const chrono = [...merged].reverse().map((r) => (isEraRow(r) ? `시대${r.era.age}` : `${r.entry.age}${r.entry.kind[0]}`));
    expect(chrono).toEqual(['0s', '시대0', '시대2', '2e', '2c', '시대5', '시대7', '7s']);
  });

  it('현재 나이에 아직 기록이 없는 해의 시대 줄은 맨 위(최신)에 선다', () => {
    const merged = mergeLogRows(BASE, [row(9, 1989)]);
    expect(isEraRow(merged[0])).toBe(true);
    expect(merged[0].key).toBe('era-y1989');
    expect(merged[0].latest).toBe(false);
    // 가장 최근 **기록** 줄은 그대로 latest다
    expect(merged.filter((r) => !isEraRow(r) && r.latest).length).toBe(1);
  });

  it('키는 해마다 하나이고 안정적이다: 기록이 쌓여도 시대 줄의 키·상대 순서가 바뀌지 않는다', () => {
    const a = mergeLogRows(BASE, [row(2, 1982)]).map((r) => r.key);
    const b = mergeLogRows([...BASE, e(7, 'event', '준비물을 샀습니다.')], [row(2, 1982)]).map((r) => r.key);
    expect(b.slice(1)).toEqual(a);
    expect(new Set(b).size).toBe(b.length);
  });

  it('남은 기록의 첫 나이보다 앞선 해(기록 상한에서 지워진 해)의 시대 줄은 목록 끝에 홀로 남지 않는다', () => {
    const trimmed = BASE.slice(3); // 7세부터
    const merged = mergeLogRows(trimmed, [row(0, 1980), row(3, 1983), row(7, 1987)]);
    expect(merged.filter(isEraRow).map((r) => r.era.age)).toEqual([7]);
  });

  it('저장 순서(history)와 판 길이 모델에 닿지 않는다(A-12): 입력 기록이 바뀌지 않고, 연출 줄 수(`lifeLineCount`)가 같다', () => {
    const before = JSON.stringify(BASE);
    const lines = lifeLineCount(BASE);
    mergeLogRows(BASE, [row(0, 1980), row(2, 1982), row(7, 1987)]);
    expect(JSON.stringify(BASE)).toBe(before);
    expect(lifeLineCount(BASE)).toBe(lines);
  });
});

describe('EraLogRow — 줄의 구조(세 겹 구분)', () => {
  const html = (r: EraRow, open = false) => renderToStaticMarkup(<EraLogRow row={r} open={open} onToggle={() => undefined} />);

  it('li.log__row--tl[data-tl="era"] id="log-y<연도>" tabindex="-1" — 나이 + 작은 연도 · 표지 「시대의 창」 + 창 아이콘 · 문장', () => {
    const out = html(row(16, 1988, { line: '서울에서 올림픽이 열렸습니다.' }));
    expect(out).toContain('class="log__row log__row--tl"');
    expect(out).toContain('data-kind="timeline"');
    expect(out).toContain('data-tl="era"');
    expect(out).toContain('id="log-y1988"');
    expect(out).toContain('tabindex="-1"');
    expect(out).toMatch(/<span class="log__age">17세<small class="log__year">1988<\/small><\/span>/);
    expect(out).toContain('<use href="#i-era"');
    expect(out).toMatch(/<span class="log__tl">[\s\S]*<span>시대의 창<\/span><\/span>/);
    expect(out).toContain('<span class="log__sent">서울에서 올림픽이 열렸습니다.</span>');
    expect(out).not.toContain('data-veiled');
  });

  it('가린 줄: 안내 + 「펼쳐 보기」 버튼, 원문은 hidden — 표지와 줄 구조는 그대로(가리지 않는다)', () => {
    const out = html(row(2, 1980, { heavy: true, veiled: true, line: '5월의 일입니다.' }));
    expect(out).toContain('data-veiled="true"');
    expect(out).toContain('시대의 창');
    expect(out).toContain('무거운 일이 있었습니다');
    expect(out).toContain('시대의 일');
    expect(out).toContain('aria-expanded="false"');
    expect(out).toMatch(/aria-controls="veil-era-1980"/);
    expect(out).toMatch(/<span class="veil__body log__sent" id="veil-era-1980" hidden="" data-testid="veil-body">5월의 일입니다\.<\/span>/);
    expect(html(row(2, 1980, { heavy: true, veiled: true, line: '5월의 일입니다.' }), true)).not.toMatch(/id="veil-era-1980" hidden/);
  });

  it('인생 기록 카드에 끼면 li가 기록 줄 사이에 함께 그려지고, 시대 줄이 없으면 이전과 같은 줄 수다', () => {
    const plain = renderToStaticMarkup(<LogCard history={BASE} live={false} />);
    const with2 = renderToStaticMarkup(<LogCard history={BASE} live={false} eraRows={[row(0, 1980), row(2, 1982)]} />);
    expect((plain.match(/<li /g) ?? []).length).toBe(BASE.length);
    expect((with2.match(/<li /g) ?? []).length).toBe(BASE.length + 2);
    // 화면은 최신순이라 시간순으로 그해 첫 기록 앞에 선 시대 줄은 그해 기록들 **아래**에 그려진다
    expect(with2.indexOf('id="log-y1982"')).toBeGreaterThan(with2.indexOf('열이 났습니다.'));
    expect(with2.indexOf('id="log-y1982"')).toBeLessThan(with2.indexOf('태어났습니다.'));
  });
});

describe('문구 (R-548)', () => {
  it('가리기 안내의 분류 이름 「시대의 일」은 6자 이하(HEAVY_KIND_NAME_MAX)이고, 안 쓰는 문구(eraEmpty)는 없다', () => {
    expect(SCENE_TEXT.eraVeilKind).toBe('시대의 일');
    expect(SCENE_TEXT.eraVeilKind.length).toBeLessThanOrEqual(HEAVY_KIND_NAME_MAX);
    expect('eraEmpty' in SCENE_TEXT).toBe(false);
  });
});
