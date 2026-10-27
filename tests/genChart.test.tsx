import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import genChartSrc from '../src/core/genChart.ts?raw';
import { GEN_CHART_Y0, GEN_CHART_Y1, buildGenChart, genChartOfficial, genChartSource, genChartSourceText, genChartWidth, manText, nearestPoint, type GenChartSource } from '../src/core/genChart';
import { GENERATION_CHOICES } from '../src/core/types';
import { GEN_CHART_TEXT } from '../src/data/genChartText';
import { GENERATIONS } from '../src/data/generations';
import { GenSlide } from '../src/ui/GenSlide';
import { codeOnly } from './helpers/code';

/**
 * 캐러셀 첫 장 「세대 그래프」 (SPEC-004 GS11, design-system.md 17-12-3 검산표, diff-004.md D4-61·D4-72): 값은 `koreaStats.json`의 출생아 수(1970~)·기대수명(1970~)뿐이고,
 * 세대 줄(라디오)이 바뀌면 같은 함수가 그림·숫자·표·읽기 이름을 다시 만든다. 1940~1969는 공식 연간 통계가 없어 비우고 「연간 통계 없음」이라 적는다. 세대 사이의 우열·순위를 말하는 글은 없다(GD6).
 */

const SRC = genChartSource() as GenChartSource;
const W = 452; // 1280 오른쪽 열의 그림 폭(453을 4px 단위로 내린 값)

/** 검산표(design-system.md 17-12-3 7번) — 7세대 + 랜덤 */
const TABLE: Array<[string, { age: string; avg: string | null; life: string | null; lifeSub: string | null; rows: number; peak: string | null }]> = [
  ['random', { age: '6~86세', avg: '64만', life: '62.3~83.5세', lifeSub: '1970·2020년생', rows: 52, peak: '1971년 102만' }],
  ['industrial', { age: '72~86세', avg: null, life: null, lifeSub: null, rows: 1, peak: null }],
  ['boomer', { age: '63~71세', avg: null, life: null, lifeSub: null, rows: 1, peak: null }],
  ['g86', { age: '57~66세', avg: null, life: null, lifeSub: null, rows: 1, peak: null }],
  ['genx', { age: '46~56세', avg: '89만', life: '62.3~66.1세', lifeSub: '1970·1980년생', rows: 11, peak: '1971년 102만' }],
  ['millennial', { age: '30~45세', avg: '71만', life: '66.7~74.2세', lifeSub: '1981·1996년생', rows: 16, peak: '1981년 87만' }],
  ['genz', { age: '14~29세', avg: '52만', life: '74.7~80.9세', lifeSub: '1997·2012년생', rows: 16, peak: '1997년 68만' }],
  ['alpha', { age: '6~13세', avg: '37만', life: '81.4~83.5세', lifeSub: '2013·2020년생', rows: 8, peak: '2015년 44만' }],
];

describe('재료: koreaStats.json의 출생아 수·기대수명', () => {
  it('출생아 수 1970~2020(51개, 2021년 이후는 그래프 범위 밖이라 뺀다) · 기대수명 1970~2024(55개) · 기관은 현재 이름 「국가데이터처」 · 조회일은 데이터의 값', () => {
    expect(SRC).not.toBeNull();
    expect(SRC.births).toHaveLength(51);
    expect([SRC.births[0].year, SRC.births[50].year]).toEqual([1970, 2020]);
    expect(SRC.births[1]).toEqual({ year: 1971, value: 1_024_773 });
    expect([SRC.life[0].year, SRC.life[54].year]).toEqual([1970, 2024]);
    expect(SRC.org).toBe('국가데이터처');
    expect(SRC.accessedOn).toBe('2026-10-15');
  });
  it('연도 오름차순이고 숫자가 모두 유한하다', () => {
    for (const list of [SRC.births, SRC.life]) {
      expect(list.every((p, i) => Number.isFinite(p.value) && (i === 0 || p.year > list[i - 1].year))).toBe(true);
    }
  });
});

