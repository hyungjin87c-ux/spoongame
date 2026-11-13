import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import age0Legacy from './fixtures/save-v030-age0.json';
import age20Legacy from './fixtures/save-v030-age20.json';
import age65Legacy from './fixtures/save-v030-age65.json';
import bothRaw from './fixtures/save-v040-both-age20.json?raw';
import fatherRaw from './fixtures/save-v040-father-ended.json?raw';
import motherRaw from './fixtures/save-v040-mother-age20.json?raw';
import { parseGame, type HistoryEntry } from '../src/core';
import { DASH_TEXT } from '../src/data/dashText';
import { isStackedEntry } from '../src/ui/dash/LogList';
import { LogCard } from '../src/ui/dash/LogCard';

/**
 * SPEC-012 QF4 · 완료 기준 8 — 인생 기록 결정 줄의 질문 자리 = 사건 제목(`HistoryEntry.title`, 새 필드 없음 · docs/design/log-question.md 안 2).
 * ① 제목이 있는 결정 줄(본인 선택·부모 결정·흘러감)은 「제목(작게, data-testid="log-q") → 고른 길 → 결과」 세 줄이고 괄호가 없다.
 * ② 제목이 없는 옛 줄·서술 줄·단계·나의 기록은 지금 모양이다(log-q 0, 괄호 꼴 그대로).
 * ③ 가린 줄은 제목도 `.veil__body`(hidden) 안이라 접힘에서 가려지고 펼침 원문에 있다.
 * ④ 옛 저장(v0.4.0 3종·v0.3.0 3종)도 열자마자 저장된 title이 제목으로 나온다 — 사건 풀(`eventId`) 조회 없이(이 파일은 이벤트 풀을 가져오지 않는다).
 */

const plain = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const render = (history: HistoryEntry[], gentle = false): string => renderToStaticMarkup(<LogCard history={history} live={false} gentle={gentle} />);
const rows = (html: string): string[] => html.split('<li ').slice(1).map((r) => '<li ' + r.slice(0, r.indexOf('</li>')));

const HISTORY: HistoryEntry[] = [
  { age: 0, kind: 'stage', text: '태어났다.' },
  { age: 3, kind: 'event', title: '비 오는 날', text: '비가 오는 날이었다.' },
  { age: 5, kind: 'choice', title: '입학 전', text: '입학을 준비했다.', choice: '새로 산다', eventId: 'school-supplies', by: 'parent' },
  { age: 7, kind: 'choice', title: '동생', text: '동생이 생겼다.', choice: '삐친다', eventId: 'infant-new-sibling', by: 'child' },
  { age: 14, kind: 'choice', title: '동아리', text: '동아리에 들어갔다.', choice: '한다', eventId: 'school-club' },
  { age: 15, kind: 'choice', text: '제목 없는 옛 줄이다.', choice: '넘긴다', eventId: 'x' },
  { age: 16, kind: 'choice', text: '제목 없는 도장 줄이다.', choice: '맡긴다', eventId: 'y', by: 'parent' },
];

