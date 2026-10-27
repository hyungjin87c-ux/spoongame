import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import copyMd from '../docs/design/copy.md?raw';
import titleScreenSrc from '../src/screens/TitleScreen.tsx?raw';
import barReleaseSrc from '../src/ui/barRelease.ts?raw';
import { BUILD_LABEL } from '../src/buildInfo';
import { CAROUSEL_MAX_DOTS, GENERATION_IDS, SELECTABLE_LIFE_LENGTHS, buildCarousel, type CarouselData, type GenerationChoice, type GenerationId, type LifeLength } from '../src/core';
import { GEN_ROWS, GEN_TEXT, genMetaText } from '../src/data/generationText';
import { GENERATIONS } from '../src/data/generations';
import { ICON_IDS, PATTERN_IDS, SPRITE_SVG } from '../src/ui/brandAssets';
import { LIFE_LENGTH_TEXT, NOT_READY_TEXT, TITLE_TEXT, footerStatsText } from '../src/data/titleText';
import { TitleScreen, type TitleSaved } from '../src/screens/TitleScreen';
import { AUTO_ADVANCE_MS } from '../src/core';

/**
 * 첫 화면의 구성 (SPEC-003 FS1~FS8, SC6 + SPEC-004 GS1~GS4·GS10·GS11 1부). 서버 렌더로 마크업을 본다 — 실제 폭·스크롤·동작은 e2e/first-screen.spec.ts.
 * 세대 목록(라디오 8줄) · 「살아봄」 표시 · 오른쪽 위 일러스트·수저 다섯 자루 줄·가상 인구 문구가 없어졌음(GS11-3)을 잠근다.
 */
const saved: TitleSaved = { onResume: () => {}, onBeginNew: () => {} };

function render(over: Partial<{ generation: GenerationChoice; lived: readonly GenerationId[]; lifeLength: LifeLength; saved: TitleSaved | null; oldSaveNotice: boolean; carousel: CarouselData; gentle: { on: boolean; onToggle: () => void } }> = {}): string {
  return renderToStaticMarkup(
    <TitleScreen
      generation={over.generation ?? 'random'}
      lived={over.lived}
      lifeLength={over.lifeLength ?? 'short30'}
      onSelectGeneration={() => {}}
      onSelectLifeLength={() => {}}
      onBegin={() => {}}
      saved={over.saved ?? null}
      oldSaveNotice={over.oldSaveNotice ?? false}
      carousel={over.carousel}
      gentle={over.gentle}
    />,
  );
}

const text = (html: string): string =>
  html
    // 줄바꿈 묶음(QM2-5, ui/Glue.tsx)의 span은 글자를 바꾸지 않는 표시일 뿐이라 벗겨 낸다 — 태그를 공백으로 바꾸는 아래 규칙이 묶음 안에 공백을 넣어
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

/** 세대 줄 하나의 마크업 (label.gen-row 전체) */
function genRow(html: string, id: GenerationChoice): string {
  const m = new RegExp(`<label class="gen-row[^"]*" data-testid="gen-row-${id}">[\\s\\S]*?</label>`).exec(html);
  if (m === null) throw new Error(`세대 줄 없음: ${id}`);
  return m[0];
}

