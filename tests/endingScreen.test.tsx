import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ERAS, bandFromRange, playToEnd, reviewEnding, startBandOf, type EndingGame, type EndingReview, type Era } from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { ENDING_HEADINGS, MOVEMENT_TEXT, REBIRTH_LABEL, REBIRTH_NOTE, journeyText } from '../src/data/endingText';
import { EndingScreen } from '../src/screens/EndingScreen';
import { splitStanding } from '../src/ui/KeepStanding';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 엔딩 화면(서버 렌더): 무엇을 어떤 순서로 보여 주는지, 금지된 것이 없는지. 실제 브라우저 동작(새로고침·다시 태어나기·연타)은 e2e/ending.spec.ts.
 * 이 화면은 core/ending.ts의 결과를 그리기만 한다.
 */

const endingOf = (seed: number, era: Era, strategy: 'auto' | 'random' = 'random'): EndingGame => playToEnd(startLife(seed, era), chooserFor(strategy, seed)).state as EndingGame;
const render = (g: EndingGame) => renderToStaticMarkup(<EndingScreen game={g} onRebirth={() => {}} />);
const textOf = (html: string) => html.replace(/<\/?(?:span|strong|em)[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const EMOJI = /\p{Extended_Pictographic}/u;
const GRADE_NAMES = /(흙|동|은|금|다이아)\s*수저|다이아/;

describe('엔딩 화면: 구성과 순서', () => {
  const game = endingOf(2024, 'present');
  const html = render(game);

  it('위에서 아래로: 이름(제목) → 출생·사망 → 출발선에서 마지막까지 → 최종 스탯 → 생애 연표 → 다시 태어나기', () => {
    const marks = ['data-testid="ending-name"', 'data-testid="ending-death"', 'data-testid="ending-journey"', 'data-testid="ending-stats"', 'data-testid="ending-timeline"', 'data-testid="rebirth"'];
    const at = marks.map((m) => html.indexOf(m));
    for (const i of at) expect(i).toBeGreaterThan(-1);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(html).toContain(ENDING_HEADINGS.journey);
    expect(html).toContain(ENDING_HEADINGS.stats);
    expect(html).toContain(ENDING_HEADINGS.timeline);
  });

  it('제목(h1)은 이름이고 tabindex=-1이다(화면이 뜨면 포커스를 받는다). 시대 이름이 위에 있다', () => {
    expect(html).toMatch(new RegExp(`<h1[^>]*tabindex="-1"[^>]*data-testid="ending-name"[^>]*>${game.character.name}</h1>`));
    expect(html).toContain(ERA_CONFIG[game.era].label);
  });

  it('출생·사망 한 줄: 몇 년에 태어나 몇 세에 어떤 원인으로 떠났는지, 선택의 순간 수', () => {
    const text = textOf(html);
    expect(text).toContain(`${game.character.birthYear}년, ${game.character.gender === 'male' ? '남자아이' : '여자아이'}로 태어났다.`);
    expect(text).toContain(`${game.death.age}세에 세상을 떠났다. 원인: ${game.death.cause}.`);
    const choices = game.history.filter((h) => h.kind === 'choice').length;
    expect(text).toContain(`살아오며 ${choices}번의 선택을 했다.`);
  });

  it('출발선 대비: 재산을 같은 세상 안의 자리로 말하는 문장 하나, 방향 한 줄, 왜 숫자를 빼지 않았는지 설명', () => {
    const review = reviewEnding(game);
    const text = textOf(html);
    expect(review.journey.kind).toBe('compared');
    expect(text).toContain(journeyText(review.journey));
    expect(html).toContain('data-testid="ending-movement"');
    expect(html).toContain('data-testid="ending-note"');
    expect(text).toContain('숫자를 빼서 견주지 않고 같은 세상 안의 자리로 견주었습니다');
  });

  it('최종 스탯: 재산·학력·건강·행복·관계·외모의 마지막 값이 모두 있다. "처음 N"은 학력·행복·관계에만 붙는다 (재산·건강·외모는 원값 비교 금지)', () => {
    for (const key of ['wealth', 'education', 'health', 'happiness', 'relationships'] as const) {
      expect(html).toMatch(new RegExp(`data-testid="final-${key}">${game.stats[key]}<`));
    }
    expect(html).toMatch(new RegExp(`data-testid="final-looks">${game.character.looks}<`));
    for (const key of ['education', 'happiness', 'relationships'] as const) {
      expect(html).toMatch(new RegExp(`data-testid="started-${key}">처음 ${game.birthStats[key]}<`));
    }
    for (const key of ['wealth', 'health', 'looks']) expect(html).not.toContain(`data-testid="started-${key}"`);
  });

  it('생애 연표: 연표의 모든 항목이 시간순으로 있고, 선택한 순간마다 "선택: <고른 문구>"가 있다', () => {
    const entryCount = (html.match(/data-testid="timeline-entry"/g) ?? []).length;
    expect(entryCount).toBe(game.history.length);
    const choices = game.history.filter((h) => h.kind === 'choice');
    expect((html.match(/data-testid="timeline-picked"/g) ?? []).length).toBe(choices.length);
    expect(choices.length).toBeGreaterThan(5);
    for (const c of choices) expect(textOf(html)).toContain(`선택: ${c.choice}`);
    // 단계 제목이 순서대로 있다
    const heads = ['영유아 · 0~6세', '학창 · 7~19세', '청년 · 20~39세', '중년 · 40~64세', '노년 · 65세~'].map((h) => html.indexOf(h));
    expect(heads.every((i) => i > -1)).toBe(true);
    expect(heads).toEqual([...heads].sort((a, b) => a - b));
    // 출생이 맨 앞, 사망이 맨 뒤
    expect(html.indexOf('data-kind="stage"')).toBeLessThan(html.indexOf('data-kind="choice"'));
    expect(html.lastIndexOf('data-kind="death"')).toBeGreaterThan(html.lastIndexOf('data-kind="choice"'));
  });

  it('다시 태어나기 버튼은 하나뿐이다: GuardedButton이라 첫 렌더에는 aria-disabled(가드), 안내 문구가 곁에 있다', () => {
    expect((html.match(/data-testid="rebirth"/g) ?? []).length).toBe(1);
    expect((html.match(/<button/g) ?? []).length).toBe(1);
    const button = html.match(/<button[^>]*data-testid="rebirth"[^>]*>다시 태어나기<\/button>/)![0];
    expect(button).toContain('aria-disabled="true"');
    expect(textOf(html)).toContain(REBIRTH_NOTE);
    expect(REBIRTH_LABEL).toBe('다시 태어나기');
  });
});

describe('엔딩 화면: 금지된 것이 없다 (SPEC "안 할 것" · 등급명 · 어조)', () => {
  const games = ERAS.flatMap((era) => [11, 222, 3333, 44444].map((seed) => endingOf(seed, era, seed % 2 === 0 ? 'auto' : 'random')));

  it('느낌표·이모지·등급명(흙/동/은/금/다이아 수저)이 어디에도 없다', () => {
    for (const g of games) {
      const text = textOf(render(g));
      expect(text, `${g.era} ${g.seed}`).not.toMatch(/[!！]/);
      expect(text, `${g.era} ${g.seed}`).not.toMatch(EMOJI);
      expect(text, `${g.era} ${g.seed}`).not.toMatch(GRADE_NAMES);
    }
  });

  it('공유·SNS·결과 카드·링크·이미지가 없다 (SNS 공유 결과 카드는 MVP에서 하지 않는다)', () => {
    for (const g of games) {
      const html = render(g);
      expect(html).not.toMatch(/<a[\s>]|<img|<canvas|<audio|<video|<svg|navigator\.share/);
      expect(textOf(html)).not.toMatch(/공유|SNS|트위터|인스타|카카오톡|복사|저장하기|이미지로/);
      expect((html.match(/<button/g) ?? []).length).toBe(1); // 다시 태어나기 하나뿐
    }
  });

  it('퍼센트 숫자는 50을 넘지 않고 "약 0%"·"약 100%"·"0~"·"~100"이 없다 (R-018, 출발선 구간 R-091)', () => {
    for (const g of games) {
      const text = textOf(render(g));
      // 구간 표현("상위 8~28% 사이")의 앞 숫자도 센다: "N%"만이 아니라 "A~B%"의 A와 B 모두
      for (const m of text.matchAll(/(\d+)(?:~(\d+))?%/g)) {
        expect(Number(m[1]), text).toBeLessThanOrEqual(50);
        if (m[2] !== undefined) expect(Number(m[2]), text).toBeLessThanOrEqual(50);
      }
      expect(text).not.toMatch(/약 (0|100)%/);
      // 출발선 구간 문장에만 건다 (연표의 단계 제목 "영유아 · 0~6세"는 나이 범위다)
      const journey = textOf(render(g).match(/data-testid="ending-journey">([^]*?)<\/p>/)![1]);
      expect(journey).not.toMatch(/(^|[^\d])0~|~100/);
    }
  });
});

describe('엔딩 화면: 스무 살 전에 끝난 인생', () => {
  const base = endingOf(2024, 'present');
  const young: EndingGame = { ...base, age: 9, death: { age: 9, cause: '갑작스러운 병' }, history: base.history.filter((h) => h.age < 9).concat([{ age: 9, kind: 'death', text: '세상을 떠났다. 원인: 갑작스러운 병.' }]) };
  const html = render(young);

  it('도착 자리·방향·설명 대신 출발선(집안 형편)만 말한다. 재산 이름은 "집안 형편"이다', () => {
    expect(html).not.toContain('data-testid="ending-movement"');
    expect(html).not.toContain('data-testid="ending-note"');
    const text = textOf(html);
    // R-083: 출발선만 담담하게 — 게임 용어("내가 가진 것")도, 윗줄이 이미 말한 "생이 끝났다"도 되풀이하지 않는다
    const journey = textOf(html.match(/data-testid="ending-journey">([^]*?)<\/p>/)![1]);
    expect(journey).toMatch(/^.+의 집에서 태어났다\.$/);
    expect(journey).not.toMatch(/내가 가진 것|생이 끝|견줄|스무 살/);
    expect(text).not.toContain('형편으로 생을 마쳤다');
    expect(html).toMatch(/<span>집안 형편<\/span>/);
    expect(html).not.toMatch(/<span>재산<\/span>/);
  });

  it('연표와 최종 스탯은 그대로 나온다 (선택 기록 수만큼)', () => {
    expect((html.match(/data-testid="timeline-entry"/g) ?? []).length).toBe(young.history.length);
    expect(html).toContain('data-testid="final-health"');
  });
});

describe('순위 표현은 줄이 바뀌어도 쪼개지지 않는다 (ui/KeepStanding, QA 사용감 3)', () => {
  it('splitStanding: 순위 표현(조사 포함)만 홀수 칸으로 나뉜다', () => {
    expect(splitStanding('상위 약 30%의 집에서 태어나, 하위 1% 안쪽의 형편으로 생을 마쳤다.')).toEqual(['', '상위 약 30%의', ' 집에서 태어나, ', '하위 1% 안쪽의', ' 형편으로 생을 마쳤다.']);
    expect(splitStanding('딱 중간쯤의 집에서 태어나, 딱 중간쯤의 형편으로 생을 마쳤다.')).toEqual(['', '딱 중간쯤의', ' 집에서 태어나, ', '딱 중간쯤의', ' 형편으로 생을 마쳤다.']);
    expect(splitStanding('외모 63점 (상위 약 22%).')).toEqual(['외모 63점 (', '상위 약 22%', ').']);
    expect(splitStanding('순위 표현이 없는 글')).toEqual(['순위 표현이 없는 글']);
    expect(splitStanding('우리나라 출생아 중 하위 약 25%의 집안 형편이었다.')).toEqual(['우리나라 출생아 중 ', '하위 약 25%의', ' 집안 형편이었다.']);
  });

  it('splitStanding: 출발선 구간 표현도 덩어리로 나뉜다 — "안쪽의"·"사이의"·"밖의" 한 덩어리, 두 끝에서 센 "하위 25%와 상위 45% 사이의"는 "와" 뒤 공백에서 나뉠 수 있게 두 덩어리 (R-091)', () => {
    expect(splitStanding('하위 40% 안쪽의 집에서 태어나, 하위 약 32%의 형편으로 생을 마쳤다.')).toEqual(['', '하위 40% 안쪽의', ' 집에서 태어나, ', '하위 약 32%의', ' 형편으로 생을 마쳤다.']);
    expect(splitStanding('상위 8~28% 사이의 집에서 태어나, 상위 약 23%의 형편으로 생을 마쳤다.')).toEqual(['', '상위 8~28% 사이의', ' 집에서 태어나, ', '상위 약 23%의', ' 형편으로 생을 마쳤다.']);
    expect(splitStanding('하위 25%와 상위 45% 사이의 집에서 태어나, 딱 중간쯤의 형편으로 생을 마쳤다.')).toEqual([
      '',
      '하위 25%와',
      ' ',
      '상위 45% 사이의',
      ' 집에서 태어나, ',
      '딱 중간쯤의',
      ' 형편으로 생을 마쳤다.',
    ]);
    expect(splitStanding('상위 3% 안쪽의 집에서 태어났다.')).toEqual(['', '상위 3% 안쪽의', ' 집에서 태어났다.']);
    expect(splitStanding('상위 30% 밖의 집에서 태어났다.')).toEqual(['', '상위 30% 밖의', ' 집에서 태어났다.']);
    expect(splitStanding('하위 30~50% 사이의 집에서 태어났다.')).toEqual(['', '하위 30~50% 사이의', ' 집에서 태어났다.']);
  });

  it('엔딩의 출발선 대비 문장: 순위 표현이 nowrap span으로 감싸지고 글은 그대로다', () => {
    const g = endingOf(71284, 'present');
    const html = render(g);
    const review = reviewEnding(g);
    expect(review.journey.kind).toBe('compared');
    const journeyHtml = html.match(/data-testid="ending-journey">([^]*?)<\/p>/)![1];
    const units = (splitStanding(journeyText(review.journey)).length - 1) / 2; // 홀수 칸 = 순위 표현(덩어리)
    expect(units).toBeGreaterThanOrEqual(2);
    expect((journeyHtml.match(/<span class="nowrap">/g) ?? []).length).toBe(units);
    expect(journeyHtml.replace(/<[^>]+>/g, '')).toBe(journeyText(review.journey));
  });
});

describe('엔딩 화면: 출발선이 재력 단계의 구간으로 보인다 (R-091)', () => {
  const base = endingOf(2024, 'present');
  /** 지금 세상의 부모 재력 단계(1~5)와 최종 재산으로 회고를 만들어 그린다 */
  const html = (wealth: 1 | 2 | 3 | 4 | 5, final: number) => {
    const game: EndingGame = { ...base, character: { ...base.character, parentWealth: wealth }, stats: { ...base.stats, wealth: final } };
    return { html: render(game), review: reviewEnding(game) };
  };
  const journeyOf = (h: string) => textOf(h.match(/data-testid="ending-journey">([^]*?)<\/p>/)![1]);
  const movementTextOf = (h: string) => textOf(h.match(/data-testid="ending-movement">([^]*?)<\/p>/)![1]);

  it('지금 세상 다섯 단계: 출발선 문구가 구간이고, 방향 문장이 그 아래에 이어진다 (맨 아래·가운데·한쪽 절반·맨 위)', () => {
    const labels = ['하위 25% 안쪽의 집에서 태어나, ', '하위 25%와 상위 45% 사이의 집에서 태어나, ', '상위 17~45% 사이의 집에서 태어나, ', '상위 3~17% 사이의 집에서 태어나, ', '상위 3% 안쪽의 집에서 태어나, '];
    for (let w = 1; w <= 5; w++) {
      const { html: h, review } = html(w as 1, 40);
      const journey = journeyOf(h);
      expect(journey.startsWith(labels[w - 1]), `${w}단계: ${journey}`).toBe(true);
      expect(journey.endsWith('의 형편으로 생을 마쳤다.'), journey).toBe(true);
      expect(review.journey.kind).toBe('compared');
      if (review.journey.kind === 'compared') expect(movementTextOf(h)).toBe(MOVEMENT_TEXT[review.journey.movement]);
    }
  });

  it('같은 구간에서 도착만 달라지면 방향만 달라진다: 지금 세상 3단계(상위 17~45% 사이)에서 재산 5(뒤쪽) / 재산 45(비슷함) / 재산 95(앞섬)', () => {
    const verdict = (final: number) => {
      const r = html(3, final).review as EndingReview;
      return r.journey.kind === 'compared' ? r.journey.movement : 'early';
    };
    expect(verdict(5)).toBe('down');
    expect(verdict(45)).toBe('same');
    expect(verdict(95)).toBe('up');
  });

  it('20세 전 사망의 출발선도 같은 구간 표현이다', () => {
    const game: EndingGame = { ...base, age: 9, death: { age: 9, cause: '갑작스러운 병' }, character: { ...base.character, parentWealth: 2 } };
    expect(journeyOf(render(game))).toBe('하위 25%와 상위 45% 사이의 집에서 태어났다.');
    expect(journeyText({ kind: 'early', start: startBandOf('present', 4) })).toBe('상위 3~17% 사이의 집에서 태어났다.');
    expect(journeyText({ kind: 'early', start: bandFromRange(0, 25) })).toBe('하위 25% 안쪽의 집에서 태어났다.');
  });
});
