import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import bothRaw from './fixtures/save-v040-both-age20.json?raw';
import { entryHeadline, parseGame, playToEnd, type EndingGame, type HistoryEntry } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { EndingScreen } from '../src/screens/EndingScreen';
import { isStackedEntry } from '../src/ui/dash/LogList';
import { LogCard } from '../src/ui/dash/LogCard';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * SPEC-014 QS2 · 완료 기준 5·6 — 결정 줄의 윗줄은 `question`이 먼저, 없으면 `title`, 둘 다 없으면 윗줄 없음.
 * ① 인생 기록: question 이 있는 줄은 log-q 자리가 질문이고(본인·부모·흘러감 모두 도장·data-by 유지), question 이 없는 옛 줄은 제목 그대로.
 * ② 가린 줄: 질문도 hidden 원문 안이라 접힘에서 빠지고 펼침에 있다.
 * ③ 엔딩 연표: 같은 규칙(질문 우선, 없으면 제목).
 */

const plain = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const render = (history: HistoryEntry[], gentle = false): string => renderToStaticMarkup(<LogCard history={history} live={false} gentle={gentle} />);
const rows = (html: string): string[] => html.split('<li ').slice(1).map((r) => '<li ' + r.slice(0, r.indexOf('</li>')));

const HISTORY: HistoryEntry[] = [
  { age: 0, kind: 'stage', text: '태어났다.' },
  { age: 5, kind: 'choice', title: '입학 전', question: '입학 전에 무엇을 시킬까?', text: '입학을 준비했다.', choice: '새로 산다', eventId: 'a', by: 'parent' },
  { age: 7, kind: 'choice', title: '동생', question: '동생에게 쏠린 눈, 어떻게 할까?', text: '동생이 생겼다.', choice: '삐친다', eventId: 'b', by: 'child' },
  { age: 14, kind: 'choice', title: '동아리', question: '동아리에 들어갈까 말까?', text: '동아리에 들어갔다.', choice: '한다', eventId: 'c' },
  { age: 15, kind: 'choice', title: '옛 줄 제목', text: '질문이 없는 옛 줄이다.', choice: '넘긴다', eventId: 'd' },
  { age: 16, kind: 'choice', text: '제목도 질문도 없는 줄이다.', choice: '맡긴다', eventId: 'e', by: 'parent' },
  { age: 17, kind: 'choice', question: '질문만 있는 줄, 어떻게 할까?', text: '제목이 없다.', choice: '한다', eventId: 'f' },
];

describe('QS2 entryHeadline: 질문 → 제목 → 없음', () => {
  it('question 이 있으면 question, 없으면 title, 둘 다 없거나 비었으면 undefined', () => {
    expect(entryHeadline({ age: 1, kind: 'choice', text: 't', title: '제목', question: '갈까?' })).toBe('갈까?');
    expect(entryHeadline({ age: 1, kind: 'choice', text: 't', title: '제목' })).toBe('제목');
    expect(entryHeadline({ age: 1, kind: 'choice', text: 't', title: '제목', question: '' })).toBe('제목');
    expect(entryHeadline({ age: 1, kind: 'choice', text: 't' })).toBeUndefined();
    expect(entryHeadline({ age: 1, kind: 'choice', text: 't', title: '' })).toBeUndefined();
  });

  it('isStackedEntry: 고른 길이 있고 질문·제목 중 하나가 있어야 세 줄로 쌓는다', () => {
    expect(isStackedEntry(HISTORY[3])).toBe(true);
    expect(isStackedEntry(HISTORY[4])).toBe(true); // 제목만(옛 줄)
    expect(isStackedEntry(HISTORY[6])).toBe(true); // 질문만
    expect(isStackedEntry(HISTORY[5])).toBe(false); // 둘 다 없음
  });
});

