import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import copyMd from '../docs/design/copy.md?raw';
import mockupTitle from '../docs/design/mockups/title-a.html?raw';
import titleScreenSrc from '../src/screens/TitleScreen.tsx?raw';
import barReleaseSrc from '../src/ui/barRelease.ts?raw';
import { BUILD_LABEL } from '../src/buildInfo';
import { CAROUSEL_MAX_DOTS, SELECTABLE_LIFE_LENGTHS, buildCarousel, formatCount, virtualPopulation, type CarouselData, type Era, type LifeLength } from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { ICON_IDS, SPOON_IDS, SPOON_LG_IDS, SPRITE_SVG } from '../src/ui/brandAssets';
import { LIFE_LENGTH_TEXT, NOT_READY_TEXT, TITLE_TEXT, eraMetaText, footerStatsText, heroTagKeepParts } from '../src/data/titleText';
import { TitleScreen, type TitleSaved } from '../src/screens/TitleScreen';

/**
 * 첫 화면의 구성 (SPEC-003 FS1~FS8, VP2, SC6). 서버 렌더로 마크업을 본다 — 실제 폭·스크롤·동작은 e2e/first-screen.spec.ts.
 * 시각은 고정해서(minute) 가상 인구를 결정적으로 만든다.
 */

const MINUTE = 29_850_000; // 2026-10-21 근처
const saved: TitleSaved = { onResume: () => {}, onBeginNew: () => {} };

function render(over: Partial<{ era: Era; lifeLength: LifeLength; saved: TitleSaved | null; oldSaveNotice: boolean; minute: number; carousel: CarouselData }> = {}): string {
  return renderToStaticMarkup(
    <TitleScreen
      era={over.era ?? 'present'}
      lifeLength={over.lifeLength ?? 'short30'}
      onSelectEra={() => {}}
      onSelectLifeLength={() => {}}
      onBegin={() => {}}
      saved={over.saved ?? null}
      oldSaveNotice={over.oldSaveNotice ?? false}
      minute={over.minute ?? MINUTE}
      carousel={over.carousel}
    />,
  );
}

const text = (html: string): string =>
  html
    // 줄바꿈 묶음(QM2-5, ui/Glue.tsx)의 span은 글자를 바꾸지 않는 표시일 뿐이라 벗겨 낸다 — 태그를 공백으로 바꾸는 아래 규칙이 묶음 안에 공백을 넣어 「(2026-10-15 조회)」가 「( 2026-10-15 조회)」로 읽히지 않게
    .replace(/<span class="nowrap">([^<]*)<\/span>/g, '$1')
    .replace(/<span class="keep-phrase">([^<]*)<\/span>/g, '$1')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ');

/** 태그 속성을 뺀 글자만(태그 사이에 공백을 넣지 않는다): <strong>51,116</strong>명 → 51,116명 */
const plain = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&');