describe('세대마다 같은 질문에 같은 모양으로 답한다 — 검산표(17-12-3)', () => {
  it.each(TABLE)('%s: 올해 나이 · 한 해 평균 · 기대수명 · 표 줄 수 · 최댓값 라벨', (choice, want) => {
    const m = buildGenChart(choice as never, SRC, W);
    expect(m.age).toBe(want.age);
    expect(m.big?.value ?? null).toBe(want.avg);
    expect(m.life?.value ?? null).toBe(want.life);
    expect(m.life?.sub ?? null).toBe(want.lifeSub);
    expect(m.table).toHaveLength(want.rows);
    expect(m.peak?.text ?? null).toBe(want.peak);
  });

  it('8가지 선택(랜덤 + 세대 7종)을 모두 만든다 — GENERATION_CHOICES와 검산표가 같은 목록이다', () => {
    expect(TABLE.map(([c]) => c).sort()).toEqual([...GENERATION_CHOICES].sort());
  });

  it('자료 없는 세대(산업화·베이비붐·86): 큰 값·기대수명이 없고(null — 화면은 「—」 + sr-only 「자료 없음」) 이유 「1970년부터 자료가 있어요」, 표는 한 줄 「{첫해}~{끝해}년 │ 자료 없음」이다', () => {
    for (const c of ['industrial', 'boomer', 'g86'] as const) {
      const def = GENERATIONS.find((g) => g.id === c)!;
      const m = buildGenChart(c, SRC, W);
      expect(m.big).toBeNull();
      expect(m.bigSub).toBe('한 해 평균 · 1970년부터 자료가 있어요');
      expect(m.life).toBeNull();
      expect(m.lifeNone).toBe('1970년부터 자료가 있어요');
      expect(m.span).toBeNull();
      expect(m.table).toEqual([{ label: `${def.birth.from}~${Math.min(def.birth.to, 1969)}년`, value: null }]);
      expect(m.readName).toContain('구간을 강조했어요. 그 구간은 공식 연간 출생 통계가 없어요.');
    }
  });

  it('X세대 읽기 이름·세대 줄·표 머리 문장이 copy.md 16-12와 같다', () => {
    const m = buildGenChart('genx', SRC, W);
    expect(m.readName).toBe('1940년부터 2020년까지 한 해에 태어난 아기 수 그래프. X세대 1970~1980년생 구간을 강조했어요. 그 구간은 한 해 평균 89만 명, 가장 많은 해는 1971년 102만 명이에요.');
    expect(m.gen).toEqual({ name: 'X세대', range: '1970~1980년생', from: 1970, to: 1980 });
    expect(m.tableCaption).toBe('X세대 1970~1980년생 구간의 해마다 출생아 수');
    expect(m.bigSub).toBe('한 해 평균 · 1970~1980년');
    expect(m.table[0]).toEqual({ label: '1970년', value: '1,006,645명' });
  });

  it('랜덤 세대: 띠가 없고 전체 구간, 읽기 이름은 공식 통계가 1970년부터 있다는 사실과 2020년 값을 말한다', () => {
    const m = buildGenChart('random', SRC, W);
    expect(m.band).toBeNull();
    expect(m.gen).toEqual({ name: '어느 세대든', range: '1940~2020년생', from: 1940, to: 2020 });
    expect(m.readName).toBe('1940년부터 2020년까지 한 해에 태어난 아기 수 그래프. 공식 연간 통계는 1970년부터 있어요. 1970~2020년은 한 해 평균 64만 명, 가장 많은 해는 1971년 102만 명, 2020년은 27만 명이에요.');
    expect(m.table[0]).toEqual({ label: '1940~1969년', value: null });
    expect(m.tableCaption).toBe('1940~2020년생 구간의 해마다 출생아 수');
  });
});

