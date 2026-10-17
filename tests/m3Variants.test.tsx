import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ERAS, PARENT_WEALTHS, parseGame, peersOf, type Era, type GameState, type ParentWealth } from '../src/core';
import { HOUSING_LABEL, OCCUPATION_LABEL } from '../src/data/birthReportTable';
import { BIRTH_ORDER_LABEL } from '../src/data/birthReportTable';
import { regionsOf, sigunguChoices } from '../src/data/birthStats';
import { placeLabel } from '../src/data/regionNames';
import { BirthScreen } from '../src/screens/BirthScreen';
import { BIRTH_VARIANTS, BIRTH_VARIANT_IDS, birthVariantState, type BirthVariantId } from '../e2e/m3Variants';
import { birthState, SAVE_VERSION } from '../e2e/saves';
import { WORD_BREAK_EXTRAS, WORD_BREAK_EXTRA_IDS, wordBreakExtraState } from '../e2e/wordBreakVariants';

/**
 * 출생신고 e2e 표본(e2e/m3Variants.ts)이 정말 「가장 긴 내용」을 담았는지 core로 다시 계산해 대조한다 (REV-003-M3-1 R-262: 공허 통과 방지).
 * e2e가 가장 긴 조합을 재려고 한 것과 실제로 가장 긴 조합이 같다는 증거 — 표가 바뀌어 더 긴 조합이 생기면 이 시험이 먼저 알린다.
 * (화면에서 의도한 내용이 보이는지는 e2e/m3States.ts#openM3Screen이 열 때마다 확인한다.)
 */

function render(state: GameState): string {
  return renderToStaticMarkup(<BirthScreen era={state.era!} character={state.character!} report={state.birthReport!} peerSeed={state.peerSeed!} onNext={() => {}} />);
}
const strip = (html: string): string => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const compareRows = (html: string): number => (html.match(/data-testid="compare-row"/g) ?? []).length;
const footNotes = (html: string): number => {
  const m = /data-testid="page-foot">([^]*?)<\/div>/.exec(html)!;
  return (m[1].match(/<p[ >]/g) ?? []).length;
};
const longestWord = (label: string): number => Math.max(...label.split(' ').map((w) => w.length));

describe('출생신고 e2e 표본: 저장 검증을 통과하고, 의도한 내용이 화면에 실제로 나온다', () => {
  for (const id of BIRTH_VARIANT_IDS) {
    it(`${id}: parseGame 통과, 비교 표 행 수·하단 표기 줄 수·태어난 곳의 가장 긴 낱말·또래 4명·다이아몬드 또래가 표본의 기대와 같다`, () => {
      const v = BIRTH_VARIANTS[id];
      const state = birthVariantState(id);
      expect(parseGame(JSON.stringify({ version: SAVE_VERSION, data: state })), id).toEqual(state);
      const html = render(state);
      expect(compareRows(html), `${id} 비교 표 행`).toBe(v.compareRows);
      expect(footNotes(html), `${id} 하단 표기 줄`).toBe(v.footNotes);
      const place = /data-testid="birth-place">([^]*?)<\/dd>/.exec(html)![1];
      expect(strip(place), id).toContain(v.placeWord);
      expect(html.match(/data-testid="peer"/g), id).toHaveLength(4);
      expect((html.match(/data-grade="5"/g) ?? []).length - (state.character!.parentWealth === 5 ? 1 : 0), `${id} 또래의 다이아몬드수저`).toBe(v.peerDiamond ? 1 : 0);
    });
  }
});