describe('QF4 ① 제목이 있는 결정 줄: 제목 → 고른 길 → 결과, 괄호 없음', () => {
  const list = rows(render(HISTORY));
  const rowOf = (age: number) => list.find((r) => new RegExp(`<span class="log__age">${age + 1}세`).test(r))!;

  it('본인 선택 · 부모 결정 · 흘러감 모두 log-q가 하나이고 글자가 title과 같다', () => {
    for (const [age, title] of [[5, '입학 전'], [7, '동생'], [14, '동아리']] as const) {
      const r = rowOf(age);
      expect(r.match(/data-testid="log-q"/g), `${age}세`).toHaveLength(1);
      expect(/<span class="log__q" data-testid="log-q">([^<]*)<\/span>/.exec(r)![1]).toBe(title);
      expect(r, `${age}세: 세 줄 쌓기 클래스`).toContain('class="log__text log__text--q"');
    }
  });

  it('차례는 제목 → 고른 길(도장·「선택: 」) → 결과이고 괄호가 없다', () => {
    expect(plain(rowOf(14))).toBe(`15세 동아리 ${DASH_TEXT.logChoicePrefix}한다 동아리에 들어갔다.`);
    expect(plain(rowOf(5))).toBe('6세 입학 전 부모님이 이렇게 정했습니다: 새로 산다 입학을 준비했다.');
    expect(plain(rowOf(7))).toBe('8세 동생 이렇게 흘러갔습니다: 삐친다 동생이 생겼다.');
    for (const age of [5, 7, 14]) expect(plain(rowOf(age)), `${age}세`).not.toMatch(/[()]/);
    // 도장 표지·아이콘은 그대로
    expect(rowOf(5)).toContain('data-testid="log-by"');
    expect(rowOf(5)).toContain('data-by="parent"');
    expect(rowOf(7)).toContain('data-by="child"');
    const r = rowOf(5);
    expect(r.indexOf('log-q'), '제목이 먼저').toBeLessThan(r.indexOf('log-by'));
    expect(r.indexOf('log-by'), '고른 길이 결과 앞').toBeLessThan(r.indexOf('log__result'));
  });

  it('isStackedEntry: 선택지를 고른 줄이고 제목이 비어 있지 않을 때만 참이다', () => {
    expect(isStackedEntry(HISTORY[4])).toBe(true);
    expect(isStackedEntry(HISTORY[5])).toBe(false); // 제목 없음
    expect(isStackedEntry({ age: 1, kind: 'choice', title: '', text: 't', choice: 'c' })).toBe(false);
    expect(isStackedEntry(HISTORY[1])).toBe(false); // 서술 줄(고른 길 없음)
    expect(isStackedEntry({ age: 1, kind: 'choice', title: 'T', text: 't' })).toBe(false); // 고른 길 없음
  });
});

describe('QF4 ② 제목이 없는 줄·서술 줄·단계는 지금 모양', () => {
  const list = rows(render(HISTORY));
  const rowOf = (age: number) => list.find((r) => new RegExp(`<span class="log__age">${age + 1}세`).test(r))!;

  it('제목 없는 결정 줄은 「결과 (선택: 고른 길)」 괄호 꼴 그대로이고 log-q가 없다', () => {
    expect(plain(rowOf(15))).toBe(`16세 제목 없는 옛 줄이다. (${DASH_TEXT.logChoicePrefix}넘긴다)`);
    expect(rowOf(15)).not.toContain('log-q');
    expect(rowOf(15)).not.toContain('log__text--q');
    expect(plain(rowOf(16))).toBe('17세 제목 없는 도장 줄이다. (부모님이 이렇게 정했습니다: 맡긴다)');
  });

  it('서술 줄(kind: event)·단계 줄은 제목을 그리지 않는다 — log-q 0', () => {
    expect(rowOf(3)).not.toContain('log-q');
    expect(plain(rowOf(3))).toBe('4세 비가 오는 날이었다.');
    expect(rowOf(0)).not.toContain('log-q');
    expect(rows(render(HISTORY)).filter((r) => r.includes('log-q'))).toHaveLength(3);
  });
});