describe('그림 좌표', () => {
  it('좌표계의 한 칸 = 화면 1px: 폭은 220~520으로 맞추고 4px 단위로 내린다, 높이는 시안 비율(400:196)', () => {
    expect(genChartWidth(453)).toBe(452);
    expect(genChartWidth(100)).toBe(220);
    expect(genChartWidth(900)).toBe(520);
    expect(genChartWidth(Number.NaN)).toBe(320);
    const m = buildGenChart('genx', SRC, 453);
    expect([m.width, m.height]).toEqual([452, 221]);
  });

  it('y 눈금 40만·80만·120만·0, x 눈금 1940·1960·1980·2000·2020(끝 둘은 안쪽 정렬), 격자 3줄은 꼭대기 120만에서 아래로 같은 간격', () => {
    const m = buildGenChart('genx', SRC, W);
    expect(m.yTicks.map((t) => t.text)).toEqual(['40만', '80만', '120만', '0']);
    expect(m.xTicks.map((t) => [t.text, t.anchor])).toEqual([['1940', 'start'], ['1960', 'middle'], ['1980', 'middle'], ['2000', 'middle'], ['2020', 'end']]);
    expect(m.grid).toHaveLength(3);
    expect(m.grid[2]).toBe(m.T); // 120만 = 위 여백
    expect(Math.abs(m.grid[0] - m.grid[1] - (m.grid[1] - m.grid[2]))).toBeLessThan(0.2);
    expect(m.xTicks[0].x).toBe(m.L);
    expect(m.xTicks[4].x).toBeCloseTo(m.R, 5);
  });

  it('보조 선은 51점 전부, 강조 선은 고른 구간의 점뿐이다 — 띠는 앞뒤 반 칸씩 넓다', () => {
    const m = buildGenChart('genx', SRC, W);
    expect(m.rest.split(' ')).toHaveLength(51);
    expect(m.span!.split(' ')).toHaveLength(11);
    expect(m.band!.width).toBeCloseTo(11 * m.step, 0);
    // 모든 점이 플롯 영역 안
    for (const p of m.points) {
      expect(p.x).toBeGreaterThanOrEqual(m.L);
      expect(p.x).toBeLessThanOrEqual(m.R);
      expect(p.y).toBeGreaterThanOrEqual(m.T);
      expect(p.y).toBeLessThanOrEqual(m.B);
    }
    expect(m.peak!.labelX).toBeGreaterThanOrEqual(m.L + 48);
    expect(m.peak!.labelX).toBeLessThanOrEqual(m.R - 48);
  });

  it('「연간 통계 없음」 글자는 1940~1969 가운데(기준선 위)에 있다', () => {
    const m = buildGenChart('random', SRC, W);
    expect(m.none.text).toBe('연간 통계 없음');
    expect(m.none.x).toBeLessThan(m.points[0].x);
    expect(m.none.x).toBeGreaterThan(m.L);
    expect(m.none.y).toBeLessThan(m.B);
  });

  it('가리킴: 가장 가까운 해의 점을 돌려주고, 자료가 없는 해(1969 이전)·그림 밖은 null이다', () => {
    const m = buildGenChart('genx', SRC, W);
    const p1988 = m.points.find((p) => p.year === 1988)!;
    expect(nearestPoint(m, p1988.x + 0.4 * m.step)?.year).toBe(1988);
    expect(nearestPoint(m, p1988.x - 0.4 * m.step)?.year).toBe(1988);
    expect(nearestPoint(m, m.L + 5)).toBeNull(); // 1940년 근처 — 자료 없음
    expect(nearestPoint(m, m.R + 80)).toBeNull();
    expect(manText(p1988.value)).toBe('63만'); // 시안 「1988년 · 63만 명」
  });

  it('가로 범위 상수는 세대 정의의 첫해·끝해다', () => {
    expect([GEN_CHART_Y0, GEN_CHART_Y1]).toEqual([1940, 2020]);
  });
});

