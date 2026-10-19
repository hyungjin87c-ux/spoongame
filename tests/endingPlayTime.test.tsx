import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { displaySeconds, formatPlayTime, playToEnd, type EndingGame, type Era, type PlayTime } from '../src/core';
import { PLAYTIME_TEXT, breakdownParts } from '../src/data/endingText';
import { EndingScreen } from '../src/screens/EndingScreen';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 엔딩 「이 판의 플레이 시간」 블록 (SPEC-003 LM6, M8 — docs/design/copy.md 8절 · diff-003.md D-93~D-95, 서버 렌더): 자리·값·낭독 쌍·분해·깨끗한 판 문장·play 없음·표시하지 않는 것·조사 금지.
 * 새로고침 뒤 같은 값·다시 태어나기 뒤 0·실제 브라우저의 타이머는 e2e/m8-playtime.spec.ts와 e2e/ending.spec.ts가 본다.
 */

const endingOf = (seed: number, era: Era): EndingGame => playToEnd(startLife(seed, era), chooserFor('random', seed)).state as EndingGame;
const render = (g: EndingGame) => renderToStaticMarkup(<EndingScreen game={g} onRebirth={() => {}} />);
const textOf = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const EMOJI = /\p{Extended_Pictographic}/u;

const base = endingOf(2024, 'present');
const clean: PlayTime = { hold: 910_900, decide: 756_900, fold: 12_000, note: 20_000, idle: 31_000, offSpeed: 0, auto: 0, skips: 0, resumes: 4 };
const withPlay = (play: PlayTime | undefined): EndingGame => ({ ...base, play });
const block = (g: EndingGame): string => render(g).match(/<div class="playtime"[^]*?<\/p><\/div>/)?.[0] ?? '';
// React의 time 요소는 dateTime 속성을 그대로 낸다(HTML 속성 이름은 대소문자를 가리지 않아 브라우저에서는 datetime과 같다)
const times = (html: string) => [...html.matchAll(/<time[^>]*dateTime="(PT\d+M\d+S)"[^>]*><span class="sr-only">([^<]*)<\/span><span aria-hidden="true">([^<]*)<\/span><\/time>/g)].map((m) => ({ iso: m[1], spoken: m[2], text: m[3] }));
const secOf = (x: { text: string }) => x.text.split(':').reduce((a, n) => a * 60 + Number(n), 0);

