import { describe, expect, it } from 'vitest';
import copyMd from '../docs/design/copy.md?raw';
import { buildCarousel, selectCarouselIndicators } from '../src/core';
import { BASE_STATS_FILE, CAROUSEL_ORDER } from '../src/data/koreaStatsAccess';
import { HYUNGJIN_ENDING_EXCEPTIONS, INSIGHT_MAX_CHARS, STAT_HEADLINES } from '../src/data/statHeadlines';

/**
 * 통계 슬라이드의 표제어·공식 통계명 (SPEC-005 SH1~SH3·SH7, 문구 기준표 docs/design/copy.md 9-1 · QI4 14-1).
 * 값 데이터(koreaStats.json)는 건드리지 않고 `data/statHeadlines.ts` 한 곳에 둔다 — 이 파일이 그 한 곳의 규칙을 잠근다.
 *
 * SPEC-005 QI4 2단계(20장): 아래 네 곳은 REV-005-QI4-1 R-478 마스터 승인 범위 안에서만 바꿨다 — (a) 종결 규칙에 형진 님 문장 예외 목록 (b) SH3 낱말 단위 + 같은 지표 haystack
 * (c) 형진 님 문장 = income-gap-by-age 표제어 (d) 전망 슬라이드 단일 출처 규칙. 바뀐 줄마다 주석에 「REV-005-QI4-1 R-478 마스터 승인」을 달았다.
 */

const carouselIds = selectCarouselIndicators().map((i) => i.id);
const slides = buildCarousel().slides;
const projectionSlides = slides.filter((s) => s.projection !== null);

/** 표제어에 쓰지 않는 말: 평가어·원인 단정·집단 낙인·정치 논평 (SH2 ④) + 완곡어(자살을 「선택」으로 읽히게 하는 말, copy.md 9-1 #5) */
const FORBIDDEN = ['문제', '탓', '때문', '심각', '위기', '충격', '최악', '참담', '실패', '낙오', '무능', '게으'];

