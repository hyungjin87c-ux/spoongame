import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import copyMd from '../docs/design/copy.md?raw';
import mockupTitle from '../docs/design/mockups/title-a.html?raw';
import titleScreenSrc from '../src/screens/TitleScreen.tsx?raw';
import barReleaseSrc from '../src/ui/barRelease.ts?raw';
import { BUILD_LABEL } from '../src/buildInfo';
import { CAROUSEL_MAX_DOTS, SELECTABLE_LIFE_LENGTHS, buildCarousel, formatCount, virtualPopulation, type CarouselData, type Era, type LifeLength } from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { ICON_IDS, PATTERN_IDS, SPOON_IDS, SPOON_LG_IDS, SPRITE_SVG } from '../src/ui/brandAssets';
import { LIFE_LENGTH_TEXT, NOT_READY_TEXT, TITLE_TEXT, eraMetaText, footerStatsText, heroTagKeepParts } from '../src/data/titleText';
import { TitleScreen, type TitleSaved } from '../src/screens/TitleScreen';
import { AUTO_ADVANCE_MS } from '../src/core';

/**
 * 첫 화면의 구성 (SPEC-003 FS1~FS8, VP2, SC6). 서버 렌더로 마크업을 본다 — 실제 폭·스크롤·동작은 e2e/first-screen.spec.ts.
 * 시각은 고정해서(minute) 가상 인구를 결정적으로 만든다.
 */

const MINUTE = 29_850_000; // 2026-10-21 근처
const saved: TitleSaved = { onResume: () => {}, onBeginNew: () => {} };