describe('서버 렌더 (수집 시점 출력 금지)', () => {
  it('첫 화면을 서버 렌더해도 콘솔에 아무것도 내지 않는다 — 이 파일의 describe 본문은 수집(import) 시점에 렌더하고, 그때의 console 출력(예: React 18의 useLayoutEffect 서버 경고)은 vitest list --json이 JSON을 깨뜨린다', () => {
    const spies = (['error', 'warn', 'log', 'info', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    try {
      for (const over of [{}, { saved }, { oldSaveNotice: true }, { generation: 'industrial' as const }, { lived: ['genx' as const] }]) render(over);
      for (const spy of spies) expect(spy.mock.calls, String(spy.getMockName())).toEqual([]);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe('첫 화면 구성 (FS1 · GS11 1부)', () => {
  const html = render();

  it('위에서부터: 로고(제목) → 한 줄 부제 → 세대 목록 → 태어나는 시도 → 인생 길이, 오른쪽(좁으면 아래)에 통계 캐러셀, 맨 아래에 푸터와 하단 띠', () => {
    const order = ['data-testid="title-heading"', 'data-testid="hero-span"', 'data-testid="gen-list"', 'data-testid="region-slot"', 'data-testid="life-length-group"', 'data-testid="carousel"', 'data-testid="title-foot"', 'data-testid="bottom-bar"'];
    const at = order.map((k) => html.indexOf(k));
    for (const [i, k] of order.entries()) expect(at[i], k).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < at.length; i++) expect(at[i], `${order[i - 1]} → ${order[i]}`).toBeGreaterThan(at[i - 1]);
  });

  it('게임명 「수저 게임」이 제목(h1)의 읽히는 글자로 있고, 로고는 워드마크(글자) 하나가 장식으로 들어 있다 — 세로·가로 로고(심볼 + 워드마크)는 없다 (SPEC-005 로고 결정)', () => {
    expect(html).toMatch(/<h1[^>]*data-testid="title-heading"[^>]*><span class="sr-only">수저 게임<\/span>/);
    expect(html).toMatch(/<span class="logo-wrap logo--word" data-testid="title-logo-word" aria-hidden="true">/);
    expect(html.match(/viewBox="0 0 425 100"/g)?.length).toBe(1); // 워드마크 하나
    expect(html).not.toContain('title-logo-stacked');
    expect(html).not.toContain('title-logo-row');
  });

  it('GS11-3: 오른쪽 위 일러스트·수저 다섯 자루 줄·가상 인구 문구가 없다 (삭제 — 서버 렌더 어디에도 흔적이 없다)', () => {
    for (const gone of ['home-illust', 'home-map', 'spoon-lineup', 'population-line', 'population-note', 'hero__pop', 'log-pin']) expect(html, gone).not.toContain(gone);
    expect(text(html)).not.toMatch(/각자의 삶을 살고 있어요|가상 인구|실제로 게임하는 사람 수/);
    expect(text(html)).not.toMatch(/접속자|동시 접속/);
    // 수저 다섯 단계의 이름은 이 화면에 없다(룰렛·출생신고에서만 쓴다)
    for (const name of ['흙수저', '동수저', '은수저', '금수저', '다이아몬드']) expect(text(html), name).not.toContain(name);
  });

  it('사용하는 아이콘 id가 디자이너 자산에 모두 있다 (도형 내용은 점검하지 않는다)', () => {
    for (const id of ICON_IDS) expect(SPRITE_SVG, id).toContain(`id="${id}"`);
    // QI4: 「전망」 칩 아이콘 i-proj(ICON_IDS)와 그래프 무늬 hatch·dots(PATTERN_IDS)도 스프라이트에 있다 — 차트 CSS의 fill: url(#hatch|#dots)가 이 한 곳을 가리킨다
    for (const id of PATTERN_IDS) expect(SPRITE_SVG, id).toContain(`<pattern id="${id}"`);
    expect(ICON_IDS).toContain('i-proj');
  });

  it('이전의 「시작」 버튼과 시대 선택 화면, 「태어날 세상」 라디오 카드 3개는 없다', () => {
    expect(html).not.toContain('era-screen');
    expect(html).not.toContain('confirm-era');
    expect(html).not.toContain('era-group');
    expect(text(html)).not.toMatch(/어느 세상에서 태어날까|이 세상에서 태어나기|태어날 세상|지난 세상|지금 세상|다가올 세상/);
    expect(html).not.toMatch(/>시작</);
  });

  it('한 줄 부제(N30): 「다른 세대, 다른 삶, 같은 대한민국」 — 뒤쪽 구절은 줄바꿈 묶음이다. 「한 판 약 30분」 슬롯은 이 단계에 없다', () => {
    const tag = plain(/<p class="hero__tag"[\s\S]*?<\/p>/.exec(html)?.[0] ?? '');
    expect(tag).toBe(`${GEN_TEXT.tagLead}${GEN_TEXT.tagKeep}`);
    expect(html).toContain(`<span class="nowrap">${GEN_TEXT.tagKeep}</span>`);
    expect(text(html)).not.toContain('한 판 약 30분');
    expect(text(html)).toContain(GEN_TEXT.span);
  });
});

describe('세대 목록 (GS1·GS2·GS10 — 한 열 스크롤 라디오 8줄)', () => {
  const html = render();

  it('큰 슬롯 제목은 「어느 세대로 살아보고 싶으세요?」이고 목록은 이름 있는 radiogroup이다', () => {
    expect(text(html)).toContain(GEN_TEXT.question);
    expect(html).toMatch(new RegExp(`<div[^>]*role="radiogroup"[^>]*aria-label="${GEN_TEXT.listLabel}"[^>]*data-testid="gen-list"|<div[^>]*data-testid="gen-list"[^>]*role="radiogroup"[^>]*aria-label="${GEN_TEXT.listLabel}"`));
  });

  it('줄은 8개: 첫 줄 「랜덤 세대」 + 세대 7종(GD1 순서). 모두 같은 라디오 묶음(name="gen")이다', () => {
    const ids: GenerationChoice[] = ['random', ...GENERATION_IDS];
    expect(GEN_ROWS.map((r) => r.id)).toEqual(ids);
    expect(html.match(/<label class="gen-row/g)).toHaveLength(8);
    const at = ids.map((id) => html.indexOf(`data-testid="gen-row-${id}"`));
    for (const [i, a] of at.entries()) expect(a, ids[i]).toBeGreaterThan(i === 0 ? -1 : at[i - 1]);
    for (const id of ids) expect(radio(html, `gen-${id}`), id).toMatchObject({ name: 'gen', value: id });
  });

  it('처음 방문의 기본은 「랜덤 세대」다 — 그 줄만 선택돼 있고 선택은 색에만 의존하지 않는다(체크 표식 + 「선택됨」 읽기)', () => {
    for (const id of ['random', ...GENERATION_IDS] as GenerationChoice[]) expect(radio(html, `gen-${id}`).checked, id).toBe(id === 'random');
    const row = genRow(html, 'random');
    expect(row).toContain('is-selected');
    expect(row).toContain('<span class="sr-only">선택됨</span>');
    expect(row).toContain('href="#i-check"');
    expect(html.match(/class="gen-row is-selected"/g)).toHaveLength(1);
    expect(html.match(/<span class="sr-only">선택됨<\/span>/g)?.length).toBeGreaterThanOrEqual(2); // 세대 줄 하나 + 인생 길이 칸 하나
  });

  it('설정이 고른 세대로 열린다(GS4): 고른 줄만 선택된다', () => {
    for (const id of GENERATION_IDS) {
      const h = render({ generation: id });
      for (const other of ['random', ...GENERATION_IDS] as GenerationChoice[]) expect(radio(h, `gen-${other}`).checked, `${id}/${other}`).toBe(other === id);
    }
  });

  it('「랜덤 세대」 줄에는 오른쪽 메타가 없고, 세대 줄은 「{범위}년생 · 올해 N~M세」 메타가 GD1 표에서 나온다 (5차 변경)', () => {
    expect(genRow(html, 'random')).not.toContain('gen-row__meta');
    for (const g of GENERATIONS) {
      const row = genRow(html, g.id);
      const meta = genMetaText(g.birth.from, g.birth.to);
      expect(text(row)).toContain(`${meta.range} · ${meta.age}`);
      expect(plain(row)).toContain(g.label);
    }
    expect(genMetaText(1940, 1954)).toEqual({ range: '1940~1954년생', age: '올해 72~86세' });
    expect(genMetaText(2013, 2020)).toEqual({ range: '2013~2020년생', age: '올해 6~13세' });
  });

  it('줄의 접근 가능한 이름은 이름 + 메타이고(aria-labelledby), 소개는 aria-describedby로 같은 글자를 읽힌다', () => {
    for (const row of GEN_ROWS) {
      const tag = new RegExp(`<input [^>]*data-testid="gen-${row.id}"[^>]*>`).exec(html)![0];
      expect(tag).toContain(`aria-labelledby="gen-name-${row.id}${row.meta === null ? '' : ` gen-meta-${row.id}`}"`);
      expect(tag).toContain(`aria-describedby="gen-desc-${row.id}"`);
      expect(html).toContain(`id="gen-desc-${row.id}"`);
      expect(plain(genRow(html, row.id))).toContain(row.desc);
    }
  });

  it('알파 줄에만 「2026년부터는 공식 전망을 바탕으로 한 이야기예요」 보조 문장이 있다 (G-06)', () => {
    for (const row of GEN_ROWS) expect(genRow(html, row.id).includes(GEN_TEXT.alphaNote), row.id).toBe(row.id === 'alpha');
  });

  it('「살아봄」(GS10): 끝까지 살아본 세대 줄에만 체크 + 글자가 붙고(색에만 의존하지 않는다) 이름 꼬리에 읽힌다. 순위·점수·보상 낱말은 없다', () => {
    expect(html).not.toContain('gen-lived');
    const h = render({ lived: ['boomer', 'alpha'] });
    for (const id of GENERATION_IDS) {
      const row = genRow(h, id);
      const on = id === 'boomer' || id === 'alpha';
      expect(row.includes(`data-testid="gen-lived-${id}"`), id).toBe(on);
      if (on) {
        expect(text(row)).toContain(GEN_TEXT.lived);
        expect(row).toContain(`gen-lived-${id}"`);
        expect(new RegExp(`<input [^>]*data-testid="gen-${id}"[^>]*>`).exec(h)![0]).toContain(`gen-lived-${id}`);
      }
    }
    expect(genRow(h, 'random')).not.toContain('gen-lived');
    expect(GEN_TEXT.lived).toBe('살아봄');
    expect(text(h)).not.toMatch(/순위|점수|보상|업적|도전 과제|달성/);
  });

  it('접이식 설명(GS2): 「세대 범위는 자료마다 조금씩 달라요」 — 목록 아래에 닫힌 채 있다', () => {
    const fold = /<details[^>]*data-testid="gen-fold"[\s\S]*?<\/details>/.exec(html)?.[0];
    expect(fold, '접이식').toBeDefined();
    expect(fold).not.toContain(' open');
    expect(plain(fold!)).toContain(GEN_TEXT.foldSummary);
    expect(plain(fold!)).toContain('1960~1963년생');
    expect(html.indexOf('data-testid="gen-fold"')).toBeGreaterThan(html.indexOf('data-testid="gen-row-alpha"'));
  });

  it('출생 연도를 먼저 보이지 않는다: 목록에는 세대 범위의 양 끝 연도만 있고 그 밖의 네 자리 연도(뽑힌 해)가 없다 (GS3)', () => {
    const ends = new Set<number>(GENERATIONS.flatMap((g) => [g.birth.from, g.birth.to]));
    const years = [...plain(/<div[^>]*data-testid="gen-list"[\s\S]*?<\/fieldset>|<div[^>]*data-testid="gen-list"[\s\S]*?data-testid="gen-fold"/.exec(html)?.[0] ?? '').matchAll(/(?<!\d)(19[4-9]\d|20[0-2]\d)(?!\d)/g)].map((m) => Number(m[1]));
    expect(years.length).toBeGreaterThan(0);
    for (const y of years) expect(ends.has(y) || y === 2026, `목록의 연도 ${y}`).toBe(true);
  });
});

describe('태어나는 시도와 인생 길이 (RG1 · FS5)', () => {
  it('시도 묶음: 분절 「룰렛에 맡기기 / 직접 고르기」, 기본은 룰렛(이 서버 렌더에서는 칩이 접혀 있다) — 한 줄 안내가 보인다', () => {
    const html = render();
    expect(html).toContain('data-testid="region-slot"');
    expect(text(html)).toContain(GEN_TEXT.regionTitle);
    expect(radio(html, 'regmode-roulette')).toEqual({ checked: true, name: 'regmode', value: 'roulette' });
    expect(radio(html, 'regmode-pick')).toEqual({ checked: false, name: 'regmode', value: 'pick' });
    expect(text(html)).toContain(GEN_TEXT.regionHint);
    expect(html).not.toContain('data-testid="region-chips"');
  });

  it('인생 길이(HS2): 「약 30분」/「약 1시간」 작은 분절 컨트롤(radiogroup, 라디오 둘), 기본 약 30분, 한 줄 안내(저장 안내) — 라디오 카드·카드 보조문·세 문장 안내는 없다', () => {
    const html = render();
    expect(html).toMatch(/<div class="seg" role="radiogroup" aria-label="인생 길이" data-testid="life-length-group">/);
    expect(radio(html, 'life-short30')).toEqual({ checked: true, name: 'lifeLength', value: 'short30' });
    expect(radio(html, 'life-long60')).toEqual({ checked: false, name: 'lifeLength', value: 'long60' });
    expect(html.match(/<label class="seg__opt/g)?.length).toBeGreaterThanOrEqual(2);
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
    const sel = /<label class="seg__opt is-selected">(?:(?!<\/label>)[\s\S])*?data-testid="life-short30"[\s\S]*?<\/label>/.exec(html)?.[0];
    expect(sel, '선택된 칸').toBeDefined();
    expect(sel).toContain('href="#i-check"');
    expect(sel).toContain('<span class="sr-only">선택됨</span>');
    expect(sel).toContain('<span>약 30분</span>');
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
    // 선택할 수 있는 칸에는 준비 중 표기가 없다
    expect(html.match(new RegExp(NOT_READY_TEXT, 'g'))?.length).toBe(1);
    // 세대 줄은 모두 선택할 수 있다
    for (const id of ['random', ...GENERATION_IDS]) expect(isDisabled(html, `gen-${id}`), id).toBe(false);
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

  it('모든 슬라이드가 마크업에 있고(전환은 보이기/숨기기), 첫 슬라이드가 현재이며, 위치는 「1 / 21」 한 줄이다(첫 장 = 세대 그래프 + 20장). 지표가 6개 이상이면 점은 그리지 않는다(R-133). 슬라이드의 이름은 「n/N 표제어, 공식 통계명(기준)」이다(SH3)', () => {
    expect(html.match(/data-testid="stat-slide"/g)?.length).toBe(data.slides.length + 1); // 세대 그래프(첫 장) + 20장
    expect(html.match(/class="slide(?: slide--gen)? is-active"/g)?.length).toBe(1);
    expect(data.slides.length).toBeGreaterThan(CAROUSEL_MAX_DOTS);
    expect(html).not.toContain('data-testid="carousel-dots"');
    expect(html).not.toMatch(/data-testid="carousel-dot-\d+"/);
    expect(html).toContain('aria-label="1/21 고른 세대는 한 해에 몇 명이 태어났을까?, 출생아 수(1970~2020년)"'); // 첫 장 = 세대 그래프(D4-71)
    expect(html).toContain(`aria-label="2/${data.slides.length + 1} ${data.slides[0].insight}, ${data.slides[0].officialText}"`);
    expect(html).toContain('aria-label="2/21 한 여성이 평생 낳을 아이는 몇 명일까?, 합계출산율(2025년)"'); // 번호가 하나씩 민다(21장)
    // 전망 슬라이드의 이름에는 「전망,」이 든다 — 칩 글자뿐 아니라 이름에도 있어 색·아이콘 없이도 전한다 (FC2, copy.md 14-1)
    expect(html).toContain('aria-label="17/21 전망, 앞으로 인구는 어떻게 달라질까?, 장래인구추계 총인구(2023년 발표, 2022년 기준, 중위 추계)"');
    expect(html).toContain('aria-label="21/21 전망, 지금 태어나는 아기라면?, 장래인구추계 인구 구조·부양비(2023년 발표, 2022년 기준, 중위 추계)"');
    expect(html).toContain('aria-label="6/21 나이들수록 또래들과 경제력 차이가 극심해져요, 연령계층별 소득 5분위배율(2024년)"');
    expect(html).toContain(`data-testid="carousel-count" aria-hidden="true">1 / ${data.slides.length + 1}<`);
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
    const carousel = html.slice(html.indexOf('data-testid="carousel"'), html.indexOf('</section>', html.indexOf('data-testid="carousel"')));
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
    expect(nav).toContain(`>1 / ${data.slides.length + 1}<`);
    // 보이는 상자 28px·거친 포인터 44px는 CSS(실측은 e2e/first-screen-layout.spec.ts). 점은 지표가 많아 없다
    expect(TITLE_TEXT.carouselPause).toBe('자동 넘김 일시정지');
    expect(TITLE_TEXT.carouselPlay).toBe('자동 넘김 다시 시작');
  });

  it('자동 넘김은 9초다 (SPEC-005 마스터 결정 M8) — 머리글 문구가 아니라 상수가 정한다', () => {
    expect(AUTO_ADVANCE_MS).toBe(9000);
  });

  it('슬라이드(세대 그래프 첫 장 포함)가 5개 이하일 때만 점을 그리고, 점 버튼의 이름은 「3/5 표제어」이다 (R-133)', () => {
    const few: CarouselData = { ...data, slides: data.slides.slice(0, CAROUSEL_MAX_DOTS - 1) }; // + 첫 장 = 5
    const dotsHtml = render({ carousel: few });
    expect(dotsHtml).toContain('data-testid="carousel-dots"');
    expect(dotsHtml.match(/data-testid="carousel-dot-\d+"/g)?.length).toBe(CAROUSEL_MAX_DOTS);
    expect(dotsHtml).toContain('aria-label="1/5 고른 세대는 한 해에 몇 명이 태어났을까?"'); // 첫 점 = 세대 그래프
    expect(dotsHtml).toContain(`aria-label="3/${CAROUSEL_MAX_DOTS} ${few.slides[1].insight}"`); // 점 버튼의 이름은 표제어(SPEC-005 SH1)
    expect(dotsHtml.match(/aria-current="true"/g)?.length).toBe(1);
    // 6개부터는 점이 없다
    const many: CarouselData = { ...data, slides: data.slides.slice(0, CAROUSEL_MAX_DOTS) };
    expect(render({ carousel: many })).not.toContain('data-testid="carousel-dots"');
    // 하나뿐이면(첫 장만) 점도 없다
    expect(render({ carousel: { ...data, slides: [] } })).not.toContain('data-testid="carousel-dots"');
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

  it('자동 전환은 스크린리더가 읽지 않는다: 슬라이드 영역에 aria-live가 없고, 손으로 넘길 때만 읽는 전용 영역(.carousel__live, polite)이 처음엔 비어 있다 (D4-71)', () => {
    expect(html).toContain('aria-label="이전 지표"');
    expect(html).toContain('aria-label="다음 지표"');
    expect(html).toContain('aria-label="자동 넘김 일시정지"');
    expect(html).toContain('aria-pressed="false"'); // 멈춤/재생 단추의 상태
    expect(html).toContain('<div class="slides">');
    expect(html).toContain('<p class="sr-only carousel__live" aria-live="polite" aria-atomic="true" data-testid="carousel-live"></p>');
    expect(html).toContain('data-autoplay="on"');
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
    // 푸터의 「새 소식」「소개」「개인정보 처리방침」「이용 안내」(SPEC-005 QI7 · SPEC-004 GS12)는 같은 화면 안의 패널을 여는 링크라 `#`이다 — 네트워크로 나가지 않고 `data-panel`로 가려진다(넷)
    const panelLinks = links.filter((l) => l.href === '#');
    expect(panelLinks.length).toBe(4);
    for (const l of panelLinks) expect(l.tag, '주소가 #인 링크는 정보 패널을 여는 링크뿐').toContain('data-panel=');
    // 그 밖: 전화(tel:)·https(출처·GitHub 이슈) · 문의 메일 주소(mailto: — 링크 이동일 뿐 자원을 불러오지 않는다)
    for (const { href } of links.filter((l) => l.href !== '#')) expect(href.startsWith('tel:') || href.startsWith('https://') || href.startsWith('mailto:'), href).toBe(true);
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

  it('푸터 통계 출처 줄은 쉼표 나열이다: 「통계 출처: 국가데이터처, 한국은행, 금융감독원, 행정안전부, 교육부, 기상청(국립기상과학원) (통계표 이름과 기준 연도는 그래프와 통계 카드마다 적혀 있어요)」 — 기관 이름 사이에 「·」가 없다 (QM2-10 b · QI4 2단계: 3곳 → 7곳 · R-488: 같은 기관은 한 번만 → 6곳 · GS12: 꼬리를 해요체 「그래프와 통계 카드마다 적혀 있어요」로)', () => {
    const credit = html.slice(html.indexOf('data-testid="stats-credit"'), html.indexOf('</p>', html.indexOf('data-testid="stats-credit"')) + 4);
    // 1단계까지의 기대 글자(국가데이터처, 행정안전부, 교육부 — 3곳)를 슬라이드 20장에서 모인 7곳으로 바꿨다가, R-488로 「통계청(현 국가데이터처)」를 「국가데이터처」에 모아 6곳이 됐다(tests/glue.test.ts 「실제 푸터」와 같은 글자)
    expect(text(credit)).toContain('통계 출처: 국가데이터처, 한국은행, 금융감독원, 행정안전부, 교육부, 기상청(국립기상과학원) (통계표 이름과 기준 연도는 그래프와 통계 카드마다 적혀 있어요)');
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

  // (한 줄 부제의 줄바꿈 묶음은 위 「첫 화면 구성」의 부제 시험이 본다 — 「같은 대한민국」 nowrap, SPEC-004 N30)

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

describe('REV-004-GM4-1 반영: 안내·실패 문구 (R-516 · R-519 b · regionHint)', () => {
  it('R-516: 밀린 탭의 이어받기가 지연 데이터를 못 받으면 밀린 화면에 안내 한 줄(role=alert)과 같은 버튼이 남는다 — 정상일 때는 안내가 없다', async () => {
    const { SupersededScreen } = await import('../src/screens/SupersededScreen');
    const ok = renderToStaticMarkup(<SupersededScreen onTakeOver={() => {}} />);
    expect(ok).not.toContain('data-testid="take-over-failed"');
    const failed = renderToStaticMarkup(<SupersededScreen onTakeOver={() => {}} loadFailed />);
    expect(failed).toContain(`role="alert" data-testid="take-over-failed">${TITLE_TEXT.loadFailed}</p>`);
    expect(failed).toContain('data-testid="take-over"'); // 같은 버튼을 다시 눌러 다시 시도한다
  });

  it('R-519 b: 「직접 고르기」에서 칩을 고르지 않고 태어나려 할 때의 안내 문구(draft)가 data의 첫 화면 문구 모음에 있다 — 시·도를 고르거나 「룰렛에 맡기기」를 고르라는 뜻', () => {
    expect(GEN_TEXT.regionPickNeeded).toBe('시·도를 고르거나, 「룰렛에 맡기기」를 골라 주세요.');
    expect(GEN_TEXT.regionPickNeeded).toContain(GEN_TEXT.regionRoulette);
    expect(titleScreenSrc).toContain('GEN_TEXT.regionPickNeeded');
    expect(titleScreenSrc).toContain('pickBlocked ? requirePick()'); // 「태어나기」·「새로 태어나기」 둘 다 진행하지 않는다
  });

  it('참고 regionHint: 1940~1980년생(인구 비례)에게도 맞는 말 — 「그해 시·도별 출생아·인구 비율대로」', () => {
    expect(GEN_TEXT.regionHint).toBe('룰렛은 그해 시·도별 출생아·인구 비율대로 돌아요.');
  });

  it('R-519 a: 내 출신 시도 바로가기는 라디오가 아니라 단추다 — 같은 시도의 일반 칩과 함께 「고른」 모양이 되지 않는다 (소스: chip은 label+radio, originShortcut은 button)', () => {
    expect(titleScreenSrc).toMatch(/<button type="button" className=\{`chip-opt chip-opt--origin/);
    expect(titleScreenSrc).not.toContain("origin ? 'sido-origin'");
  });
});
