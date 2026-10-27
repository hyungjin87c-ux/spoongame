import { describe, expect, it } from 'vitest';
import copyMd from '../docs/design/copy.md?raw';
import { LINE_H, LINE_H_STACKED, R1_PROFILE, buildCarousel, buildSlide, isDrawable, segmentHitsRect, selectCarouselIndicators, valueWidthEm, type BarsChartModel, type CarouselSlide, type LineChartModel, type StackChartModel } from '../src/core';
import { FIRST_LABEL_BOX, buildHeatSlide, gapEveryYear, manLabel, placeProjectionFirstLabel, scenarioMeaning } from '../src/core/slideForms';
import { hasBatchim, josa, sourceTextOf } from '../src/core/slideKit';
import { heatProjectionInput } from '../src/data/heatProjectionAdapter';
import { BASE_STATS_FILE, createStatsAccess, type StatsFile, type UsableIndicator } from '../src/data/koreaStatsAccess';
import { SLIDE_TEXT } from '../src/data/slideText';
import { STAT_HEADLINES } from '../src/data/statHeadlines';

/**
 * 전망·격차·폭염·아기 슬라이드의 형식별 모델 (SPEC-005 QI4 2단계, 설계 diff-005 12절 D5-60~D5-75 · copy.md 14절 · design-system.md 15절).
 * 값은 전부 데이터에서 계산한다 — 이 시험은 모델이 데이터와 같은 값을, 문서(copy.md 14-1·14-4)와 같은 글자로 내는지, 그래프 좌표가 규칙(경계 x = 확정 마지막 해, 끝 글자 x = 마지막 점 + 8)을 지키는지 잠근다.
 * 슬라이드 20장·순서·공통 글자(출처 줄·기준 줄·접근 가능한 이름)는 tests/carousel.test.ts, 표제어·공식 통계명·단일 출처 규칙은 tests/statHeadlines.test.ts.
 */

const data = buildCarousel();
const byId = (id: string): CarouselSlide => data.slides.find((s) => s.id === id)!;
const ind = (id: string): UsableIndicator => selectCarouselIndicators().find((i) => i.id === id)!;
const line = (id: string): LineChartModel => {
  const c = byId(id).chart;
  if (c.kind !== 'line') throw new Error(`${id}는 선 그래프가 아니다`);
  return c;
};

describe('작은 도구: 조사(josa)·만 단위·시나리오 뜻 낱말', () => {
  it('hasBatchim·josa: 데이터로 채운 낱말에 받침에 맞는 조사가 붙는다 (이상 → 과, 18~65세 → 와, 인구 → 는)', () => {
    expect(hasBatchim('이상')).toBe(true);
    expect(hasBatchim('18~65세')).toBe(false);
    expect(hasBatchim('인구')).toBe(false);
    expect(hasBatchim('가구원')).toBe(true);
    expect(hasBatchim('')).toBe(false);
    expect(josa.and('66세 이상')).toBe('66세 이상과');
    expect(josa.and('18~65세')).toBe('18~65세와');
    expect(josa.topic('65세 이상 인구')).toBe('65세 이상 인구는');
    expect(josa.topic('인구수')).toBe('인구수는'); // 받침 없음 → 는
    expect(josa.topic('가구원')).toBe('가구원은');
  });

  it('manLabel: 1천만 이상은 그래프 안에서만 만 단위(반올림) — 25,012,374 → 2,501만, 36,222,293 → 3,622만 (design-system.md 15-2)', () => {
    expect(manLabel(25012374)).toBe('2,501만');
    expect(manLabel(36222293)).toBe('3,622만');
    expect(manLabel(51672569)).toBe('5,167만');
    expect(manLabel(10000000)).toBe('1,000만');
  });

  it('scenarioMeaning: 데이터 official의 「(최대인구 추계」「(최소인구 추계」 낱말, 없으면 null — 중위·단일 추계는 null', () => {
    const pop = ind('projection-population-total').projection!.scenarios;
    expect(pop.map((s) => scenarioMeaning(s))).toEqual([null, '최대인구', '최소인구']); // 중위·고위·저위
    expect(scenarioMeaning(ind('projection-one-person-households').projection!.scenarios[0])).toBeNull();
    expect(scenarioMeaning({ official: '시험 추계' })).toBeNull();
  });
});

