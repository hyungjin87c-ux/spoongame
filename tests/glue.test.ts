import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ERAS, PARENT_WEALTHS, buildCarousel, commaList, glueSegments, segmentsText, splitPair, type GlueSegment } from '../src/core';
import { startBandOf } from '../src/core/ending';
import { GRADE_NAME } from '../src/data/birthReportText';
import { bandLabel } from '../src/data/endingText';
import { footerStatsText, TITLE_TEXT } from '../src/data/titleText';
import { Glue } from '../src/ui/Glue';
import { Pair } from '../src/ui/Pair';

/**
 * 줄바꿈 묶음 (SPEC-003 QM2-5). 묶음 규칙은 순수 함수(core/glue.ts)이고, 실제 줄바꿈 결과(혼자 남는 「·」 0, 숫자와 단위가 갈라지지 않음)는 e2e/line-breaks.spec.ts가 글자 단위 Range로 잰다.
 * 여기서는 (1) 어떤 글자를 한 묶음으로 두는지 (2) 묶어도 글자가 바뀌지 않는지 (3) 실제 14장·푸터 문구에서 기호가 묶음 밖에 홀로 남지 않는지를 본다.
 */

const kinds = (segments: readonly GlueSegment[]): string[] => segments.map((s) => (s.kind === 'plain' ? `plain:${s.text}` : s.kind === 'nowrap' ? `nowrap:${s.text}` : `chain:${segmentsText(s.parts)}`));

