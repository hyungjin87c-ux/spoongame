import { describe, expect, it } from 'vitest';
import copyMd from '../docs/design/copy.md?raw';
import { buildCarousel, selectCarouselIndicators } from '../src/core';
import { CAROUSEL_ORDER } from '../src/data/koreaStatsAccess';
import { INSIGHT_MAX_CHARS, STAT_HEADLINES } from '../src/data/statHeadlines';

/**
 * 통계 슬라이드의 표제어·공식 통계명 (SPEC-005 SH1~SH3·SH7, 문구 기준표 docs/design/copy.md 9-1).
 * 값 데이터(koreaStats.json)는 건드리지 않고 `data/statHeadlines.ts` 한 곳에 둔다 — 이 파일이 그 한 곳의 규칙을 잠근다.
 */

const carouselIds = selectCarouselIndicators().map((i) => i.id);
const slides = buildCarousel().slides;

/** 표제어에 쓰지 않는 말: 평가어·원인 단정·집단 낙인·정치 논평 (SH2 ④) + 완곡어(자살을 「선택」으로 읽히게 하는 말, copy.md 9-1 #5) */
const FORBIDDEN = ['문제', '탓', '때문', '심각', '위기', '충격', '최악', '참담', '극단적 선택', '실패', '낙오', '무능', '게으'];

describe('표제어 데이터 (SH7 ① — 캐러셀 지표 id 전부에 항목이 있고 남는 항목이 없다)', () => {
  it('캐러셀 지표 14개 전부에 항목이 있다', () => {
    expect(carouselIds.length).toBe(14);
    for (const id of carouselIds) expect(STAT_HEADLINES[id], `${id}의 표제어·공식 통계명`).toBeDefined();
  });

  it('항목은 캐러셀 지표뿐이다 — 지표가 빠졌는데 항목이 남지 않는다 (공허 통과 방지: 가짜 id를 더하면 걸린다)', () => {
    const orphan = Object.keys(STAT_HEADLINES).filter((id) => !carouselIds.includes(id));
    expect(orphan).toEqual([]);
    expect(Object.keys({ ...STAT_HEADLINES, 'no-such-indicator': STAT_HEADLINES.tfr }).filter((id) => !carouselIds.includes(id))).toEqual(['no-such-indicator']);
    // 항목 순서 = 캐러셀 순서(CAROUSEL_ORDER) — copy.md 9-1 표와 같은 차례
    expect(Object.keys(STAT_HEADLINES)).toEqual(CAROUSEL_ORDER.filter((id) => id in STAT_HEADLINES));
  });

  it('슬라이드가 항목의 글자를 그대로 쓴다: insight·officialName이 모델에 실려 있다', () => {
    for (const s of slides) {
      expect(s.insight, s.id).toBe(STAT_HEADLINES[s.id].insight);
      expect(s.officialName, s.id).toBe(STAT_HEADLINES[s.id].officialName);
      expect(s.officialText.startsWith(`${s.officialName}(`), s.id).toBe(true);
    }
  });
});