describe('QS2 ① 인생 기록: 질문 우선, 없으면 제목', () => {
  const list = rows(render(HISTORY));
  const rowOf = (age: number) => list.find((r) => new RegExp(`<span class="log__age">${age}세`).test(r))!;
  const headOf = (r: string) => /<span class="log__q" data-testid="log-q">([^<]*)<\/span>/.exec(r)?.[1];

  it('질문이 있는 줄(본인·부모·흘러감)의 log-q 는 질문이고 제목이 아니다', () => {
    expect(headOf(rowOf(5))).toBe('입학 전에 무엇을 시킬까?');
    expect(headOf(rowOf(7))).toBe('동생에게 쏠린 눈, 어떻게 할까?');
    expect(headOf(rowOf(14))).toBe('동아리에 들어갈까 말까?');
    for (const age of [5, 7, 14]) expect(rowOf(age), `${age}세`).not.toContain('>입학 전<');
  });

  it('차례는 질문 → 고른 길 → 결과, 도장·data-by·세 줄 쌓기 클래스는 그대로', () => {
    expect(plain(rowOf(14))).toBe('14세 동아리에 들어갈까 말까? 선택: 한다 동아리에 들어갔다.');
    expect(plain(rowOf(5))).toBe('5세 입학 전에 무엇을 시킬까? 부모님이 이렇게 정했습니다: 새로 산다 입학을 준비했다.');
    expect(plain(rowOf(7))).toBe('7세 동생에게 쏠린 눈, 어떻게 할까? 이렇게 흘러갔습니다: 삐친다 동생이 생겼다.');
    expect(rowOf(5)).toContain('data-testid="log-by"');
    expect(rowOf(5)).toContain('data-by="parent"');
    expect(rowOf(7)).toContain('data-by="child"');
    for (const age of [5, 7, 14]) expect(rowOf(age)).toContain('class="log__text log__text--q"');
  });

  it('질문이 없는 옛 줄은 제목 그대로, 둘 다 없으면 윗줄 없이 괄호 꼴이다', () => {
    expect(headOf(rowOf(15))).toBe('옛 줄 제목');
    expect(plain(rowOf(15))).toBe('15세 옛 줄 제목 선택: 넘긴다 질문이 없는 옛 줄이다.');
    expect(rowOf(16)).not.toContain('log-q');
    expect(plain(rowOf(16))).toBe('16세 제목도 질문도 없는 줄이다. (부모님이 이렇게 정했습니다: 맡긴다)');
    expect(headOf(rowOf(17))).toBe('질문만 있는 줄, 어떻게 할까?');
  });
});

describe('QS2 ② 가린 줄: 질문도 가린다', () => {
  const heavy: HistoryEntry[] = [
    { age: 0, kind: 'stage', text: '태어났다.' },
    { age: 1, kind: 'choice', title: '한밤의 열', question: '한밤의 열, 병원에 갈까 지켜볼까?', text: '열이 올랐다.', choice: '병원에 간다', eventId: 'infant-fever', by: 'parent' },
  ];

  it('가림을 켜면 질문은 hidden 원문(.veil__body) 안에만 있고, 접힌 안내 줄에는 없다', () => {
    const r = rows(render(heavy, true)).find((x) => x.includes('data-veiled="true"'))!;
    expect(r).toBeDefined();
    const at = r.indexOf('<span class="veil__body"');
    expect(r.slice(0, at)).not.toContain('병원에 갈까');
    expect(r.slice(0, at)).not.toContain('log-q');
    expect(plain(r.slice(at))).toContain('한밤의 열, 병원에 갈까 지켜볼까? 부모님이 이렇게 정했습니다: 병원에 간다 열이 올랐다.');
  });

  it('끄면 같은 줄의 질문이 hidden 없이 보인다', () => {
    const off = render(heavy, false);
    expect(off).toContain('data-testid="log-q">한밤의 열, 병원에 갈까 지켜볼까?</span>');
    expect(off).not.toContain('hidden=""');
  });
});

describe('QS2 옛 저장(v0.4.0)의 결정 줄은 question 이 없어 제목으로 보인다', () => {
  it('열자마자 log-q 글자가 저장된 title 이다', () => {
    const game = parseGame(bothRaw)!;
    const html = render(game.history);
    const choices = game.history.filter((h) => h.kind === 'choice' && h.title);
    expect(choices.length).toBeGreaterThan(0);
    for (const h of choices) expect(html).toContain(`data-testid="log-q">${h.title}</span>`);
  });
});

describe('QS2 ③ 엔딩 연표: 같은 규칙', () => {
  const game = playToEnd(startLife(2024, 'alpha'), chooserFor('random', 2024)).state as EndingGame;
  const html = renderToStaticMarkup(<EndingScreen game={game} onRebirth={() => {}} />);
  const timeline = html.slice(html.indexOf('data-testid="ending-timeline"'));

  it('새 판의 결정 줄은 연표 굵은 글이 질문이다 (제목이 아니다)', () => {
    const choices = game.history.filter((h) => h.kind === 'choice');
    expect(choices.length, '공허 통과 방지').toBeGreaterThan(5);
    for (const h of choices) {
      const q = EVENT_POOL.byId.get(h.eventId!)!.question!;
      expect(h.question).toBe(q);
      expect(timeline, `${h.age}세`).toContain(`<strong>${q}</strong>`);
    }
  });

  it('question 이 없는 옛 줄은 제목을 굵게 보인다', () => {
    const old: EndingGame = { ...game, history: game.history.map((h) => { if (h.kind !== 'choice') return h; const { question: _q, ...rest } = h; void _q; return rest as HistoryEntry; }) };
    const oldHtml = renderToStaticMarkup(<EndingScreen game={old} onRebirth={() => {}} />);
    const tl = oldHtml.slice(oldHtml.indexOf('data-testid="ending-timeline"'));
    for (const h of old.history.filter((x) => x.kind === 'choice' && x.title)) expect(tl).toContain(`<strong>${h.title}</strong>`);
    for (const h of game.history.filter((x) => x.kind === 'choice')) expect(tl.includes(`<strong>${h.question}</strong>`) && !tl.includes(`<strong>${h.title}</strong>`)).toBe(false);
  });
});