describe('전망 선 그래프 (총인구 · 65세 이상 구성비 · 1인 가구) — FC2: 실선 | 경계 | 긴 점선 + 고위~저위 띠', () => {
  const IDS = ['projection-population-total', 'projection-aging-share', 'projection-one-person-households'];

  it('계열 둘: 확정(앞선) 구간 실선·점 없음, 전망 구간 긴 점선(proj)·마지막 점만 — 경계 해에서 이어진다 (가구추계는 2021 → 2022 사이도 잇는다)', () => {
    for (const id of IDS) {
      const c = line(id);
      const p = ind(id).projection!;
      expect(c.series.map((s) => [s.key, s.dash, s.marks]), id).toEqual([
        ['actual', 'solid', 'none'],
        ['projection', 'proj', 'last'],
      ]);
      const [actual, proj] = c.series;
      expect(actual.last.year, `${id} 확정 마지막 해 = actualThrough`).toBe(p.actualThrough);
      expect(proj.first.year, `${id} 전망 계열은 경계 해에서 시작`).toBe(p.actualThrough);
      expect(proj.last.year, `${id} 지평`).toBe(p.horizon);
      // 경계에서 이어진다: 전망 선의 첫 점 = 확정 선의 마지막 점
      expect([proj.first.x, proj.first.y], id).toEqual([actual.last.x, actual.last.y]);
      // 가구추계: 중위 계열이 2022에서 시작하므로 2021(확정 마지막)에서 2022 사이 한 칸이 점선이다
      if (p.scenarios[0].level === 'single') expect(proj.points.slice(0, 2).map((x) => x.year), id).toEqual([2021, 2022]);
    }
  });

  it('경계(split): x = 확정 마지막 해의 x, 위 글자 왼쪽 「확정 / 추계 앞 구간」·오른쪽 「전망」, 축 아래 눈금과 가운데 정렬 연도 글자, x 라벨은 시작·경계·끝 셋 (D5-63)', () => {
    const expected: Record<string, string> = { 'projection-population-total': '확정', 'projection-aging-share': '확정', 'projection-one-person-households': '추계 앞 구간' };
    for (const id of IDS) {
      const c = line(id);
      const p = ind(id).projection!;
      const sp = c.split!;
      expect(sp, id).not.toBeNull();
      expect(sp.year).toBe(p.actualThrough);
      expect(sp.x, `${id} 경계 x = 확정 마지막 점 x`).toBe(c.series[0].last.x);
      expect([sp.left.text, sp.left.anchor, sp.right.text, sp.right.anchor], id).toEqual([expected[id], 'end', '전망', 'start']);
      expect([sp.left.x, sp.right.x], id).toEqual([sp.x - 4, sp.x + 4]);
      expect(sp.top).toBeLessThan(sp.bottom);
      expect(sp.bottom, id).toBe(c.axisY);
      expect(sp.tickTo - sp.bottom, `${id} 눈금 5px`).toBe(5);
      expect(c.xLabels.map((l) => [l.text, l.anchor]), id).toEqual([
        [String(c.series[0].first.year), 'start'],
        [String(p.actualThrough), 'middle'],
        [String(p.horizon), 'end'],
      ]);
      expect(c.xLabels[1].x, `${id} 경계 연도 글자는 경계선 아래`).toBe(sp.x);
    }
  });

  it('고위~저위 띠: 총인구·65세 이상 구성비만(시나리오가 하나인 가구추계는 없다) — 띠 면 + 가장자리 점선 둘 + 끝 글자 「고위」「저위」(12px 연한 글씨, 중위 끝값과 12.9 이상 벌어짐)', () => {
    expect(line('projection-one-person-households').band).toBeNull();
    expect(line('projection-one-person-households').labels.some((l) => l.tone === 'range')).toBe(false);
    for (const id of ['projection-population-total', 'projection-aging-share']) {
      const c = line(id);
      expect(c.band, id).not.toBeNull();
      expect(c.band!.path.startsWith('M') && c.band!.path.endsWith('Z'), id).toBe(true);
      expect(c.band!.edges).toHaveLength(2);
      const range = c.labels.filter((l) => l.tone === 'range');
      expect(range.map((l) => l.text), id).toEqual(['고위', '저위']);
      const last = c.series[1].last;
      for (const l of c.labels.filter((x) => x.bold || x.tone === 'range')) expect(l.x, `${id} 끝 글자 x = 마지막 점 + 8`).toBe(last.x + 8);
      const ys = c.labels.filter((x) => x.bold || x.tone === 'range').map((l) => l.y).sort((a, b) => a - b);
      for (let k = 1; k < ys.length; k++) expect(ys[k] - ys[k - 1], `${id} 끝 글자 간격`).toBeGreaterThanOrEqual(12.9);
    }
    // 65세 이상 구성비: 고위(최대인구) 44.5% < 중위 47.7% < 저위(최소인구) 51.2% — 「고위」가 띠 아래에 오고 범례·보조 줄이 이유를 말한다 (R-483 a)
    const aging = line('projection-aging-share');
    const [high, low] = aging.labels.filter((l) => l.tone === 'range');
    expect(high.y, '고위 글자가 저위 글자 아래').toBeGreaterThan(low.y);
    expect(byId('projection-aging-share').legend.at(-1)!.label).toBe('고위(최대인구)~저위(최소인구) 추계 범위');
    expect(byId('projection-aging-share').sideValues[0].text).toBe('2072년 고위 추계(최대인구) 44.5%, 저위 추계(최소인구) 51.2%');
    // 총인구는 반대: 고위 글자가 위
    const [highP, lowP] = line('projection-population-total').labels.filter((l) => l.tone === 'range');
    expect(highP.y).toBeLessThan(lowP.y);
  });

  it('값 글자: 처음 = 확정 첫 값, 마지막 = 중위 끝값(굵게) — 1천만 이상은 그래프 안에서만 만 단위, 값 줄·범례·읽기 이름·보조 줄은 원문 자릿수 그대로 (총인구 「2,501만」→「3,622만」 / 36,222,293명)', () => {
    const pop = line('projection-population-total');
    const first = pop.labels.find((l) => !l.bold && l.tone === undefined)!;
    const last = pop.labels.find((l) => l.bold)!;
    expect([first.text, last.text]).toEqual(['2,501만', '3,622만']);
    expect(byId('projection-population-total').valueText).toBe('36,222,293');
    expect(byId('projection-population-total').legend[0].valueText).toBe('51,672,569명');
    expect(byId('projection-population-total').legend[1].valueText).toBe('36,222,293명');
    expect(byId('projection-population-total').sideValues[0].text).toBe('2072년 고위 추계(최대인구) 42,818,632명, 저위 추계(최소인구) 30,172,383명');
    const aging = line('projection-aging-share');
    expect([aging.labels.find((l) => !l.bold && l.tone === undefined)!.text, aging.labels.find((l) => l.bold)!.text]).toEqual(['2.9', '47.7']);
    const hh = line('projection-one-person-households');
    expect([hh.labels.find((l) => !l.bold && l.tone === undefined)!.text, hh.labels.find((l) => l.bold)!.text]).toEqual(['15.5', '41.3']);
  });

  it('보조 줄: 고위·저위는 쉼표 문장(머리 + 항목 둘, 항목마다 줄바꿈 묶음), 시나리오가 하나면 출발값·경계값(「추계 앞 구간 2000년 15.5%, 2021년 32.9%」), 65세 이상 구성비는 65세 이상 인구(중위 끝값) 한 줄이 더 있다 (R-483 b)', () => {
    const pop = byId('projection-population-total').sideValues;
    expect(pop).toHaveLength(1);
    expect(pop[0].phrases).toEqual({ lead: '2072년', items: ['고위 추계(최대인구) 42,818,632명', '저위 추계(최소인구) 30,172,383명'] });
    expect(pop[0].text).toBe(`${pop[0].phrases!.lead} ${pop[0].phrases!.items.join(', ')}`);
    expect(byId('projection-one-person-households').sideValues.map((v) => v.text)).toEqual(['추계 앞 구간 2000년 15.5%, 2021년 32.9%']);
    expect(byId('projection-one-person-households').sideValues[0].phrases).toBeUndefined();
    expect(byId('projection-aging-share').sideValues.map((v) => v.text)).toEqual(['2072년 고위 추계(최대인구) 44.5%, 저위 추계(최소인구) 51.2%', '65세 이상 인구는 2072년 17,270,735명(중위 추계)']);
  });

  it('범례: 「확정 1960~2022 51,672,569명」「전망 2023~2072(중위) 36,222,293명」+ 띠 견본, 가구추계는 「추계 앞 구간 2000~2021 32.9%」「전망 2022~2052 41.3%」(시나리오 괄호 없음)', () => {
    expect(byId('projection-population-total').legend.map((l) => [l.label, l.valueText, l.rect ?? null])).toEqual([
      ['확정 1960~2022', '51,672,569명', null],
      ['전망 2023~2072(중위)', '36,222,293명', null],
      ['고위(최대인구)~저위(최소인구) 추계 범위', '', 'band'],
    ]);
    expect(byId('projection-one-person-households').legend.map((l) => [l.label, l.valueText])).toEqual([
      ['추계 앞 구간 2000~2021', '32.9%'],
      ['전망 2022~2052', '41.3%'],
    ]);
    expect(byId('projection-population-total').legend.map((l) => l.dash)).toEqual(['solid', 'proj', 'proj']);
  });

  it('그래프 읽기 이름(chartLabel)은 copy.md 14-4·design-system.md 15-2의 글자와 같다: 구간·선 모양·세 시점 값(+ 고위·저위 괄호)', () => {
    expect(byId('projection-population-total').chartLabel).toBe(
      '1960년부터 2072년까지 장래인구추계 총인구 그래프. 1960~2022년은 확정인구(실선), 2023~2072년은 전망(점선, 고위~저위 범위는 띠). 1960년 25,012,374명, 2022년 51,672,569명, 2072년 중위 36,222,293명(고위 최대인구 추계 42,818,632명, 저위 최소인구 추계 30,172,383명)',
    );
    expect(byId('projection-one-person-households').chartLabel).toBe(
      '2000년부터 2052년까지 장래가구추계 1인 가구 비율 그래프. 2000~2021년은 같은 표의 추계 앞 구간(실선), 2022~2052년은 전망(점선). 2000년 15.5%, 2021년 32.9%, 2052년 41.3%',
    );
    expect(copyMd, 'copy.md 14-4가 같은 꼴을 적어 두었다').toContain('1960년부터 2072년까지 장래인구추계 총인구 그래프. 1960~2022년은 확정인구(실선), 2023~2072년은 전망(점선, 고위~저위 범위는 띠).');
  });

  it('처음 값 글자 자리(r2, R-487 + developer 보정): 어느 폭·높이에서도 고른 자리의 실제 글자 상자가 어느 계열 선분과도 만나지 않고 그림 영역 안이다 — 가파르게 오르는 총인구·1인 가구는 ③(축 바로 위 오른쪽)이다', () => {
    // 실제 그래프: 폭 220~520을 4px씩 × 낮은(LINE_H)·높은(LINE_H_STACKED) 그래프 — 실제 브라우저(e2e/chart-labels.spec.ts, first-screen.spec.ts R-225)가 getBBox로 보는 것과 같은 크기의 상자로 센다.
    // 보정 전에는 시안 생성기의 작은 상자(위 12)로 골라 낮은 그래프(1280 폭 392×180)의 1인 가구 「15.5」가 오르는 선과 겹친 채 ①로 돌아갔다 (실제 브라우저 검사에서 드러남).
    let checked = 0;
    for (const id of IDS) {
      for (const h of [LINE_H, LINE_H_STACKED]) {
        for (let w = 220; w <= 520; w += 4) {
          const c = buildCarousel(undefined, { width: w, lineHeight: h }).slides.find((s) => s.id === id)!.chart as LineChartModel;
          const first = c.labels.find((l) => !l.bold && l.tone === undefined)!;
          const segs = [c.series[0].points, c.series[1].points, ...(c.band === null ? [] : [c.band.edges.map((e) => e.split(' ').map((q) => ({ x: Number(q.split(',')[0]), y: Number(q.split(',')[1]) })))].flat())].filter((sg) => sg.length > 1);
          const width = valueWidthEm(first.text) * 13;
          const box = { left: first.x - FIRST_LABEL_BOX.side, right: first.x + width + FIRST_LABEL_BOX.side, top: first.y - FIRST_LABEL_BOX.up, bottom: first.y + FIRST_LABEL_BOX.down };
          const where = `${id} ${w}x${h} 처음 값 「${first.text}」 (${first.x}, ${first.y})`;
          const hit = segs.some((sg) => sg.some((_, k) => k > 0 && segmentHitsRect(sg[k - 1].x, sg[k - 1].y, sg[k].x, sg[k].y, box)));
          expect(hit, `${where}: 글자 상자가 선과 만난다`).toBe(false);
          expect(box.top, `${where}: 그림 영역 위 한계`).toBeGreaterThanOrEqual(24 + 2);
          expect(box.bottom, `${where}: 축 위`).toBeLessThanOrEqual(c.axisY);
          expect(box.right, `${where}: 오른쪽 값 글자 자리(PAD.right) 앞`).toBeLessThan(w);
          checked++;
        }
      }
    }
    expect(checked, '실제로 센 (지표, 크기) 조합 수').toBe(IDS.length * 2 * 76);
    // 가파르게 오르는 총인구(1960 「2,501만」)는 선·축과 겹치는 ①·②를 피해 ③ 축 바로 위 오른쪽이다 (design-system.md 15-2)
    {
      const c = line('projection-population-total');
      const first = c.labels.find((l) => !l.bold && l.tone === undefined)!;
      expect(first.y).toBe(c.axisY - 4);
      expect(first.x).toBeGreaterThanOrEqual(c.series[0].first.x + 12);
    }
    // 규칙 자체: 합성 입력으로 후보 순서를 잠근다 (선분 하나가 후보를 차례로 막는다)
    const p = { x: 8, y: 100, year: 1960, value: 1, text: '99.9' };
    const free = placeProjectionFirstLabel(p, [], 200);
    expect([free.x, free.y]).toEqual([8, 92]); // ① 점 위
    const blockUp = placeProjectionFirstLabel(p, [[{ x: 0, y: 88 }, { x: 80, y: 88 }]], 200);
    expect([blockUp.x, blockUp.y]).toEqual([8, 118]); // ① 막히면 ② 점 아래
    const blockBoth = placeProjectionFirstLabel(p, [[{ x: 0, y: 88 }, { x: 80, y: 88 }], [{ x: 0, y: 114 }, { x: 80, y: 114 }]], 200);
    expect([blockBoth.x, blockBoth.y]).toEqual([20, 196]); // ② 막히면 ③ 축 바로 위 오른쪽 (x+12, 축−4)
    // ③이 오른쪽으로 오르는 선에 막히면 오른쪽으로 4px씩 비켜 간다 (낮은 그래프의 1인 가구 「15.5」: 선이 (8,141.3) → (20.2,133.3) → (26.3,129.5)로 오른다)
    const rising = [{ x: 8, y: 141.3 }, { x: 14.1, y: 137.1 }, { x: 20.2, y: 133.3 }, { x: 26.3, y: 129.5 }, { x: 32.5, y: 126.2 }, { x: 38.6, y: 122.8 }];
    const low = placeProjectionFirstLabel({ x: 8, y: 141.3, year: 2000, value: 15.5, text: '15.5' }, [rising], 150);
    expect(low.y, '③ 높이(축 바로 위)').toBe(146);
    expect(low.x, '③ 12px 자리는 선에 막혀 더 오른쪽으로 비켜 갔다').toBeGreaterThan(20);
    const lowBox = { left: low.x - 1, right: low.x + valueWidthEm('15.5') * 13 + 1, top: low.y - 15, bottom: low.y + 3 };
    expect(rising.some((q, k) => k > 0 && segmentHitsRect(rising[k - 1].x, rising[k - 1].y, q.x, q.y, lowBox)), '고른 자리는 선과 만나지 않는다').toBe(false);
    // ③이 전부 막히면 ④ 위 눈금 아래 오른쪽 (x+12, 위+17) — 위 한계(PAD.top + 2)와 상자 위끝이 같아 이제 고를 수 있는 후보다
    const blockThree = placeProjectionFirstLabel(p, [[{ x: 0, y: 88 }, { x: 80, y: 88 }], [{ x: 0, y: 114 }, { x: 80, y: 114 }], [{ x: 0, y: 190 }, { x: 80, y: 190 }]], 200);
    expect([blockThree.x, blockThree.y]).toEqual([20, 41]);
    const none = placeProjectionFirstLabel(p, [[{ x: 0, y: 88 }, { x: 80, y: 88 }], [{ x: 0, y: 114 }, { x: 80, y: 114 }], [{ x: 0, y: 190 }, { x: 80, y: 190 }], [{ x: 0, y: 36 }, { x: 80, y: 36 }]], 200);
    expect([none.x, none.y]).toEqual([8, 92]); // 다 막히면 ①
  });

  it('칩·한 줄 안내·기준 줄: 전망 5장 모두 같은 칩 글자와 안내 글자, 기준 줄은 발표일 (FC2 · 마스터 결정 8)', () => {
    for (const s of data.slides.filter((x) => x.projection !== null)) {
      expect(s.projection!.chip, s.id).toBe('전망');
      expect(s.projection!.note, s.id).toBe('전망은 예측이 아니라 공식 추계입니다. 가정이 달라지면 값도 달라집니다.');
      expect(s.basisLine.startsWith(`발표: ${s.projection!.releasedOn} · `), s.id).toBe(true);
    }
    expect(copyMd).toContain('전망은 예측이 아니라 공식 추계입니다. 가정이 달라지면 값도 달라집니다.');
    expect(data.slides.filter((s) => s.projection === null).every((s) => s.legendLabel === '그래프 범례와 최근 값' || s.chart.kind !== 'line')).toBe(true);
  });
});