describe('표제어 규칙 lint (SH2, SH7 ② ③ ④)', () => {
  const entries = Object.entries(STAT_HEADLINES);

  it('숫자와 달력 연도가 없다 — 값 줄과 공식 통계명 줄이 맡는다(갱신 때 표제어가 낡지 않게)', () => {
    for (const [id, h] of entries) {
      expect(h.insight, id).not.toMatch(/[0-9０-９]/);
      expect(h.insight, id).not.toMatch(/[일이삼사오육칠팔구십백천만]{2,}\s*년|\d+\s*년/);
    }
  });

  it(`길이 ≤ ${INSIGHT_MAX_CHARS}자(띄어쓰기·물음표 포함, 글자 200%에서는 두 줄 허용), 비어 있지 않다`, () => {
    for (const [id, h] of entries) {
      expect([...h.insight].length, `${id} 「${h.insight}」`).toBeLessThanOrEqual(INSIGHT_MAX_CHARS);
      expect([...h.insight].length, id).toBeGreaterThanOrEqual(5);
    }
  });

  it('표제어는 지표마다 하나이고 중복이 없다 (공식 통계명도 겹치지 않는다)', () => {
    const insights = entries.map(([, h]) => h.insight);
    expect(new Set(insights).size).toBe(insights.length);
    const names = entries.map(([, h]) => h.officialName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('평가어·원인 단정·집단 낙인 말이 없다 (「~가 문제예요」「~탓이에요」 류)', () => {
    for (const [id, h] of entries) for (const w of FORBIDDEN) expect(h.insight, `${id}: 「${w}」`).not.toContain(w);
    // 공허 통과 방지: 목록이 실제로 잡는다
    expect(FORBIDDEN.some((w) => '저출생은 정부 탓이에요'.includes(w))).toBe(true);
  });

  it('어체: 해요체 — 질문 「~까?」 또는 사실 요약 「~요」로 끝나고 느낌표·이모지·마침표가 없다 (SPEC-003 R2: 첫 화면 현행 어체)', () => {
    for (const [id, h] of entries) {
      expect(h.insight, id).toMatch(/(까\?|요)$/);
      expect(h.insight, id).not.toMatch(/[!！.。]/);
      expect(h.insight, id).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(h.insight, id).not.toMatch(/(습니다|입니다)/); // 합쇼체는 슬라이드 본문(정의·출처) 어체 — 표제어만 해요체
    }
  });

  it('자살률 표제어(M9 확정)는 방법·장소·동기를 말하지 않고 완곡어도 쓰지 않으며 「자살」 낱말은 공식 통계명 줄에만 있다 (copy.md 9-1 #5, SC6)', () => {
    const h = STAT_HEADLINES['suicide-rate'];
    expect(h.insight).toBe('삶을 스스로 마감하는 사람은 얼마나 될까?'); // 확정(M9 — REV-005-QI3-1 판독 통과 + 마스터 승인, 버린 후보 ② ③은 copy.md 9-1 #5)
    expect(h.insight).not.toMatch(/자살|극단적|방법|장소|동기|수단/);
    expect(h.officialName).toBe('자살률');
    const s = slides.find((x) => x.id === 'suicide-rate')!;
    expect(s.safety, '상담전화 안내는 같은 슬라이드 안에 그대로').not.toBeNull();
    for (const [id, other] of entries) if (id !== 'suicide-rate') expect(other.officialName, id).not.toContain('자살');
  });
});

describe('공식 통계명 (SH3 — 기관이 쓰는 이름, 지어내지 않는다)', () => {
  it('공식 통계명 낱말이 해당 지표의 title·source.table·정의 문구에 실제로 나온다 (「·」로 이은 이름은 각 이름이)', () => {
    for (const ind of selectCarouselIndicators()) {
      const h = STAT_HEADLINES[ind.id];
      const haystack = [ind.title, ind.source.table, ind.definition].join(' ');
      const parts = haystack.includes(h.officialName) ? [h.officialName] : h.officialName.split('·');
      for (const part of parts) expect(haystack, `${ind.id}: 공식 통계명 「${part}」`).toContain(part);
    }
  });

  it('기준 표기는 데이터에서 만든다 — latest.year(월 기준 지표는 범위 문구의 「2026년 9월」). 이 파일에 연도를 적지 않는다 (SC4 단일 출처)', () => {
    for (const [id, h] of Object.entries(STAT_HEADLINES)) {
      expect(h.officialName, id).not.toMatch(/\d{4}/);
      expect(h.insight, id).not.toMatch(/\d{4}/);
    }
    for (const ind of selectCarouselIndicators()) {
      const s = slides.find((x) => x.id === ind.id)!;
      expect([...s.officialText.matchAll(/(\d{4})년/g)].map((m) => Number(m[1])), `${ind.id} 공식 통계명 줄의 연도`).toEqual([ind.latest.year]);
      expect(s.basisLine, ind.id).toContain(`${ind.latest.year}년`); // 「통계 기준」 줄과 같은 연도
    }
    expect(slides.find((s) => s.id === 'region-population-registered')!.officialText).toBe('지역별 주민등록 인구수(2026년 9월, 16개 시·도)'); // R-446 (b): 범위 문구 괄호의 첫 항목만(「주민등록」은 이름에 이미 있다)
    expect(slides.find((s) => s.id === 'life-expectancy')!.officialText).toBe('기대수명(2024년)'); // 형진 님 예시 「기대수명(2024년)」
  });

  it('범위 설명(withScope)은 시·도 범위가 보이는 두 지표만 괄호 안에 더한다 — 「2026년 9월, 16개 시·도」「2025년, 17개 시·도」', () => {
    expect(Object.entries(STAT_HEADLINES).filter(([, h]) => h.withScope === true).map(([id]) => id)).toEqual(['region-population-registered', 'tfr-by-sido']);
    expect(slides.find((s) => s.id === 'region-population-registered')!.officialText).toBe('지역별 주민등록 인구수(2026년 9월, 16개 시·도)');
    expect(slides.find((s) => s.id === 'tfr-by-sido')!.officialText).toBe('시·도별 합계출산율(2025년, 17개 시·도)');
  });

  it('슬라이드의 접근 가능한 이름은 「n/N 표제어, 공식 통계명(기준)」이다 — 첫 슬라이드와 일곱째 슬라이드 예', () => {
    const n = slides.length;
    expect(`1/${n} ${slides[0].insight}, ${slides[0].officialText}`).toBe(`1/${n} 한 여성이 평생 낳을 아이는 몇 명일까?, 합계출산율(2025년)`);
    const life = slides.findIndex((s) => s.id === 'life-expectancy');
    expect(`${life + 1}/${n} ${slides[life].insight}, ${slides[life].officialText}`).toBe(`7/${n} 얼마나 살 수 있을까?, 기대수명(2024년)`);
  });
});

describe('문구 기준표(docs/design/copy.md 9-1)와 코드가 같다 — 표제어·공식 통계명(기준) 14행', () => {
  /** copy.md 9-1 표의 행: `| # | id | 표제어 | 자 | 공식 통계명(기준) | 비고 |` */
  const rows = copyMd
    .slice(copyMd.indexOf('### 9-1. 통계 표제어'), copyMd.indexOf('### 9-2.'))
    .split('\n')
    .filter((l) => /^\| \d+ \|/.test(l))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map((c) => ({ id: c[2], insight: c[3].replace(/\*\*/g, '').replace(/^\(후보\) /, ''), official: c[5] }));

  it('표가 14행이다 (공허 통과 방지)', () => {
    expect(rows).toHaveLength(14);
  });

  it('id가 데이터와 같은 13행은 표제어와 공식 통계명 줄이 화면 글자와 같다', () => {
    let compared = 0;
    for (const r of rows) {
      const s = slides.find((x) => x.id === r.id);
      if (s === undefined) continue; // #4 poverty-by-age — 연령계층별 빈곤율 지표는 QI4 수집 뒤(형진 님 답 M8). 지금은 elderly-poverty 자리(아래 단언)
      compared++;
      expect(s.insight, r.id).toBe(r.insight);
      expect(s.officialText, r.id).toBe(r.official);
    }
    expect(compared).toBe(13);
  });

  it('#4는 copy.md가 형진 님 예시 「나이들수록 또래들과 경제력 차이가 극심해져요」를 연령계층별 빈곤율 지표(QI4 수집)의 표제어로 정했다 — 그 전 elderly-poverty 슬라이드는 부록 B 대안 「노년의 살림살이는 어떨까?」(마스터 결정 대기, diff-005 D5-15)', () => {
    const r4 = rows.find((r) => r.id.startsWith('poverty-by-age'))!;
    expect(r4.insight).toBe('나이들수록 또래들과 경제력 차이가 극심해져요');
    expect(STAT_HEADLINES['elderly-poverty'].insight).toBe('노년의 살림살이는 어떨까?');
    expect(STAT_HEADLINES['elderly-poverty'].officialName).toBe('66세 이상 상대적 빈곤율');
    expect(Object.values(STAT_HEADLINES).map((h) => h.insight)).not.toContain(r4.insight); // 지금 그래프(66세 이상 한 줄)가 그 문장에 직접 답하지 못한다(SH2 ⑤)
  });
});