describe('표제어 데이터 (SH7 ① — 캐러셀 지표 id 전부에 항목이 있고 남는 항목이 없다)', () => {
  it('캐러셀 지표 20개 전부에 항목이 있다', () => {
    expect(carouselIds.length).toBe(20); // QI4 2단계: 14 → 20 (격차 1 + 공식 전망 5)
    for (const id of carouselIds) expect(STAT_HEADLINES[id], `${id}의 표제어·공식 통계명`).toBeDefined();
  });

  it('항목은 캐러셀 지표뿐이다 — 지표가 빠졌는데 항목이 남지 않는다 (공허 통과 방지: 가짜 id를 더하면 걸린다)', () => {
    const orphan = Object.keys(STAT_HEADLINES).filter((id) => !carouselIds.includes(id));
    expect(orphan).toEqual([]);
    expect(Object.keys({ ...STAT_HEADLINES, 'no-such-indicator': STAT_HEADLINES.tfr }).filter((id) => !carouselIds.includes(id))).toEqual(['no-such-indicator']);
    // 항목 순서 = 캐러셀 순서(CAROUSEL_ORDER) — copy.md 9-1·14-1 표와 같은 차례
    expect(Object.keys(STAT_HEADLINES)).toEqual(CAROUSEL_ORDER.filter((id) => id in STAT_HEADLINES));
    expect(Object.keys(STAT_HEADLINES)).toEqual([...CAROUSEL_ORDER]);
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

  it('평가어·원인 단정·집단 낙인 말이 없다 (「~가 문제예요」「~탓이에요」 류) — 형진 님 문장 「극심해져요」는 목록 밖이다(마스터 결정 6)', () => {
    for (const [id, h] of entries) for (const w of FORBIDDEN) expect(h.insight, `${id}: 「${w}」`).not.toContain(w);
    // 공허 통과 방지: 목록이 실제로 잡는다
    expect(FORBIDDEN.some((w) => '저출생은 정부 탓이에요'.includes(w))).toBe(true);
    expect(FORBIDDEN.some((w) => STAT_HEADLINES['income-gap-by-age'].insight.includes(w))).toBe(false);
  });

  /**
   * 어체: 해요체 — 질문 「~까?」 또는 사실 요약 「~요」로 끝난다. 형진 님 문장 예외 목록(`HYUNGJIN_ENDING_EXCEPTIONS`)의 문장은 이 종결 규칙만 면제된다.
   * REV-005-QI4-1 R-478 마스터 승인 (a): 예외 목록은 지금 「지금 태어나는 아기라면?」 하나이고, 목록 밖의 「~라면?」은 그대로 실패한다.
   */
  const endsOk = (insight: string): boolean => /(까\?|요)$/.test(insight) || HYUNGJIN_ENDING_EXCEPTIONS.includes(insight);

  it('어체: 해요체 — 질문 「~까?」 또는 사실 요약 「~요」로 끝나고(형진 님 문장 예외 목록 제외) 느낌표·이모지·마침표가 없다 (SPEC-003 R2: 첫 화면 현행 어체 · REV-005-QI4-1 R-478 마스터 승인 a)', () => {
    for (const [id, h] of entries) {
      expect(endsOk(h.insight), `${id} 「${h.insight}」 종결`).toBe(true);
      expect(h.insight, id).not.toMatch(/[!！.。]/);
      expect(h.insight, id).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(h.insight, id).not.toMatch(/(습니다|입니다)/); // 합쇼체는 슬라이드 본문(정의·출처) 어체 — 표제어만 해요체
    }
  });

  it('종결 예외는 형진 님 문장 목록 하나뿐이고 목록 밖의 「~라면?」은 실패한다 (R-478 a — 조용히 느슨하게 하지 않는다)', () => {
    expect([...HYUNGJIN_ENDING_EXCEPTIONS]).toEqual(['지금 태어나는 아기라면?']);
    expect(endsOk('지금 태어나는 아기라면?')).toBe(true);
    expect(endsOk('아이가 크면?')).toBe(false); // 목록 밖의 물음표 문장
    expect(endsOk('다 컸다면?')).toBe(false); // 목록 밖의 「~라면?」류
    expect(endsOk('한 해에 몇 명이 태어날까?')).toBe(true);
    // 예외 목록의 문장은 실제 표제어이고(남는 예외 없음), 다른 표제어는 예외에 기대지 않는다
    for (const ex of HYUNGJIN_ENDING_EXCEPTIONS) expect(entries.map(([, h]) => h.insight)).toContain(ex);
    expect(entries.filter(([, h]) => !/(까\?|요)$/.test(h.insight)).map(([, h]) => h.insight)).toEqual([...HYUNGJIN_ENDING_EXCEPTIONS]);
  });

  it('전망 네 장은 「앞으로 …」로 시작해 칩·색 없이 글자만으로도 전망임이 읽힌다 — 다섯째 「지금 태어나는 아기라면?」은 형진 님 문장이라 예외 (FC2, copy.md 14-1)', () => {
    const starts = ['projection-population-total', 'projection-aging-share', 'projection-one-person-households', 'heat-projection'].map((id) => STAT_HEADLINES[id].insight.startsWith('앞으로 '));
    expect(starts).toEqual([true, true, true, true]);
    expect(STAT_HEADLINES['projection-newborn-age-structure'].insight).toBe('지금 태어나는 아기라면?');
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
  /** 공식 통계명을 낱말로 나눈다: 공백과 「·」(고정 짝)에서 — 「청년(15~29세)」 같은 괄호 붙은 낱말은 한 낱말이다 */
  const wordsOf = (officialName: string): string[] => officialName.split(/[\s·]+/).filter((w) => w !== '');

  /**
   * REV-005-QI4-1 R-478 마스터 승인 (b): SH3 시험은 SPEC 문구대로 **낱말 단위**이고, 각 낱말이 **같은 지표**의 title·source.table·definition에 있어야 한다.
   * (이전 시험은 공식 통계명 전체 구절을 찾아 전망 5장이 실패하게 되어 있었다. 폭염 어댑터는 상수 없이 표에서 읽으므로 haystack은 같은 세 곳이다.)
   */
  it('공식 통계명 낱말이 같은 지표의 title·source.table·정의 문구에 실제로 나온다 — 낱말마다 (R-478 마스터 승인 b)', () => {
    let checked = 0;
    for (const ind of selectCarouselIndicators()) {
      const h = STAT_HEADLINES[ind.id];
      const haystack = [ind.title, ind.source.table, ind.definition].join(' ');
      for (const word of wordsOf(h.officialName)) {
        checked++;
        expect(haystack, `${ind.id}: 공식 통계명 낱말 「${word}」 (같은 지표의 title·source.table·정의)`).toContain(word);
      }
    }
    expect(checked, '공허 통과 방지: 낱말을 실제로 검사했다').toBeGreaterThan(40);
  });

  it('낱말 시험은 다른 지표의 글자로 통과하지 않는다 — 같은 지표여야 한다 (공허 통과 방지)', () => {
    // 폭염 지표의 낱말 「폭염일수」는 합계출산율 지표에 없고, 합계출산율의 낱말은 폭염 지표에 없다
    const byId = (id: string) => selectCarouselIndicators().find((i) => i.id === id)!;
    const hay = (id: string) => [byId(id).title, byId(id).source.table, byId(id).definition].join(' ');
    expect(hay('tfr')).not.toContain('폭염일수');
    expect(hay('heat-projection')).toContain('폭염일수');
    expect(hay('heat-projection')).not.toContain('합계출산율');
    // 여러 낱말: 낱말 하나가 없으면 실패한다 — 「장래인구추계 총인구」의 「총인구」는 65세 이상 구성비 지표의 title에 없고(정의에는 있다), 「장래가구추계」는 인구 지표에 없다
    expect(hay('projection-population-total')).not.toContain('장래가구추계');
    expect(hay('projection-one-person-households')).toContain('장래가구추계');
  });

  it('기준 표기는 데이터에서 만든다 — latest.year(월 기준 지표는 범위 문구의 「2026년 9월」). 이 파일에 연도를 적지 않는다 (SC4 단일 출처)', () => {
    for (const [id, h] of Object.entries(STAT_HEADLINES)) {
      expect(h.officialName, id).not.toMatch(/\d{4}/);
      expect(h.insight, id).not.toMatch(/\d{4}/);
    }
    for (const ind of selectCarouselIndicators()) {
      const s = slides.find((x) => x.id === ind.id)!;
      if (s.projection !== null) continue; // 공식 전망 슬라이드는 아래 단일 출처 규칙(d)을 따른다
      expect([...s.officialText.matchAll(/(\d{4})년/g)].map((m) => Number(m[1])), `${ind.id} 공식 통계명 줄의 연도`).toEqual([ind.latest.year]);
      expect(s.basisLine, ind.id).toContain(`${ind.latest.year}년`); // 「통계 기준」 줄과 같은 연도
    }
    expect(slides.find((s) => s.id === 'region-population-registered')!.officialText).toBe('지역별 주민등록 인구수(2026년 9월, 16개 시·도)'); // R-446 (b): 범위 문구 괄호의 첫 항목만(「주민등록」은 이름에 이미 있다)
    expect(slides.find((s) => s.id === 'life-expectancy')!.officialText).toBe('기대수명(2024년)'); // 형진 님 예시 「기대수명(2024년)」
  });

  /**
   * 전망 슬라이드는 연도가 자리마다 출처가 하나다 (REV-005-QI4-1 R-478 마스터 승인 d, diff-005 12절 단일 출처 규칙):
   * 공식 통계명 줄 「{발표 연도}년 발표」 = `projection.releasedOn`의 연도, 「{기준}년 기준」 = `projection.baseYear`, 캡션 연도 = `latest.year`(지평 또는 아기 30세 해),
   * 기준 줄 = `releasedOn` 전체. 폭염은 어댑터가 표에서 읽는다(발표일 = `source.table`의 괄호 날짜, 기준 = 열 이름의 기간) — `latest.year` 2081은 전망 기간의 시작 해라 어디서도 「기준」이 아니다.
   * 이전 시험의 「공식 통계명 줄 연도 = latest.year」는 전망 슬라이드에서 설계상 깨져 이 규칙으로 바꿨다.
   */
  it('전망 슬라이드 단일 출처 규칙: 발표 연도 = releasedOn, 기준 = baseYear, 캡션 연도 = latest.year, 기준 줄 = 발표일 전체 (R-478 마스터 승인 d)', () => {
    expect(projectionSlides.map((s) => s.id)).toEqual(['projection-population-total', 'projection-aging-share', 'projection-one-person-households', 'heat-projection', 'projection-newborn-age-structure']);
    for (const s of projectionSlides) {
      const ind = selectCarouselIndicators().find((i) => i.id === s.id)!;
      const releasedOn = s.projection!.releasedOn;
      expect(releasedOn, s.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const m = /\((\d{4})년 발표, (.+?) 기준(?:, (.+))?\)$/.exec(s.officialText);
      expect(m, `${s.id} 공식 통계명 줄 모양: ${s.officialText}`).not.toBeNull();
      expect(Number(m![1]), `${s.id} 발표 연도`).toBe(Number(releasedOn.slice(0, 4)));
      if (ind.projection !== undefined) {
        expect(releasedOn, `${s.id} 발표일 = projection.releasedOn`).toBe(ind.projection.releasedOn);
        expect(m![2], `${s.id} 기준`).toBe(`${ind.projection.baseYear}년`);
        // 시나리오 칸은 시나리오가 둘 이상일 때만, 라벨은 데이터 그대로 (마스터 결정 2: 장래가구추계는 칸 없음)
        const mid = ind.projection.scenarios.find((x) => x.key === ind.projection!.defaultScenario)!;
        if (mid.level === 'single') expect(m![3], `${s.id} 시나리오 칸 없음`).toBeUndefined();
        else expect(m![3], `${s.id} 시나리오`).toBe(mid.label);
      } else {
        // 폭염 어댑터: 발표일 = source.table 괄호 날짜, 기준 = 열 이름의 괄호 기간, latest.year(2081)는 기준이 아니다
        expect(ind.source.table, `${s.id} 발표일 글자가 표 이름에 있다`).toContain(`(${releasedOn})`);
        expect(m![2], `${s.id} 기준 기간`).toBe('2000~2019년');
        expect((ind.columns ?? []).map((c) => c.label).join(' '), `${s.id} 열 이름에 기준 기간`).toContain(`(${m![2]})`);
        expect(s.officialText, `${s.id}: latest.year 2081은 기준이 아니다`).not.toContain('2081');
        expect(m![3]).toBe('저탄소·고탄소');
      }
      expect(s.caption, `${s.id} 캡션이 있다`).not.toBeNull();
      expect(s.caption!, `${s.id} 캡션 연도 = latest.year`).toContain(String(ind.latest.year));
      expect(s.basisLine, `${s.id} 기준 줄 = 발표일 전체`).toBe(`발표: ${releasedOn} · 마지막 갱신 ${BASE_STATS_FILE.meta.updatedOn}`);
    }
  });

  it('범위 설명(withScope)은 시·도 범위가 보이는 두 지표만 괄호 안에 더한다 — 「2026년 9월, 16개 시·도」「2025년, 17개 시·도」', () => {
    expect(Object.entries(STAT_HEADLINES).filter(([, h]) => h.withScope === true).map(([id]) => id)).toEqual(['region-population-registered', 'tfr-by-sido']);
    expect(slides.find((s) => s.id === 'region-population-registered')!.officialText).toBe('지역별 주민등록 인구수(2026년 9월, 16개 시·도)');
    expect(slides.find((s) => s.id === 'tfr-by-sido')!.officialText).toBe('시·도별 합계출산율(2025년, 17개 시·도)');
  });

  it('슬라이드의 접근 가능한 이름은 「n/N 표제어, 공식 통계명(기준)」이다 — 전망 슬라이드는 「n/N 전망, …」 — 첫 슬라이드·일곱째·열여섯째 예', () => {
    const n = slides.length;
    expect(n).toBe(20);
    expect(`1/${n} ${slides[0].insight}, ${slides[0].officialText}`).toBe(`1/${n} 한 여성이 평생 낳을 아이는 몇 명일까?, 합계출산율(2025년)`);
    const life = slides.findIndex((s) => s.id === 'life-expectancy');
    expect(`${life + 1}/${n} ${slides[life].insight}, ${slides[life].officialText}`).toBe(`8/${n} 얼마나 살 수 있을까?, 기대수명(2024년)`);
  });
});

describe('선택 필드(caption·pairExtra·actualWord)는 숫자 없이 정의 상수와 화면 낱말만 담는다 (마스터 결정 9 · R-486)', () => {
  const numbersIn = (t: string): string[] => t.match(/\d[\d,.]*/g) ?? [];

  it('caption의 숫자 토막은 같은 지표 definition에 있는 정의 상수뿐이다 — 격차 캡션의 「20%」', () => {
    const withCaption = Object.entries(STAT_HEADLINES).filter(([, h]) => h.caption !== undefined);
    expect(withCaption.map(([id]) => id)).toEqual(['income-gap-by-age']);
    for (const [id, h] of withCaption) {
      const ind = selectCarouselIndicators().find((i) => i.id === id)!;
      const defNumbers = numbersIn(ind.definition);
      for (const num of numbersIn(h.caption!)) expect(defNumbers, `${id} 캡션의 숫자 「${num}」가 정의에 있다`).toContain(num);
      expect(numbersIn(h.caption!).length, '공허 통과 방지: 캡션에 숫자 토막이 실제로 있다').toBeGreaterThan(0);
    }
    // 시험이 실제로 잡는다: 정의에 없는 숫자를 캡션에 넣으면 걸린다
    const ind = selectCarouselIndicators().find((i) => i.id === 'income-gap-by-age')!;
    expect(numbersIn(ind.definition)).not.toContain('30');
    expect(numbersIn('상위 30%가 하위 20%의 몇 배').every((x) => numbersIn(ind.definition).includes(x))).toBe(false);
  });

  it('다른 선택 필드에 숫자가 없다: pairExtra는 참 값, actualWord는 두 낱말뿐이다', () => {
    for (const [id, h] of Object.entries(STAT_HEADLINES)) {
      expect(h.pairExtra === undefined || h.pairExtra === true, id).toBe(true);
      if (h.actualWord !== undefined) {
        expect(['확정', '추계 앞 구간'], id).toContain(h.actualWord);
        expect(h.actualWord, id).not.toMatch(/\d/);
      }
    }
    expect(Object.entries(STAT_HEADLINES).filter(([, h]) => h.pairExtra === true).map(([id]) => id)).toEqual(['income-gap-by-age']);
    expect(Object.entries(STAT_HEADLINES).filter(([, h]) => h.actualWord !== undefined).map(([id]) => id)).toEqual(['projection-population-total', 'projection-aging-share', 'projection-one-person-households']);
  });

  it('「확정」은 원문 주석(actualNote)이 확정이라고 말하는 지표에만 쓰고, 근거가 없는 앞 구간은 「추계 앞 구간」이다 — 「실측」은 어떤 화면 글자에도 없다 (마스터 결정 3·9, R-480)', () => {
    for (const ind of selectCarouselIndicators().filter((i) => i.kind === 'projection' && i.projection?.shape !== 'cohort-rows')) {
      const word = STAT_HEADLINES[ind.id].actualWord;
      expect(word, ind.id).toBeDefined();
      expect(word === '확정', `${ind.id}: 「확정」 ⇔ actualNote에 「확정」`).toBe(ind.projection!.actualNote.includes('확정'));
    }
    for (const s of slides) {
      for (const t of slideTexts(s)) expect(t, `${s.id}: 「실측」 0`).not.toContain('실측');
      const texts = slideTexts(s, false); // 「확정」은 모델이 만든 글자(범례·경계·읽기 이름 등)만 본다 — 정의 같은 데이터 글은 데이터가 정한다
      const ind = selectCarouselIndicators().find((i) => i.id === s.id)!;
      const sayConfirmed = texts.some((t) => t.includes('확정'));
      const allowed = ind.kind === 'projection' && ind.projection !== undefined && ind.projection.shape !== 'cohort-rows' && ind.projection.actualNote.includes('확정');
      if (sayConfirmed) expect(allowed, `${s.id}: 「확정」은 actualNote에 확정이 있는 지표에만`).toBe(true);
    }
    // 공허 통과 방지: 「확정」이 실제로 보이는 슬라이드가 둘 있다
    expect(slides.filter((s) => slideTexts(s, false).some((t) => t.includes('확정'))).map((s) => s.id)).toEqual(['projection-population-total', 'projection-aging-share']);
  });
});

/** 슬라이드가 화면과 읽기 이름에 내놓는 글자 전부(표제어·공식 통계명·캡션·보조 줄·범례·그래프 글자·표·정의·한 줄·출처·기준) */
function slideTexts(s: ReturnType<typeof buildCarousel>['slides'][number], dataText = true): string[] {
  // dataText=false: 데이터가 정한 글(정의·출처 줄 — 예: 출생아 수 정의의 「확정치」)은 빼고 슬라이드 모델이 **만든** 글자만 본다
  const out: string[] = [s.insight, s.officialText, s.caption ?? '', s.basisLine, s.chartLabel, s.basisText ?? '', s.seriesNote ?? '', ...(dataText ? [s.definition, s.sourceText] : [])];
  out.push(...s.headlines.map((h) => `${h.label ?? ''}${h.value}`), ...s.legend.map((l) => l.label), ...s.sideValues.map((v) => v.text));
  if (s.projection !== null) out.push(s.projection.chip, s.projection.note);
  for (const t of s.tables) out.push(t.caption, ...t.head, ...t.rows.flatMap((r) => [r.head, ...r.cells]));
  if (s.chart.kind === 'line') {
    out.push(...s.chart.labels.map((l) => l.text), ...s.chart.xLabels.map((l) => l.text));
    if (s.chart.split !== null) out.push(s.chart.split.left.text, s.chart.split.right.text);
  }
  if (s.chart.kind === 'bars') out.push(...s.chart.rows.flatMap((r) => [r.label, r.text]), s.chart.header?.text ?? '');
  if (s.chart.kind === 'stack') out.push(s.chart.header.text, ...s.chart.rows.flatMap((r) => [r.ageText, r.yearText, r.work.text, r.valueText]));
  return out;
}

describe('문구 기준표(docs/design/copy.md 9-1 · 14-1)와 코드가 같다 — 표제어·공식 통계명(기준) 20장', () => {
  /** copy.md 9-1 표의 행: `| # | id | 표제어 | 자 | 공식 통계명(기준) | 비고 |` */
  const rows91 = copyMd
    .slice(copyMd.indexOf('### 9-1. 통계 표제어'), copyMd.indexOf('### 9-2.'))
    .split('\n')
    .filter((l) => /^\| \d+ \|/.test(l))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map((c) => ({ id: c[2], insight: c[3].replace(/\*\*/g, '').replace(/^\(후보\) /, ''), official: c[5] }));

  /** copy.md 14-1 표(QI4): 4·5·16~20번 — `| # | id | 표제어 | 자 | 공식 통계명 줄(화면 글자 그대로) | 큰 값(캡션) | 근거 |` */
  const rows141 = copyMd
    .slice(copyMd.indexOf('### 14-1.'), copyMd.indexOf('### 14-2.'))
    .split('\n')
    .filter((l) => /^\| \d+ \|/.test(l))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map((c) => ({ n: Number(c[1]), id: /^[a-z][a-z0-9-]+/.exec(c[2])![0], insight: c[3].replace(/\*\*/g, ''), official: c[5] }));

  it('9-1 표가 14행이고 14-1 표가 7행이다 (공허 통과 방지)', () => {
    expect(rows91).toHaveLength(14);
    expect(rows141.map((r) => r.n)).toEqual([4, 5, 16, 17, 18, 19, 20]);
  });

  it('id가 데이터와 같은 13행(9-1)은 표제어와 공식 통계명 줄이 화면 글자와 같다', () => {
    let compared = 0;
    for (const r of rows91) {
      const s = slides.find((x) => x.id === r.id);
      if (s === undefined) continue; // #4 poverty-by-age — 14-1 표가 정본(아래): 격차는 income-gap-by-age, 노년 살림은 elderly-poverty
      compared++;
      expect(s.insight, r.id).toBe(r.insight);
      expect(s.officialText, r.id).toBe(r.official);
    }
    expect(compared).toBe(13);
  });

  it('14-1 표(QI4 정본)의 일곱 행은 표제어와 공식 통계명 줄이 화면 글자와 같다 — 격차(#5)와 전망 다섯(#16~#20)·elderly-poverty(#4)', () => {
    for (const r of rows141) {
      const s = slides.find((x) => x.id === r.id);
      expect(s, `${r.id}: 슬라이드가 있다`).toBeDefined();
      expect(slides.indexOf(s!) + 1, `${r.id} 순서 = 표의 번호`).toBe(r.n);
      expect(s!.insight, r.id).toBe(r.insight);
      expect(s!.officialText, r.id).toBe(r.official);
    }
  });

  /**
   * REV-005-QI4-1 R-478 마스터 승인 (c): 형진 님 문장 = `income-gap-by-age`의 표제어. 이전 시험은 「형진 님 문장이 STAT_HEADLINES에 없다」(지금 슬라이드가 그 문장에 직접 답하지 못한다, SH2 ⑤)였는데
   * 연령계층별 격차 지표를 수집해 슬라이드가 문장에 값과 보조 줄로 답하게 되었으므로(마스터 결정 6) 그 문장이 바로 이 지표의 표제어라는 단언으로 바꿨다.
   */
  it('형진 님 문장 「나이들수록 또래들과 경제력 차이가 극심해져요」 = income-gap-by-age의 표제어이고 다른 지표에는 없다 (9-1 #4 · R-478 마스터 승인 c)', () => {
    const r4 = rows91.find((r) => r.id.startsWith('poverty-by-age'))!;
    expect(r4.insight).toBe('나이들수록 또래들과 경제력 차이가 극심해져요');
    expect(STAT_HEADLINES['income-gap-by-age'].insight).toBe(r4.insight);
    expect(Object.entries(STAT_HEADLINES).filter(([, h]) => h.insight === r4.insight).map(([id]) => id)).toEqual(['income-gap-by-age']);
    // 노년 살림 슬라이드는 부록 B 대안 그대로 확정(마스터 결정 1) — 「임시」가 아니다
    expect(STAT_HEADLINES['elderly-poverty'].insight).toBe('노년의 살림살이는 어떨까?');
    expect(STAT_HEADLINES['elderly-poverty'].officialName).toBe('66세 이상 상대적 빈곤율');
  });
});
