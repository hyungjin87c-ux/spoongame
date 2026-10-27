import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GENERATION_IDS, PARENT_WEALTHS, R1_PRESENT, parseGame, peersOf, type GameState, type ParentWealth } from '../src/core';
import { HOUSING_LABEL, OCCUPATION_LABEL } from '../src/data/birthReportTable';
import { BIRTH_ORDER_LABEL } from '../src/data/birthReportTable';
import { regionsOf } from '../src/data/birthStats';
import { regionLabelAt } from '../src/data/regionNames';
import { BirthScreen } from '../src/screens/BirthScreen';
import { BIRTH_VARIANTS, BIRTH_VARIANT_IDS, birthVariantState, type BirthVariantId } from '../e2e/m3Variants';
import { birthState, report as sampleReport, SAVE_VERSION } from '../e2e/saves';
import { WORD_BREAK_EXTRAS, WORD_BREAK_EXTRA_IDS, wordBreakExtraState } from '../e2e/wordBreakVariants';

/**
 * 출생신고 e2e 표본(e2e/m3Variants.ts)이 정말 「가장 긴 내용」을 담았는지 core로 다시 계산해 대조한다 (REV-003-M3-1 R-262: 공허 통과 방지).
 * e2e가 가장 긴 조합을 재려고 한 것과 실제로 가장 긴 조합이 같다는 증거 — 표가 바뀌어 더 긴 조합이 생기면 이 시험이 먼저 알린다.
 * (화면에서 의도한 내용이 보이는지는 e2e/m3States.ts#openM3Screen이 열 때마다 확인한다.)
 */