/** data-testid로 라디오 입력 태그 하나를 꺼낸다 (React가 속성을 적는 순서에 기대지 않는다) */
function radio(html: string, testId: string): { checked: boolean; name: string; value: string } {
  const tag = new RegExp(`<input [^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0];
  if (tag === undefined) throw new Error(`라디오 없음: ${testId}`);
  return { checked: /\schecked(=|\s|\/|>)/.test(tag), name: /name="([^"]*)"/.exec(tag)![1], value: /value="([^"]*)"/.exec(tag)![1] };
}

describe('서버 렌더 (수집 시점 출력 금지)', () => {
  it('첫 화면을 서버 렌더해도 콘솔에 아무것도 내지 않는다 — 이 파일의 describe 본문은 수집(import) 시점에 렌더하고, 그때의 console 출력(예: React 18의 useLayoutEffect 서버 경고)은 vitest list --json의 리포터를 죽여 check:todo가 실패한다', () => {
    const spies = (['error', 'warn', 'log', 'info', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    try {
      for (const over of [{}, { saved }, { oldSaveNotice: true }, { era: 'past' as const }]) render(over);
      for (const spy of spies) expect(spy.mock.calls, String(spy.getMockName())).toEqual([]);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe('첫 화면 구성 (FS1)', () => {
  const html = render();

  it('위에서부터: 로고(제목) → 한 줄 설명 → 수저 다섯 자루 → 가상 인구 문구와 보조 문구 → 태어날 세상 → 인생 길이, 오른쪽(좁으면 아래)에 캐러셀, 푸터, 하단 고정 버튼', () => {
    const order = ['data-testid="title-heading"', 'hero__tag', 'data-testid="spoon-lineup"', 'data-testid="population-line"', 'data-testid="population-note"', 'data-testid="era-group"', 'data-testid="life-length-group"', 'data-testid="carousel"', 'data-testid="title-foot"', 'data-testid="bottom-bar"'];
    const at = order.map((k) => html.indexOf(k));
    for (const [i, k] of order.entries()) expect(at[i], k).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < at.length; i++) expect(at[i], `${order[i - 1]} → ${order[i]}`).toBeGreaterThan(at[i - 1]);
  });

  it('게임명 「수저 게임」이 제목(h1)의 읽히는 글자로 있고, 로고는 세로·가로 두 벌(모바일/데스크톱)이 장식으로 들어 있다', () => {
    expect(html).toMatch(/<h1[^>]*data-testid="title-heading"[^>]*><span class="sr-only">수저 게임<\/span>/);
    expect(html).toContain('data-testid="title-logo-stacked"');
    expect(html).toContain('data-testid="title-logo-row"');
    expect(html.match(/viewBox="0 0 309\.3 248"/g)?.length).toBe(1); // 세로 로고
    expect(html).toContain('viewBox="0 0 443.8 128"'); // 가로 로고
  });

  it('수저 다섯 단계: 이름이 글자로 있고(색에만 의존하지 않는다) 큰 변형 도형(sp-1-lg~sp-5-lg, 32px 이상)을 쓴다 — 칩 변형(sp-N)은 쓰지 않는다', () => {
    for (const name of ['흙수저', '동수저', '은수저', '금수저', '다이아몬드']) expect(html).toContain(name);
    for (const id of SPOON_LG_IDS) expect(html).toContain(`href="#${id}"`);
    for (const id of SPOON_IDS) expect(html, `${id}는 칩(<= 24px)용이다`).not.toContain(`href="#${id}"`);
    expect(html).toContain('aria-label="수저 다섯 단계: 흙수저, 동수저, 은수저, 금수저, 다이아몬드수저"');
  });

  it('사용하는 아이콘·수저 스프라이트 id가 디자이너 자산에 모두 있다 (도형 내용은 점검하지 않는다)', () => {
    for (const id of [...ICON_IDS, ...SPOON_IDS, ...SPOON_LG_IDS]) expect(SPRITE_SVG, id).toContain(`id="${id}"`);
  });

  it('이전의 「시작」 버튼과 시대 선택 화면은 없다', () => {
    expect(html).not.toContain('era-screen');
    expect(html).not.toContain('confirm-era');
    expect(text(html)).not.toMatch(/어느 세상에서 태어날까|이 세상에서 태어나기/);
    expect(html).not.toMatch(/>시작</);
  });
});

describe('가상 인구 문구 (FS2·VP2)', () => {
  it('형진 님 지정 문구 「{N}명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요.」, N은 천 단위 쉼표의 가상 인구 값', () => {
    const html = render();
    const n = formatCount(virtualPopulation(MINUTE));
    expect(n).toMatch(/^5\d,\d{3}$/);
    // 「{N}명」이 함께 굵고(시안 title-a.html의 <strong>51,284명</strong>이 …, R-209), 숫자만 따로 읽을 수 있게 안쪽 span에 testid
    expect(html).toContain(`<strong><span data-testid="population-count">${n}</span>명</strong>이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요.`);
    expect(plain(html)).toContain(`${n}명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요.`);
    expect(mockupTitle).toMatch(/<p class="hero__pop"><strong>[\d,]+명<\/strong>이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요\.<\/p>/); // 시안과 같은 구조
  });

  it('근거 통계를 읽을 수 없어도(가상 인구 모델을 만들 수 없어도) 첫 화면은 뜨고 가상 인구 줄과 보조 문구만 빠진다 (R-211: 흰 화면·오류 화면이 되지 않는다)', async () => {
    vi.resetModules();
    vi.doMock('../src/data/koreaStatsAccess', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/data/koreaStatsAccess')>()), getUsableIndicator: () => undefined }));
    try {
      const { TitleScreen: BrokenInputsTitle } = await import('../src/screens/TitleScreen');
      const html = renderToStaticMarkup(
        <BrokenInputsTitle era="present" lifeLength="short30" onSelectEra={() => {}} onSelectLifeLength={() => {}} onBegin={() => {}} minute={MINUTE} />,
      );
      expect(html).toContain('data-testid="title-heading"');
      expect(html).toContain('data-testid="start-birth"');
      expect(html).toContain('data-testid="carousel"');
      expect(html).not.toContain('data-testid="population-line"');
      expect(html).not.toContain('data-testid="population-note"');
      expect(html).not.toMatch(/NaN|undefined/);
    } finally {
      vi.doUnmock('../src/data/koreaStatsAccess');
      vi.resetModules();
    }
  });

  it('같은 시각이면 같은 값, 시각이 다르면 값이 달라질 수 있다 (분 단위)', () => {
    expect(render({ minute: MINUTE })).toBe(render({ minute: MINUTE }));
    const values = new Set(Array.from({ length: 30 }, (_, i) => virtualPopulation(MINUTE + i)));
    expect(values.size).toBeGreaterThan(3);
    expect(render({ minute: MINUTE })).not.toBe(render({ minute: MINUTE + 7 }));
  });

  it('보조 문구는 항상 보인다 (세상·인생 길이·이어하기 상태와 무관하게): 가상의 사람들이며 실제 사람 수가 아니다', () => {
    for (const over of [{}, { era: 'past' as const }, { era: 'future' as const }, { saved }, { oldSaveNotice: true }]) {
      const html = render(over);
      expect(html).toContain(`data-testid="population-note">${TITLE_TEXT.populationNote}`);
      expect(TITLE_TEXT.populationNote).toContain('가상');
      expect(TITLE_TEXT.populationNote).toContain('실제로 게임하는 사람 수가 아니에요');
    }
  });

  it('가상 인구 설명이 푸터에 한 곳 있다 (규모의 근거·반영한 통계·서버와 통신하지 않음)', () => {
    const html = render();
    expect(html).toContain('data-testid="population-info"');
    expect(TITLE_TEXT.populationInfo).toContain('1,000분의 1');
    expect(TITLE_TEXT.populationInfo).toContain('출생·사망 통계');
    expect(TITLE_TEXT.populationInfo).toContain('서버와 통신하지 않고');
  });

  it('어느 상태의 화면에도 「접속자」「동시 접속」 표현이 없다 (VP2) — 문구 상수 전체와 마크업 전체를 점검', () => {
    const banned = /접속자|동시\s*접속|접속\s*중|접속한/;
    const all = [render(), render({ saved }), render({ oldSaveNotice: true }), render({ era: 'future' })];
    for (const html of all) expect(text(html)).not.toMatch(banned);
    for (const value of Object.values(TITLE_TEXT)) expect(typeof value === 'string' ? value : value(8)).not.toMatch(banned);
    for (const v of Object.values(LIFE_LENGTH_TEXT)) expect(`${v.title} ${v.desc}`).not.toMatch(banned);
  });
});

describe('태어날 세상·인생 길이 선택 (FS4·FS5)', () => {
  it('세상 3개를 라디오 카드로 보인다(radiogroup, 이름·연도 안내·한 줄 설명), 기본은 지금 세상', () => {
    const html = render();
    expect(html).toMatch(/role="radiogroup" aria-label="태어날 세상"/);
    for (const era of ['past', 'present', 'future'] as const) {
      expect(html).toContain(`data-testid="era-${era}"`);
      expect(text(html)).toContain(ERA_CONFIG[era].label);
      expect(text(html)).toContain(ERA_CONFIG[era].blurb);
    }
    expect(radio(html, 'era-present')).toEqual({ checked: true, name: 'era', value: 'present' });
    expect(radio(html, 'era-past')).toEqual({ checked: false, name: 'era', value: 'past' });
    expect(radio(html, 'era-future')).toEqual({ checked: false, name: 'era', value: 'future' });
  });

  it('선택 상태는 색에만 의존하지 않는다: 체크 표시(아이콘)와 「선택됨」 글자가 선택된 카드에만 있다', () => {
    for (const era of ['past', 'present', 'future'] as const) {
      const html = render({ era });
      expect(html.match(/is-selected/g)?.length).toBe(2); // 세상 1 + 인생 길이 1
      expect(html.match(/<span class="sr-only">선택됨<\/span>/g)?.length).toBe(2);
      for (const other of ['past', 'present', 'future'] as const) expect(radio(html, `era-${other}`).checked, `${era} 선택 → ${other}`).toBe(other === era);
    }
  });

  it('카드의 연도 안내는 출생 로직의 연도 범위(ERA_CONFIG)에서 만든다: 지금 세상은 출생 연도가 2026 한 해일 때만 「올해(2026) 태어나는 아이」, 그 전에는 실제 범위 (형진 님 결정 Q1, R-201)', () => {
    const html = render();
    // 카드에 보이는 문구 ⇔ ERA_CONFIG (이 단언이 바뀐 이유: 예전에는 지금 세상 카드가 범위와 무관하게 「올해(2026)」를 적어 출생 화면의 연도와 모순이었다)
    for (const era of ['past', 'present', 'future'] as const) {
      const { min, max } = ERA_CONFIG[era].birthYears;
      const expected = era === 'present' && min === 2026 && max === 2026 ? '올해(2026) 태어나는 아이' : min === max ? `${min}년생` : `${min}~${max}년생`;
      expect(eraMetaText(era, ERA_CONFIG[era].birthYears), era).toBe(expected);
      expect(html, era).toContain(`<span class="radio-card__meta">${expected}</span>`);
    }
    // 지금 세상은 실제 범위가 2026 한 해가 아닌 동안 「올해(2026)」를 적지 않는다 — M3가 범위를 2026으로 고정하면 이 단언이 문구를 바꿔 따라온다
    const present = ERA_CONFIG.present.birthYears;
    expect(text(html).includes('올해(2026) 태어나는 아이')).toBe(present.min === 2026 && present.max === 2026);
    // 합성 범위: 규칙 자체
    expect(eraMetaText('present', { min: 2026, max: 2026 })).toBe('올해(2026) 태어나는 아이');
    expect(eraMetaText('present', { min: 2008, max: 2025 })).toBe('2008~2025년생');
    expect(eraMetaText('present', { min: 2008, max: 2026 })).toBe('2008~2026년생');
    expect(eraMetaText('present', { min: 2025, max: 2025 })).toBe('2025년생');
    expect(eraMetaText('future', { min: 2026, max: 2026 })).toBe('2026년생'); // 「올해」 문구는 지금 세상 전용
    expect(eraMetaText('past', ERA_CONFIG.past.birthYears)).toBe('1950~1989년생');
    expect(text(html)).toContain('1950~1989년생');
    expect(text(html)).toContain('2030~2060년생');
  });

  it('세상 카드의 한 줄 설명은 시안(title-a.html)과 같다 — 다가올 세상도 「…고들 합니다」 (R-209)', () => {
    for (const era of ['past', 'present', 'future'] as const) {
      expect(mockupTitle, era).toContain(`<span class="radio-card__desc">${ERA_CONFIG[era].blurb}</span>`);
      expect(mockupTitle, era).toContain(`<span class="radio-card__title">${ERA_CONFIG[era].label}</span>`);
    }
  });

  it('인생 길이: 「약 30분」/「약 1시간」 라디오 카드, 기본 약 30분, 한 줄 설명(저장 안내)', () => {
    const html = render();
    expect(html).toMatch(/role="radiogroup" aria-label="인생 길이"/);
    expect(radio(html, 'life-short30')).toEqual({ checked: true, name: 'lifeLength', value: 'short30' });
    expect(radio(html, 'life-long60')).toEqual({ checked: false, name: 'lifeLength', value: 'long60' });
    expect(text(html)).toContain('약 30분');
    expect(text(html)).toContain('약 1시간');
    expect(text(html)).toContain(TITLE_TEXT.lifeLengthHint);
    expect(TITLE_TEXT.lifeLengthHint).toContain('이 기기에 남습니다'); // 도중에 나가도 진행은 이 기기에 남는다는 뜻 (FS5)
  });

  /** 입력 태그 하나에서 disabled 속성 여부 */
  const isDisabled = (html: string, testId: string): boolean => /\sdisabled(=|\s|\/|>)/.test(new RegExp(`<input [^>]*data-testid="${testId}"[^>]*>`).exec(html)![0]);

  it('「약 1시간」 카드는 보이되 선택할 수 없고 「준비 중」이 적혀 있다. 라디오 그룹 안에 그대로 있고 비활성 이유는 카드 글(접근 가능한 이름)에 들어 있다 (R-202)', () => {
    expect(SELECTABLE_LIFE_LENGTHS).toEqual(['short30']);
    const html = render();
    expect(isDisabled(html, 'life-long60')).toBe(true);
    expect(isDisabled(html, 'life-short30')).toBe(false);
    expect(NOT_READY_TEXT).toBe('준비 중');
    // 카드(label) 하나 안에 라디오·제목·준비 중·설명이 모두 들어 있다 → 라디오의 접근 가능한 이름은 「약 1시간 준비 중 결정을 더 많이」
    const label = /<label class="radio-card is-disabled">(?:(?!<\/label>)[\s\S])*?data-testid="life-long60"(?:(?!<\/label>)[\s\S])*?<\/label>/.exec(html)?.[0];
    expect(label, '비활성 카드 마크업').toBeDefined();
    expect(text(label!)).toContain(LIFE_LENGTH_TEXT.long60.title);
    expect(text(label!)).toContain(NOT_READY_TEXT);
    expect(text(label!)).toContain(LIFE_LENGTH_TEXT.long60.desc);
    expect(label).toContain(`<span class="radio-card__meta">${NOT_READY_TEXT}</span>`);
    // 라디오 그룹은 그대로 2개 — 카드를 숨기지 않는다
    expect(html.match(/name="lifeLength"/g)?.length).toBe(2);
    expect(html).toMatch(/role="radiogroup" aria-label="인생 길이"/);
    // 선택할 수 있는 카드에는 준비 중 표기가 없다
    expect(html.match(new RegExp(NOT_READY_TEXT, 'g'))?.length).toBe(1);
    // 세상 카드는 모두 선택할 수 있다
    for (const era of ['past', 'present', 'future']) expect(isDisabled(html, `era-${era}`), era).toBe(false);
  });
});

describe('하단 고정 「태어나기」와 이어하기 (FS6)', () => {
  it('저장된 판이 없으면 하단 띠에 「태어나기」 하나만 있다', () => {
    const html = render();
    const bar = html.slice(html.indexOf('data-testid="bottom-bar"'));
    expect(bar).toContain('data-testid="start-birth"');
    expect(text(bar)).toContain('태어나기');
    expect(bar).not.toContain('data-testid="resume"');
    expect(bar).not.toContain('data-testid="begin-new"');
  });

  it('진행 중인 저장이 있으면(첫 화면을 다시 연 상태) 같은 자리에 「이어서 살기」가 기본 버튼, 「새로 태어나기」는 보조 버튼이다', () => {
    const html = render({ saved });
    const bar = html.slice(html.indexOf('data-testid="bottom-bar"'));
    expect(bar).not.toContain('data-testid="start-birth"');
    expect(bar).toMatch(/btn btn--primary btn--lg"[^>]*data-testid="resume"[^>]*>이어서 살기</);
    expect(bar).toMatch(/btn btn--ghost btn--sm"[^>]*data-testid="begin-new"[^>]*>새로 태어나기</);
    expect(bar.indexOf('data-testid="resume"')).toBeLessThan(bar.indexOf('data-testid="begin-new"'));
    // 이전 판이 사라진다는 확인은 「새로 태어나기」를 누른 뒤에 뜬다(상호작용은 e2e)
    expect(bar).not.toContain('confirm-new-ask');
  });

  it('본문이 하단 띠에 가리지 않도록 끝에 여백(page-end-space)이 있고, 그 높이는 하단 띠의 실제 높이(--bar-h)를 따른다 — 상태마다 다른 띠 높이를 고정값으로 가정하지 않는다 (R-203)', () => {
    const html = render();
    expect(html.indexOf('page-end-space')).toBeGreaterThan(html.indexOf('data-testid="title-foot"'));
    expect(html.indexOf('page-end-space')).toBeLessThan(html.indexOf('data-testid="bottom-bar"'));
    // 여백의 높이(CSS `height: calc(var(--bar-h) + …)`)와 상태별 띠 높이 대조는 실제 브라우저에서 잰다(e2e/first-screen.spec.ts 「하단 고정(FS6)」 — vitest는 CSS를 읽지 못한다)
  });

  it('하단 띠의 높이를 재서 --bar-h로 알리는 곳이 첫 화면에 있고, 확인 단계도 같은 띠 안에서 열린다 (ResizeObserver, R-203)', () => {
    // 측정은 공용 감시자(ui/barRelease.ts#watchBarRelease)가 한다 — 첫 화면이 그것을 띠에 걸고, 감시자가 ResizeObserver로 재서 --bar-h를 알린다 (M3·M4 재사용을 위해 R-240에서 옮겼다)
    expect(titleScreenSrc).toContain('watchBarRelease(bar,');
    expect(barReleaseSrc).toContain('ResizeObserver');
    expect(barReleaseSrc).toContain("setProperty('--bar-h'");
    expect(titleScreenSrc).not.toContain('is-confirming'); // 확인 단계만 따로 고정한 여백 클래스는 없다
  });
});

describe('이전 버전 저장 안내 (C6)', () => {
  it('이전 버전(v4 이하) 저장을 버렸을 때만 안내 한 줄이 뜬다', () => {
    expect(render()).not.toContain('data-testid="old-save-notice"');
    const html = render({ oldSaveNotice: true });
    expect(html).toMatch(/role="status" data-testid="old-save-notice">이전 버전에서 저장된 판은 이어서 할 수 없어 새 게임으로 시작합니다\./);
  });
});

describe('캐러셀과 푸터 (FS3·FS7·SC)', () => {
  const html = render();
  const data = buildCarousel();

  it('모든 슬라이드가 마크업에 있고(전환은 보이기/숨기기), 첫 슬라이드가 현재이며, 위치는 「1 / 14」 한 줄이다. 지표가 6개 이상이면 점은 그리지 않는다(R-133)', () => {
    expect(html.match(/data-testid="stat-slide"/g)?.length).toBe(data.slides.length);
    expect(html.match(/class="slide is-active"/g)?.length).toBe(1);
    expect(data.slides.length).toBeGreaterThan(CAROUSEL_MAX_DOTS);
    expect(html).not.toContain('data-testid="carousel-dots"');
    expect(html).not.toMatch(/data-testid="carousel-dot-\d+"/);
    expect(html).toContain(`aria-label="1/${data.slides.length} ${data.slides[0].title}"`); // 슬라이드의 이름은 그대로 「n/N 제목」
    expect(html).toContain(`data-testid="carousel-count" aria-hidden="true">1 / ${data.slides.length}<`);
    expect(text(html)).toContain('7초마다 다음 지표');
  });

  it('슬라이드가 5개 이하일 때만 점을 그리고, 점 버튼의 이름은 「3/5 제목」이다 (R-133)', () => {
    const few: CarouselData = { ...data, slides: data.slides.slice(0, CAROUSEL_MAX_DOTS) };
    const dotsHtml = render({ carousel: few });
    expect(dotsHtml).toContain('data-testid="carousel-dots"');
    expect(dotsHtml.match(/data-testid="carousel-dot-\d+"/g)?.length).toBe(CAROUSEL_MAX_DOTS);
    expect(dotsHtml).toContain(`aria-label="3/${CAROUSEL_MAX_DOTS} ${few.slides[2].title}"`);
    expect(dotsHtml.match(/aria-current="true"/g)?.length).toBe(1);
    // 6개부터는 점이 없다
    const many: CarouselData = { ...data, slides: data.slides.slice(0, CAROUSEL_MAX_DOTS + 1) };
    expect(render({ carousel: many })).not.toContain('data-testid="carousel-dots"');
    // 하나뿐이면 점도 없다
    expect(render({ carousel: { ...data, slides: data.slides.slice(0, 1) } })).not.toContain('data-testid="carousel-dots"');
  });

  it('막대 그래프(시·도별)는 값 16~17개 전부를 시각적으로 숨긴 표로도 준다 — 선 그래프에는 표가 없다 (R-207)', () => {
    const bars = data.slides.filter((s) => s.chart.kind === 'bar');
    expect(bars.map((s) => s.id)).toEqual(expect.arrayContaining(['region-population-registered', 'tfr-by-sido']));
    expect(html.match(/data-testid="chart-table"/g)?.length).toBe(bars.length);
    for (const slide of bars) {
      if (slide.chart.kind !== 'bar') throw new Error('bar');
      const start = html.indexOf(`data-slide-id="${slide.id}"`);
      const end = html.indexOf('</article>', start);
      const article = html.slice(start, end);
      expect(article, slide.id).toContain('class="sr-only" data-testid="chart-table"'); // 화면에서는 숨기고 보조기기에는 읽힌다
      expect(article, slide.id).toContain(`<caption>${slide.title} — 큰 값부터</caption>`);
      expect(slide.chart.rows.length, slide.id).toBeGreaterThanOrEqual(16);
      for (const row of slide.chart.rows) {
        expect(article, `${slide.id} ${row.fullLabel}`).toContain(`<th scope="row">${row.fullLabel}</th><td>${row.valueWithUnit}</td>`);
      }
      expect(article.match(/<tr>/g)?.length, slide.id).toBe(slide.chart.rows.length + 1); // 머리 줄 + 값 줄
    }
    // 단위가 붙은 값이다: 인구는 「…명」
    const region = bars.find((s) => s.id === 'region-population-registered')!;
    if (region.chart.kind !== 'bar') throw new Error('bar');
    expect(region.chart.rows[0].valueWithUnit).toBe(`${region.chart.rows[0].text}명`);
    // 선 그래프 슬라이드에는 표가 없다
    const tfr = html.slice(html.indexOf('data-slide-id="tfr"'), html.indexOf('</article>', html.indexOf('data-slide-id="tfr"')));
    expect(tfr).not.toContain('chart-table');
  });

  it('이전·다음·일시정지 버튼과 자동 전환은 스크린리더가 읽지 않는다(aria-live=off)', () => {
    expect(html).toContain('aria-label="이전 지표"');
    expect(html).toContain('aria-label="다음 지표"');
    expect(html).toContain('aria-label="자동 넘김 일시정지"');
    expect(html).toContain('<div class="slides" aria-live="off">');
    expect(html).toContain('aria-roledescription="캐러셀"');
  });

  it('슬라이드마다 출처·기준 연도가 적혀 있고 마지막 갱신일이 보인다 (SC2·SC4)', () => {
    for (const s of data.slides) {
      expect(text(html), s.id).toContain(`출처: ${s.sourceText}`);
      expect(text(html), s.id).toContain(s.basisText);
      expect(text(html), s.id).toContain(s.basisLine); // 「통계 기준: 2025년 · 마지막 갱신 2026-10-15」
    }
    expect(html.match(/data-testid="slide-basis"/g)?.length).toBe(data.slides.length);
  });

  it('자살률 슬라이드 안에 상담전화 안내(109, 24시간)가 있다 (SC6) — 같은 article 안', () => {
    const start = html.indexOf('data-slide-id="suicide-rate"');
    const end = html.indexOf('</article>', start);
    const slide = html.slice(start, end);
    expect(slide).toContain('data-testid="slide-help"');
    expect(slide).toContain('href="tel:109"');
    expect(text(slide)).toContain('자살예방 상담전화 109 (24시간)');
    expect(text(slide)).toContain('27.8');
    expect(text(slide)).toContain('2025년 기준');
    // 다른 슬라이드에는 없다
    expect(html.match(/data-testid="slide-help"/g)?.length).toBe(1);
  });

  it('푸터: 이름 통계 출처, 통계 출처 기관명, 빌드 버전 (FS7)', () => {
    const foot = html.slice(html.indexOf('data-testid="title-foot"'));
    expect(foot).toContain('data-testid="names-credit"');
    expect(text(foot)).toContain('통계 출처: 국가데이터처');
    for (const org of data.orgs) expect(text(foot), org).toContain(org);
    expect(foot).toContain(`data-testid="build-version">${BUILD_LABEL}<`);
    expect(BUILD_LABEL).toMatch(/^v\d+\.\d+\.\d+ \(([0-9a-f]{7}\+?|개발 빌드)\)$/); // 「+」: 커밋 안 된 변경이 있는 로컬 빌드(QM2-7)
  });

  it('외부 요청이 없다 (FS8): 외부 주소로 불러오는 자원(src·stylesheet·script·img)이 마크업에 없고, 링크는 사용자가 누르는 출처 링크뿐이다', () => {
    expect(html).not.toMatch(/<(img|script|iframe|link)\b[^>]*(src|href)="https?:/i);
    expect(html).not.toMatch(/url\(\s*['"]?https?:/i);
    const links = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    for (const href of links) expect(href.startsWith('tel:') || href.startsWith('https://'), href).toBe(true);
  });

  it('이모지·느낌표가 없다 (담담한 어조)', () => {
    for (const h of [html, render({ saved }), render({ oldSaveNotice: true })]) {
      expect(text(h)).not.toMatch(/[!！]/);
      expect(text(h)).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('확인 단계 확정 버튼 문구 (SPEC-003 QM2-6, 마스터 결정 A「이전 판 지우고 태어나기」)', () => {
  it('확정 버튼 이름은 마스터가 고른 「이전 판 지우고 태어나기」이고, 글자는 titleText.ts 한 곳에서만 온다 (하드코딩 없음)', () => {
    expect(TITLE_TEXT.confirmNewYes).toBe('이전 판 지우고 태어나기');
    expect(titleScreenSrc).toContain('{TITLE_TEXT.confirmNewYes}');
    expect(titleScreenSrc).not.toContain('이전 판 지우고');
  });

  it('확정 버튼 ≠ 첫 화면의 보조 버튼 「새로 태어나기」, 확정 ≠ 취소 「돌아가기」 — 방금 누른 버튼이 그대로 남은 것처럼 보이지 않는다', () => {
    expect(TITLE_TEXT.confirmNewYes).not.toBe(TITLE_TEXT.beginNew);
    expect(TITLE_TEXT.beginNew).toBe('새로 태어나기');
    expect(TITLE_TEXT.confirmNewYes).not.toBe(TITLE_TEXT.confirmNewNo);
    expect(TITLE_TEXT.confirmNewNo).toBe('돌아가기');
    // 확인 단계 문구 셋이 서로 다르고, 안내문은 그대로다
    expect(new Set([TITLE_TEXT.beginNew, TITLE_TEXT.confirmNewYes, TITLE_TEXT.confirmNewNo, TITLE_TEXT.confirmNewTitle]).size).toBe(4);
    expect(TITLE_TEXT.confirmNewTitle).toBe('이전 판이 사라집니다. 새로 태어날까요?');
  });

  it('버튼 이름만 읽어도 결과가 드러난다: 무엇을(이전 판) 어떻게 하는지(지움) 그리고 그 뒤(태어남)', () => {
    expect(TITLE_TEXT.confirmNewYes).toMatch(/이전 판/);
    expect(TITLE_TEXT.confirmNewYes).toMatch(/지우/);
    expect(TITLE_TEXT.confirmNewYes).toMatch(/태어나/);
  });

  it('문구 원칙: 다른 게임 고유 문구(「삶을 시작하기」)·느낌표·이모지가 없고 자살을 연상시키는 말(끝낸다·접는다·죽)을 쓰지 않으며 13자 안팎이다', () => {
    const t = TITLE_TEXT.confirmNewYes;
    expect(t).not.toMatch(/삶을 시작하기/);
    expect(t).not.toMatch(/[!！]/);
    expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(t).not.toMatch(/끝낸|끝내|접는|접기|죽|목숨|포기/);
    expect(t.length).toBe(13);
  });

  it('문구 기준표(docs/design/copy.md)에 이 자리 행이 있고 같은 문구·근거(QM2-6 마스터 결정)가 적혀 있다', () => {
    const row = copyMd.split('\n').find((line) => line.includes('확인 단계 · 확정 버튼'));
    expect(row, 'copy.md에 「확인 단계 · 확정 버튼」 행').toBeDefined();
    expect(row).toContain('「이전 판 지우고 태어나기」');
    expect(row).toContain('QM2-6 마스터 결정');
    expect(row!.startsWith('| 첫 화면 |')).toBe(true);
  });
});

describe('2회차 보완 화면 문구 (SPEC-003 QM2-10·QM2-11, REV-003-M2-3 R-230·R-236·R-237)', () => {
  const html = render();
  const data = buildCarousel();

  it('푸터 통계 출처 줄은 쉼표 나열이다: 「통계 출처: 국가데이터처, 행정안전부, 교육부 (통계표 이름과 기준 연도는 카드마다 적혀 있습니다)」 — 기관 이름 사이에 「·」가 없다 (QM2-10 b)', () => {
    const credit = html.slice(html.indexOf('data-testid="stats-credit"'), html.indexOf('data-testid="population-info"'));
    expect(text(credit)).toContain('통계 출처: 국가데이터처, 행정안전부, 교육부 (통계표 이름과 기준 연도는 카드마다 적혀 있습니다)');
    expect(plain(credit)).toContain(footerStatsText(data.orgs));
    for (const org of data.orgs) expect(plain(credit).includes(`${org} ·`) || plain(credit).includes(`· ${org}`), `${org} 앞뒤의 「·」`).toBe(false);
  });

  it('혼인 건수 슬라이드: 큰 값 줄 바로 아래에 「조혼인율 인구 1천 명당 4.7건」 줄이 있고(값 → 보조 값 → 기준 줄 순서), 다른 슬라이드에는 이 줄이 없다 (QM2-11)', () => {
    const start = html.indexOf('data-slide-id="marriage-count"');
    const slide = html.slice(start, html.indexOf('</article>', start));
    expect(slide).toContain('data-testid="slide-side-value"');
    expect(text(slide)).toContain('조혼인율 인구 1천 명당 4.7건');
    const order = ['data-testid="slide-value"', 'data-testid="slide-side-value"', 'data-testid="slide-basis-line"', 'class="chart"'].map((k) => slide.indexOf(k));
    expect(order.every((i) => i >= 0), `조각 위치 ${order}`).toBe(true);
    expect([...order].sort((a, b) => a - b), '큰 값 → 조혼인율 줄 → 기준 줄 → 그래프 순서').toEqual(order);
    expect(slide, '선 무늬(범례)가 아니다').not.toContain('class="legend"');
    expect(html.match(/data-testid="slide-side-value"/g)?.length, '14장 중 보조 값 줄은 하나').toBe(1);
  });

  it('기준 줄과 「통계 기준」 줄의 짧은 쌍은 <Pair>로 그려진다 — 기준 줄 쌍 둘(조사망률·자살률), 통계 기준 줄 쌍 14장 전부 (QM2-10 규칙 3)', () => {
    expect(html.match(/class="pair pair--basis"/g)?.length).toBe(2);
    expect(html.match(/class="pair pair--meta"/g)?.length).toBe(14);
    const start = html.indexOf('data-slide-id="suicide-rate"');
    const slide = html.slice(start, html.indexOf('</article>', start));
    expect(text(slide)).toContain('27.8 명');
    expect(text(slide)).toContain('인구 10만 명당 · 2025년 기준');
  });

  it('한 줄 설명의 끝 「한 번의 인생」은 줄바꿈 금지 묶음(nowrap)이고 글자는 그대로다 — 마지막 낱말 「인생」이 혼자 줄에 남지 않는다 (R-237, QA 3회차 마스터 결정: 마지막 두 어절 묶음)', () => {
    expect(html).toContain('<span class="keep-phrase">한국인의 <span class="nowrap">한 번의 인생</span></span>');
    expect(text(html)).toContain('태어난 집에 따라 달라지는, 한국인의 한 번의 인생');
    expect(TITLE_TEXT.heroTagKeep).toBe('한국인의 한 번의 인생');
    expect(heroTagKeepParts()).toEqual(['한국인의 ', '한 번의 인생', '']);
    // 갈라지지 않는 부분은 마지막 두 어절(「번의 인생」)을 포함한다 — 「한 번의」는 R-237로 이미 한 덩어리라 세 어절이 한 덩어리가 된다
    const [lead, noBreak, tail] = heroTagKeepParts();
    expect(`${lead}${noBreak}${tail}`).toBe(TITLE_TEXT.heroTagKeep);
    expect(noBreak.endsWith('번의 인생')).toBe(true);
    expect(noBreak.startsWith('한 번의')).toBe(true);
  });

  it('문구 기준표(docs/design/copy.md)에 푸터 통계 출처 줄(쉼표 나열)과 조혼인율 줄 행이 있다 (마스터 결정)', () => {
    const footer = copyMd.split('\n').find((line) => line.includes('푸터 · 통계 출처 줄'));
    expect(footer, 'copy.md에 「푸터 · 통계 출처 줄」 행').toBeDefined();
    expect(footer).toContain('국가데이터처, 행정안전부, 교육부');
    expect(footer).toContain('QM2-10');
    const marriage = copyMd.split('\n').find((line) => line.includes('조혼인율 줄'));
    expect(marriage, 'copy.md에 「조혼인율 줄」 행').toBeDefined();
    expect(marriage).toContain('조혼인율 인구 1천 명당 4.7건');
    expect(marriage).toContain('QM2-11');
  });
});
