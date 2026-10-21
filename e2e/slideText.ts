import { type Page } from '@playwright/test';
import { BASIS_B, SLIDE_FORMS, UNIT_WORD, VALUE_LINE, forbiddenIn } from './carouselForms';

/**
 * 캐러셀 슬라이드의 **화면 DOM 글자** 측정과 판정 (SPEC-003 QM2-4 완료 기준 c, QM2-11 완료 기준 c, REV-003-M2-3 R-231).
 * 단위 테스트(tests/carousel.test.ts)는 모델(`buildCarousel()`)의 글자를 보지만, 실제 화면은 그 글자를 어떻게 그리는지에 달려 있다(범례가 그려지는지·값 줄 아래 줄이 그려지는지 …).
 * 여기서는 지금 보이는 슬라이드의 **눈에 보이는 글자**를 DOM에서 모은다 — 보임 = 계산된 display·visibility·opacity가 보이고 글자 상자의 폭·높이 > 0, `.sr-only`·대체 텍스트·`title` 속성 제외.
 * 숨긴 표(sr-only)에 값이 있어도 눈은 못 본다(QM2-11 규칙 3). 같은 금지 패턴·형식표(e2e/carouselForms.ts)로 판정한다.
 */

export interface SlideDom {
  id: string;
  /** 표제어(h3, SPEC-005 SH1) */
  insight: string;
  /** 공식 통계명(기준) 줄 「합계출산율(2025년)」 (SH3) */
  official: string;
  captions: string[];
  /** 큰 값 줄들(남자·여자처럼 둘이면 둘): 라벨(없으면 null)과 「값 + 단위 낱말」 글자 */
  valueLines: Array<{ label: string | null; text: string; unit: string }>;
  /** 큰 값 아래 줄의 보조 계열 값 (「조혼인율 인구 1천 명당 4.7건」) */
  sideLines: string[];
  /** 기준 줄: 분모가 있는 비율(B형)만 「인구 10만 명당」 한 줄, 그 밖에는 없다(SPEC-005 copy.md 9-2 — 연도는 공식 통계명 줄이 맡는다) */
  basisLines: string[];
  /** 「통계 기준: 2025년 · 마지막 갱신 2026-10-15」 (쌍이 나뉘면 두 줄) */
  statLines: string[];
  legend: string[];
  /** 계열 설명·출처 줄 */
  metas: string[];
  /** QI4 전망 슬라이드의 「전망」 칩 글자(없으면 빈 배열)와 정의 아래 한 줄 안내 */
  chips?: string[];
  projNotes?: string[];
  definition: string;
  /** 그래프 안 글자(값·가로축·막대 라벨) */
  chartTexts: string[];
  /** 눈에 보이는 글자 전부 (블록 사이는 줄바꿈) */
  all: string;
}