describe('문구: 해요체 · 우열·순위 없음 · 출처는 데이터에서', () => {
  it('출처 줄: 기관·조회일은 데이터에서, 표 범위와 비운 구간을 말한다', () => {
    expect(genChartSourceText(SRC)).toEqual({
      lead: '출처: 국가데이터처 인구동향조사 출생아 수(1970~2020년)와 생명표 기대수명(1970~2024년), 2026-10-15 조회.',
      tail: '1969년까지는 공식 연간 출생 통계가 없어 비워 두었어요.',
    });
    expect(genChartOfficial(SRC)).toBe('출생아 수(1970~2020년)');
  });

  it('그래프가 만드는 모든 글(8가지 선택)에 우열·순위·평가 낱말이 없다 (GD6)', () => {
    const banned = /순위|등수|가장 힘든|제일 힘든|불쌍|운이 좋|더 나은|더 못한|우월|열등|1위|꼴찌/;
    for (const c of GENERATION_CHOICES) {
      const m = buildGenChart(c, SRC, W);
      const text = [m.readName, m.tableCaption, m.bigSub, m.age, m.life?.value ?? '', m.life?.sub ?? '', m.lifeNone, m.gen.name, m.gen.range, ...m.table.map((r) => r.label)].join(' / ');
      expect(text, c).not.toMatch(banned);
    }
    expect(GEN_CHART_TEXT.insight).not.toMatch(banned);
  });

  it('core/genChart.ts는 시각·난수·DOM을 만지지 않는다 (CM2) — 순수 함수다', () => {
    expect(codeOnly(genChartSrc)).not.toMatch(/Math\.random|Date\.now|new Date\b|window\.|document\./);
  });
});

describe('GenSlide 서버 렌더 (D4-71 첫 장)', () => {
  const html = (choice: Parameters<typeof GenSlide>[0]['choice'], active = true) => renderToStaticMarkup(<GenSlide choice={choice} source={SRC} active={active} index={0} count={21} />);

  it('슬라이드 문법: article(aria-roledescription=슬라이드, 이름 「1/21 표제어, 공식 통계명」) → h3 표제어 → 세대 줄(aria-live=polite) → 큰 값 → svg(role=img + 읽기 이름) → 숫자 둘 → 표로 보기 → 출처', () => {
    const h = html('genx');
    expect(h).toContain('data-slide-id="gen-births"');
    expect(h).toContain('aria-roledescription="슬라이드"');
    expect(h).toContain('aria-label="1/21 고른 세대는 한 해에 몇 명이 태어났을까?, 출생아 수(1970~2020년)"');
    const order = ['slide__insight', 'gen-chart__gen', 'gen-chart__big', 'gen-chart__bigsub', '<svg', 'gen-chart__nums', 'gen-chart__table', 'data-testid="gen-chart-source"'].map((k) => h.indexOf(k));
    expect(order.every((v) => v > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(h).toContain('aria-live="polite"');
    expect(h).toContain('role="img"');
    expect(h).toContain('<b>X세대</b>');
    expect(h).toContain('<span>89만</span><small class="slide__unit">명</small>');
    expect(h).toContain('<summary>표로 보기</summary>');
    expect(h).toContain('is-active');
    expect(html('genx', false)).not.toContain('is-active');
  });

  it('자료 없는 세대: 큰 값은 「—」(보이는 글자) + sr-only 「자료 없음」이고 값 단위 글자가 없다', () => {
    const h = html('industrial');
    expect(h).toContain('<span class="gen-chart__dash" aria-hidden="true">—</span><span class="sr-only">자료 없음</span>');
    expect(h).not.toContain('slide__unit');
    expect(h).toContain('1970년부터 자료가 있어요');
  });

  it('고른 세대마다 서로 다른 선 모양(강조 선·띠)이 그려지고, 랜덤에는 띠가 없다', () => {
    expect(html('random')).not.toContain('gchart__band');
    expect(html('genz')).toContain('gchart__band');
    expect(html('industrial')).toContain('gchart__band'); // 자료가 없어도 띠(고른 구간)는 보인다
    expect(html('industrial')).not.toContain('data-testid="gen-chart-span"');
    expect(html('genz')).toContain('data-testid="gen-chart-span"');
  });
});