describe('엔딩 플레이 시간 블록: 자리와 값 (D-93·D-94)', () => {
  it('「사망과 선택」 카드의 세 번째 요소다: 사망 문장 → 선택 수 문장 → 플레이 시간 블록(별도 카드가 아니다), 이름은 「이 판의 플레이 시간」', () => {
    const html = render(withPlay(clean));
    const section = html.match(/<section class="card stack stack--sm" aria-label="사망과 선택">[^]*?<\/section>/)?.[0] ?? '';
    expect(section).not.toBe('');
    const at = ['data-testid="ending-death"', 'data-testid="ending-choices"', 'data-testid="ending-playtime"'].map((m) => section.indexOf(m));
    expect(at.every((i) => i > -1)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(html.match(/data-testid="ending-playtime"/g)).toHaveLength(1);
    expect(section).toContain(`<dl class="playtime__row"><dt>${PLAYTIME_TEXT.label}</dt><dd><time class="playtime__value"`);
    expect(PLAYTIME_TEXT.label).toBe('이 판의 플레이 시간');
  });

  it('값 = 버킷별로 초를 버린 뒤 더한 값: hold 910.9초 + decide 756.9초 → 27:46 (분해 15:10 / 12:36), 접어 둔 시간·기록·멈춘 시간은 들어가지 않는다', () => {
    const t = times(block(withPlay(clean)));
    expect(t).toEqual([
      { iso: 'PT27M46S', spoken: '27분 46초', text: '27:46' },
      { iso: 'PT15M10S', spoken: '15분 10초', text: '15:10' },
      { iso: 'PT12M36S', spoken: '12분 36초', text: '12:36' },
    ]);
    expect(secOf(t[1]) + secOf(t[2])).toBe(secOf(t[0]));
    expect(displaySeconds(clean)).toBe(1666);
  });

  it('분해 두 값의 합이 늘 표시값과 같다 (소수 부분이 다른 여러 조합 — 통째로 버리면 1초 어긋나는 판)', () => {
    for (const [hold, decide] of [[1_999, 1_999], [60_999, 59_999], [3_599_999, 1], [0, 999], [123_456, 789_012]]) {
      const t = times(block(withPlay({ ...clean, hold, decide })));
      expect(secOf(t[1]) + secOf(t[2]), `${hold}+${decide}`).toBe(secOf(t[0]));
    }
  });

  it('숫자 표기: 00:59 · 61:05 · 100:00 — 분은 두 자리 이상·상한 없음, 시 단위로 바꾸지 않는다 / 모든 시간은 aria-hidden mm:ss + sr-only 「N분 N초」 + datetime PT 쌍', () => {
    expect(times(block(withPlay({ ...clean, hold: 59_000, decide: 0 })))[0]).toEqual({ iso: 'PT0M59S', spoken: '0분 59초', text: '00:59' });
    expect(times(block(withPlay({ ...clean, hold: 3_665_000, decide: 0 })))[0]).toEqual({ iso: 'PT61M5S', spoken: '61분 5초', text: '61:05' });
    expect(times(block(withPlay({ ...clean, hold: 6_000_000, decide: 0 })))[0]).toEqual({ iso: 'PT100M0S', spoken: '100분 0초', text: '100:00' });
    const html = block(withPlay(clean));
    expect(html.match(/<time /g)).toHaveLength(3);
    for (const m of html.matchAll(/<time[^>]*>(.*?)<\/time>/g)) {
      expect(m[1]).toMatch(/^<span class="sr-only">\d+분 \d+초<\/span><span aria-hidden="true">\d{2,}:\d{2}<\/span>$/);
    }
  });

  it('formatPlayTime 단위 표 (D-94): 59초 · 1666초 · 3665초 · 6000초, 초 미만은 버리고 이상한 값은 0', () => {
    expect(formatPlayTime(59)).toEqual({ text: '00:59', spoken: '0분 59초', iso: 'PT0M59S' });
    expect(formatPlayTime(1666)).toEqual({ text: '27:46', spoken: '27분 46초', iso: 'PT27M46S' });
    expect(formatPlayTime(3665)).toEqual({ text: '61:05', spoken: '61분 5초', iso: 'PT61M5S' });
    expect(formatPlayTime(6000)).toEqual({ text: '100:00', spoken: '100분 0초', iso: 'PT100M0S' });
    expect(formatPlayTime(59.99).text).toBe('00:59');
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(formatPlayTime(bad).text, String(bad)).toBe('00:00');
  });
});

describe('엔딩 플레이 시간 블록: 보조 문장과 상태 (D-95)', () => {
  it('보조 문장 순서: 분해 → 제외 범위 → 이 기기에만 — 깨끗한 판에는 깨끗하지 않다는 문장이 없다 (침묵이 깨끗함)', () => {
    const html = block(withPlay(clean));
    const note = html.match(/data-testid="ending-playtime-note">([^]*?)<\/p>/)![1];
    // 낭독 글자와 눈에 보이는 글자가 함께 읽히는 텍스트 노드 순서를 확인한다
    expect(textOf(note.replace(/<span class="sr-only">[^<]*<\/span>/g, ''))).toBe(`세월이 흐른 시간 15:10, 결정을 읽고 고른 시간 12:36의 합입니다. ${PLAYTIME_TEXT.excluded} ${PLAYTIME_TEXT.device}`);
    expect(html).not.toContain(PLAYTIME_TEXT.notClean);
  });

  it('배속만 바꾼 판 / 자동 모드만 켠 판 / 「다음 결정으로」만 누른 판 셋 모두 깨끗하지 않은 판 문장이 제외 범위와 이 기기 사이에 뜨고, 1배속 수동 판에는 없다', () => {
    for (const patch of [{ offSpeed: 1000 }, { auto: 1000 }, { skips: 1 }]) {
      // 보조 문장은 조각마다 Glue를 거친다(D-98 — 「그 밖에」「이 기기에만」이 한 묶음) → 태그를 벗긴 글자로 순서를 본다
      const note = textOf(block(withPlay({ ...clean, ...patch })).match(/data-testid="ending-playtime-note">([^]*?)<\/p>/)![1].replace(/<span class="sr-only">[^<]*<\/span>/g, ''));
      expect(note, JSON.stringify(patch)).toContain(PLAYTIME_TEXT.notClean);
      expect(note.indexOf(PLAYTIME_TEXT.notClean)).toBeGreaterThan(note.indexOf(PLAYTIME_TEXT.excluded));
      expect(note.indexOf(PLAYTIME_TEXT.notClean)).toBeLessThan(note.indexOf(PLAYTIME_TEXT.device));
    }
    expect(textOf(block(withPlay(clean)))).not.toContain(PLAYTIME_TEXT.notClean);
    // 이어하기·접기·기록·멈춤은 깨끗함을 해치지 않는다
    expect(textOf(block(withPlay({ ...clean, resumes: 99, fold: 99_999, note: 99_999, idle: 99_999 })))).not.toContain(PLAYTIME_TEXT.notClean);
  });

  it('play가 없는 판(M8 이전 저장)은 블록이 없다 — 다른 문장·카드는 그대로', () => {
    const html = render(withPlay(undefined));
    expect(html).not.toContain('ending-playtime');
    expect(html).not.toContain(PLAYTIME_TEXT.label);
    expect(html).toContain('data-testid="ending-death"');
    expect(html).toContain('data-testid="ending-choices"');
  });

  it('이어하기 횟수(resumes)와 일시정지·접기·기록 시간은 화면에 나오지 않는다 (누적만 — 마스터 승인)', () => {
    const html = block(withPlay({ ...clean, resumes: 7, idle: 4_321_000, fold: 5_432_000, note: 6_543_000 }));
    expect(textOf(html)).not.toMatch(/이어|7번|일시정지|접어|적은 글/);
    expect(times(html)).toHaveLength(3); // 표시값 + 분해 둘뿐
  });

  it('스무 살 전에 끝난 인생에도 같은 블록이 있다', () => {
    let early: EndingGame | null = null;
    for (let seed = 1; seed < 4000 && early === null; seed++) {
      const g = endingOf(seed * 7919 + 13, 'past');
      if (g.death.age < 20) early = g;
    }
    expect(early, '스무 살 전 사망 판').not.toBeNull();
    expect(render({ ...early!, play: clean })).toContain('data-testid="ending-playtime-value"');
  });

  it('시간 값 바로 뒤에는 조사가 없다 (쉼표·「의」만 — 눈에 보이는 12:36(육)과 낭독 12분 36초(초)의 받침이 다르다, design-system.md 11-4)', () => {
    for (const patch of [{}, { skips: 3 }]) {
      const html = block(withPlay({ ...clean, ...patch }));
      for (const m of html.matchAll(/<\/time>([^<]{0,1})/g)) expect(['', ',', '의'], `time 뒤 「${m[1]}」`).toContain(m[1]);
    }
    expect(PLAYTIME_TEXT.breakdown).toMatch(/\{연출 mm:ss\}, .*\{결정 mm:ss\}의 합입니다\.$/);
    expect(breakdownParts()).toEqual(['세월이 흐른 시간 ', ', 결정을 읽고 고른 시간 ', '의 합입니다.']);
  });

  it('블록의 문구는 합쇼체이고 느낌표·이모지·가운뎃점이 없으며 문구 상수가 copy.md 8-1과 같다', () => {
    const joined = Object.values(PLAYTIME_TEXT).join(' ');
    expect(joined).not.toMatch(/[!！]/);
    expect(joined).not.toMatch(/·/);
    expect(EMOJI.test(joined)).toBe(false);
    expect(PLAYTIME_TEXT.breakdown).toBe('세월이 흐른 시간 {연출 mm:ss}, 결정을 읽고 고른 시간 {결정 mm:ss}의 합입니다.');
    expect(PLAYTIME_TEXT.excluded).toBe('그 밖에 멈춰 있던 시간과 생각을 적은 시간은 넣지 않았습니다.');
    expect(PLAYTIME_TEXT.notClean).toBe('배속이나 자동 모드, 「다음 결정으로」를 쓴 판이라 1배속으로 직접 고른 판보다 짧게 잡힙니다.');
    expect(PLAYTIME_TEXT.device).toBe('이 기기에만 저장됩니다.');
  });
});