describe('glueSegments: 묶는 것', () => {
  it('숫자와 바로 뒤 단위는 한 묶음(nowrap)이다: 「240,326 건」「27.8명」「37.7%」「66세」', () => {
    expect(kinds(glueSegments('240,326 건 기준'))).toEqual(['nowrap:240,326 건', 'plain: 기준']);
    expect(kinds(glueSegments('총 27.8명이'))).toEqual(['plain:총 ', 'nowrap:27.8명', 'plain:이']);
    expect(kinds(glueSegments('37.7%'))).toEqual(['nowrap:37.7%']);
    expect(kinds(glueSegments('66세 이상'))).toEqual(['nowrap:66세', 'plain: 이상']);
  });

  it('날짜·시각은 통째로 한 묶음이다: 「11월 1일 0시」(고령인구 정의에서 「1일」과 「0시」 사이가 끊기던 곳)·「2026년 9월」·「2026-10-15」', () => {
    expect(kinds(glueSegments('(11월 1일 0시 기준, 등록센서스)'))).toEqual(['plain:(', 'nowrap:11월 1일 0시', 'plain: 기준, 등록센서스)']);
    expect(kinds(glueSegments('2026년 9월 전국 주민등록 인구'))).toEqual(['nowrap:2026년 9월', 'plain: 전국 주민등록 인구']);
    expect(kinds(glueSegments('(2026-10-15 조회)'))).toEqual(['plain:(', 'nowrap:2026-10-15', 'plain: 조회)']);
    expect(kinds(glueSegments('2025년 11월 1일 0시'))).toEqual(['nowrap:2025년 11월 1일 0시']);
  });

  it('띄어 쓴 구분 기호는 앞말·뒷말과 함께 한 묶음(chain)이다: 「2025년 · 마지막」「A / B / C」 — 기호가 줄 끝·첫머리에 혼자 서는 일이 없다', () => {
    expect(kinds(glueSegments('통계 기준: 2025년 · 마지막 갱신'))).toEqual(['plain:통계 기준: ', 'chain:2025년 · 마지막', 'plain: 갱신']);
    expect(kinds(glueSegments('국가데이터처 · 행정안전부 · 교육부 (통계표'))).toEqual(['chain:국가데이터처 · 행정안전부 · 교육부', 'plain: (통계표']);
    expect(kinds(glueSegments('1970~2025 / 2025년 혼인'))).toEqual(['chain:1970~2025 / 2025년', 'plain: 혼인']);
    expect(kinds(glueSegments('인구 10만 명당 · 2025년 기준'))).toEqual(['plain:인구 10만 ', 'chain:명당 · 2025년', 'plain: 기준']);
  });

  it('붙여 쓴 구분 기호가 든 낱말도 한 묶음이다: 「인구동향조사·생명표)」「6)·본문」「시·도)」 — 기호 앞·뒤에서 줄이 바뀌지 않는다', () => {
    expect(kinds(glueSegments('(INH_1B8000F_02, 인구동향조사·생명표) (2026'))).toEqual(['plain:(INH_1B8000F_02, ', 'chain:인구동향조사·생명표)', 'plain: (2026']);
    expect(kinds(glueSegments('(통계표 6)·본문 [표 12]'))).toEqual(['plain:(통계표 ', 'chain:6)·본문', 'plain: [표 12]']);
    expect(kinds(glueSegments('지역별 인구수(2026년 9월, 16개 시·도)'))).toEqual(['plain:지역별 ', 'chain:인구수(2026년 9월,', 'plain: ', 'nowrap:16개', 'plain: ', 'chain:시·도)']);
  });

  it('글자에 붙은 괄호는 그 낱말째 한 묶음이다: 「기간(15~49세)」을 「기간 / (15~49세)」로 쪼개지 않는다 — 괄호로 시작하는 낱말(「(통계표」)은 묶지 않는다', () => {
    expect(kinds(glueSegments('가임 기간(15~49세) 동안'))).toEqual(['plain:가임 ', 'chain:기간(15~49세)', 'plain: 동안']);
    expect(kinds(glueSegments('조(粗)출생률 및'))).toEqual(['chain:조(粗)출생률', 'plain: 및']);
    // 괄호 안의 날짜는 괄호 낱말에 이어 붙는다 — 「비율입니다(11월 1일 0시」를 괄호 낱말과 날짜로 쪼개지 않는다
    expect(kinds(glueSegments('비율입니다(11월 1일 0시 기준, 등록센서스).'))).toEqual(['chain:비율입니다(11월 1일 0시', 'plain: 기준, 등록센서스).']);
    expect(kinds(glueSegments('(통계표 6) 참고'))).toEqual(['plain:(통계표 6) 참고']);
  });

  it('닫는 괄호 뒤에 글자가 붙은 낱말도 한 묶음이다: 「기준)으로」를 「기준) / 으로」로 쪼개지 않는다 (REV-003-M2-4 R-244: 혼인 건수 정의 320px) — 괄호나 구두점만 붙은 낱말은 묶지 않는다', () => {
    expect(kinds(glueSegments('혼인신고 기준(신고월 기준)으로 집계한'))).toEqual(['plain:혼인신고 ', 'chain:기준(신고월', 'plain: ', 'chain:기준)으로', 'plain: 집계한']);
    expect(kinds(glueSegments('평균 햇수(출생 시 기대여명)입니다. 해당'))).toEqual(['plain:평균 ', 'chain:햇수(출생', 'plain: 시 ', 'chain:기대여명)입니다.', 'plain: 해당']);
    expect(kinds(glueSegments('자해(자살)로 숨진'))).toEqual(['chain:자해(자살)로', 'plain: 숨진']);
    expect(kinds(glueSegments('끝 (통계표 6). 참고 (2026-10-15 조회)'))).toEqual(['plain:끝 (통계표 6). 참고 (', 'nowrap:2026-10-15', 'plain: 조회)']); // 뒤에 구두점만 붙은 「6).」「조회)」는 묶지 않는다
    expect(kinds(glueSegments('(영문)ABC 와 (숫자)12'))).toEqual(['chain:(영문)ABC', 'plain: 와 ', 'chain:(숫자)12']);
  });

  it('실제 14장·푸터 글자에서 닫는 괄호 바로 뒤에 글자(한글·영문·숫자)가 붙은 곳은 모두 묶음 안에 있다 — 혼인 건수 정의의 「기준)으로」가 들어 있다 (REV-003-M2-4 R-244)', () => {
    const data = buildCarousel();
    const texts: string[] = [];
    for (const s of data.slides) texts.push(s.title, s.caption ?? '', s.definition, s.sourceText, s.basisText, s.basisLine, s.seriesNote ?? '', ...s.legend.map((l) => l.label));
    texts.push(footerStatsText(data.orgs));
    let attached = 0;
    for (const t of texts) {
      const segs = glueSegments(t);
      const stray = segs.flatMap((g) => (g.kind === 'chain' ? [] : /\)[가-힣A-Za-z0-9]/.test(g.text) ? [g.text] : []));
      expect(stray, `묶음 밖에서 「)」와 뒤 글자가 이어진 곳: ${t}`).toEqual([]);
      attached += [...t.matchAll(/\)[가-힣A-Za-z0-9]/g)].length;
    }
    expect(attached, '공허 통과 방지: 닫는 괄호에 글자가 붙은 곳을 실제로 봤다').toBeGreaterThanOrEqual(6);
    const marriage = data.slides.find((s) => s.id === 'marriage-count')!;
    expect(glueSegments(marriage.definition).some((g) => g.kind === 'chain' && segmentsText(g.parts) === '기준)으로')).toBe(true);
  });

  it('묶음 안에서도 숫자+단위·날짜는 그대로 묶인다 (「2025년 · 마지막」의 「2025년」)', () => {
    const [chain] = glueSegments('2025년 · 마지막');
    expect(chain.kind).toBe('chain');
    if (chain.kind === 'chain') expect(kinds(chain.parts)).toEqual(['nowrap:2025년', 'plain: · 마지막']);
  });

  it('묶을 것이 없는 글자는 그대로 한 조각이다', () => {
    expect(kinds(glueSegments('합계출산율은 한 여자가 낳을 것으로 예상되는 평균 출생아 수입니다.'))).toEqual(['plain:합계출산율은 한 여자가 낳을 것으로 예상되는 평균 출생아 수입니다.']);
    expect(glueSegments('')).toEqual([]);
  });
});