/** 지금 보이는(active) 슬라이드의 눈에 보이는 글자를 DOM에서 모은다. 전환(opacity)이 끝난 뒤 부른다. */
export async function collectSlideDom(page: Page): Promise<SlideDom> {
  await page.waitForFunction(() => {
    const el = document.querySelector('.slide.is-active');
    return el !== null && getComputedStyle(el).opacity === '1' && getComputedStyle(el).visibility === 'visible';
  });
  return page.evaluate(() => {
    const slide = document.querySelector('.slide.is-active') as HTMLElement;
    const isVisible = (el: Element | null): boolean => {
      for (let cur = el; cur !== null; cur = cur.parentElement) {
        if (cur.classList.contains('sr-only')) return false;
        const cs = getComputedStyle(cur);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
        if (cur === slide) break;
      }
      return true;
    };
    const INLINE = new Set(['inline', 'inline-block', 'inline-flex', 'inline-grid', 'contents', 'ruby', 'ruby-text']);
    const blockOf = (el: Element): Element => {
      const svgText = el.closest('svg') !== null ? el.closest('text') : null;
      if (svgText !== null) return svgText;
      let cur: Element | null = el;
      while (cur !== null && cur !== slide && INLINE.has(getComputedStyle(cur).display)) cur = cur.parentElement;
      return cur ?? slide;
    };
    const norm = (t: string): string => t.replace(/[ \t\r\f ]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n+/g, '\n').trim();
    /** root 안의 눈에 보이는 글자. 블록이 바뀔 때 줄바꿈을 넣는다 */
    const textOf = (root: Element): string => {
      const out: string[] = [];
      let lastBlock: Element | null = null;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node !== null; node = walker.nextNode() as Text | null) {
        const parent = node.parentElement;
        if (parent === null || !isVisible(parent)) continue;
        if (node.data.trim() === '') {
          if (out.length > 0) out.push(node.data);
          continue;
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        if (![...range.getClientRects()].some((r) => r.width > 0 && r.height > 0)) continue; // 그려지지 않은 글자
        const block = blockOf(parent);
        if (lastBlock !== null && block !== lastBlock) out.push('\n');
        out.push(node.data);
        lastBlock = block;
      }
      return norm(out.join(''));
    };
    const all = (sel: string, within: ParentNode = slide): Element[] => [...within.querySelectorAll(sel)].filter((e) => isVisible(e));
    const lines = (sel: string): string[] => all(sel).map((e) => textOf(e)).filter((t) => t !== '');
    const basisEl = slide.querySelector('[data-testid="slide-basis-line"]');
    const statEl = slide.querySelector('[data-testid="slide-basis"]');
    const valueEls = all('.slide__value');
    const valueLines: Array<{ label: string | null; text: string; unit: string }> = [];
    for (const v of valueEls) {
      const hvs = [...v.querySelectorAll('.slide__hv')];
      if (hvs.length > 0) {
        for (const hv of hvs) {
          const unitEl = hv.querySelector('.slide__unit');
          valueLines.push({ label: textOf(hv.querySelector('.slide__label')!) || null, text: textOf(hv.querySelector('.slide__num')!), unit: unitEl === null ? '' : textOf(unitEl) });
        }
      } else {
        const unitEl = v.querySelector('.slide__unit');
        valueLines.push({ label: null, text: textOf(v), unit: unitEl === null ? '' : textOf(unitEl) });
      }
    }
    return {
      id: slide.getAttribute('data-slide-id') ?? '',
      insight: textOf(slide.querySelector('h3')!),
      official: textOf(slide.querySelector('.slide__official')!),
      captions: lines('.slide__caption'),
      valueLines,
      sideLines: lines('.slide__side'),
      basisLines: basisEl === null ? [] : textOf(basisEl).split('\n'),
      statLines: statEl === null ? [] : textOf(statEl).split('\n'),
      legend: lines('.legend li'),
      metas: lines('.slide__meta'),
      chips: lines('.slide__chips'),
      projNotes: lines('.slide__projnote'),
      definition: textOf(slide.querySelector('p.t-muted')!),
      chartTexts: all('svg.chart text').map((t) => (t.textContent ?? '').trim()),
      all: textOf(slide),
    };
  });
}

/** 슬라이드 하나에 화면이 보여야 할 것 — 앱의 모델(`buildCarousel()`·`titleIndicators()`)에서 가져온다(fetchExpected) */
export interface ExpectedSlide {
  id: string;
  /** 표제어 (모델의 `insight`) */
  insight: string;
  /** 공식 통계명 줄 글자 (모델의 `officialText`) */
  officialText: string;
  /** 지표의 기준 연도(latest.year) */
  year: number;
  chartKind: 'line' | 'bar' | 'bars' | 'stack';
  /** 공식 전망 슬라이드면 모델이 정한 칩 글자·한 줄 안내·발표일(아니면 null) */
  projection?: { chip: string; note: string; releasedOn: string } | null;
  scopeLabel: string | null;
  /** 제목에 이름이 든 지표들 (QM2-11 규칙 3) */
  titleIndicators: Array<{ name: string; kind: 'main' | 'extra'; valueText: string; valueGlyph: string }>;
  /** 큰 값 아래 줄에 보여야 하는 글자 (「조혼인율 인구 1천 명당 4.7건」) */
  sideTexts: string[];
}