describe('폭염일수 (어댑터 → 막대 셋 + 권역 표) — D5-67', () => {
  const heat = byId('heat-projection');

  it('어댑터는 표에서 모두 읽는다: 권역 수도권, 막대 라벨 낱말, 발표일(source.table의 괄호 날짜 하나)·기준 기간(열 이름) — 상수가 없다', () => {
    const input = heatProjectionInput(ind('heat-projection'))!;
    expect(input.region).toBe('수도권');
    expect(input.bars.map((b) => [b.key, b.label, b.value, b.projection])).toEqual([
      ['present', '현재 2000~2019년', 7.8, false],
      ['lateLow', '저탄소 SSP1-2.6', 25, true],
      ['lateHigh', '고탄소 SSP5-8.5', 86.4, true],
    ]);
    expect(input.headlines).toEqual([
      { label: '저탄소 시나리오', value: 25 },
      { label: '고탄소 시나리오', value: 86.4 },
    ]);
    expect(input.caption).toBe('수도권 연 폭염일수(21세기 후반기 2081~2100년 평균)');
    expect([input.releasedOn, input.baseLabel, input.scenarioWord]).toEqual(['2021-12-23', '2000~2019년', '저탄소·고탄소']);
    // 발표일·기준 기간 글자는 데이터(source.table·열 이름)에 실제로 있다 — 데이터가 바뀌어 사라지면 어댑터가 null → 슬라이드가 빠져 20장 단언이 실패한다
    expect(ind('heat-projection').source.table).toContain(`(${input.releasedOn})`);
    expect((ind('heat-projection').columns ?? []).map((c) => c.label).join(' ')).toContain(`(${input.baseLabel})`);
    expect(input.rows).toHaveLength(6);
    expect(input.columns).toHaveLength(4);
  });

  it('데이터가 어긋나면 어댑터가 null을 돌려준다(그릴 수 없음): 열 이름 변경·날짜 둘·권역 행 값 없음 — 조용히 틀린 글을 만들지 않는다', () => {
    const base = ind('heat-projection');
    const clone = (mut: (i: Record<string, unknown>) => void): UsableIndicator => {
      const c = structuredClone(base) as unknown as Record<string, unknown>;
      mut(c);
      return c as unknown as UsableIndicator;
    };
    expect(heatProjectionInput(clone(() => {}))).not.toBeNull();
    expect(heatProjectionInput(clone((c) => ((c.columns as Array<{ key: string; label: string }>)[1].label = '현재 연 폭염일수(일)')))).toBeNull(); // 기간 괄호 없음
    expect(heatProjectionInput(clone((c) => ((c.source as { table: string }).table += ' 개정(2024-01-01)')))).toBeNull(); // 괄호 날짜가 둘
    expect(heatProjectionInput(clone((c) => ((c.rows as Array<Record<string, unknown>>)[0].lateHigh = '큼')))).toBeNull();
    expect(heatProjectionInput(clone((c) => (c.id = 'other')))).toBeNull();
    expect(buildHeatSlide(clone((c) => ((c.rows as Array<Record<string, unknown>>)[0].present = undefined)), undefined, { width: 320, lineHeight: LINE_H })).toBeNull();
  });

  it('막대 셋: 현재 = 실선 채움, 전망 둘 = 빗금(proj), 막대 길이는 값에 비례, 값 글자는 「25.0일」 단위 포함', () => {
    const c = heat.chart as BarsChartModel;
    expect(c.kind).toBe('bars');
    expect(c.rows.map((r) => [r.label, r.text, r.proj, r.bold])).toEqual([
      ['현재 2000~2019년', '7.8일', false, false],
      ['저탄소 SSP1-2.6', '25.0일', true, false],
      ['고탄소 SSP5-8.5', '86.4일', true, false],
    ]);
    const [a, b, d] = c.rows.map((r) => r.barWidth);
    expect(d / b).toBeCloseTo(86.4 / 25, 1);
    expect(b / a).toBeCloseTo(25 / 7.8, 1);
    expect(c.header).toBeNull();
    expect(c.height).toBe(3 * 26 + 8);
    expect(heat.legend.map((l) => [l.label, l.rect])).toEqual([
      ['현재', 'bar'],
      ['전망(빗금)', 'proj'],
    ]);
    expect(heat.legendLabel).toBe('막대 범례');
  });

  it('값 줄·캡션·보조 줄·공식 통계명·권역 표·읽기 이름이 copy.md 14-1과 같다', () => {
    expect(heat.headlines.map((h) => [h.label, h.value])).toEqual([
      ['저탄소 시나리오', '25.0'],
      ['고탄소 시나리오', '86.4'],
    ]);
    expect(heat.unitText).toBe('일');
    expect(heat.caption).toBe('수도권 연 폭염일수(21세기 후반기 2081~2100년 평균)');
    expect(heat.sideValues.map((v) => v.text)).toEqual(['현재(2000~2019년)는 7.8일']);
    expect(heat.officialText).toBe('남한상세 기후변화 전망 폭염일수(2021년 발표, 2000~2019년 기준, 저탄소·고탄소)');
    expect(heat.chartLabel).toBe('수도권 연 폭염일수 막대 그래프. 현재 2000~2019년 7.8일, 저탄소 SSP1-2.6 25.0일, 고탄소 SSP5-8.5 86.4일(빗금은 전망). 권역 6곳의 값은 아래 표');
    expect(heat.tables).toHaveLength(1);
    expect(heat.tables[0].rows.map((r) => r.head)).toEqual(['수도권', '강원권', '충청권', '전라권', '경상권', '제주권']);
    expect(heat.tables[0].rows[0].cells).toEqual(['7.8일', '25.0일', '86.4일']);
    expect(heat.tables[0].head[0]).toBe('권역');
    expect(heat.basisLine).toMatch(/^발표: 2021-12-23 · /);
  });
});

