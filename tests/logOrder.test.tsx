import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { startLife } from '../scripts/simulateLib';
import { playToEnd, type HistoryEntry } from '../src/core';
import { appendHistory } from '../src/core/history';
import { HISTORY_LIMITS } from '../src/data/lifeTable';
import { LogCard } from '../src/ui/dash/LogCard';
import { LogList } from '../src/ui/dash/LogList';
import { LOG_TOP_SLACK, RESIZE_EPSILON, addedAbove, isAtLogTop, logRowKeys, logRows, resizePlan, scrollPlan } from '../src/ui/dash/logOrder';

/**
 * 인생 기록 최신순 (SPEC-005 QI1, LR1~LR7) — 순서·키·위치 보정 계획·문구·CSS 규칙을 확인한다.
 * 브라우저가 있어야 하는 것(실제 스크롤 위치가 움직이지 않는지, Home/End, WebKit)은 e2e/log-order.spec.ts가 본다.
 */

const MINUTE = 29_846_880;

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 CSS는 파일 시스템으로 읽는다(tests/docCssFallback.test.ts와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const CSS_FILES = ['doc.css', 'dash.css', 'title.css', 'tokens.css'];
const SRC_CSS: Record<string, string> = Object.fromEntries(await Promise.all(CSS_FILES.map(async (f): Promise<[string, string]> => [f, await readText(`../src/styles/${f}`).catch(() => '')])));
const dashCss = SRC_CSS['dash.css'];
/** src 아래 모든 .ts·.tsx 파일의 원문 (Vite의 ?raw 가져오기) */
const SRC_CODE = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const e = (age: number, kind: HistoryEntry['kind'], text: string, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({ age, kind, text, ...extra });
const BASE: HistoryEntry[] = [
  e(0, 'stage', '태어났습니다.'),
  e(2, 'event', '열이 났습니다.', { eventId: 'infant-fever' }),
  e(2, 'choice', '병원에 갔습니다.', { eventId: 'infant-care', choice: '병원에 간다' }),
  e(7, 'stage', '학교에 들어갈 나이가 되었습니다.'),
  e(7, 'event', '준비물을 샀습니다.', { eventId: 'school-supplies' }),
];
const renderLog = (history: readonly HistoryEntry[], live = true) => renderToStaticMarkup(<LogCard history={history} name="김민준" live={live} minute={MINUTE} />);
const rowsOf = (html: string) => [...html.matchAll(/<li class="([^"]*)" data-kind="([^"]*)" data-testid="log-row">([\s\S]*?)<\/li>/g)].map((m) => ({ cls: m[1], kind: m[2], html: m[3] }));
const plain = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

describe('LR1 순서: 화면만 뒤집고 저장 순서는 그대로', () => {
  it('logRows는 저장 순서의 거꾸로이고 첫 줄만 latest다. 입력 배열은 바뀌지 않는다', () => {
    const before = JSON.stringify(BASE);
    const rows = logRows(BASE);
    expect(rows.map((r) => r.entry)).toEqual([...BASE].reverse());
    expect(rows.map((r) => r.index)).toEqual([4, 3, 2, 1, 0]);
    expect(rows.map((r) => r.latest)).toEqual([true, false, false, false, false]);
    expect(JSON.stringify(BASE), '저장 순서 불변').toBe(before);
  });

  it('같은 나이 안에서도 나중에 쌓인 줄이 위다 (결정 결과 줄이 같은 해 사건 줄 위)', () => {
    const sameYear = logRows([e(2, 'event', '사건'), e(2, 'choice', '결과', { choice: '선택' })]);
    expect(sameYear.map((r) => r.entry.kind)).toEqual(['choice', 'event']);
    const html = renderLog([e(0, 'stage', '출생'), e(3, 'event', '사건'), e(3, 'choice', '결과', { choice: '선택' })]);
    expect(rowsOf(html).map((r) => r.kind)).toEqual(['choice', 'event', 'stage']);
  });

  it('렌더 결과(DOM 순서)가 곧 화면 순서다: 나이가 위에서 아래로 늘지 않고, 첫 줄이 굵게(latest), 끝 줄이 출생이다', () => {
    const rows = rowsOf(renderLog(BASE));
    expect(rows).toHaveLength(BASE.length);
    expect(rows.map((r) => Number(/^(\d+)세/.exec(plain(r.html))![1]))).toEqual([7, 7, 2, 2, 0]);
    expect(rows.map((r) => r.cls.includes('log__row--latest'))).toEqual([true, false, false, false, false]);
    expect(rows.at(-1)!.kind).toBe('stage');
    expect(plain(rows[0].html)).toContain('준비물을 샀습니다.');
  });

  it('진짜 한 판(세 시대): 화면 줄 = 연표를 거꾸로 읽은 것, 나이는 비증가, 단계 줄(출생 포함)이 각 묶음의 맨 아래에 온다 (LR3)', () => {
    for (const [seed, era] of [[11, 'past'], [22, 'present'], [33, 'future']] as const) {
      const game = playToEnd(startLife(seed, era)).state;
      const rows = rowsOf(renderLog(game.history));
      expect(rows).toHaveLength(game.history.length);
      rows.forEach((r, i) => expect(r.kind, `${era} ${i}번째`).toBe(game.history[game.history.length - 1 - i].kind));
      const ages = rows.map((r) => Number(/^(\d+)세/.exec(plain(r.html))![1]));
      expect(ages, era).toEqual([...ages].sort((a, b) => b - a));
      // 단계 줄은 그 단계에서 가장 오래된 줄이다 — 같은 나이의 다른 줄보다 아래에 있다
      rows.forEach((r, i) => {
        if (r.kind !== 'stage') return;
        const next = rows[i + 1];
        if (next !== undefined) expect(Number(/^(\d+)세/.exec(plain(next.html))![1]), `${era}: 단계 줄 아래는 이전 단계`).toBeLessThanOrEqual(ages[i]);
      });
    }
  });

  it('「나의 기록」 줄은 쓴 시점의 나이로 맨 위에 새 줄로 붙는다 (LR5 a)', () => {
    const note = e(9, 'note', '오늘의 생각', { title: '지금의 생각' });
    const rows = rowsOf(renderLog([...BASE, note]));
    expect(rows[0].kind).toBe('note');
    expect(rows[0].cls).toContain('log__row--note');
    expect(rows[0].cls).toContain('log__row--latest');
    expect(rows[1].kind).toBe('event');
  });

  it('맨 위 고정 줄(가상 인구)은 쌓이는 기록 밖 맨 위 그대로다 (LR3)', () => {
    const html = renderLog(BASE);
    expect(html.indexOf('data-testid="log-pin"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="log-pin"')).toBeLessThan(html.indexOf('data-testid="log-list"'));
  });
});

describe('LR1·LR7 키: 뒤집어도, 상한에서 오래된 줄이 지워져도 남은 줄은 다시 만들어지지 않는다', () => {
  it('키는 중복이 없고 저장 순서의 인덱스가 아니라 줄의 꼴(나이·종류·이벤트)에서 온다', () => {
    const keys = logRowKeys(BASE);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[2]).toBe('2-choice-infant-care-0');
    // 「나의 기록」이 같은 나이에 둘이어도 먼저 쌓인 순서로 가른다
    const twoNotes = logRowKeys([e(0, 'stage', 'a'), e(5, 'note', 'x'), e(5, 'note', 'y')]);
    expect(new Set(twoNotes).size).toBe(3);
  });

  it('줄이 하나 쌓여도 기존 줄의 키는 그대로이고 새 키 하나만 맨 위에 생긴다', () => {
    const before = logRows(BASE).map((r) => r.key);
    const after = logRows([...BASE, e(8, 'event', '새 줄', { eventId: 'school-friend' })]).map((r) => r.key);
    expect(after.slice(1)).toEqual(before);
    expect(before).not.toContain(after[0]);
  });

  it('상한(300줄)에서 오래된 줄이 지워지면 그 줄의 키만 사라지고 나머지 키는 그대로다 (LR7, 진짜 appendHistory)', () => {
    let history: HistoryEntry[] = [e(0, 'stage', '태어났습니다.')];
    for (let i = 1; i < HISTORY_LIMITS.maxEntries; i++) history = appendHistory(history, e(1 + Math.floor(i / 3), i % 5 === 0 ? 'choice' : 'event', `줄 ${i}`, { eventId: `ev-${i}` }));
    expect(history).toHaveLength(HISTORY_LIMITS.maxEntries);
    const before = logRows(history).map((r) => r.key);
    const next = appendHistory(history, e(101, 'event', '마지막 새 줄', { eventId: 'ev-new' }));
    expect(next, '길이는 상한 그대로').toHaveLength(HISTORY_LIMITS.maxEntries);
    const after = logRows(next).map((r) => r.key);
    const gone = before.filter((k) => !after.includes(k));
    const born = after.filter((k) => !before.includes(k));
    expect(gone, '지워진 줄은 하나').toHaveLength(1);
    expect(born, '새 줄도 하나').toHaveLength(1);
    expect(after[0], '새 줄이 맨 위').toBe(born[0]);
    expect(after.slice(1), '나머지는 순서·키 모두 그대로(지워진 줄만 빠짐)').toEqual(before.filter((k) => k !== gone[0]));
    // 출생(맨 끝 줄)은 상한에서도 남는다
    expect(next[0].kind).toBe('stage');
    expect(logRows(next).at(-1)!.entry.kind).toBe('stage');
  });

  it('상한에서 길이가 그대로여도 「새 줄」을 센다: addedAbove는 지난 맨 위 줄 위의 줄 수다', () => {
    let history: HistoryEntry[] = [e(0, 'stage', '태어났습니다.')];
    for (let i = 1; i < HISTORY_LIMITS.maxEntries; i++) history = appendHistory(history, e(1 + Math.floor(i / 3), 'event', `줄 ${i}`, { eventId: `ev-${i}` }));
    const prevNewest = logRows(history)[0].key;
    const next = appendHistory(history, e(101, 'event', '새 줄', { eventId: 'ev-new' }));
    expect(next.length).toBe(history.length);
    expect(addedAbove(logRows(next), prevNewest)).toBe(1);
  });
});

describe('LR2 스크롤 계획: 맨 위면 머물고, 읽는 중이면 보던 줄이 밀린 만큼 내려 그 줄을 붙든다', () => {
  it('addedAbove: 처음(키 없음)은 0, 쌓인 수, 지난 맨 위 줄이 목록에 없으면 null(다른 판)', () => {
    const rows = logRows([...BASE, e(8, 'event', 'a', { eventId: 'x1' }), e(8, 'choice', 'b', { eventId: 'x1' })]);
    expect(addedAbove(rows, null)).toBe(0);
    expect(addedAbove(rows, rows[0].key)).toBe(0);
    expect(addedAbove(rows, rows[2].key)).toBe(2);
    expect(addedAbove(rows, 'nope')).toBeNull();
  });

  it('isAtLogTop: 24px 이하가 맨 위다', () => {
    expect(LOG_TOP_SLACK).toBe(24);
    expect(isAtLogTop(0)).toBe(true);
    expect(isAtLogTop(24)).toBe(true);
    expect(isAtLogTop(24.5)).toBe(false);
    expect(isAtLogTop(200)).toBe(false);
  });

  it('맨 위를 보고 있으면(≤ 24) 0으로 머물고 개수는 세지 않는다 — 새 줄이 바로 보인다', () => {
    expect(scrollPlan({ scrollTop: 0, shift: 80, added: 1, follow: false })).toEqual({ top: 0, unread: 0 });
    expect(scrollPlan({ scrollTop: 24, shift: 160, added: 2, follow: false })).toEqual({ top: 0, unread: 0 });
  });

  it('읽는 중이면(> 24) 보던 줄이 밀린 만큼 아래로 내려 보던 줄의 화면 위치를 지키고, 쌓인 수를 센다', () => {
    expect(scrollPlan({ scrollTop: 200, shift: 72.5, added: 1, follow: false })).toEqual({ top: 272.5, unread: 1 });
    expect(scrollPlan({ scrollTop: 25, shift: 300, added: 3, follow: false })).toEqual({ top: 325, unread: 3 });
  });

  it('「맨 위로」를 눌러 올라가는 중(follow)이면 어디에 있든 맨 위로 따라간다', () => {
    expect(scrollPlan({ scrollTop: 400, shift: 90, added: 1, follow: true })).toEqual({ top: 0, unread: 0 });
  });

  it('보정은 위치를 가만히 두는 뜻이다: 보던 줄의 새 화면 위치 = 옛 화면 위치 (수식 점검)', () => {
    // 보던 줄이 목록 안 y 위치 Y(쌓이기 전)에 있고 스크롤이 S였다면 화면 위치는 Y − S. 쌓인 뒤 줄은 Y + H에 있고 스크롤은 S + H이므로 같다
    for (const [S, H, Y] of [[200, 72, 500], [31.5, 140.25, 320], [1000, 33, 1500]] as const) {
      const plan = scrollPlan({ scrollTop: S, shift: H, added: 1, follow: false });
      expect(Y + H - plan.top).toBeCloseTo(Y - S, 6);
    }
  });
});

describe('R-439 줄이 다시 흐를 때(창 크기·글자 크기·화면 회전) 보던 줄을 지키는 계획', () => {
  it('맨 위였으면(기억한 위치 ≤ 24) 되맞추지 않는다 — 맨 위는 어떻게 흘러도 맨 위다', () => {
    expect(resizePlan({ rememberedScrollTop: 0, scrollTop: 0, shift: 120, follow: false })).toBeNull();
    expect(resizePlan({ rememberedScrollTop: LOG_TOP_SLACK, scrollTop: 24, shift: -40, follow: false })).toBeNull();
  });

  it('읽는 중이었으면(기억한 위치 > 24) 보던 줄이 밀린 만큼 옮겨 그 줄을 같은 자리에 붙든다: 글자가 커져 줄이 밀리면 내리고, 줄면 올린다', () => {
    expect(resizePlan({ rememberedScrollTop: 220, scrollTop: 220, shift: 96.5, follow: false })).toBe(316.5);
    expect(resizePlan({ rememberedScrollTop: 220, scrollTop: 220, shift: -80, follow: false })).toBe(140);
    // 브라우저가 줄어든 내용에 맞춰 위치를 끌어당겼어도(scrollTop이 기억과 다르다) 지금 위치에서 밀린 만큼 옮기면 그 줄이 기억한 거리에 온다
    expect(resizePlan({ rememberedScrollTop: 600, scrollTop: 310, shift: 55, follow: false })).toBe(365);
  });

  it('보던 줄이 이미 기억한 거리에 있으면(밀림 < 0.5px) 움직이지 않는다 — 새 줄 보정 뒤 뒤따르는 관찰자가 한 번 더 움직이지 않는다', () => {
    expect(resizePlan({ rememberedScrollTop: 220, scrollTop: 220, shift: 0, follow: false })).toBeNull();
    expect(resizePlan({ rememberedScrollTop: 220, scrollTop: 220, shift: RESIZE_EPSILON - 0.01, follow: false })).toBeNull();
    expect(resizePlan({ rememberedScrollTop: 220, scrollTop: 220, shift: -(RESIZE_EPSILON - 0.01), follow: false })).toBeNull();
    expect(resizePlan({ rememberedScrollTop: 220, scrollTop: 220, shift: RESIZE_EPSILON, follow: false })).toBe(220.5);
  });

  it('「맨 위로」가 부드럽게 올라가는 중(follow)이면 건드리지 않고, 위치는 0 밑으로 내려가지 않는다', () => {
    expect(resizePlan({ rememberedScrollTop: 400, scrollTop: 400, shift: 90, follow: true })).toBeNull();
    expect(resizePlan({ rememberedScrollTop: 400, scrollTop: 30, shift: -90, follow: false })).toBe(0);
  });

  it('되맞춤은 위치를 가만히 두는 뜻이다: 보던 줄의 새 화면 위치 = 기억한 화면 위치 (수식 점검)', () => {
    // 보던 줄이 영역 윗변에서 o만큼 떨어져 있었고(기억), 줄이 다시 흐른 뒤 윗변에서 o + shift로 밀렸다. 스크롤을 shift만큼 옮기면 다시 o다
    for (const [S, o, shift] of [[200, -14, 180], [31.5, 3.25, -9.5], [1000, 0, 333]] as const) {
      const top = resizePlan({ rememberedScrollTop: S, scrollTop: S, shift, follow: false })!;
      expect(o + shift - (top - S)).toBeCloseTo(o, 6);
    }
  });

  it('브라우저의 스크롤 고정을 끈 자리(overflow-anchor: none)는 LogList가 ResizeObserver로 되맞춘다 — 끄기만 하고 되맞춤이 없으면 아래에서 읽던 자리가 튄다', () => {
    const list = SRC_CODE['../src/ui/dash/LogList.tsx'];
    expect(list, 'LogList.tsx를 읽었다').toBeTruthy();
    expect(list).toContain('new ResizeObserver(');
    expect(list).toContain('resizePlan(');
    expect(list).toContain('this.observer?.disconnect()');
    expect(dashCss).toMatch(/.log__list {[^}]*overflow-anchor: none/);
  });
});

describe('R-438 「새 기록 N개 · 맨 위로」 알약 자리: 스크롤 영역 안, 줄 목록 앞의 높이 0 슬롯', () => {
  const renderList = (jump?: JSX.Element) =>
    renderToStaticMarkup(
      <LogList rows={logRows(BASE)} live scrollerRef={createRef<HTMLDivElement>()} following={{ current: false }} onScroll={() => undefined} onUserScroll={() => undefined} onUnread={() => undefined} onReset={() => undefined} jump={jump} />,
    );

  it('알약이 있으면 스크롤 영역(log__list) 안, 줄 목록(ol) 앞의 슬롯 안에 있고, 줄 목록(live region) 밖이다 — 개수가 바뀔 때마다 읽히지 않는다', () => {
    const html = renderList(<button type="button" className="btn btn--secondary btn--sm log__jump" data-testid="log-jump">새 기록 2개 · 맨 위로</button>);
    const slot = html.indexOf('<div class="log__jump-slot">');
    const pill = html.indexOf('data-testid="log-jump"');
    const ol = html.indexOf('<ol ');
    const olEnd = html.indexOf('</ol>');
    expect(slot, '슬롯이 있다').toBeGreaterThan(html.indexOf('class="log__list"'));
    expect(pill, '알약은 슬롯 안').toBeGreaterThan(slot);
    expect(html.indexOf('</div>', slot), '슬롯은 알약 하나만 감싼다').toBeGreaterThan(pill);
    expect(slot, '슬롯이 줄 목록보다 앞').toBeLessThan(ol);
    expect(pill < ol && pill < olEnd, '알약이 live region(ol) 밖').toBe(true);
    expect(html).not.toMatch(/<ol[^>]*>[\s\S]*log-jump[\s\S]*<\/ol>/);
  });

  it('알약이 없으면 슬롯도 없다(빈 슬롯을 남기지 않는다) — 줄 목록은 영역의 첫 자식이다', () => {
    const html = renderList();
    expect(html).not.toContain('log__jump-slot');
    expect(html).not.toContain('log-jump');
    expect(html.slice(html.indexOf('class="log__list"')).replace(/^[^>]*>/, '').startsWith('<ol ')).toBe(true);
  });

  it('LogCard는 알약을 스크롤 영역 안에서만 그린다: 목록 아래(카드 끝)에는 버튼이 없다 — 처음엔 알약도 슬롯도 없다 (unread 0)', () => {
    const html = renderLog(BASE);
    expect(html).not.toContain('log-jump');
    expect(html).not.toContain('log__jump-slot');
    expect(html.slice(html.indexOf('</ol>'))).not.toContain('<button');
  });

  it('CSS: 슬롯은 높이 0 sticky(top 0, 줄을 밀지 않는다)이고 알약은 슬롯 안 absolute — 위 가장자리에서 8px 아래 가운데, 알약 모서리·그림자·display: block·낱말 보호, ::before가 터치 대상 44px을 채운다', () => {
    const rule = (sel: string) => new RegExp(`${sel.replace(/[.[\]:]/g, '\\$&')} \\{[^}]*\\}`).exec(dashCss)![0];
    const slot = rule('.log__jump-slot');
    expect(slot).toMatch(/position: sticky/);
    expect(slot).toMatch(/top: 0/);
    expect(slot).toMatch(/height: 0/);
    expect(slot).toMatch(/z-index: 1/);
    expect(slot).toMatch(/overflow: visible/);
    const pill = rule('.log__jump');
    expect(pill).toMatch(/position: absolute/);
    expect(pill).toMatch(/top: var\(--sp-2\)/);
    expect(pill).toMatch(/left: var\(--sp-2\)/);
    expect(pill).toMatch(/right: var\(--sp-2\)/);
    expect(pill).toMatch(/width: fit-content/);
    expect(pill).toMatch(/margin: 0 auto/);
    expect(pill).toMatch(/display: block/);
    expect(pill).toMatch(/border-radius: var\(--r-pill\)/);
    expect(pill).toMatch(/box-shadow: var\(--shadow-2\)/);
    expect(pill).toMatch(/word-break: keep-all/);
    expect(pill).toMatch(/overflow-wrap: normal/);
    const hit = rule('.log__jump::before');
    expect(hit).toMatch(/position: absolute/);
    expect(hit).toMatch(/top: min\(0px, calc\(\(100% - var\(--hit\)\) \/ 2\)\)/);
    expect(hit).toMatch(/bottom: min\(0px, calc\(\(100% - var\(--hit\)\) \/ 2\)\)/);
    // 옛 자리(카드 끝의 보통 흐름 버튼)의 규칙은 남지 않는다
    expect(dashCss).not.toMatch(/\.log__jump \{[^}]*align-self: center/);
  });
});

describe('LR2 문구 · LR4 접근성 · CSS 규칙', () => {
  it('live region 속성이 유지된다: 빠른 진행·자동 모드가 아니면 polite, 아니면 off, 늘 additions', () => {
    for (const [live, expected] of [[true, 'polite'], [false, 'off']] as const) {
      const html = renderLog(BASE, live);
      expect(html).toContain(`<ol aria-live="${expected}" aria-relevant="additions" class="log__rows">`);
    }
  });

  it('영역은 키보드로 닿는 region(tabindex 0, 이름 「인생 기록」)이고 안내 문구가 설명이다 — 순서를 포커스에서 듣는다', () => {
    const html = renderLog(BASE);
    const tag = /<div class="log__list"[^>]*>/.exec(html)![0];
    expect(tag).toContain('role="region"');
    expect(tag).toContain('aria-label="인생 기록"');
    expect(tag).toContain('tabindex="0"');
    expect(tag).toContain('aria-describedby="log-hint"');
    expect(plain(html.slice(html.indexOf('id="log-hint"'), html.indexOf('</div>', html.indexOf('id="log-hint"'))))).toContain('최신순 · 아래로 스크롤하면 지난 기록');
  });

  it('옛 순서 문구와 임시 문구와 이름이 소스 어디에도 남지 않는다: 「위로 스크롤하면 지난 기록」·「맨 아래로」·「최근 기록이 위」·「태어난 순서대로」·LOG_BOTTOM_SLACK (R-437)', () => {
    const files: Array<[string, string]> = [...Object.entries(SRC_CODE), ...Object.entries(SRC_CSS)];
    expect(Object.keys(SRC_CODE).length, 'src 코드 파일을 읽었다').toBeGreaterThan(50);
    expect(SRC_CSS['dash.css'].length, 'CSS를 읽었다').toBeGreaterThan(1000);
    for (const [f, code] of files) {
      expect(code, f).not.toContain('위로 스크롤하면 지난 기록');
      expect(code, f).not.toContain('맨 아래로');
      expect(code, f).not.toContain('최근 기록이 위');
      expect(code, f).not.toContain('태어난 순서대로');
      expect(code, f).not.toContain('LOG_BOTTOM_SLACK');
    }
  });

  it('CSS는 겉만 뒤집지 않는다(column-reverse·order·direction 없음)고 브라우저의 스크롤 고정을 끈다(overflow-anchor: none) — 위치 보정은 한 곳(LogCard)에서만 한다', () => {
    const css = dashCss;
    const rule = (sel: string) => new RegExp(`${sel.replace(/[.[\]]/g, '\\$&')} \\{[^}]*\\}`).exec(css)![0];
    for (const sel of ['.log__list', '.log__rows', '.log__row']) {
      expect(rule(sel), sel).not.toMatch(/-reverse|(?:^|[{;\s])(?:order|direction)\s*:/);
    }
    expect(rule('.log__list')).toMatch(/overflow-anchor: none/);
    expect(rule('.log__list')).toMatch(/overflow-y: auto/);
    // 단계 줄의 구분선은 줄 아래(LR3)
    expect(rule('.log__row--stage')).toMatch(/border-bottom: 2px solid var\(--c-border-strong\)/);
    expect(rule('.log__row--stage')).not.toMatch(/border-top/);
  });
});