describe('묶음은 글자를 바꾸지 않는다', () => {
  const samples = [
    '통계 기준: 2025년 · 마지막 갱신 2026-10-15',
    '국가데이터처, 2025년 출생 통계 통계표 1 「출생아 수, 조(粗)출생률 및 합계출산율, 1970~2025」(보도자료 부록) (2026-10-15 조회)',
    '고령인구 비율은 총인구 중 65세 이상 인구가 차지하는 비율입니다(11월 1일 0시 기준, 등록센서스).',
    'KOSIS 혼인건수, 조혼인율 (INH_1B8000F_03, 인구동향조사) 1970~2025 / 2025년 혼인·이혼 통계 요약(보도자료 1쪽)',
    '통계 출처: 국가데이터처 · 행정안전부 · 교육부 (통계표 이름과 기준 연도는 카드마다 적혀 있습니다)',
  ];
  it('조각을 이어 붙이면 원래 글자와 같다 (공백 하나까지)', () => {
    for (const s of samples) expect(segmentsText(glueSegments(s)), s).toBe(s);
  });

  it('실제 14장의 모든 글자와 푸터 문구도 그렇다', () => {
    const data = buildCarousel();
    let checked = 0;
    for (const s of data.slides) {
      for (const t of [s.title, s.caption ?? '', s.definition, s.sourceText, s.basisText, s.basisLine, s.seriesNote ?? '', ...s.legend.map((l) => l.label)]) {
        checked++;
        expect(segmentsText(glueSegments(t)), `${s.id}: ${t}`).toBe(t);
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('<Glue>는 같은 글자를 span으로 감싸 그린다 — 마크업의 글자(태그 제외)가 원래 글자와 같다', () => {
    for (const s of samples) {
      const html = renderToStaticMarkup(Glue({ text: s }));
      expect(html.replace(/<[^>]+>/g, ''), s).toBe(s);
      expect(html).toContain('class="');
    }
    expect(renderToStaticMarkup(Glue({ text: '240,326 건' }))).toBe('<span class="nowrap">240,326 건</span>');
    expect(renderToStaticMarkup(Glue({ text: '2025년 · 마지막' }))).toBe('<span class="keep-phrase"><span class="nowrap">2025년</span> · 마지막</span>');
  });
});

describe('실제 문구: 구분 기호가 묶음 밖에 홀로 남지 않는다 (QM2-5 a의 단위 검사)', () => {
  /** 묶음 밖(plain·nowrap) 글자에 구분 기호가 있으면 그 기호 앞뒤에서 줄이 바뀔 수 있다 */
  const strayIn = (segments: readonly GlueSegment[]): string[] => segments.flatMap((s) => (s.kind === 'chain' ? [] : /[·/—]/.test(s.text) ? [s.text] : []));

  it('14장의 모든 글자와 푸터에서 「·」「/」「—」는 전부 묶음 안에 있다', () => {
    const data = buildCarousel();
    const texts: Array<[string, string]> = [];
    for (const s of data.slides) {
      texts.push([`${s.id} 제목`, s.title], [`${s.id} 정의`, s.definition], [`${s.id} 출처`, s.sourceText], [`${s.id} 기준`, s.basisText], [`${s.id} 통계 기준`, s.basisLine]);
      if (s.caption !== null) texts.push([`${s.id} 캡션`, s.caption]);
      if (s.seriesNote !== null) texts.push([`${s.id} 계열 설명`, s.seriesNote]);
      for (const l of s.legend) texts.push([`${s.id} 범례`, l.label]);
    }
    texts.push(['푸터 기관', footerStatsText(data.orgs)]);
    for (const [where, text] of texts) expect(strayIn(glueSegments(text)), `${where}: ${text}`).toEqual([]);
    expect(texts.length).toBeGreaterThan(80);
  });

  it('공백 없이 길게 이어지는 나열(예전 「학원·개인과외·그룹과외·방문학습지·인터넷」)이 없다 — 묶음이 한 줄보다 길면 안에서 끊긴다', () => {
    const data = buildCarousel();
    for (const s of data.slides) {
      for (const t of [s.title, s.definition, s.sourceText, s.basisText, s.seriesNote ?? '']) {
        for (const seg of glueSegments(t)) {
          if (seg.kind !== 'chain') continue;
          const text = segmentsText(seg.parts);
          // 320px 화면의 카드 안쪽(254px)에 14px 글자로 들어가는 길이(한글 한 글자 약 14px → 18자 안팎)
          expect(text.length, `${s.id}: 「${text}」`).toBeLessThanOrEqual(22);
        }
      }
    }
    const pe = data.slides.find((s) => s.id === 'private-education')!;
    expect(pe.definition).toContain('학원, 개인과외, 그룹과외, 방문학습지, 인터넷 강좌 등');
  });
});

describe('쉼표 나열과 짧은 쌍 (SPEC-003 QM2-10: 한 줄을 넘을 수 있는 나열은 쉼표, 「·」는 한 줄에 들어가는 짧은 쌍에만)', () => {
  it('commaList: 항목 사이는 「, 」(쉼표 + 공백)이고 「·」가 없다', () => {
    expect(commaList(['가'])).toBe('가');
    expect(commaList(['가', '나'])).toBe('가, 나');
    expect(commaList(['가', '나', '다'])).toBe('가, 나, 다');
    expect(commaList([])).toBe('');
  });

  it('푸터 통계 출처 줄: 기관 수 1·2·3·5개 — 기관 이름 사이 구분자가 모두 쉼표이고 「·」가 0개이며 줄 모양은 「통계 출처: A, B, C (통계표 …)」다 (QM2-10 b)', () => {
    const all = ['국가데이터처', '행정안전부', '교육부', '보건복지부', '고용노동부'];
    for (const n of [1, 2, 3, 5]) {
      const orgs = all.slice(0, n);
      const text = footerStatsText(orgs);
      expect(text, `${n}개`).toBe(`통계 출처: ${orgs.join(', ')} (통계표 이름과 기준 연도는 카드마다 적혀 있습니다)`);
      // 기관 이름 사이만 떼어 본다: 구분자는 모두 「, 」이고 「·」가 없다
      const listPart = text.slice(TITLE_TEXT.footerStatsLead.length, text.indexOf(' (통계표'));
      expect(listPart, `${n}개: 기관 이름 목록`).toBe(orgs.join(', '));
      expect(listPart.includes('·'), `${n}개: 기관 이름 사이에 「·」`).toBe(false);
      expect(listPart.split(', '), `${n}개: 쉼표로 나뉜 항목`).toEqual(orgs);
    }
    // 기관이 없어도 이중 공백이 없다
    expect(footerStatsText([])).toBe('통계 출처: (통계표 이름과 기준 연도는 카드마다 적혀 있습니다)');
  });

  it('실제 푸터: 「통계 출처: 국가데이터처, 행정안전부, 교육부 (통계표 이름과 기준 연도는 카드마다 적혀 있습니다)」', () => {
    const data = buildCarousel();
    expect(footerStatsText(data.orgs)).toBe('통계 출처: 국가데이터처, 행정안전부, 교육부 (통계표 이름과 기준 연도는 카드마다 적혀 있습니다)');
  });

  it('쉼표 나열은 줄 가장자리에 기호가 서지 않게 묶을 것이 없다: 가운뎃점 묶음(chain)이 하나도 생기지 않는다 (쉼표는 앞 낱말에 붙어 줄 끝에 와도 되고 첫머리에는 오지 않는다)', () => {
    const text = footerStatsText(buildCarousel().orgs);
    expect(glueSegments(text).some((seg) => seg.kind === 'chain')).toBe(false);
  });

  it('splitPair: 구분 기호가 정확히 하나인 쌍만 [앞, 뒤]로 나눈다 — 기호가 없거나 둘 이상이거나 한쪽이 비면 null', () => {
    expect(splitPair('인구 10만 명당 · 2025년 기준')).toEqual(['인구 10만 명당', '2025년 기준']);
    expect(splitPair('통계 기준: 2025년 · 마지막 갱신 2026-10-15')).toEqual(['통계 기준: 2025년', '마지막 갱신 2026-10-15']);
    expect(splitPair('2025년 기준')).toBeNull();
    expect(splitPair('2026년 9월 기준(16개 시·도, 주민등록)')).toBeNull(); // 붙여 쓴 기호는 쌍이 아니다
    expect(splitPair('가 · 나 · 다')).toBeNull();
    expect(splitPair(' · 나')).toBeNull();
  });

  it('<Pair>: 쌍이면 [앞] 공백 [· ] [뒤] 조각(글자는 「앞 · 뒤」 그대로), 쌍이 아니면 일반 줄바꿈 묶음이다', () => {
    const html = renderToStaticMarkup(Pair({ text: '인구 10만 명당 · 2025년 기준', kind: 'basis' }));
    expect(html).toContain('class="pair pair--basis"');
    expect(html.match(/class="pair__item"/g)).toHaveLength(2);
    expect(html).toContain('</span> <span class="pair__sep">· </span><span class="pair__item">'); // 공백은 기호 조각 밖에 있고 기호 조각 안은 「· 」다
    expect(html.replace(/<[^>]+>/g, ''), '글자는 그대로').toBe('인구 10만 명당 · 2025년 기준');
    expect(renderToStaticMarkup(Pair({ text: '2025년 기준', kind: 'basis' }))).toBe('<span class="nowrap">2025년</span> 기준');
    // 분모 문구 「인구 10만 명당」은 갈라지지 않는 한 묶음이다(「인구 10만 / 명당」으로 끊기지 않는다)
    expect(html).toContain('<span class="nowrap">인구 10만 명당</span>');
  });

  it('<Pair>의 두 항목 사이에는 기호 조각 밖에 일반 공백이 하나 있다 — 두 줄 모드(기호 조각 display: none)에서도 「명당2025년」처럼 붙지 않는다 (REV-003-M2-4 R-242)', () => {
    for (const [text, kind, a, b] of [
      ['인구 10만 명당 · 2025년 기준', 'basis', '인구 10만 명당', '2025년 기준'],
      ['통계 기준: 2025년 · 마지막 갱신 2026-10-15', 'meta', '통계 기준: 2025년', '마지막 갱신 2026-10-15'],
    ] as const) {
      const html = renderToStaticMarkup(Pair({ text, kind }));
      // 두 줄 모드에서 보이는 글자: 기호 조각을 통째로 뺀 마크업의 글자
      const withoutSep = html.replace(/<span class="pair__sep">[^<]*<\/span>/, '');
      expect(withoutSep, `${kind}: 기호 조각이 하나 빠졌다`).not.toContain('pair__sep');
      const visible = withoutSep.replace(/<[^>]+>/g, '');
      expect(visible, `${kind}: 두 항목 사이에 일반 공백 하나`).toBe(`${a} ${b}`);
      expect(visible).not.toMatch(/\s{2,}/);
      // 기호 조각 안에는 공백이 앞에 없다(바깥으로 뺐다): 안쪽 글자는 「· 」
      expect(/<span class="pair__sep">([^<]*)<\/span>/.exec(html)![1]).toBe('· ');
    }
  });

  it('분모 문구는 한 묶음이다: 「조혼인율 인구 1천 명당 4.7건」이 좁은 폭에서 「인구 1천 / 명당 4.7건」으로 갈라지지 않는다', () => {
    expect(kinds(glueSegments('조혼인율 인구 1천 명당 4.7건'))).toEqual(['plain:조혼인율 ', 'nowrap:인구 1천 명당', 'plain: ', 'nowrap:4.7건']);
    expect(kinds(glueSegments('인구 10만 명당'))).toEqual(['nowrap:인구 10만 명당']);
  });
});

describe('가운뎃점·빗금으로 목록을 잇는 곳 점검 (QM2-10 c: reviewer가 열어 보는 사용처를 테스트가 잠근다)', () => {
  const sources = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  const files = Object.entries(sources).map(([path, raw]) => ({ file: path.replace('../src/', ''), code: stripComments(raw) }));

  it("join(' · ')·join('·')·join(' / ')은 개발자용 점검 메시지(core/eventLint.ts 2곳) 말고 어디에도 없다 — 화면 글자를 가운뎃점·빗금으로 잇는 목록 조립이 없다", () => {
    const hits: Record<string, number> = {};
    for (const f of files) {
      const n = [...f.code.matchAll(/\.join\(\s*(['"`])\s*[·/—]\s*\1\s*\)/g)].length;
      if (n > 0) hits[f.file] = n;
    }
    expect(hits).toEqual({ 'core/eventLint.ts': 2 });
    expect(files.length, '공허 통과 방지: src 전체를 읽었다').toBeGreaterThan(40);
  });

  it('코드 안의 「 · 」(공백 + 가운뎃점 + 공백) 문구 조립은 항목이 고정된 짧은 쌍 여섯 곳뿐이다 — 기준 줄·통계 기준 줄(둘 다 ui/Pair가 좁은 폭에서 두 줄로 나눈다)·분해 코드·엔딩 연표의 단계 줄·대시보드 인생 기록의 안내 두 줄(ui/Glue 묶음)·룰렛/출생신고의 짧은 쌍(ui/FitPair — 한 줄에 들어갈 때만 「A · B」이고 안 들어가면 기호 없이 두 줄) (ui/Pair.tsx는 공백을 기호 조각 밖에 두어 「· 」만 그린다 — R-242)', () => {
    const hits: Record<string, number> = {};
    for (const f of files) {
      const n = [...f.code.matchAll(/ · /g)].length;
      if (n > 0) hits[f.file] = n;
    }
    expect(hits).toEqual({
      'core/carousel.ts': 1, // 기준 줄 「{분모 문구} · {연도}년 기준」 (항목 둘 고정)
      'core/glue.ts': 1, // splitPair의 분해 기호
      'data/endingText.ts': 2, // 엔딩 연표의 단계 줄: 단계 · 나이 범위, 엔딩 머리 셋째 줄: 「{출생 연월} ~ {사망 연도}년 · {나이}세」 (M7e-3 — 둘 다 엔딩 화면이 ui/Glue로 그린다)
      'screens/EndingScreen.tsx': 1, // 엔딩 머리 라벨 「{세상} · 생애 기록」 (M7e-3, ui/Glue 묶음 — 「·」가 줄 가장자리에 남지 않는다)
      // SPEC-003 M4 대시보드: 인생 기록 머리 보조 「시간순 · 위로 스크롤하면 지난 기록」과 새 줄 버튼 「새 기록 N개 · 맨 아래로」 — 둘 다 항목이 둘로 고정된 짧은 쌍이고 ui/Glue 묶음(.keep-phrase)으로 그려 기호가 줄 가장자리에 혼자 남지 않는다(copy.md 대시보드 행, 11-4절).
      'data/dashText.ts': 2,
      'data/koreaStatsAccess.ts': 2, // 「통계 기준: {연도}년 · 마지막 갱신 {날짜}」, 카드 출처 줄(화면에 쓰이지 않는 접근자 값)
      // SPEC-003 M3: 항목이 둘로 고정된 짧은 쌍(룰렛 결과 「{수저(구간)} · {시·도}」, 출생신고의 「나이 · 직업」·「장소 · 성별」·「수저 게임 · 가상의 서류」)을 그린다 — 탐침 글자(data-text)와 한 줄 모양의 JSX 두 곳.
      // 한 줄에 들어가는지 재서(탐침) 안 들어가면 기호 없이 두 항목을 따로 줄로 나눈다(QM2-10 규칙 3) — 기호가 줄 끝·첫머리에 혼자 남지 않는다.
      'ui/FitPair.tsx': 2,
    });
    // 쌍을 그리는 곳(ui/Pair.tsx)은 공백이 기호 조각 밖에 있어 「 · 」 문자열이 없다 — 대신 기호 조각이 「· 」이고 앞에 일반 공백이 따로 있음을 본다
    const pair = files.find((f) => f.file === 'ui/Pair.tsx')!;
    expect(pair.code).toContain('<span className="pair__sep">· </span>');
    expect(pair.code).toContain("{' '}");
  });
});

/**
 * 괄호 안 짧은 구간 표기 (QA-003-M3 M3-O13, M3 r5): 룰렛 결과 문장 「다이아몬드수저(상위 3% 안쪽)」가 글자 200%·좁은 폭에서 「(상위 / 3% 안쪽)」으로 갈라지던 것을 막는다.
 * 괄호 구간(상위·하위로 시작하는 24글자 이하)은 괄호째 한 묶음이고, 앞 낱말은 묶음 밖이다. 실제 줄 모양은 e2e/m3-band-glue.spec.ts가 잰다.
 */
describe('괄호 안 짧은 구간은 괄호째 한 묶음이다 (M3-O13)', () => {
  it('「다이아몬드수저(상위 3% 안쪽)」: 앞 낱말은 묶음 밖, 「(상위 3% 안쪽)」은 한 묶음이고 안에서 「3%」는 그대로 묶인다', () => {
    const segs = glueSegments('다이아몬드수저(상위 3% 안쪽)');
    expect(kinds(segs)).toEqual(['plain:다이아몬드수저', 'chain:(상위 3% 안쪽)']);
    const chain = segs[1];
    expect(chain.kind).toBe('chain');
    if (chain.kind === 'chain') expect(kinds(chain.parts)).toEqual(['plain:(상위 ', 'nowrap:3%', 'plain: 안쪽)']);
  });

  it('구간의 세 꼴을 모두 묶는다: 「안쪽」「~ 사이」「A와 B 사이」 — 그리고 뒤에 붙은 조사·구두점(「)의」「),」)도 묶음 안이다', () => {
    expect(kinds(glueSegments('흙수저(하위 30% 안쪽)'))).toEqual(['plain:흙수저', 'chain:(하위 30% 안쪽)']);
    expect(kinds(glueSegments('금수저(상위 17~45% 사이)'))).toEqual(['plain:금수저', 'chain:(상위 17~45% 사이)']);
    expect(kinds(glueSegments('은수저(하위 25% 선과 상위 45% 선 사이)'))).toEqual(['plain:은수저', 'chain:(하위 25% 선과 상위 45% 선 사이)']);
    expect(kinds(glueSegments('동수저(하위 25% 안쪽)의 집에서'))).toEqual(['plain:동수저', 'chain:(하위 25% 안쪽)의', 'plain: 집에서']);
    expect(kinds(glueSegments('흙수저(하위 30% 안쪽), 서울'))).toEqual(['plain:흙수저', 'chain:(하위 30% 안쪽),', 'plain: 서울']);
  });

  it('앞 낱말이 없어도(괄호 구간만) 묶는다: 출생신고 「집안 형편」의 구간 글자 「(하위 25% 안쪽)」', () => {
    expect(kinds(glueSegments('(하위 25% 안쪽)'))).toEqual(['chain:(하위 25% 안쪽)']);
  });

  it('우리 문구의 모든 구간이 묶인다: 세 시대 × 수저 5단계의 「{수저}({구간})」는 구간 하나가 한 묶음이고 그 밖에는 괄호가 없다 — 묶음은 글자를 바꾸지 않는다', () => {
    let seen = 0;
    for (const era of ERAS) {
      for (const grade of PARENT_WEALTHS) {
        const band = bandLabel(startBandOf(era, grade));
        const sentence = `${GRADE_NAME[grade]}(${band})`;
        const segs = glueSegments(sentence);
        expect(segmentsText(segs), sentence).toBe(sentence);
        const chains = segs.filter((s) => s.kind === 'chain');
        expect(chains.map((c) => segmentsText([c])), `${era} ${grade}단계: ${sentence}`).toEqual([`(${band})`]);
        const outside = segs.filter((s) => s.kind !== 'chain').map((s) => (s.kind === 'plain' || s.kind === 'nowrap' ? s.text : ''));
        expect(outside.join(''), `${era} ${grade}단계: 묶음 밖에는 괄호가 없다`).toBe(GRADE_NAME[grade]);
        seen++;
      }
    }
    expect(seen, '공허 통과 방지').toBe(ERAS.length * PARENT_WEALTHS.length);
  });

  it('범위 밖은 건드리지 않는다: 상위·하위로 시작하지 않는 괄호, 24글자를 넘는 괄호, 닫히지 않은 괄호는 이 규칙의 묶음이 아니다', () => {
    expect(kinds(glueSegments('(통계표 6) 참고'))).toEqual(['plain:(통계표 6) 참고']);
    expect(kinds(glueSegments('끝 (통계표 6). 참고'))).toEqual(['plain:끝 (통계표 6). 참고']);
    const long = `(상위 ${'가'.repeat(30)})`;
    expect(glueSegments(long).some((s) => s.kind === 'chain' && segmentsText([s]) === long)).toBe(false);
    expect(kinds(glueSegments('(상위 3% 안쪽'))).not.toContain('chain:(상위 3% 안쪽');
  });

  it('<Glue>: 괄호 구간만 keep-phrase로 감싸고 글자는 그대로다 — 마크업의 글자(태그 제외)가 원래 글자와 같다', () => {
    const html = renderToStaticMarkup(Glue({ text: '다이아몬드수저(상위 3% 안쪽)' }));
    expect(html).toBe('다이아몬드수저<span class="keep-phrase">(상위 <span class="nowrap">3%</span> 안쪽)</span>');
    expect(html.replace(/<[^>]+>/g, '')).toBe('다이아몬드수저(상위 3% 안쪽)');
  });
});