describe('지금 태어나는 아기라면? (연령 3구간 가로 누적 막대) — D5-68', () => {
  const s = byId('projection-newborn-age-structure');
  const c = s.chart as StackChartModel;
  const rows = ind('projection-newborn-age-structure').projection!.scenarios.find((x) => x.key === 'median')!.rows!;

  it('행 = 아기가 0·10·20·30·40세가 되는 해 다섯, 나이 오름차순 — 값은 데이터 중위 추계 행 그대로', () => {
    expect(c.kind).toBe('stack');
    expect(c.rows.map((r) => [r.age, r.year])).toEqual([[0, 2026], [10, 2036], [20, 2046], [30, 2056], [40, 2066]]);
    expect(c.rows.map((r) => r.valueText)).toEqual(rows.map((r) => `${r.share65plus.toFixed(1)}%`));
    expect(c.rows.map((r) => r.work.text)).toEqual(rows.map((r) => `${r.share15to64.toFixed(1)}%`));
    expect(c.header.text).toBe('모두 전망(중위 추계)');
  });

  it('세 칸이 막대 전체를 채운다: 0~14세 빈 칸 · 15~64세 채움 · 65세 이상 점무늬 — 폭은 구성비에 비례하고 합이 막대 폭이다 (320·388 폭)', () => {
    for (const w of [252, 292, 388]) {
      const wide = buildCarousel(undefined, { width: w, lineHeight: LINE_H }).slides.find((x) => x.id === s.id)!.chart as StackChartModel;
      for (const [k, r] of wide.rows.entries()) {
        expect(r.young.width + r.work.width + r.old.width, `${w} ${r.year}`).toBeCloseTo(wide.barWidth, 0);
        expect(r.young.width / wide.barWidth, `${w} ${r.year} 0~14세`).toBeCloseTo(rows[k].share0to14 / 100, 2);
        expect(r.work.width / wide.barWidth, `${w} ${r.year} 15~64세`).toBeCloseTo(rows[k].share15to64 / 100, 2);
        expect(r.work.x, '채움 칸은 빈 칸 오른쪽').toBeCloseTo(r.young.x + r.young.width, 0);
        expect(r.old.x, '점무늬 칸은 채움 칸 오른쪽').toBeCloseTo(r.work.x + r.work.width, 0);
      }
    }
    // 65세 이상 값은 해마다 오른다 (21.6 → 47.0)
    const olds = c.rows.map((r) => Number(r.valueText.replace('%', '')));
    expect([...olds].sort((a, b) => a - b)).toEqual(olds);
  });

  it('큰 값·캡션·보조 줄·범례·표·읽기 이름 (copy.md 14-1 #20): 42.1% · 캡션은 데이터 latestLabel 그대로 · 총부양비 45.4명 → 97.9명 · 범례 셋(65세 이상은 점무늬)', () => {
    expect(s.valueText).toBe('42.1');
    expect(s.unitText).toBe('%');
    expect(s.caption).toBe('2026년에 태어난 아기가 30세가 되는 2056년, 65세 이상 인구 구성비(중위 추계)');
    expect(s.caption).toBe(ind('projection-newborn-age-structure').latestLabel);
    expect(s.sideValues.map((v) => v.text)).toEqual(['15~64세 100명당 0~14세와 65세 이상 인구(총부양비): 2026년 45.4명, 2056년 97.9명']);
    expect(s.legend.map((l) => [l.label, l.rect])).toEqual([
      ['0~14세', 'young'],
      ['15~64세', 'work'],
      ['65세 이상(점무늬)', 'old'],
    ]);
    expect(s.tables).toHaveLength(1);
    expect(s.tables[0].rows).toHaveLength(5);
    expect(s.tables[0].head).toEqual(['나이(연도)', '0~14세', '15~64세', '65세 이상', '총부양비']);
    expect(s.tables[0].rows[3]).toEqual({ head: '30세(2056년)', cells: ['7.4%', '50.5%', '42.1%', '97.9'] });
    expect(s.chartLabel.startsWith('2026년에 태어난 아기가 0세, 10세, 20세, 30세, 40세가 되는 해의 연령 3구간 인구 구성비 누적 막대 그래프(중위 추계). 2026년(0세) 0~14세 9.7%, 15~64세 68.8%, 65세 이상 21.6%, 총부양비 45.4.')).toBe(true);
    expect(s.chartLabel.match(/\(\d+세\)/g)).toHaveLength(5);
  });

  it('cohort.birthYear = 올해 출생 연도(시험 전용 R1 프로필의 2026)이고 첫 행의 해(0세)와 같다 — 어긋나면 이 시험이 실패한다 (R-484)', () => {
    expect(R1_PROFILE.birthYear, '올해 출생은 한 해로 고정').toBe(2026);
    const cohort = ind('projection-newborn-age-structure').cohort!;
    expect(cohort.birthYear, 'cohort.birthYear = 올해 출생 연도 상수').toBe(R1_PROFILE.birthYear);
    expect(c.rows[0].year, '첫 행 = 0세가 되는 해 = 출생 연도').toBe(cohort.birthYear);
    expect(c.rows.map((r) => r.age)).toEqual(cohort.ages);
    expect(s.chartLabel).toContain(`${cohort.birthYear}년에 태어난 아기`);
    expect(s.caption).toContain(`${cohort.birthYear}년에 태어난 아기`);
  });
});