describe('QF4 ③ 가린 줄: 제목도 가린다', () => {
  // 무거운 장면 표지가 있는 실제 사건(infant-fever: 건강)과 서술 줄·보통 결정 줄
  const heavy: HistoryEntry[] = [
    { age: 0, kind: 'stage', text: '태어났다.' },
    { age: 1, kind: 'choice', title: '한밤의 열', text: '열이 올랐다.', choice: '병원에 간다', eventId: 'infant-fever', by: 'parent' },
    { age: 14, kind: 'choice', title: '동아리', text: '동아리에 들어갔다.', choice: '한다', eventId: 'school-club' },
  ];
  const veiled = (html: string) => rows(html).filter((r) => r.includes('data-veiled="true"'));

  it('가림을 켜면 무거운 줄 하나가 가려지고 제목은 hidden 원문(.veil__body) 안에만 있다 — 접힘에서는 접근성 트리·찾기에서 빠진다', () => {
    const on = veiled(render(heavy, true));
    expect(on, '가린 줄').toHaveLength(1);
    const r = on[0];
    expect(r).toMatch(/<span class="veil__body"[^>]*hidden=""/);
    const outside = r.slice(0, r.indexOf('<span class="veil__body"'));
    expect(outside, '접힌 안내 줄에는 제목이 없다').not.toContain('log-q');
    expect(outside).not.toContain('한밤의 열');
    const inside = r.slice(r.indexOf('<span class="veil__body"'));
    expect(inside.match(/data-testid="log-q"/g)).toHaveLength(1);
    expect(plain(inside)).toContain('한밤의 열 부모님이 이렇게 정했습니다: 병원에 간다 열이 올랐다.');
  });

  it('보통 결정 줄(동아리)은 가림과 무관하게 제목이 보이고, 가림을 끄면 같은 줄의 제목이 hidden 없이 보인다', () => {
    const on = render(heavy, true);
    const club = rows(on).find((r) => r.includes('동아리에 들어갔다'))!;
    expect(club).not.toContain('data-veiled');
    expect(club).toContain('data-testid="log-q">동아리</span>');
    const off = render(heavy, false);
    expect(veiled(off)).toHaveLength(0);
    expect(rows(off).find((r) => r.includes('열이 올랐다'))!).toContain('data-testid="log-q">한밤의 열</span>');
    expect(off).not.toContain('hidden=""');
  });
});

describe('QF4 ④ 옛 저장도 열자마자 title이 제목으로 나온다 (사건 풀 조회 없이)', () => {
  const lifeHistory = (g: { history: HistoryEntry[] }) => g.history.filter((h) => h.kind === 'choice');

  for (const [name, raw] of [['v0.4.0 both-age20', bothRaw], ['v0.4.0 mother-age20', motherRaw], ['v0.4.0 father-ended', fatherRaw]] as const) {
    it(`${name}: 제목 있는 결정 줄마다 log-q가 있고 글자는 저장된 title이다`, () => {
      const game = parseGame(raw)!;
      const choices = lifeHistory(game);
      expect(choices.length, '결정 줄이 있다(공허 통과 방지)').toBeGreaterThan(0);
      const html = render(game.history);
      const withTitle = choices.filter((h) => h.title);
      expect(withTitle.length).toBeGreaterThan(0);
      expect(html.match(/data-testid="log-q"/g) ?? []).toHaveLength(withTitle.length);
      for (const h of withTitle) expect(html, h.title).toContain(`data-testid="log-q">${h.title}</span>`);
      expect(html, '결정 줄에 괄호 꼴이 남지 않는다').not.toMatch(/\(선택: |\(부모님이 이렇게|\(어머니가 이렇게|\(아버지가 이렇게|\(이렇게 흘러갔습니다/);
    });
  }

  for (const [name, save] of [['v0.3.0 age0', age0Legacy], ['v0.3.0 age20', age20Legacy], ['v0.3.0 age65', age65Legacy]] as const) {
    it(`${name}: 열리고(저장 스키마 그대로) 제목이 있는 결정 줄은 같은 모양, 없는 줄은 옛 괄호 꼴이다`, () => {
      const game = parseGame(JSON.stringify(save))!;
      expect(game, '열린다').not.toBeNull();
      const choices = lifeHistory(game);
      const html = render(game.history);
      expect(html.match(/data-testid="log-q"/g) ?? []).toHaveLength(choices.filter((h) => isStackedEntry(h)).length);
      // 제목이 없는 결정 줄은 지금 모양(괄호) 그대로 — 있다면
      for (const h of choices.filter((x) => !x.title)) expect(plain(html), `${h.age}세`).toContain(`${h.text} (`);
    });
  }
});

describe('QF4 ⑤ 사건 풀 조회 없음 (완료 기준 8 ⑥)', () => {
  it('LogList.tsx는 이벤트 풀·데이터 로더를 가져오지 않는다 — 제목은 저장된 HistoryEntry.title에서만 온다', async () => {
    const src = (await import('../src/ui/dash/LogList.tsx?raw')).default;
    expect(src).not.toMatch(/EVENT_POOL|data\/events|gameData|byId\.get/);
  });
});