function render(over: Partial<{ era: Era; lifeLength: LifeLength; saved: TitleSaved | null; oldSaveNotice: boolean; minute: number; carousel: CarouselData; gentle: { on: boolean; onToggle: () => void } }> = {}): string {
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
      gentle={over.gentle}
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

  it('위에서부터: 로고(제목) → (좁은 화면) 일러스트 배너 → 한 줄 설명 → 수저 다섯 자루 → 가상 인구 문구와 보조 문구 → 태어날 세상 → 인생 길이, 오른쪽(좁으면 아래)에 일러스트 → 캐러셀, 푸터, 하단 고정 버튼', () => {
    const order = ['data-testid="title-heading"', 'data-testid="home-illust-banner"', 'hero__tag', 'data-testid="spoon-lineup"', 'data-testid="population-line"', 'data-testid="population-note"', 'data-testid="era-group"', 'data-testid="life-length-group"', 'data-testid="home-illust-top"', 'data-testid="carousel"', 'data-testid="title-foot"', 'data-testid="bottom-bar"'];
    const at = order.map((k) => html.indexOf(k));
    for (const [i, k] of order.entries()) expect(at[i], k).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < at.length; i++) expect(at[i], `${order[i - 1]} → ${order[i]}`).toBeGreaterThan(at[i - 1]);
  });

  it('게임명 「수저 게임」이 제목(h1)의 읽히는 글자로 있고, 로고는 워드마크(글자) 하나가 장식으로 들어 있다 — 두 폭 모두 같은 것이고 세로·가로 로고(심볼 + 워드마크)는 없다 (SPEC-005 D5-01 A안·D5-31)', () => {
    expect(html).toMatch(/<h1[^>]*data-testid="title-heading"[^>]*><span class="sr-only">수저 게임<\/span>/);
    expect(html).toMatch(/<span class="logo-wrap logo--word" data-testid="title-logo-word" aria-hidden="true">/);
    expect(html.match(/viewBox="0 0 425 100"/g)?.length).toBe(1); // 워드마크 하나
    expect(html).not.toContain('title-logo-stacked');
    expect(html).not.toContain('title-logo-row');
  });

  it('수저 다섯 단계: 이름이 글자로 있고(색에만 의존하지 않는다) 큰 변형 도형(sp-1-lg~sp-5-lg, 32px 이상)을 쓴다 — 칩 변형(sp-N)은 쓰지 않는다', () => {
    for (const name of ['흙수저', '동수저', '은수저', '금수저', '다이아몬드']) expect(html).toContain(name);
    for (const id of SPOON_LG_IDS) expect(html).toContain(`href="#${id}"`);
    for (const id of SPOON_IDS) expect(html, `${id}는 칩(<= 24px)용이다`).not.toContain(`href="#${id}"`);
    expect(html).toContain('aria-label="수저 다섯 단계: 흙수저, 동수저, 은수저, 금수저, 다이아몬드수저"');
  });

  it('사용하는 아이콘·수저 스프라이트 id가 디자이너 자산에 모두 있다 (도형 내용은 점검하지 않는다)', () => {
    for (const id of [...ICON_IDS, ...SPOON_IDS, ...SPOON_LG_IDS]) expect(SPRITE_SVG, id).toContain(`id="${id}"`);
    // QI4: 「전망」 칩 아이콘 i-proj(ICON_IDS)와 그래프 무늬 hatch·dots(PATTERN_IDS)도 스프라이트에 있다 — 차트 CSS의 fill: url(#hatch|#dots)가 이 한 곳을 가리킨다
    for (const id of PATTERN_IDS) expect(SPRITE_SVG, id).toContain(`<pattern id="${id}"`);
    expect(ICON_IDS).toContain('i-proj');
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
      // 보조 문구는 Glue를 거친다(D-98 — 「이 기기」가 한 묶음) → 태그를 벗긴 글자가 문구 그대로인지 본다
      expect(text(html.match(/data-testid="population-note">([^]*?)<\/p>/)![1]).trim()).toBe(TITLE_TEXT.populationNote);
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
    for (const value of Object.values(TITLE_TEXT)) expect(value).not.toMatch(banned); // (SPEC-005: 함수형 문구 carouselAutoNote가 없어져 모두 글자다)
    for (const v of Object.values(LIFE_LENGTH_TEXT)) expect(v.title).not.toMatch(banned);
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

  it('인생 길이(HS2): 「약 30분」/「약 1시간」 작은 분절 컨트롤(radiogroup, 라디오 둘), 기본 약 30분, 한 줄 안내(저장 안내) — 라디오 카드·카드 보조문·세 문장 안내는 없다', () => {
    const html = render();
    expect(html).toMatch(/<div class="seg" role="radiogroup" aria-label="인생 길이" data-testid="life-length-group">/);
    expect(radio(html, 'life-short30')).toEqual({ checked: true, name: 'lifeLength', value: 'short30' });
    expect(radio(html, 'life-long60')).toEqual({ checked: false, name: 'lifeLength', value: 'long60' });
    expect(html.match(/<label class="seg__opt/g)?.length).toBe(2);
    expect(text(html)).toContain('약 30분');
    expect(text(html)).toContain('약 1시간');
    // 한 줄 안내(copy.md 9-4): 평균 수명까지 · 생각을 적는 시간은 뺐다 · 나가도 이 기기에 남는다 — 세 뜻이 한 줄에 있다
    expect(text(html)).toContain(TITLE_TEXT.lifeLengthHint);
    expect(TITLE_TEXT.lifeLengthHint).toBe('평균 수명까지 사는 시간이에요. 생각을 적는 시간은 뺐고, 나가도 이 기기에 남아요.');
    expect(TITLE_TEXT.lifeLengthHint).toContain('이 기기에 남아요'); // 도중에 나가도 진행은 이 기기에 남는다는 뜻 (FS5)
    expect(TITLE_TEXT.lifeLengthHint).toContain('생각을 적는 시간은 뺐고'); // LD-1: 기록 쓰기 시간은 「약 30분」 밖이다
    expect(TITLE_TEXT.lifeLengthHint.length).toBeLessThanOrEqual(50); // 한 줄 안내(1280에서 한 줄 — 실측은 e2e/first-screen-layout.spec.ts)
    for (const gone of ['가볍게 한 판', '결정을 더 많이', '생각을 적는 시간은 넣지 않았어요']) expect(text(html), gone).not.toContain(gone);
    expect(html).not.toContain('choices--2');
  });

  it('분절 컨트롤의 선택 상태는 색에만 의존하지 않는다: 체크 아이콘과 「선택됨」 글자가 선택된 칸에만 있다 (HS2 ①)', () => {
    const html = render();
    const sel = /<label class="seg__opt is-selected">[\s\S]*?<\/label>/.exec(html)?.[0];
    expect(sel, '선택된 칸').toBeDefined();
    expect(sel).toContain('href="#i-check"');
    expect(sel).toContain('<span class="sr-only">선택됨</span>');
    expect(sel).toContain('<span>약 30분</span>');
    expect(html.match(/class="seg__opt is-selected"/g)?.length).toBe(1);
  });

  /** 입력 태그 하나에서 disabled 속성 여부 */
  const isDisabled = (html: string, testId: string): boolean => /\sdisabled(=|\s|\/|>)/.test(new RegExp(`<input [^>]*data-testid="${testId}"[^>]*>`).exec(html)![0]);

  it('「약 1시간」 칸은 보이되 선택할 수 없고 「준비 중」이 적혀 있다. 라디오 그룹 안에 그대로 있고 비활성 이유는 칸 글(접근 가능한 이름)에 들어 있다 (R-202)', () => {
    expect(SELECTABLE_LIFE_LENGTHS).toEqual(['short30']);
    const html = render();
    expect(isDisabled(html, 'life-long60')).toBe(true);
    expect(isDisabled(html, 'life-short30')).toBe(false);
    expect(NOT_READY_TEXT).toBe('준비 중');
    // 칸(label) 하나 안에 라디오·이름·준비 중이 모두 들어 있다 → 라디오의 접근 가능한 이름은 「약 1시간 준비 중」 (SPEC-005 HS2 ②: 분절 컨트롤의 비활성 칸)
    const label = /<label class="seg__opt is-disabled">(?:(?!<\/label>)[\s\S])*?data-testid="life-long60"(?:(?!<\/label>)[\s\S])*?<\/label>/.exec(html)?.[0];
    expect(label, '비활성 칸 마크업').toBeDefined();
    expect(text(label!)).toContain(LIFE_LENGTH_TEXT.long60.title);
    expect(text(label!)).toContain(NOT_READY_TEXT);
    expect(label).toContain(`<span class="seg__meta">${NOT_READY_TEXT}</span>`);
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

  it('모든 슬라이드가 마크업에 있고(전환은 보이기/숨기기), 첫 슬라이드가 현재이며, 위치는 「1 / 20」 한 줄이다. 지표가 6개 이상이면 점은 그리지 않는다(R-133). 슬라이드의 이름은 「n/N 표제어, 공식 통계명(기준)」이다(SH3)', () => {
    expect(html.match(/data-testid="stat-slide"/g)?.length).toBe(data.slides.length);
    expect(html.match(/class="slide is-active"/g)?.length).toBe(1);
    expect(data.slides.length).toBeGreaterThan(CAROUSEL_MAX_DOTS);
    expect(html).not.toContain('data-testid="carousel-dots"');
    expect(html).not.toMatch(/data-testid="carousel-dot-\d+"/);
    expect(html).toContain(`aria-label="1/${data.slides.length} ${data.slides[0].insight}, ${data.slides[0].officialText}"`); // 「1/14 한 여성이 평생 낳을 아이는 몇 명일까?, 합계출산율(2025년)」
    expect(html).toContain('aria-label="1/20 한 여성이 평생 낳을 아이는 몇 명일까?, 합계출산율(2025년)"'); // QI4 2단계: 14 → 20
    // 전망 슬라이드의 이름에는 「전망,」이 든다 — 칩 글자뿐 아니라 이름에도 있어 색·아이콘 없이도 전한다 (FC2, copy.md 14-1)
    expect(html).toContain('aria-label="16/20 전망, 앞으로 인구는 어떻게 달라질까?, 장래인구추계 총인구(2023년 발표, 2022년 기준, 중위 추계)"');
    expect(html).toContain('aria-label="20/20 전망, 지금 태어나는 아기라면?, 장래인구추계 인구 구조·부양비(2023년 발표, 2022년 기준, 중위 추계)"');
    expect(html).toContain('aria-label="5/20 나이들수록 또래들과 경제력 차이가 극심해져요, 연령계층별 소득 5분위배율(2024년)"');
    expect(html).toContain(`data-testid="carousel-count" aria-hidden="true">1 / ${data.slides.length}<`);
  });

  it('머리글 삭제(SH4): 눈에 보이는 「한국 사회 통계」「7초마다 다음 지표」「자동 넘김 멈춤」이 없다. 영역 이름은 aria-label로 남고 제목은 h2.sr-only — 슬라이드 h3 위에 h2가 있다', () => {
    const visible = text(html.replace(/<h2 class="sr-only">[^<]*<\/h2>/g, ''));
    for (const gone of ['한국 사회 통계', '7초마다', '9초마다', '자동 넘김 멈춤', '다음 지표']) {
      // 「다음 지표」는 버튼의 aria-label에만 있다 — 눈에 보이는 글자(태그 안 속성 제외)에는 없다
      expect(visible, gone).not.toContain(gone);
    }
    expect(html).not.toContain('carousel-auto-note');
    expect(html).not.toContain('carousel__head');
    expect(html).toContain('aria-roledescription="캐러셀" aria-label="한국 사회 통계 캐러셀"');
    expect(html).toContain('<h2 class="sr-only">한국 사회 통계</h2>');
    const carousel = html.slice(html.indexOf('data-testid="carousel"'));
    expect(carousel.indexOf('<h2 class="sr-only">')).toBeGreaterThan(-1);
    expect(carousel.indexOf('<h2 class="sr-only">')).toBeLessThan(carousel.indexOf('<h3 class="slide__insight">')); // 제목 단계를 건너뛰지 않는다
    expect(carousel.match(/<h2/g)?.length).toBe(1);
    for (const key of ['carouselTitle', 'carouselAutoNote', 'carouselPausedNote']) expect(key in TITLE_TEXT, key).toBe(false);
  });

  it('슬라이드는 위에서부터 표제어(h3) → 공식 통계명(기준) 줄 → 값 → 그래프 → 정의 → 출처 순이다 (SH1) — 지표 이름(옛 h3)은 제목이 아니다', () => {
    for (const s of data.slides) {
      const start = html.indexOf(`data-slide-id="${s.id}"`);
      const article = html.slice(start, html.indexOf('</article>', start));
      const order = ['<h3 class="slide__insight">', 'class="slide__official"', 'class="chart"', 'class="t-sm t-muted"', '출처: '].map((k) => article.indexOf(k));
      expect(order.every((i) => i >= 0), `${s.id} 조각 위치 ${order}`).toBe(true);
      expect([...order].sort((a, b) => a - b), `${s.id} 순서`).toEqual(order);
      if (s.valueText !== null) expect(article.indexOf('data-testid="slide-value"'), `${s.id} 값은 공식 통계명 줄 뒤`).toBeGreaterThan(order[1]);
      expect(text(article), s.id).toContain(s.insight);
      expect(text(article), s.id).toContain(s.officialText);
    }
  });

  it('조작 줄(SH5·SH6): 이전·「i / N」·다음·일시정지가 카드 안 슬라이드 앞(오른쪽 위)에 있고, 일시정지 버튼은 늘 보이며 아이콘·이름이 상태를 맡는다 — 돌고 있으면 일시정지 아이콘 + 「자동 넘김 일시정지」', () => {
    const nav = /<div class="carousel__nav" data-testid="carousel-nav">[\s\S]*?<\/div>/.exec(html)?.[0];
    expect(nav, '조작 줄').toBeDefined();
    expect(html.indexOf('data-testid="carousel-nav"')).toBeLessThan(html.indexOf('data-testid="carousel-viewport"'));
    expect(nav!.match(/<button /g)?.length).toBe(3); // 이전 · 다음 · 일시정지 (「i / N」은 글자)
    expect(nav).toMatch(/data-testid="carousel-prev" aria-label="이전 지표"[^>]*><span class="nav-btn__box"><svg[^>]*><use href="#i-prev"/);
    expect(nav).toMatch(/data-testid="carousel-next" aria-label="다음 지표"[^>]*><span class="nav-btn__box"><svg[^>]*><use href="#i-forward"/);
    expect(nav).toMatch(/data-testid="carousel-pause" aria-label="자동 넘김 일시정지"[^>]*><span class="nav-btn__box"><svg[^>]*><use href="#i-pause"/);
    expect(nav).not.toContain('#i-play');
    expect(nav).toContain(`>1 / ${data.slides.length}<`);
    // 보이는 상자 28px·거친 포인터 44px는 CSS(실측은 e2e/first-screen-layout.spec.ts). 점은 지표가 많아 없다
    expect(TITLE_TEXT.carouselPause).toBe('자동 넘김 일시정지');
    expect(TITLE_TEXT.carouselPlay).toBe('자동 넘김 다시 시작');
  });

  it('자동 넘김은 9초다 (SPEC-005 마스터 결정 M8) — 머리글 문구가 아니라 상수가 정한다', () => {
    expect(AUTO_ADVANCE_MS).toBe(9000);
  });

  it('슬라이드가 5개 이하일 때만 점을 그리고, 점 버튼의 이름은 「3/5 표제어」이다 (R-133)', () => {
    const few: CarouselData = { ...data, slides: data.slides.slice(0, CAROUSEL_MAX_DOTS) };
    const dotsHtml = render({ carousel: few });
    expect(dotsHtml).toContain('data-testid="carousel-dots"');
    expect(dotsHtml.match(/data-testid="carousel-dot-\d+"/g)?.length).toBe(CAROUSEL_MAX_DOTS);
    expect(dotsHtml).toContain(`aria-label="3/${CAROUSEL_MAX_DOTS} ${few.slides[2].insight}"`); // 점 버튼의 이름은 표제어(SPEC-005 SH1)
    expect(dotsHtml.match(/aria-current="true"/g)?.length).toBe(1);
    // 6개부터는 점이 없다
    const many: CarouselData = { ...data, slides: data.slides.slice(0, CAROUSEL_MAX_DOTS + 1) };
    expect(render({ carousel: many })).not.toContain('data-testid="carousel-dots"');
    // 하나뿐이면 점도 없다
    expect(render({ carousel: { ...data, slides: data.slides.slice(0, 1) } })).not.toContain('data-testid="carousel-dots"');
  });

  it('막대 그래프(시·도별)는 값 16~17개 전부를 시각적으로 숨긴 표로도 준다 — 보통 선 그래프에는 표가 없다 (R-207) · QI4: 격차 2011~2024·폭염 권역 6곳·아기 5행도 숨긴 표로 준다', () => {
    const bars = data.slides.filter((s) => s.chart.kind === 'bar');
    expect(bars.map((s) => s.id)).toEqual(expect.arrayContaining(['region-population-registered', 'tfr-by-sido']));
    // 시·도 막대 둘의 표 + 새 슬라이드의 그래프 밖 표(격차 1·폭염 1·아기 1) — 전망 선 그래프 셋과 보통 선 그래프에는 표가 없다
    const srTables = data.slides.filter((s) => s.tables.length > 0);
    expect(srTables.map((s) => s.id)).toEqual(['income-gap-by-age', 'heat-projection', 'projection-newborn-age-structure']);
    expect(html.match(/data-testid="chart-table"/g)?.length).toBe(bars.length + srTables.reduce((n, s) => n + s.tables.length, 0));
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

  it('슬라이드마다 출처·기준 연도(공식 통계명 줄)가 적혀 있고 마지막 갱신일이 보인다 (SC2·SC4 — 기준 연도는 SPEC-005 SH3에서 공식 통계명 줄로 옮겼다)', () => {
    for (const s of data.slides) {
      expect(text(html), s.id).toContain(`출처: ${s.sourceText}`);
      expect(text(html), s.id).toContain(s.officialText);
      if (s.basisText !== null) expect(text(html), s.id).toContain(s.basisText);
      expect(text(html), s.id).toContain(s.basisLine); // 「통계 기준: 2025년 · 마지막 갱신 2026-10-15」
    }
    // 연도만 있던 기준 줄은 없다 — 분모가 있는 둘(조사망률·자살률)만 기준 줄이 남는다
    expect(html.match(/data-testid="slide-basis-line"/g)?.length).toBe(2);
    // 전망 슬라이드의 공식 통계명 줄 「(2023년 발표, 2022년 기준, 중위 추계)」의 「2022년 기준」은 연도만 있던 옛 기준 줄이 아니다 — 뒤에 쉼표나 닫는 괄호가 오는 꼴만 허용한다(QI4 2단계, 가구추계는 시나리오 칸이 없어 「2022년 기준)」로 끝난다)
    expect(text(html.replace(/<caption>[^<]*<\/caption>/g, ''))).not.toMatch(/\d{4}년 기준(?![(,)])/); // (숨긴 표의 캡션은 지표 이름 그대로라 뺀다)
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
    expect(text(slide)).toContain('자살률(2025년)'); // 공식 통계명 줄(SH3) — 「자살」 낱말은 이 줄에만 있다
    expect(text(slide)).toContain('인구 10만 명당'); // 기준 줄(분모만)
    const insight = /<h3 class="slide__insight">([\s\S]*?)<\/h3>/.exec(slide)![1];
    expect(text(insight)).toBe('삶을 스스로 마감하는 사람은 얼마나 될까?'); // 확정 표제어(M9 — copy.md 9-1 #5, REV-005-QI3-1 판독 통과 + 마스터 승인) — 「자살」 낱말은 공식 통계명 줄에만 있다
    expect(text(insight)).not.toContain('자살');
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
    const links = [...html.matchAll(/<a ([^>]*)href="([^"]+)"([^>]*)>/g)].map((m) => ({ href: m[2], tag: m[0] }));
    // 푸터의 「새 소식」「소개」(SPEC-005 QI7)는 같은 화면 안의 패널을 여는 링크라 `#`이다 — 네트워크로 나가지 않고 `data-panel`로 가려진다(둘뿐)
    const panelLinks = links.filter((l) => l.href === '#');
    expect(panelLinks.length).toBe(2);
    for (const l of panelLinks) expect(l.tag, '주소가 #인 링크는 정보 패널을 여는 링크뿐').toContain('data-panel=');
    for (const { href } of links.filter((l) => l.href !== '#')) expect(href.startsWith('tel:') || href.startsWith('https://'), href).toBe(true);
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

  it('푸터 통계 출처 줄은 쉼표 나열이다: 「통계 출처: 국가데이터처, 한국은행, 금융감독원, 행정안전부, 교육부, 기상청(국립기상과학원) (통계표 이름과 기준 연도는 카드마다 적혀 있습니다)」 — 기관 이름 사이에 「·」가 없다 (QM2-10 b · QI4 2단계: 3곳 → 7곳 · R-488: 같은 기관은 한 번만 → 6곳)', () => {
    const credit = html.slice(html.indexOf('data-testid="stats-credit"'), html.indexOf('data-testid="population-info"'));
    // 1단계까지의 기대 글자(국가데이터처, 행정안전부, 교육부 — 3곳)를 슬라이드 20장에서 모인 7곳으로 바꿨다가, R-488로 「통계청(현 국가데이터처)」를 「국가데이터처」에 모아 6곳이 됐다(tests/glue.test.ts 「실제 푸터」와 같은 글자)
    expect(text(credit)).toContain('통계 출처: 국가데이터처, 한국은행, 금융감독원, 행정안전부, 교육부, 기상청(국립기상과학원) (통계표 이름과 기준 연도는 카드마다 적혀 있습니다)');
    expect(text(credit).includes('통계청'), '푸터에 옛 이름 「통계청」이 없다(R-488)').toBe(false);
    expect(plain(credit)).toContain(footerStatsText(data.orgs));
    for (const org of data.orgs) expect(plain(credit).includes(`${org} ·`) || plain(credit).includes(`· ${org}`), `${org} 앞뒤의 「·」`).toBe(false);
  });

  it('혼인 건수 슬라이드: 큰 값 줄 바로 아래에 「조혼인율 인구 1천 명당 4.7건」 줄이 있고(값 → 보조 값 → 기준 줄 순서), 다른 슬라이드에는 이 줄이 없다 (QM2-11)', () => {
    const start = html.indexOf('data-slide-id="marriage-count"');
    const slide = html.slice(start, html.indexOf('</article>', start));
    expect(slide).toContain('data-testid="slide-side-value"');
    expect(text(slide)).toContain('조혼인율 인구 1천 명당 4.7건');
    const order = ['class="slide__official"', 'data-testid="slide-value"', 'data-testid="slide-side-value"', 'class="chart"'].map((k) => slide.indexOf(k));
    expect(order.every((i) => i >= 0), `조각 위치 ${order}`).toBe(true);
    expect([...order].sort((a, b) => a - b), '공식 통계명 줄 → 큰 값 → 조혼인율 줄 → 그래프 순서(연도 기준 줄은 공식 통계명 줄로 옮겼다)').toEqual(order);
    expect(slide, '혼인 건수는 분모가 없어 기준 줄이 없다').not.toContain('data-testid="slide-basis-line"');
    expect(text(slide)).toContain('혼인 건수·조혼인율(2025년)');
    expect(slide, '선 무늬(범례)가 아니다').not.toContain('class="legend"');
    // 기존 14장 중 보조 값 줄은 혼인 건수의 하나, QI4의 새 여섯 장은 격차 2 + 총인구 1 + 65세 이상 2 + 1인 가구 1 + 폭염 1 + 아기 1 = 8줄 (보조 줄은 새 슬라이드의 값 설명·한계)
    expect(html.match(/data-testid="slide-side-value"/g)?.length, '보조 값 줄 = 혼인 건수 1 + QI4 새 슬라이드 8').toBe(1 + 8);
    expect(data.slides.filter((s) => !['income-gap-by-age', 'projection-population-total', 'projection-aging-share', 'projection-one-person-households', 'heat-projection', 'projection-newborn-age-structure'].includes(s.id)).flatMap((s) => s.sideValues)).toHaveLength(1);
  });

  it('「통계 기준」 줄의 짧은 쌍은 <Pair>로 그려진다 — 20장 전부(전망은 「발표: … · 마지막 갱신 …」). 기준 줄은 분모만 남아 쌍이 아니다(SPEC-005 copy.md 9-2: 「인구 10만 명당 · 2025년 기준」 → 「인구 10만 명당」 + 공식 통계명 줄 「자살률(2025년)」) (QM2-10 규칙 3)', () => {
    expect(html.match(/class="pair pair--basis"/g)?.length ?? 0).toBe(0);
    expect(html.match(/class="pair pair--meta"/g)?.length).toBe(20); // QI4 2단계: 14 → 20
    const start = html.indexOf('data-slide-id="suicide-rate"');
    const slide = html.slice(start, html.indexOf('</article>', start));
    expect(text(slide)).toContain('27.8 명');
    expect(text(slide)).toContain('인구 10만 명당');
    expect(text(slide)).not.toContain('인구 10만 명당 · 2025년 기준');
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