function render(state: GameState): string {
  return renderToStaticMarkup(<BirthScreen generation={state.generation!} character={state.character!} report={state.birthReport!} peerSeed={state.peerSeed!} onNext={() => {}} />);
}
const strip = (html: string): string => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const compareRows = (html: string): number => (html.match(/data-testid="compare-row"/g) ?? []).length;
const footNotes = (html: string): number => {
  const m = /data-testid="page-foot">([^]*?)<\/div>/.exec(html)!;
  return (m[1].match(/<p[ >]/g) ?? []).length;
};
const longestWord = (label: string): number => Math.max(...label.split(' ').map((w) => w.length));
/** 시험 전용 R1 프로필(2026년생)의 출생신고 화면 — 시군구와 비교 표(BR5)가 있는 유일한 판 */
function r1State(wealth: ParentWealth): GameState {
  const base = birthState(1, 'alpha', wealth, 50);
  return { ...base, generation: R1_PRESENT, character: { ...base.character!, birthYear: 2026 }, birthReport: sampleReport({ sigunguSido: '서울', sigungu: '종로구' }), peerSeed: 5 };
}
const placeOf = (state: GameState): string => regionLabelAt(state.birthReport!.region, state.character!.birthYear);

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
  it('비교 표는 세대 판에서 숨긴다(BR5): 일곱 세대 × 수저 5단계 모두 0행이고, 시험 전용 R1(2026년생)만 3행이다 — 표본의 compareRows가 이 규칙을 따른다', () => {
    for (const g of GENERATION_IDS) for (const w of PARENT_WEALTHS) expect(compareRows(render({ ...birthState(1, g, w, 50), peerSeed: 5 })), `${g} ${w}`).toBe(0);
    for (const w of PARENT_WEALTHS) expect(compareRows(render(r1State(w))), `R1 ${w}`).toBe(3);
    expect(BIRTH_VARIANT_IDS.every((id) => BIRTH_VARIANTS[id].compareRows === 0)).toBe(true);
  });

  it('하단 표기 줄 수: 세대 판은 모두 같은 줄 수(표본의 footNotes, 6줄)이고, 시험 전용 R1은 4줄이다 (R1 때 그대로)', () => {
    const byGen = GENERATION_IDS.map((g) => footNotes(render({ ...birthState(1, g, 3, 50), peerSeed: 5 })));
    expect(new Set(byGen).size, `세대별 줄 수 ${byGen.join(',')}`).toBe(1);
    for (const id of BIRTH_VARIANT_IDS) expect(BIRTH_VARIANTS[id].footNotes, id).toBe(byGen[0]);
    expect(byGen[0]).toBe(6);
    expect(footNotes(render(r1State(3)))).toBe(4);
  });

  /** 표본 출생 연도에서 가능한 모든 장소 라벨 (그 해의 행정구역 이름 + 지금의 시도) */
  function places(id: BirthVariantId) {
    const state = birthVariantState(id);
    const year = state.character!.birthYear;
    const all = regionsOf(year).regions.map((r) => {
      const label = regionLabelAt(r.name, year);
      return { region: r.name, label, word: longestWord(label) };
    });
    return { year, state, all };
  }

  it('태어난 곳: 낱말이 가장 긴 장소(「전남광주통합특별시)」 10글자)이자 전체가 가장 긴 장소를 표본이 쓴다 — 기준선 서울은 짧은 쪽이다', () => {
    const maxWord = (id: BirthVariantId) => Math.max(...places(id).all.map((p) => p.word));
    const maxLen = (id: BirthVariantId) => Math.max(...places(id).all.map((p) => p.label.length));
    expect(maxWord('birth-dirt')).toBe('전남광주통합특별시)'.length);
    for (const id of ['birth-dirt', 'birth-diamond', 'birth-industrial', 'birth-genz'] as const) {
      expect(longestWord(placeOf(birthVariantState(id))), `${id} 낱말 최대`).toBe(maxWord(id));
      expect(placeOf(birthVariantState(id)).length, `${id} 전체 길이 최대`).toBe(maxLen(id));
      expect(strip(/data-testid="birth-place">([^]*?)<\/dd>/.exec(render(birthVariantState(id)))![1])).toContain(BIRTH_VARIANTS[id].placeWord);
    }
    expect(placeOf(birthVariantState('birth')).length).toBeLessThan(maxLen('birth') / 2);
  });

  it('또래 4명: 표본마다 장소 낱말이 가장 긴 조합을 둘 이상 포함하고 다이아몬드수저 또래가 정확히 한 명 있다', () => {
    for (const id of BIRTH_VARIANT_IDS) {
      if (id === 'birth') continue; // 기준선(짧은 쪽)
      const { year, state, all } = places(id);
      const peers = peersOf(state.peerSeed!, year, state.birthReport!.month, state.character!.name);
      const words = peers.map((p) => longestWord(regionLabelAt(p.region, year)));
      const best = Math.max(...all.map((p) => p.word));
      expect(Math.max(...words), `${id} 또래 중 가장 긴 낱말`).toBe(best);
      expect(peers.filter((p) => p.wealth === 5).length, `${id} 다이아몬드수저 또래`).toBe(1);
      expect(words.filter((w) => w === best).length, `${id} 가장 긴 낱말을 가진 또래`).toBeGreaterThanOrEqual(2);
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

  it('표본의 수저 단계·세대 조합: 흙수저(알파·산업화)·다이아몬드수저(알파·Z)가 모두 있다', () => {
    const combos = new Set(BIRTH_VARIANT_IDS.map((id) => `${BIRTH_VARIANTS[id].generation}/${BIRTH_VARIANTS[id].wealth as ParentWealth}`));
    for (const c of ['alpha/1', 'alpha/5', 'industrial/1', 'genz/5']) expect(combos.has(c), c).toBe(true);
  });
});

describe('낱말 끊김 감사의 추가 출생신고 표본 둘 (e2e/wordBreakVariants.ts, QM3-1)', () => {
  // 가장 긴 내용 표본 5가지는 부모 직업이 모두 「기계 조작직」이라 반쪽 칸의 5글자 직업 이름(「단순노무직」)·4글자(「서비스직」) 끊김을 못 잡았다(QA M3-L02). 이 표본이 그 낱말을 담는다.
  for (const id of WORD_BREAK_EXTRA_IDS) {
    it(`${id}: parseGame 통과, 알파 세대, 어머니·아버지 칸에 의도한 직업 이름, 태어난 곳에 의도한 7글자 지명, 비교 표 없음·하단 표기 줄 수는 기준선과 같음·또래 4명`, () => {
      const v = WORD_BREAK_EXTRAS[id];
      const state = wordBreakExtraState(id);
      expect(parseGame(JSON.stringify({ version: SAVE_VERSION, data: state })), id).toEqual(state);
      expect(state.generation).toBe('alpha');
      const html = render(state);
      const field = (testId: string) => strip(new RegExp(`data-testid="${testId}">([^]*?)</dd>`).exec(html)![1]);
      expect(field('birth-mother'), id).toContain(v.jobs[0]);
      expect(field('birth-father'), id).toContain(v.jobs[1]);
      expect(field('birth-place'), id).toContain(v.placeWord);
      expect(strip(/data-testid="birth-sentence">([^]*?)<\/p>/.exec(html)![1]), `${id} 서술문에도 지명이 나온다`).toContain(v.placeWord);
      expect(compareRows(html)).toBe(0);
      expect(footNotes(html)).toBe(BIRTH_VARIANTS.birth.footNotes);
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