describe('연령별 격차 (마지막 해 두 구간 막대 + 보조 문장 둘 + 시계열 표) — D5-70·D5-75, R-476', () => {
  const s = byId('income-gap-by-age');
  const raw = ind('income-gap-by-age');

  it('값 둘(66세 이상 6.90배 · 18~65세 5.01배) · 캡션(정의 상수 20%) · 막대 길이는 값에 비례 · 위 오른쪽 「2024년」 · 같은 채움(라벨 글자가 구분)', () => {
    expect(s.headlines.map((h) => [h.label, h.value])).toEqual([
      ['66세 이상', '6.90'],
      ['18~65세', '5.01'],
    ]);
    expect(s.unitText).toBe('배');
    expect(s.caption).toBe('같은 나이대 안에서 소득 상위 20%가 하위 20%의 몇 배인지(균등화 처분가능소득)');
    const c = s.chart as BarsChartModel;
    expect(c.kind).toBe('bars');
    expect(c.header!.text).toBe('2024년');
    expect(c.rows.map((r) => [r.label, r.text, r.proj, r.bold])).toEqual([
      ['66세 이상', '6.90배', false, true],
      ['18~65세', '5.01배', false, true],
    ]);
    expect(c.rows[0].barWidth / c.rows[1].barWidth).toBeCloseTo(6.9 / 5.01, 1);
    expect(s.legend).toEqual([]);
    expect(s.chartLabel).toBe('2024년 연령계층별 소득 5분위배율(균등화 처분가능소득) 막대 그래프. 66세 이상(은퇴연령인구) 6.90배, 18~65세(근로연령인구) 5.01배. 2011~2024년 값은 아래 표');
  });

  it('두 계열의 마지막 해가 같다(2024) — 다르면 막대 라벨에 연도를 밝힌다 (REV 7절 8)', () => {
    const a = raw.series!.at(-1) as { year: number };
    const b = raw.extraSeries![0].series.at(-1) as { year: number };
    expect(a.year).toBe(b.year);
    const mut = structuredClone(raw) as UsableIndicator;
    mut.extraSeries![0].series = mut.extraSeries![0].series.slice(0, -1); // 18~65세는 2023년이 마지막
    const slide = buildSlide(mut)!;
    expect(slide.headlines.map((h) => h.label)).toEqual(['66세 이상(2024년)', '18~65세(2023년)']); // 해가 다르면 두 막대 모두 자기 해를 밝힌다
    expect((slide.chart as BarsChartModel).header).toBeNull();
  });

  /**
   * 「모든 해」 판정 (R-476 b, D5-75): 실제 데이터에서 참이어야 한다 — 갱신으로 깨지면 이 시험이 실패한다(문장이 거짓이 되므로 조용히 숨기지 않는다).
   * 모델은 거짓일 때 문장을 빼므로(거짓을 보이지 않는다) 문장이 있는지도 함께 단언한다.
   */
  it('2011~2024년 14개 해 모두 66세 이상의 값 > 18~65세의 값이고 보조 문장 ①이 화면에 있다 — 판정이 깨지면 시험이 실패한다', () => {
    const every = gapEveryYear(raw)!;
    expect(every, '두 계열이 함께 있는 해가 둘 이상').not.toBeNull();
    expect([every.firstYear, every.lastYear, every.years]).toEqual([2011, 2024, 14]);
    expect(every.holds, '2011~2024년 모든 해에 66세 이상의 격차가 더 크다(갱신으로 깨지면 보조 줄 ① 문장을 고쳐야 한다)').toBe(true);
    expect(s.sideValues.map((v) => v.text)).toEqual([
      '2011~2024년 모든 해에 66세 이상의 격차가 18~65세보다 큽니다.',
      '같은 나이대 안의 소득 격차는 18~65세와 66세 이상 두 구간으로 공표됩니다. 더 잘게 나눈 나이 구간의 값은 없습니다.',
    ]);
    // 판정이 실제로 뒤집힌다(공허 통과 방지): 한 해라도 18~65세가 더 크면 holds = false이고 모델은 거짓 문장을 보이지 않는다
    const mut = structuredClone(raw) as unknown as UsableIndicator & { extraSeries: Array<{ series: Array<{ year: number; value: number }> }> };
    mut.extraSeries[0].series[5].value = 99;
    expect(gapEveryYear(mut)!.holds).toBe(false);
    expect(buildSlide(mut)!.sideValues.map((v) => v.text)).toEqual(['같은 나이대 안의 소득 격차는 18~65세와 66세 이상 두 구간으로 공표됩니다. 더 잘게 나눈 나이 구간의 값은 없습니다.']);
    // 겹치는 해가 하나뿐이면 판정하지 않는다(null)
    const one = structuredClone(raw) as unknown as UsableIndicator & { extraSeries: Array<{ series: Array<{ year: number; value: number }> }> };
    one.extraSeries[0].series = [{ year: 2024, value: 5.01 }, { year: 2025, value: 5 }];
    expect(gapEveryYear(one)).toBeNull();
  });

  it('보조 줄의 구간 이름·연도는 데이터에서 온다: 계열 라벨의 괄호 앞 이름(조사 와/과는 받침에 맞게), 겹치는 첫~마지막 해', () => {
    expect(SLIDE_TEXT.gapAllYears(2011, 2024, '66세 이상', '18~65세')).toBe('2011~2024년 모든 해에 66세 이상의 격차가 18~65세보다 큽니다.');
    expect(SLIDE_TEXT.gapBands('18~65세', '66세 이상')).toContain('18~65세와 66세 이상 두 구간');
    expect(SLIDE_TEXT.gapBands('66세 이상', '18~65세')).toContain('66세 이상과 18~65세 두 구간'); // 받침 있는 이름이 앞에 오면 「과」
  });

  it('sr-only 표 = 두 계열이 함께 있는 해 14행(연도 · 66세 이상 · 18~65세) — 시계열은 보이는 그래프에서 뺐지만 값은 전부 표에 있다 (copy.md 14-8 ①, D5-75 ④)', () => {
    expect(s.tables).toHaveLength(1);
    const t = s.tables[0];
    expect(t.caption).toBe('연령계층별 소득 5분위배율(균등화 처분가능소득) — 2011~2024년');
    expect(t.head).toEqual(['연도', '66세 이상(은퇴연령인구)', '18~65세(근로연령인구)']);
    expect(t.rows).toHaveLength(14);
    expect(t.rows[0]).toEqual({ head: '2011년', cells: ['11.44배', '7.12배'] });
    expect(t.rows.at(-1)).toEqual({ head: '2024년', cells: ['6.90배', '5.01배'] });
    // 표의 값이 데이터와 같다
    for (const [k, r] of t.rows.entries()) {
      const m = raw.series![k] as { year: number; value: number };
      expect(r.head).toBe(`${m.year}년`);
      expect(r.cells[0]).toBe(`${m.value.toFixed(2)}배`);
    }
  });

  it('틀의 숫자는 정의 상수뿐이다(R-486): 보조 문장·캡션의 숫자 토막은 같은 지표 definition의 숫자와 데이터 값(연도·구간 이름·값)에서 온다', () => {
    const defNums = new Set(raw.definition.match(/\d[\d,.]*/g));
    const dataNums = new Set<string>();
    for (const p of [...raw.series!, ...raw.extraSeries![0].series] as Array<{ year: number; value: number }>) {
      dataNums.add(String(p.year));
      dataNums.add(p.value.toFixed(2));
    }
    for (const label of [raw.seriesLabel!, raw.extraSeries![0].label]) for (const m of label.match(/\d[\d,.]*/g) ?? []) dataNums.add(m); // 구간 이름의 숫자(66·18·65)
    const texts = [s.caption!, ...s.sideValues.map((v) => v.text)];
    let checked = 0;
    for (const text of texts) {
      for (const tok of text.match(/\d[\d,.]*/g) ?? []) {
        const num = tok.replace(/[.,]+$/, '');
        checked++;
        expect(defNums.has(num) || dataNums.has(num), `「${text.slice(0, 30)}…」의 숫자 「${num}」`).toBe(true);
      }
    }
    expect(checked, '공허 통과 방지').toBeGreaterThan(6);
  });
});