/**
 * 개발 서버(Vite)의 모듈을 브라우저 안에서 불러 앱 자신의 모델에서 기대값을 만든다 — Playwright는 데이터 JSON을 가져올 수 없어서(import 속성 필요) 같은 계산을 앱 안에서 한다.
 * 모델이 만든 값이 화면 DOM에 **그려졌는가**를 보는 것이 이 e2e의 일이다(모델 자체는 tests/carousel.test.ts가 본다).
 */
export async function fetchExpected(page: Page): Promise<ExpectedSlide[]> {
  return page.evaluate(async () => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
    const m = await load('/src/core/carousel.ts');
    const inds: any[] = m.selectCarouselIndicators();
    const slides: any[] = m.buildCarousel().slides;
    return slides.map((s) => {
      const ind = inds.find((i) => i.id === s.id);
      return {
        id: s.id,
        insight: s.insight,
        officialText: s.officialText,
        year: ind.latest.year,
        chartKind: s.chart.kind,
        projection: s.projection,
        scopeLabel: ind.scopeLabel ?? null,
        titleIndicators: m.titleIndicators(ind).map((t: any) => ({ name: t.name, kind: t.kind, valueText: t.valueText, valueGlyph: t.valueGlyph })),
        sideTexts: s.sideValues.map((v: any) => v.text),
      };
    });
  });
}

const flat = (t: string): string => t.replace(/\s+/g, ' ').trim();