describe('출생신고 e2e 표본: 가장 긴 조합을 실제로 담았다 (core로 다시 계산)', () => {
  const presentIds = BIRTH_VARIANT_IDS.filter((id) => BIRTH_VARIANTS[id].era === 'present');

  it('비교 표 행 수가 최대인 조합(지금 세상, 3행)이 표본에 있고, 모든 수저 단계에서 최대 행 수가 같다 — 흙수저·다이아몬드수저 표본이 모두 있다', () => {
    const rowsByWealth = PARENT_WEALTHS.map((w) => compareRows(render({ ...birthState(1, 'present', w, 50), peerSeed: 5 })));
    const max = Math.max(...rowsByWealth);
    expect(max).toBe(3);
    expect(rowsByWealth.every((n) => n === max), `단계별 행 수 ${rowsByWealth.join(',')}`).toBe(true);
    // 지난·다가올 세상은 표가 없다(0행)
    for (const era of ['past', 'future'] as const) for (const w of PARENT_WEALTHS) expect(compareRows(render({ ...birthState(1, era, w, 50), peerSeed: 5 })), `${era} ${w}`).toBe(0);
    expect(presentIds.map((id) => BIRTH_VARIANTS[id].compareRows).every((n) => n === max)).toBe(true);
    const wealths = new Set(presentIds.map((id) => BIRTH_VARIANTS[id].wealth));
    for (const w of [1, 3, 5] as const) expect(wealths.has(w), `지금 세상 ${w}단계 표본`).toBe(true);
  });

  it('하단 표기 줄 수가 최대인 조합(지난·다가올 세상, 5줄)이 표본에 있다', () => {
    const byEra = ERAS.map((era) => footNotes(render({ ...birthState(1, era, 3, 50), peerSeed: 5 })));
    const max = Math.max(...byEra);
    expect(max).toBe(5);
    for (const era of ['past', 'future'] as const) {
      const ids = BIRTH_VARIANT_IDS.filter((id) => BIRTH_VARIANTS[id].era === era);
      expect(ids.length, era).toBeGreaterThan(0);
      expect(ids.every((id) => BIRTH_VARIANTS[id].footNotes === max), era).toBe(true);
    }
    expect(footNotes(render({ ...birthState(1, 'present', 3, 50), peerSeed: 5 }))).toBe(4);
  });

  /** 시대의 표본 출생 연도에서 가능한 모든 장소 */
  function places(id: BirthVariantId) {
    const state = birthVariantState(id);
    const era = state.era as Era;
    const year = state.character!.birthYear;
    const out: Array<{ label: string; word: number }> = [];
    for (const r of regionsOf(year).regions) {
      for (const c of sigunguChoices(year, r.name)) {
        const label = placeLabel({ region: r.name, sigunguSido: c.sido, sigungu: c.name }, era);
        out.push({ label, word: longestWord(label) });
      }
    }
    return { era, year, state, all: out };
  }

  it('태어난 곳: 시대마다 낱말이 가장 긴 장소(지금·다가올 세상 「전남광주통합특별시」, 지난 세상 5글자)나 전체가 가장 긴 장소(지금 15글자·지난 14글자)를 표본이 쓴다', () => {
    const maxWord = (id: BirthVariantId) => Math.max(...places(id).all.map((p) => p.word));
    const maxLen = (id: BirthVariantId) => Math.max(...places(id).all.map((p) => p.label.length));
    const heroLabel = (id: BirthVariantId) => {
      const { era, state } = places(id);
      const r = state.birthReport!;
      return placeLabel({ region: r.region, sigunguSido: r.sigunguSido, sigungu: r.sigungu }, era);
    };
    expect(longestWord(heroLabel('birth-dirt')), '지금 세상 낱말 최대').toBe(maxWord('birth-dirt'));
    expect(maxWord('birth-dirt')).toBe('전남광주통합특별시'.length);
    expect(heroLabel('birth-diamond').length, '지금 세상 전체 길이 최대').toBe(maxLen('birth-diamond'));
    expect(heroLabel('birth-past').length, '지난 세상 전체 길이 최대').toBe(maxLen('birth-past'));
    expect(longestWord(heroLabel('birth-past')), '지난 세상 낱말 최대').toBe(maxWord('birth-past'));
    expect(longestWord(heroLabel('birth-future')), '다가올 세상 낱말 최대').toBe(maxWord('birth-future'));
    expect(maxWord('birth-future')).toBe('전남광주통합특별시'.length);
  });

  it('또래 4명: 시대마다 장소가 가장 긴 조합을 포함하고(지금·다가올 세상 「전남광주통합특별시」 둘 이상) 다이아몬드수저 또래가 있다', () => {
    for (const id of BIRTH_VARIANT_IDS) {
      if (id === 'birth') continue; // 기준선(짧은 쪽)
      const { era, state, all } = places(id);
      const peers = peersOf(state.peerSeed!, state.character!.birthYear, state.birthReport!.month, state.character!.name);
      const words = peers.map((p) => longestWord(placeLabel(p, era)));
      const best = Math.max(...all.map((p) => p.word));
      expect(Math.max(...words), `${id} 또래 중 가장 긴 낱말`).toBe(best);
      expect(peers.some((p) => p.wealth === 5), `${id} 다이아몬드수저 또래`).toBe(true);
      if (era !== 'past') expect(words.filter((w) => w === best).length, `${id} 가장 긴 낱말을 가진 또래`).toBeGreaterThanOrEqual(2);
    }
  });

  it('직업·주거·형제 순서·체중: 모든 긴 내용 표본이 가장 긴 직업 이름(기계 조작직)·주거 이름(임차)·형제 순서(다섯째 이상)와 극단 체중을 쓴다', () => {
    const longest = <T extends string>(labels: Record<T, string>): string => (Object.values(labels) as string[]).reduce((a, b) => (b.length > a.length ? b : a));
    const job = longest(OCCUPATION_LABEL);
    const housing = longest(HOUSING_LABEL);
    const order = (Object.values(BIRTH_ORDER_LABEL) as string[]).reduce((a, b) => (b.length > a.length ? b : a));
    expect(job).toBe('기계 조작직');
    expect(housing).toBe('임차(전세, 월세)');
    expect(order).toBe('다섯째 이상');
    for (const id of BIRTH_VARIANT_IDS) {
      if (id === 'birth') continue;
      const r = birthVariantState(id).birthReport!;
      expect(OCCUPATION_LABEL[r.mother.job], `${id} 어머니`).toBe(job);
      expect(OCCUPATION_LABEL[r.father.job], `${id} 아버지`).toBe(job);
      expect(HOUSING_LABEL[r.housing], `${id} 주거`).toBe(housing);
      expect(BIRTH_ORDER_LABEL[r.birthOrder], `${id} 형제 순서`).toBe(order);
      expect([1, 4.9], `${id} 체중`).toContain(r.birthWeightKg);
    }
  });

  it('표본의 수저 단계·시대 조합: 흙수저(지금·지난)·다이아몬드수저(지금·다가올)가 모두 있다', () => {
    const combos = new Set(BIRTH_VARIANT_IDS.map((id) => `${BIRTH_VARIANTS[id].era}/${BIRTH_VARIANTS[id].wealth as ParentWealth}`));
    for (const c of ['present/1', 'present/5', 'past/1', 'future/5']) expect(combos.has(c), c).toBe(true);
  });
});

