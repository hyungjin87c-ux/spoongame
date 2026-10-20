import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ERAS, bandFromRange, finalWealthStanding, formatMan, formatWon, looksStanding, playToEnd, reviewEnding, startBandOf, type EndingGame, type EndingReview, type Era } from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { BIRTH_TEXT } from '../src/data/birthReportText';
import { standingLabel } from '../src/data/birthText';
import { FINAL_DISTRIBUTION } from '../src/data/finalDistribution';
import { decidedByText, delegatedSummaryText } from '../src/data/parentDecisionTable';
import { ENDING_HEADINGS, MOVEMENT_TEXT, REBIRTH_LABEL, REBIRTH_NOTE, journeyText } from '../src/data/endingText';
import { EndingScreen } from '../src/screens/EndingScreen';
import { splitStanding, standingPieces } from '../src/ui/KeepStanding';
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

  it('제목(h1)은 「{이름}의 인생」이고 tabindex=-1이다(화면이 뜨면 포커스를 받는다). 시대 이름이 위에 있다 — 바뀐 기대(M4): 예전 제목은 이름뿐이었다. 공통 헤더(DS1)가 게임명 로고와 화면 이름을 맡으므로 h1은 화면의 메시지다(docs/design/copy.md 엔딩 헤더 행)', () => {
    expect(html).toMatch(new RegExp(`<h1[^>]*tabindex="-1"[^>]*data-testid="ending-name"[^>]*>${game.character.name}의 인생</h1>`));
    // M7e-3(R-327): 라벨은 「{세상} · 생애 기록」 (ui/Glue 묶음이라 태그를 뺀 글자로 찾는다)
    expect(textOf(html.match(/data-testid="ending-era">([^]*?)<\/p>/)![1])).toBe(`${ERA_CONFIG[game.era].label} · 생애 기록`);
  });

  it('머리 두 줄의 가운뎃점은 aria-hidden이다 (SPEC-003 M7c D-74): 낭독은 「{세상} 생애 기록」·「{출생 연월} ~ {사망 연도}년 {나이}세」, 눈에 보이는 글자는 그대로', () => {
    const era = html.match(/data-testid="ending-era">([^]*?)<\/p>/)![1];
    const span = html.match(/data-testid="ending-span">([^]*?)<\/p>/)![1];
    const readOf = (h: string) => h.replace(/<span aria-hidden="true">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    expect(era).toContain('<span aria-hidden="true">·</span>');
    expect(span).toContain('<span aria-hidden="true">·</span>');
    expect(readOf(era)).toBe(`${ERA_CONFIG[game.era].label} 생애 기록`);
    expect(readOf(span)).toBe(`${game.character.birthYear}년 ${game.birthReport!.month}월 ~ ${game.character.birthYear + game.death.age}년 ${game.death.age}세`);
  });

  it('공통 헤더(DS1): 게임명 로고와 화면 이름 「엔딩」이 있고, 옛 <h1>수저 게임</h1>은 없다 — h1은 하나뿐이다 (M4)', () => {
    expect(html).toContain('data-testid="site-head"');
    expect(html).toContain('data-testid="header-logo"');
    expect(html).toMatch(/<span class="site-head__name">엔딩<\/span>/);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(textOf(html.match(/<h1[^>]*>([^]*?)<\/h1>/)![1])).not.toBe('수저 게임');
  });

  it('얼굴: 마지막 나이의 얼굴 한 장이 제목 곁에 있다 (DS4 — 엔딩에도 적용)', () => {
    expect((html.match(/data-testid="face"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/class="face face--lg" data-testid="face" data-age-group="[a-z]+"/);
  });

  it('출생·사망 한 줄: 몇 년에 태어나 몇 세에 어떤 원인으로 떠났는지, 선택의 순간 수', () => {
    const text = textOf(html);
    const c = game.character;
    // M7e-3(R-327, copy.md 5-4): 머리 셋째 줄 = 「{출생 연월} ~ {사망 연도}년 · {나이}세」 (예전 「2026년, 여자아이로 태어났다.」 줄은 없어졌다)
    expect(textOf(html.match(/data-testid="ending-span">([^]*?)<\/p>/)![1])).toBe(`${c.birthYear}년 ${game.birthReport!.month}월 ~ ${c.birthYear + game.death.age}년 · ${game.death.age}세`);
    expect(html).not.toContain('data-testid="ending-born"');
    // 합쇼체 (copy.md 5-3): 「84세에 세상을 떠났습니다. 원인은 노환이었습니다.」 — 원인 낱말의 받침에 따라 「이었습니다」·「였습니다」
    expect(textOf(html.match(/data-testid="ending-death">([^]*?)<\/p>/)![1])).toBe(`${game.death.age}세에 세상을 떠났습니다. 원인은 ${game.death.cause}${/[가-힣]/.test(game.death.cause) && (game.death.cause.charCodeAt(game.death.cause.length - 1) - 0xac00) % 28 !== 0 ? '이었' : '였'}습니다.`);
    // 「N번의 선택」은 본인이 고른 선택만 센다(by 없는 choice 줄) — 부모님이 정한 일·흘러간 일은 따로 한 줄이다 (SPEC-005 PD9)
    const own = game.history.filter((h) => h.kind === 'choice' && h.by === undefined).length;
    const parent = game.history.filter((h) => h.kind === 'choice' && h.by === 'parent').length;
    const child = game.history.filter((h) => h.kind === 'choice' && h.by === 'child').length;
    expect(parent + child, '공허 통과 방지: 어린 시절에 부모님이 정한·흘러간 선택이 있는 판이다').toBeGreaterThan(2);
    expect(text).toContain(`살아오며 ${own}번의 선택을 했습니다.`);
    expect(own + parent + child).toBe(game.history.filter((h) => h.kind === 'choice').length);
    // 둘째 줄: 어린 시절의 큰 결정 가운데 M번은 부모님이 내렸고 K번은 아이의 일로 흘러갔습니다 (PD9, copy.md 11-1 ③ — K = 0이면 부모 부분만, M = 0이면 흘러감 부분만, 둘 다 0이면 줄 없음)
    expect(textOf(html.match(/data-testid="ending-delegated">([^]*?)<\/p>/)![1])).toBe(delegatedSummaryText(parent, child));
    expect(delegatedSummaryText(parent, child)).toBe(
      child > 0 && parent > 0 ? `어린 시절의 큰 결정 가운데 ${parent}번은 부모님이 내렸고, ${child}번은 아이의 일로 흘러갔습니다.`
        : parent > 0 ? `어린 시절의 큰 결정 가운데 ${parent}번은 부모님이 내렸습니다.`
        : `어린 시절의 큰 결정 가운데 ${child}번은 아이의 일로 흘러갔습니다.`,
    );
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

  it('최종 스탯: 지식(학력)·건강·행복·관계의 마지막 값과 외모(「상위/하위 약 N%」)가 있다. "처음 N"은 지식·행복·관계에만 붙는다 (건강·외모는 원값 비교 금지) — 외모는 원점수 없이 순위 문구만 (R-135, M4). 재산 막대는 재산 스탯이 없어지면서 임시로 빠졌다(SPEC-003 M5 2a) — 최종 순자산 줄은 2b에서 화면에 더해진다', () => {
    expect(html).not.toContain('data-testid="final-wealth"');
    for (const key of ['education', 'health', 'happiness', 'relationships'] as const) {
      expect(html).toMatch(new RegExp(`data-testid="final-${key}">${game.stats[key]}<`));
    }
    // 바뀐 기대(M4): 예전에는 외모 막대에 원점수(「외모 53」)가 있었다. 엔딩 어디에도 원점수가 없고 「상위/하위 약 N%」(또는 가운데 문구)만 있다.
    const looksCell = html.match(/data-testid="final-looks">([^]*?)<\/dd>/)![1];
    expect(textOf(looksCell)).toBe(`${BIRTH_TEXT.looksSub} ${standingLabel(looksStanding(game.character.looks))}`); // M7e-3: 값 앞에 「또래 사이에서」
    expect(textOf(html)).not.toMatch(/외모\s*\d+\s*점/);
    expect(html).not.toMatch(/data-stat="looks"/);
    expect(html).not.toMatch(new RegExp(`data-testid="final-looks">\\s*${game.character.looks}\\s*<`));
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
    // 줄 문구: 본인이 고른 선택 「선택: 라벨」 · 부모님이 정한 일 「부모님이 이렇게 정했습니다: 라벨」 · 흘러간 일 「이렇게 흘러갔습니다: 라벨」 — 인생 기록 줄과 같은 문구 한 곳(PD6)
    for (const c of choices) expect(textOf(html)).toContain(c.by === undefined ? `선택: ${c.choice}` : `${decidedByText(c.by)}: ${c.choice}`);
    expect(choices.some((c) => c.by === 'parent') && choices.some((c) => c.by === undefined), '공허 통과 방지: 부모·본인 선택이 모두 있다').toBe(true);
    // 단계 제목이 순서대로 있다
    // (단계 제목은 ui/Glue 묶음으로 그려져 숫자+단위 둘레에 span이 낀다 — 태그를 뺀 글자로 찾는다)
    const plain = textOf(html);
    const heads = ['영유아 · 0~6세', '학창 · 7~19세', '청년 · 20~39세', '중년 · 40~64세', '노년 · 65세~'].map((h) => plain.indexOf(h));
    expect(heads.every((i) => i > -1)).toBe(true);
    expect(heads).toEqual([...heads].sort((a, b) => a - b));
    // 출생이 맨 앞, 사망이 맨 뒤
    expect(html.indexOf('data-kind="stage"')).toBeLessThan(html.indexOf('data-kind="choice"'));
    expect(html.lastIndexOf('data-kind="death"')).toBeGreaterThan(html.lastIndexOf('data-kind="choice"'));
  });

  it('엔딩 연표는 시간순(위가 처음) 그대로이고 제목 옆에 「태어날 때부터 차례로」가 있다 — 살아가기 화면의 인생 기록은 최신순이라 두 화면의 순서가 다르다 (SPEC-005 LR6, 마스터 결정 M1)', () => {
    const ages = [...html.matchAll(/data-testid="timeline-entry"><span class="log__age">(\d+)세/g)].map((m) => Number(m[1]));
    expect(ages).toHaveLength(game.history.length);
    expect(ages, '저장 순서(시간순) 그대로').toEqual(game.history.map((h) => h.age));
    expect(ages).toEqual([...ages].sort((a, b) => a - b));
    expect(ENDING_HEADINGS.timelineOrder).toBe('태어날 때부터 차례로');
    // 제목(h2)과 같은 머리 줄 안에 있고, 연표 본문(첫 단계 묶음)보다 앞이다
    const head = html.slice(html.indexOf('id="ending-timeline-title"'), html.indexOf('data-testid="timeline-infant"'));
    expect(textOf(head)).toContain(`${ENDING_HEADINGS.timeline} ${ENDING_HEADINGS.timelineOrder}`);
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

describe('엔딩 「최종 순자산」 줄 (M5 2b, copy.md 4-6절 · design-system.md 6절)', () => {
  const FINAL_NET = (html: string) => html.slice(html.indexOf('<dl class="final-net'), html.indexOf('</dl>', html.indexOf('<dl class="final-net')) + 5);
  const valueOf = (html: string) => /data-testid="final-net-value">([^<]*)</.exec(html)?.[1];
  const withNet = (g: EndingGame, net: number): EndingGame => ({ ...g, assets: { ...g.assets!, net, debt: Math.max(g.assets!.debt, -net) } });

  it('「재산」 막대 자리에 한 줄이 있다: 최종 스탯 네 막대 뒤, 외모 앞 — 이름 「최종 순자산」, 금액은 formatWon 그대로(「약」 없음), 자리 글자는 없다 (M7e-3: 「같은 세상 안에서 …」 삭제)', () => {
    for (const era of ERAS) {
      const game = endingOf(2024, era);
      expect(game.death.age, era).toBeGreaterThanOrEqual(20);
      const html = render(game);
      const net = game.assets!.net;
      const block = FINAL_NET(html);
      expect(block, era).toContain('<dl class="final-net" data-testid="final-net">');
      expect(textOf(block), era).toContain('최종 순자산');
      expect(valueOf(block), era).toBe(formatMan(net));
      expect(valueOf(block)).toBe(formatWon(net * 10_000));
      expect(block).toContain('class="final-net__value nowrap"');
      // M7e-3 (copy.md 5-2 ① 1, QA-003-M5 O04): 금액 옆에 백분위를 붙이면 「0원 = 하위 42%」처럼 절대값과 상대 자리가 한 줄에서 부딪친다 — 자리는 출발선 카드 한 곳에서만 말한다
      expect(block, era).not.toContain('final-net__standing');
      expect(textOf(block), era).not.toContain('같은 세상 안에서');
      expect(textOf(block), era).not.toMatch(/상위|하위|가운데쯤/);
      expect(textOf(block)).not.toContain('약 ' + formatMan(net));
      // 자리: 막대 네 개 뒤, 외모 앞
      const at = (m: string) => html.indexOf(m);
      expect(at('data-testid="final-relationships"')).toBeLessThan(at('data-testid="final-net"'));
      expect(at('data-testid="final-net"')).toBeLessThan(at('data-testid="final-looks"'));
      // 옛 「재산」 막대와 「집안 형편」은 없다
      expect(html).not.toContain('data-testid="final-wealth"');
      expect(html).not.toContain('data-stat="wealth"');
      // (출발선 카드의 주석 JOURNEY_NOTE는 M7e까지 「집안 형편」을 말한다 — 최종 스탯 카드에는 없다)
      const statsCard = html.slice(html.indexOf('data-testid="ending-stats"'), html.indexOf('data-testid="ending-timeline"'));
      expect(textOf(statsCard)).not.toContain('집안 형편');
    }
  });

  it('지난·다가올 세상만 금액 바로 아래에 태그 「지금 가치로 환산」이 있다 (지금 세상은 없다). 금액 → 태그 순서 (자리 줄은 M7e-3에서 없어졌다)', () => {
    for (const era of ERAS) {
      const block = FINAL_NET(render(endingOf(2024, era)));
      if (era === 'present') expect(block).not.toContain('class="tag"');
      else {
        expect(block, era).toContain('<span class="tag" data-testid="final-net-basis">지금 가치로 환산</span>');
        const order = ['final-net-value', 'final-net-basis'].map((id) => block.indexOf(id));
        expect(order, era).toEqual([...order].sort((a, b) => a - b));
        expect(order.every((i) => i > -1), era).toBe(true);
        expect(block, era).not.toContain('final-net-standing');
      }
    }
  });

  it('경계: 음수는 U+2212 「−」로 시작하고 「빚」으로 바꿔 쓰지 않으며, 0은 「0원」이다 — 자리는 이 줄이 아니라 출발선 카드(막대·범례)가 분포표로 말한다 (M7e-3)', () => {
    const game = endingOf(2024, 'present');
    const neg = render(withNet(game, -1200));
    expect(valueOf(FINAL_NET(neg))).toBe('−1,200만 원');
    expect(valueOf(FINAL_NET(neg))!.startsWith('−')).toBe(true);
    expect(textOf(FINAL_NET(neg))).not.toContain('빚');
    expect(textOf(FINAL_NET(neg))).not.toContain('같은 세상 안에서');
    // 자리는 출발선 카드의 범례(「마지막」)에 있다
    expect(textOf(neg.match(/data-testid="ending-legend-end">([^]*?)<\/dd>/)![1])).toBe(standingLabel(finalWealthStanding('present', -1200)));
    const zero = render(withNet(game, 0));
    expect(valueOf(FINAL_NET(zero))).toBe('0원');
    expect(textOf(FINAL_NET(zero))).not.toContain('같은 세상 안에서');
    expect(textOf(zero.match(/data-testid="ending-legend-end">([^]*?)<\/dd>/)![1])).toBe(standingLabel(finalWealthStanding('present', 0)));
    expect(valueOf(FINAL_NET(render(withNet(game, -199_999))))).toBe('−19억 9,999만 원');
    expect(valueOf(FINAL_NET(render(withNet(game, 123_456))))).toBe('12억 3,456만 원');
  });

  it('스무 살 전에 끝난 인생: 금액도 자리도 없이 한 문장만 — 「스무 살이 되기 전이라 자산을 세지 않았습니다.」 (시대와 무관, 태그 없음)', () => {
    for (const era of ERAS) {
      const base = endingOf(2024, era);
      const early: EndingGame = { ...base, age: 15, assets: null, death: { ...base.death, age: 15 } };
      const html = render(early);
      const block = FINAL_NET(html);
      expect(block, era).toContain('<dl class="final-net final-net--early" data-testid="final-net">');
      expect(textOf(block), era).toBe('최종 순자산 스무 살이 되기 전이라 자산을 세지 않았습니다.');
      expect(block).toContain('class="final-net__none"');
      expect(block).not.toContain('final-net__value');
      expect(block).not.toContain('final-net__standing');
      expect(block).not.toContain('class="tag"');
      expect(html).not.toContain('data-testid="final-wealth"');
    }
  });

  it('금액을 말하는 곳은 이 줄뿐이다: 엔딩의 다른 문장(출발선·도착 자리·연표)에는 만 원 단위 금액이 없다 (D8 — 인생 기록에 금액 접미 없음)', () => {
    const html = render(endingOf(2024, 'present'));
    const outside = html.replace(FINAL_NET(html), '');
    expect(textOf(outside)).not.toMatch(/d만 원|d억/);
  });
});

describe('엔딩 화면: 금지된 것이 없다 (SPEC "안 할 것" · 등급명 · 어조)', () => {
  const games = ERAS.flatMap((era) => [11, 222, 3333, 44444].map((seed) => endingOf(seed, era, seed % 2 === 0 ? 'auto' : 'random')));

  it('느낌표·이모지가 어디에도 없고, 등급명(흙/동/은/금/다이아 수저)은 문장에 없다 — 출발선 막대의 범례 수저 칩(출발선)에만 있다 (M7e-3, R-327)', () => {
    for (const g of games) {
      const html = render(g);
      const text = textOf(html);
      expect(text, `${g.era} ${g.seed}`).not.toMatch(/[!！]/);
      expect(text, `${g.era} ${g.seed}`).not.toMatch(EMOJI);
      // 범례(.journey__legend)를 빼면 등급명이 없다: 회고 문장·사망 줄·연표 어디에도 「흙수저」가 쓰이지 않는다
      const outsideLegend = textOf(html.replace(/<dl class="journey__legend"[^]*?<\/dl>/, ''));
      expect(outsideLegend, `${g.era} ${g.seed}`).not.toMatch(GRADE_NAMES);
      // 범례의 수저 칩은 이 인물의 부모 재력 단계 칩 하나다 (출발선)
      const legend = html.match(/<dl class="journey__legend"[^]*?<\/dl>/)![0];
      expect(legend, `${g.era} ${g.seed}`).toContain(`data-grade="${g.character.parentWealth}"`);
      expect((legend.match(/class="grade grade--\d/g) ?? []).length, `${g.era} ${g.seed}`).toBe(1);
    }
  });

  it('공유·SNS·결과 카드·링크·이미지가 없다 (SNS 공유 결과 카드는 MVP에서 하지 않는다)', () => {
    for (const g of games) {
      const html = render(g);
      // (M4: 공통 헤더 로고·얼굴·아이콘이 인라인 <svg>라 svg는 더는 금지 목록이 아니다 — 공유·링크·이미지 파일·캔버스·소리가 없다는 뜻은 그대로다)
      expect(html).not.toMatch(/<a[\s>]|<img|<canvas|<audio|<video|navigator\.share/);
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

  it('도착 자리·방향·설명 대신 출발선(집안 형편)만 말한다 (재산 막대는 2a에서 임시로 빠졌다)', () => {
    expect(html).not.toContain('data-testid="ending-movement"');
    expect(html).not.toContain('data-testid="ending-note"');
    const text = textOf(html);
    // R-083: 출발선만 담담하게 — 게임 용어("내가 가진 것")도, 윗줄이 이미 말한 "생이 끝났다"도 되풀이하지 않는다
    const journey = textOf(html.match(/data-testid="ending-journey">([^]*?)<\/p>/)![1]);
    expect(journey).toMatch(/^.+의 집에서 태어났습니다\.$/);
    expect(journey).not.toMatch(/내가 가진 것|생이 끝|견줄|스무 살/);
    expect(text).not.toContain('형편으로 생을 마쳤습니다');
    // 재산 막대는 M5 2a에서 임시로 빠졌다(재산 스탯이 없어졌다): 「재산」이든 「집안 형편」이든 막대가 없다. 2b가 20세 전은 「집안 살림」, 20세부터는 「최종 순자산」 줄로 되살린다.
    expect(html).not.toMatch(/<span class="meter__label">(재산|집안 형편)<\/span>/);
  });

  it('연표와 최종 스탯은 그대로 나온다 (선택 기록 수만큼)', () => {
    expect((html.match(/data-testid="timeline-entry"/g) ?? []).length).toBe(young.history.length);
    expect(html).toContain('data-testid="final-health"');
  });
});

describe('순위 표현은 줄이 바뀌어도 쪼개지지 않는다 (ui/KeepStanding, QA 사용감 3)', () => {
  it('splitStanding: 순위 표현(조사 포함)만 홀수 칸으로 나뉜다', () => {
    expect(splitStanding('상위 약 30%의 집에서 태어나, 하위 1% 안쪽의 형편으로 생을 마쳤습니다.')).toEqual(['', '상위 약 30%의', ' 집에서 태어나, ', '하위 1% 안쪽의', ' 형편으로 생을 마쳤습니다.']);
    expect(splitStanding('가운데쯤의 집에서 태어나, 가운데쯤의 형편으로 생을 마쳤습니다.')).toEqual(['', '가운데쯤의', ' 집에서 태어나, ', '가운데쯤의', ' 형편으로 생을 마쳤습니다.']);
    expect(splitStanding('외모 63점 (상위 약 22%).')).toEqual(['외모 63점 (', '상위 약 22%', ').']);
    expect(splitStanding('순위 표현이 없는 글')).toEqual(['순위 표현이 없는 글']);
    expect(splitStanding('우리나라 출생아 중 하위 약 25%의 집안 형편이었다.')).toEqual(['우리나라 출생아 중 ', '하위 약 25%의', ' 집안 형편이었다.']);
  });

  it('splitStanding: 출발선 구간 표현도 덩어리로 나뉜다 — "안쪽의"·"사이의"·"밖의" 한 덩어리, 두 끝에서 센 "하위 25% 선과 상위 45% 선 사이의"는 "와" 뒤 공백에서 나뉠 수 있게 두 덩어리 (R-091)', () => {
    expect(splitStanding('하위 40% 안쪽의 집에서 태어나, 하위 약 32%의 형편으로 생을 마쳤습니다.')).toEqual(['', '하위 40% 안쪽의', ' 집에서 태어나, ', '하위 약 32%의', ' 형편으로 생을 마쳤습니다.']);
    expect(splitStanding('상위 8~28% 사이의 집에서 태어나, 상위 약 23%의 형편으로 생을 마쳤습니다.')).toEqual(['', '상위 8~28% 사이의', ' 집에서 태어나, ', '상위 약 23%의', ' 형편으로 생을 마쳤습니다.']);
    expect(splitStanding('하위 25% 선과 상위 45% 선 사이의 집에서 태어나, 가운데쯤의 형편으로 생을 마쳤습니다.')).toEqual([
      '',
      '하위 25% 선과',
      ' ',
      '상위 45% 선 사이의',
      ' 집에서 태어나, ',
      '가운데쯤의',
      ' 형편으로 생을 마쳤습니다.',
    ]);
    expect(splitStanding('상위 3% 안쪽의 집에서 태어났습니다.')).toEqual(['', '상위 3% 안쪽의', ' 집에서 태어났습니다.']);
    expect(splitStanding('상위 30% 밖의 집에서 태어났습니다.')).toEqual(['', '상위 30% 밖의', ' 집에서 태어났습니다.']);
    expect(splitStanding('하위 30~50% 사이의 집에서 태어났습니다.')).toEqual(['', '하위 30~50% 사이의', ' 집에서 태어났습니다.']);
  });

  it('standingPieces (M7a r2, 320px·글자 200% 가로 넘침 수정): 넓은 구간 덩어리만 숫자 구간과 뒤쪽 낱말로 나뉘고, 글은 공백 하나로 이어 붙이면 그대로다', () => {
    expect(standingPieces('상위 3~17% 사이의')).toEqual(['상위 3~17%', '사이의']);
    expect(standingPieces('하위 30~50% 사이의')).toEqual(['하위 30~50%', '사이의']);
    expect(standingPieces('상위 8~28% 사이')).toEqual(['상위 8~28%', '사이']);
    expect(standingPieces('하위 40% 안쪽의')).toEqual(['하위 40%', '안쪽의']);
    expect(standingPieces('상위 3% 안쪽의')).toEqual(['상위 3%', '안쪽의']);
    expect(standingPieces('상위 30% 밖의')).toEqual(['상위 30%', '밖의']);
    // 짧은 덩어리는 그대로 한 조각이다 — 숫자·「%」·조사가 쪼개지지 않는다
    for (const unit of ['상위 약 23%의', '하위 약 25%의', '하위 25% 선과', '가운데쯤의', '가운데쯤', '상위 약 38%']) expect(standingPieces(unit), unit).toEqual([unit]);
    // M7e-3(copy.md 5-1): 두 끝에서 센 구간의 뒷덩어리 「상위 45% 선 사이의」는 숫자 구간(「상위 45%」)과 「선 사이의」로 나뉜다
    expect(standingPieces('상위 45% 선 사이의')).toEqual(['상위 45%', '선 사이의']);
    expect(standingPieces('상위 45% 선 사이')).toEqual(['상위 45%', '선 사이']);
    // 어느 조각도 숫자 한가운데·「%」 앞·조사 앞에서 끊기지 않는다: 조각 안에 줄 바꿈 기회(공백)가 있다면 「상위 약」「하위 약」 앞뒤뿐이다
    for (const unit of ['상위 3~17% 사이의', '하위 40% 안쪽의', '상위 30% 밖의', '상위 45% 선 사이의']) {
      const [number, word] = standingPieces(unit);
      expect(number).toMatch(/^(상위|하위) \d+(~\d+)?%$/);
      expect(word).toMatch(/^(선 사이|사이|안쪽|밖)의?$/);
      expect(`${number} ${word}`).toBe(unit);
    }
  });

  it('엔딩의 출발선 대비 문장: 순위 표현이 nowrap span으로 감싸지고 글은 그대로다', () => {
    const g = endingOf(71284, 'present');
    const html = render(g);
    const review = reviewEnding(g);
    expect(review.journey.kind).toBe('compared');
    const journeyHtml = html.match(/data-testid="ending-journey">([^]*?)<\/p>/)![1];
    const parts = splitStanding(journeyText(review.journey));
    const units = (parts.length - 1) / 2; // 홀수 칸 = 순위 표현(덩어리)
    expect(units).toBeGreaterThanOrEqual(2);
    // 넓은 덩어리(「상위 3~17% 사이의」)는 숫자 구간과 뒤쪽 낱말 둘로 감싼다(standingPieces) — 조각 수의 합이 nowrap span 수다
    const pieces = parts.filter((_, i) => i % 2 === 1).flatMap(standingPieces).length;
    expect((journeyHtml.match(/<span class="nowrap">/g) ?? []).length).toBe(pieces);
    expect(journeyHtml.replace(/<[^>]+>/g, '')).toBe(journeyText(review.journey));
  });
});

describe('엔딩 화면: 출발선이 재력 단계의 구간으로 보인다 (R-091)', () => {
  const base = endingOf(2024, 'present');
  /** 지금 세상의 부모 재력 단계(1~5)와 최종 순자산(만 원)으로 회고를 만들어 그린다 */
  const html = (wealth: 1 | 2 | 3 | 4 | 5, final: number) => {
    const game: EndingGame = { ...base, character: { ...base.character, parentWealth: wealth }, assets: { ...base.assets!, net: final, debt: Math.max(base.assets!.debt, -final) } };
    return { html: render(game), review: reviewEnding(game) };
  };
  const journeyOf = (h: string) => textOf(h.match(/data-testid="ending-journey">([^]*?)<\/p>/)![1]);
  const movementTextOf = (h: string) => textOf(h.match(/data-testid="ending-movement">([^]*?)<\/p>/)![1]);

  it('지금 세상 다섯 단계: 출발선 문구가 구간이고, 방향 문장이 그 아래에 이어진다 (맨 아래·가운데·한쪽 절반·맨 위)', () => {
    const labels = ['하위 25% 안쪽의 집에서 태어나, ', '하위 25% 선과 상위 45% 선 사이의 집에서 태어나, ', '상위 17~45% 사이의 집에서 태어나, ', '상위 3~17% 사이의 집에서 태어나, ', '상위 3% 안쪽의 집에서 태어나, '];
    for (let w = 1; w <= 5; w++) {
      const { html: h, review } = html(w as 1, 5000);
      const journey = journeyOf(h);
      expect(journey.startsWith(labels[w - 1]), `${w}단계: ${journey}`).toBe(true);
      expect(journey.endsWith('의 형편으로 생을 마쳤습니다.'), journey).toBe(true);
      expect(review.journey.kind).toBe('compared');
      if (review.journey.kind === 'compared') expect(movementTextOf(h)).toBe(MOVEMENT_TEXT[review.journey.movement]);
    }
  });

  it('같은 구간에서 도착만 달라지면 방향만 달라진다: 지금 세상 3단계(상위 17~45% 사이)에서 최종 순자산이 분위수표의 5번째(뒤쪽) / 70번째(비슷함) / 95번째(앞섬) 백분위 값일 때', () => {
    const q = FINAL_DISTRIBUTION.present.quantiles;
    const verdict = (final: number) => {
      const r = html(3, final).review as EndingReview;
      return r.journey.kind === 'compared' ? r.journey.movement : 'early';
    };
    expect(verdict(q[5])).toBe('down');
    expect(verdict(q[70])).toBe('same');
    expect(verdict(q[95])).toBe('up');
  });

  it('20세 전 사망의 출발선도 같은 구간 표현이다', () => {
    const game: EndingGame = { ...base, age: 9, death: { age: 9, cause: '갑작스러운 병' }, character: { ...base.character, parentWealth: 2 } };
    expect(journeyOf(render(game))).toBe('하위 25% 선과 상위 45% 선 사이의 집에서 태어났습니다.');
    expect(journeyText({ kind: 'early', start: startBandOf('present', 4) })).toBe('상위 3~17% 사이의 집에서 태어났습니다.');
    expect(journeyText({ kind: 'early', start: bandFromRange(0, 25) })).toBe('하위 25% 안쪽의 집에서 태어났습니다.');
  });
});