describe('문구 틀(SLIDE_TEXT)에는 손으로 적은 숫자가 없다 — 있는 것은 나이 구간 이름과 총부양비의 정의 상수뿐 (R-486, 지어낸 수치 0)', () => {
  /** 틀 함수에 숫자 없는 자리표시(NaN·문자)를 넣어 틀이 스스로 가진 글자만 본다 */
  const NAN = Number.NaN;
  const outputs: Array<[string, string]> = [];
  for (const [key, v] of Object.entries(SLIDE_TEXT)) {
    if (typeof v === 'string') outputs.push([key, v]);
    else if (Array.isArray(v)) outputs.push([key, v.join(' ')]);
    else if (typeof v === 'function') {
      const args = Array.from({ length: v.length }, (_, k) => (k === 1 && key === 'newbornChartLabel' ? ['가', '나'] : key === 'projectionLineLabel' ? undefined : '자리표시'));
      try {
        const out = key === 'projectionLineLabel'
          ? (v as (o: Record<string, unknown>) => string)({ name: 'N', firstYear: NAN, throughYear: NAN, horizonYear: NAN, actualPhrase: 'A', hasBand: true, firstValue: 'V', throughValue: 'V', horizonValue: 'V', midWord: '중위', range: 'R' })
          : (v as (...a: unknown[]) => string)(...args.map((a) => (a === '자리표시' && /Year|year|^endYear$/.test(key) ? NAN : a)));
        outputs.push([key, out]);
      } catch {
        // 숫자 인자를 .toFixed 같은 것으로 쓰는 틀은 없다 — 던지면 시험이 알려 준다
        throw new Error(`틀 ${key}를 자리표시로 부를 수 없다`);
      }
    } else if (typeof v === 'object' && v !== null) outputs.push([key, Object.values(v).join(' ')]);
  }

  it('틀 출력의 숫자 토막은 새 아기 슬라이드의 정의에 있는 나이 구간(0~14세·15~64세·65세)과 총부양비의 정의 상수 「100」(15~64세 인구 100명당)뿐이다', () => {
    const newbornDef = ind('projection-newborn-age-structure').definition;
    const allowed = new Set([...(newbornDef.match(/\d[\d~]*/g) ?? []), '100']);
    let withDigits = 0;
    for (const [key, out] of outputs) {
      const toks = (out.match(/\d[\d~,.]*/g) ?? []).map((x) => x.replace(/[.,]+$/, ''));
      if (toks.length > 0) withDigits++;
      for (const tok of toks) expect(allowed.has(tok), `틀 ${key}의 숫자 「${tok}」 — 정의 상수가 아니면 데이터에서 채워야 한다 (출력: ${out.slice(0, 60)})`).toBe(true);
    }
    // 숫자가 든 틀은 아기 슬라이드의 구간 이름·부양비 틀뿐이다(공허 통과 방지: 실제로 몇 개를 봤다)
    expect(withDigits).toBeGreaterThanOrEqual(4);
    expect(outputs.length).toBeGreaterThan(20);
    expect(allowed.has('100')).toBe(true);
    expect(newbornDef.includes('100'), '「100」은 정의 문장에는 없는 총부양비 정의 상수라 허용 목록에 따로 적었다').toBe(false);
  });

  it('틀 글자에 평가어·느낌표·이모지가 없고 「실측」을 쓰지 않는다', () => {
    for (const [key, out] of outputs) {
      expect(out, key).not.toMatch(/[!！]/);
      expect(out, key).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(out, key).not.toContain('실측');
      expect(out, key).not.toMatch(/심각|위기|충격|최악|참담|문제|탓/);
    }
  });
});