describe('낱말 끊김 감사의 추가 출생신고 표본 둘 (e2e/wordBreakVariants.ts, QM3-1)', () => {
  // 가장 긴 내용 표본 5가지는 부모 직업이 모두 「기계 조작직」이라 반쪽 칸의 5글자 직업 이름(「단순노무직」)·4글자(「서비스직」) 끊김을 못 잡았다(QA M3-L02). 이 표본이 그 낱말을 담는다.
  for (const id of WORD_BREAK_EXTRA_IDS) {
    it(`${id}: parseGame 통과, 지금 세상, 어머니·아버지 칸에 의도한 직업 이름, 태어난 곳에 의도한 7글자 지명, 비교 표 3행·하단 표기 4줄·또래 4명`, () => {
      const v = WORD_BREAK_EXTRAS[id];
      const state = wordBreakExtraState(id);
      expect(parseGame(JSON.stringify({ version: SAVE_VERSION, data: state })), id).toEqual(state);
      expect(state.era).toBe('present');
      const html = render(state);
      const field = (testId: string) => strip(new RegExp(`data-testid="${testId}">([^]*?)</dd>`).exec(html)![1]);
      expect(field('birth-mother'), id).toContain(v.jobs[0]);
      expect(field('birth-father'), id).toContain(v.jobs[1]);
      expect(field('birth-place'), id).toContain(v.placeWord);
      expect(strip(/data-testid="birth-sentence">([^]*?)<\/p>/.exec(html)![1]), `${id} 서술문에도 지명이 나온다`).toContain(v.placeWord);
      expect(compareRows(html)).toBe(3);
      expect(footNotes(html)).toBe(4);
      expect(html.match(/data-testid="peer"/g)).toHaveLength(4);
      expect(longestWord(v.placeWord), '7글자 지명 낱말').toBe(7);
    });
  }

  it('표본은 5글자 낱말 직업(단순노무직·농림어업직)·4글자(서비스직)·3글자(판매직)를 부모에게 준다 — 직업 이름 중 낱말이 가장 긴 것(5글자)을 모두 포함한다', () => {
    const longestJobWord = Math.max(...Object.values(OCCUPATION_LABEL).map((l) => longestWord(l)));
    expect(longestJobWord).toBe(5);
    const used = WORD_BREAK_EXTRA_IDS.flatMap((id) => WORD_BREAK_EXTRAS[id].jobs);
    expect(used.map(longestWord).sort()).toEqual([3, 4, 5, 5]);
    expect(new Set(used).size).toBe(4);
  });
});