/** 화면 글자가 금지 패턴·형식표·「제목이 약속한 값은 눈에 보인다」를 지키는가. 위반 목록(비면 통과). `label`은 어느 조건인지(폭·글자·장). */
export function checkSlideDom(dom: SlideDom, expected: ExpectedSlide, label: string): string[] {
  const out: string[] = [];
  const bad = (msg: string) => out.push(`${label} ${dom.id}: ${msg}`);

  // 1) 금지 패턴 — 눈에 보이는 글자 전부와 구성 요소마다(어느 곳인지 알려 주려고)
  const groups: Array<[string, string]> = [
    ['표제어', dom.insight],
    ['공식 통계명 줄', dom.official],
    ['캡션', dom.captions.join(' ')],
    ['값 줄', dom.valueLines.map((v) => `${v.label ?? ''} ${v.text}`).join(' / ')],
    ['보조 값 줄', dom.sideLines.join(' / ')],
    ['기준 줄', dom.basisLines.join(' ')],
    ['통계 기준 줄', dom.statLines.join(' ')],
    ['범례', dom.legend.join(' / ')],
    ['계열 설명·출처', dom.metas.join(' / ')],
    ['정의', dom.definition],
    ['그래프 글자', dom.chartTexts.join(' ')],
    ['전체', flat(dom.all)],
  ];
  for (const [where, text] of groups) for (const name of forbiddenIn(text)) bad(`${where}에 금지 패턴(${name}): 「${text.slice(0, 70)}」`);

  // 2) 형식표 A·B·C·D (QM2-4 b)
  const form = SLIDE_FORMS[dom.id];
  const yearOf = String(expected.year);
  if (form === undefined) bad('형식표(SLIDE_FORMS)에 없는 슬라이드다 — 새 지표는 형식을 정해야 한다');
  else {
    for (const v of dom.valueLines) {
      if (!VALUE_LINE.test(v.text)) bad(`값 줄 「${v.text}」이 「숫자 + 단위 낱말」 모양이 아니다`);
      if (v.unit !== '' && !UNIT_WORD.test(v.unit)) bad(`값 바로 옆 단위 칸 「${v.unit}」이 단위 낱말 하나가 아니다`);
    }
    if (form === 'A' || form === 'B') {
      if (dom.valueLines.length !== 1) bad(`형식 ${form}인데 값 줄이 ${dom.valueLines.length}개다`);
    }
    // SPEC-005 copy.md 9-1·9-2: 표제어와 공식 통계명 줄은 모델의 글자 그대로 그려지고, 기준 연도(월)·범위는 공식 통계명 줄 끝 괄호가 말한다(연도만 있던 기준 줄은 없다)
    if (flat(dom.insight) !== flat(expected.insight)) bad(`표제어가 모델과 다르다: 「${flat(dom.insight)}」 ≠ 「${expected.insight}」`);
    if (/[0-9]/.test(dom.insight)) bad(`표제어에 숫자가 있다(SH2 ③): 「${dom.insight}」`);
    if (flat(dom.official) !== flat(expected.officialText)) bad(`공식 통계명 줄이 모델과 다르다: 「${flat(dom.official)}」 ≠ 「${expected.officialText}」`);
    if (form === 'P') {
      // 공식 전망 (QI4 FC2): 「이름(2023년 발표, 2022년 기준[, 시나리오])」 · 칩 「전망」 · 한 줄 안내가 눈에 보인다 — 칩은 색 + 글자 + 아이콘이고 글자는 이 시험이 본다
      if (!/\(\d{4}년 발표, [^()]+ 기준(, [^()]+)?\)$/.test(flat(dom.official))) bad(`공식 전망 통계명 줄 모양(「이름(발표 연도 발표, 기준 기준[, 시나리오])」): 「${flat(dom.official)}」`);
      if ((dom.chips ?? []).join(' ') !== (expected.projection?.chip ?? '전망')) bad(`전망 칩 글자가 「전망」이 아니다: 「${(dom.chips ?? []).join(' ')}」`);
      if ((dom.projNotes ?? []).map(flat).join(' ') !== flat(expected.projection?.note ?? '')) bad(`전망 한 줄 안내가 모델과 다르다: 「${(dom.projNotes ?? []).join(' ')}」`);
    } else {
      if (!/\(\d{4}년( \d{1,2}월)?(, [^()]+)?\)$/.test(flat(dom.official))) bad(`공식 통계명 줄 모양(「이름(기준)」): 「${flat(dom.official)}」`);
      if ((dom.chips ?? []).length !== 0) bad(`전망이 아닌 슬라이드에 칩이 있다: 「${(dom.chips ?? []).join(' ')}」`);
    }
    if (form === 'E') {
      if (dom.valueLines.map((v) => v.label).join(',') !== '66세 이상,18~65세') bad(`형식 E 값 라벨이 「66세 이상·18~65세」가 아니다: ${dom.valueLines.map((v) => v.label).join(',')}`);
      if (!dom.valueLines.every((v) => /배$/.test(v.text))) bad('형식 E 값이 「…배」가 아니다');
      if (dom.sideLines.length !== 2) bad(`형식 E 보조 문장이 둘이 아니다: ${dom.sideLines.length}개`);
      if (dom.basisLines.length !== 0) bad(`형식 E에 기준 줄이 남아 있다: 「${dom.basisLines.join(' / ')}」`);
    }
    if (form === 'A' || form === 'C') {
      if (dom.basisLines.length !== 0) bad(`형식 ${form}에 기준 줄이 남아 있다(연도는 공식 통계명 줄이 맡는다): 「${dom.basisLines.join(' / ')}」`);
    }
    if (form === 'C') {
      if (dom.valueLines.map((v) => v.label).join(',') !== '남자,여자') bad(`형식 C 값 라벨이 「남자·여자」가 아니다: ${dom.valueLines.map((v) => v.label).join(',')}`);
      if (!dom.valueLines.every((v) => /세$/.test(v.text))) bad('형식 C 값이 「…세」가 아니다');
    } else if (form === 'B') {
      if (dom.valueLines[0] !== undefined && !/명$/.test(dom.valueLines[0].text)) bad(`형식 B 값 줄이 「…명」이 아니다: 「${dom.valueLines[0].text}」`);
      // 기준 줄은 분모만 한 줄 — 연도가 섞이면(옛 「인구 N 명당 · 2025년 기준」) 걸린다
      if (dom.basisLines.length !== 1 || !BASIS_B.test(dom.basisLines[0])) bad(`형식 B 기준 줄이 「인구 N 명당」(분모만, 한 줄)이 아니다: 「${dom.basisLines.join(' / ')}」`);
    } else if (form === 'D') {
      // D: 그래프가 주인공 — 전국 값(캡션 + 값 + 단위)은 두고, 연도(월)·범위는 공식 통계명 줄이 데이터의 범위 문구(scopeLabel)에서 말한다. 기준 줄은 없다
      if (expected.chartKind !== 'bar') bad('형식 D인데 막대 그래프가 아니다');
      if (dom.captions.length === 0) bad('형식 D 전국 값의 캡션이 없다');
      if (dom.basisLines.length !== 0) bad(`형식 D에 기준 줄이 남아 있다: 「${dom.basisLines.join(' / ')}」`);
      const when = expected.scopeLabel === null ? null : /^(\d{4}년(?: \d{1,2}월)?) 기준/.exec(expected.scopeLabel)?.[1];
      if (when !== undefined && when !== null && !flat(dom.official).includes(`(${when}`)) bad(`형식 D 공식 통계명 줄에 범위 문구의 기준 「${when}」이 없다: 「${flat(dom.official)}」`);
    }
  }

  // 3) 기준 연도는 한 값에서 나온다 (QM2-4 규칙 4 · SPEC-005 SH3): 공식 통계명 줄·기준 줄·「통계 기준」 줄·그래프 가로축 끝
  if (form !== 'P') {
    for (const text of [dom.official, dom.basisLines.join(' '), dom.statLines.join(' ')]) {
      for (const m of text.matchAll(/(\d{4})년/g)) if (m[1] !== yearOf) bad(`기준 연도 ${m[1]}이(가) latest.year(${yearOf})와 다르다: 「${text}」`);
    }
    if (!/^통계 기준: \d{4}년 · 마지막 갱신 \d{4}-\d{2}-\d{2}$/.test(dom.statLines.join(' · '))) bad(`「통계 기준」 줄 모양: 「${dom.statLines.join(' / ')}」`);
  } else {
    // 전망은 기준 표기가 발표일이다(마스터 결정 8): 「발표: 2023-12-14 · 마지막 갱신 …」 — 연도는 자리마다 출처가 하나(단일 출처 규칙, tests/statHeadlines.test.ts)
    if (!/^발표: \d{4}-\d{2}-\d{2} · 마지막 갱신 \d{4}-\d{2}-\d{2}$/.test(dom.statLines.join(' · '))) bad(`전망 기준 줄 모양(「발표: … · 마지막 갱신 …」): 「${dom.statLines.join(' / ')}」`);
    if (expected.projection !== undefined && expected.projection !== null && !dom.statLines.join(' ').includes(expected.projection.releasedOn)) bad(`기준 줄에 발표일 ${expected.projection.releasedOn}이 없다: 「${dom.statLines.join(' / ')}」`);
  }
  if (expected.chartKind === 'line' && !dom.chartTexts.includes(yearOf)) bad(`그래프 가로축 끝 글자(${yearOf})가 화면에 없다`);

  // 4) 제목에 이름이 든 지표마다 그 값이 눈에 보이는 글자에 있다 (QM2-11 규칙 3). 대체 텍스트·숨긴 표는 세지 않는다(dom.all은 보이는 글자뿐이다)
  const visible = flat(dom.all);
  for (const t of expected.titleIndicators) {
    if (!visible.includes(t.valueGlyph)) bad(`제목에 이름이 든 「${t.name}」의 값 「${t.valueGlyph}」이 눈에 보이는 글자에 없다`);
  }
  for (const text of expected.sideTexts) {
    if (!dom.sideLines.map(flat).includes(text)) bad(`큰 값 아래 줄에 「${text}」가 없다 (있는 줄: ${dom.sideLines.join(' / ') || '없음'})`);
    if (!visible.includes(text)) bad(`「${text}」가 눈에 보이는 글자에 없다`);
  }
  return out;
}