describe('캐러셀 지표 공통 점검 — 정의에 내부 키 0, 갱신일 게이트, 출처 줄', () => {
  /** 캐러셀 지표 definition에 나오면 안 되는 내부 필드 이름(영문 키) — 결정 10: 「measures에 함께 담았습니다」가 화면에 그대로 나오던 것 */
  const INTERNAL_KEYS = ['measures', 'series', 'extraSeries', 'related', 'scenarios', 'scenario', 'actual', 'cohort', 'columns', 'rows', 'latestLabel', 'latestUnit', 'basisId', 'headline', 'helpLine', 'unverifiedParts', 'verification', 'usable', 'projection'];

  it('캐러셀 지표 20개의 definition(화면에 그대로 보이는 글)에 내부 필드 이름이 없다 (마스터 결정 10, D5-73)', () => {
    const inds = selectCarouselIndicators();
    expect(inds).toHaveLength(20);
    for (const i of inds) {
      for (const key of INTERNAL_KEYS) expect(i.definition, `${i.id}: 정의에 내부 키 「${key}」`).not.toMatch(new RegExp(`(^|[^A-Za-z])${key}([^A-Za-z]|$)`));
      expect(i.definition, `${i.id}: 영문 키처럼 보이는 낱말(소문자 camelCase)`).not.toMatch(/\b[a-z]+[A-Z][A-Za-z]*\b/);
    }
    // 시험이 실제로 잡는다: 옛 정의 문장은 걸린다
    expect('시장소득 기준과 지니계수는 measures에 함께 담았습니다.').toMatch(new RegExp('(^|[^A-Za-z])measures([^A-Za-z]|$)'));
    // D5-73: 정의 끝 문장은 사람이 읽는 글로 고쳤다(값 불변)
    expect(ind('income-gap-by-age').definition.endsWith('시장소득 기준 값과 지니계수는 이 화면에 보이지 않습니다.')).toBe(true);
  });

  it('meta.updatedOn ≥ 캐러셀 지표 source.accessedOn의 최댓값 — 같은 슬라이드에 「마지막 갱신」이 「조회」보다 앞서 보이지 않는다 (R-485 게이트)', () => {
    const latestAccess = selectCarouselIndicators().map((i) => i.source.accessedOn).sort().at(-1)!;
    expect(latestAccess).toBe('2026-10-21');
    expect(BASE_STATS_FILE.meta.updatedOn >= latestAccess, `meta.updatedOn(${BASE_STATS_FILE.meta.updatedOn})이 가장 늦은 조회일(${latestAccess})보다 앞선다 — 배포 때 마스터가 올린다`).toBe(true);
    for (const s of data.slides) {
      const accessed = /\((\d{4}-\d{2}-\d{2}) 조회\)$/.exec(s.sourceText)![1];
      const updated = /마지막 갱신 (\d{4}-\d{2}-\d{2})$/.exec(s.basisLine)![1];
      expect(updated >= accessed, `${s.id}: 마지막 갱신 ${updated} ≥ 조회 ${accessed}`).toBe(true);
    }
    // 게이트가 실제로 잡는다: 갱신일이 조회일보다 앞서면 실패 조건이다
    expect('2026-10-15' >= latestAccess).toBe(false);
  });

  it('projection-tfr(합계출산율 전망)와 future-projection은 캐러셀에 없다 (마스터 결정 4) — 접근자도 기본으로 돌려주지 않는다', () => {
    expect(data.slides.map((s) => s.id)).not.toContain('projection-tfr');
    expect(data.slides.map((s) => s.id)).not.toContain('future-projection');
    expect(createStatsAccess(BASE_STATS_FILE as StatsFile).getUsableIndicator('projection-tfr')).toBeUndefined(); // 예비 지표 — 첫 화면 묶음에 없다
  });

  it('isDrawable: 20개 모두 그릴 수 있고, 데이터가 모양을 잃으면 그릴 수 없다(조용한 탈락은 20장 단언이 잡는다)', () => {
    for (const i of selectCarouselIndicators()) expect(isDrawable(i), i.id).toBe(true);
    const noActual = { ...ind('projection-population-total'), actual: [] } as UsableIndicator;
    expect(isDrawable(noActual)).toBe(false);
    const noWord = Object.keys(STAT_HEADLINES).includes('projection-aging-share');
    expect(noWord).toBe(true);
    expect(isDrawable({ ...ind('income-gap-by-age'), extraSeries: [] } as UsableIndicator)).toBe(false);
    expect(isDrawable({ ...ind('projection-newborn-age-structure'), projection: { ...ind('projection-newborn-age-structure').projection!, scenarios: [] } } as UsableIndicator)).toBe(false);
    expect(isDrawable({ ...ind('heat-projection'), rows: [] } as UsableIndicator)).toBe(false);
  });

  it('출처 줄 함수 sourceTextOf: 기관 쉼표 나열 + 「의」 + 표 이름 + (열람일 조회)', () => {
    expect(sourceTextOf({ source: { org: '국가데이터처·교육부', table: '표 이름', accessedOn: '2026-10-15' } })).toBe('국가데이터처, 교육부의 표 이름 (2026-10-15 조회)');
    expect(sourceTextOf({ source: { org: '행정안전부', table: 'X', accessedOn: '2026-10-15' } })).toBe('행정안전부의 X (2026-10-15 조회)');
  });
});
