import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import copyMd from '../docs/design/copy.md?raw';
import { TitleScreen } from '../src/screens/TitleScreen';
import { TITLE_TEXT } from '../src/data/titleText';
import { readThemeBlocks, themeTokens } from '../scripts/checkContrastLib';

/**
 * 첫 화면 개편의 구조·CSS 규칙 (SPEC-005 QI3 HS1~HS5·SH4~SH6, diff-005.md 7절 D5-24~D5-33). 서버 렌더로 마크업을 보고 CSS는 글로 읽는다 —
 * 실제 폭·겹침·가림은 e2e/first-screen-layout.spec.ts가 브라우저에서 잰다. 이 파일은 그 약속의 바탕(마크업 계약·CSS 값·토큰·문구 일치)을 잠근다.
 */

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 파일 시스템으로 읽는다 */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const titleCss = await readText('../src/styles/title.css');
const tokensCss = await readText('../src/styles/tokens.css');
const stripComments = (css: string): string => css.replace(/\/\*[^]*?\*\//g, '');
const css = stripComments(titleCss);

function render(gentle?: { on: boolean; onToggle: () => void }): string {
  return renderToStaticMarkup(<TitleScreen generation="random" lifeLength="short30" onSelectGeneration={() => {}} onSelectLifeLength={() => {}} onBegin={() => {}} gentle={gentle} />);
}
const html = render();

/** 규칙 하나의 본문 (주석을 뺀 CSS에서, 첫 번째 일치) */
function ruleBody(selector: string, source: string = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  expect(m, `규칙 ${selector}`).not.toBeNull();
  return m![1];
}

describe('그림이 없다 (SPEC-004 GS11 · 3차): 오른쪽 위 일러스트·지도 자산을 모두 걷어 냈다', () => {
  it('마크업에 figure·img·picture가 하나도 없고, 일러스트 자리(data-testid home-illust-*)와 가상 인구 줄·수저 줄이 없다', () => {
    expect(html).not.toMatch(/<figure|<img\b|<picture|illust/);
    for (const gone of ['home-illust', 'spoon-lineup', 'population-line', 'population-note', 'population-info', 'log__pin']) expect(html, gone).not.toContain(gone);
    expect(html).not.toContain('한 판 약 30분');
  });

  it('CSS에 .illust 규칙·--illust-* 변수가 없고, tokens.css에도 없다', () => {
    expect(css).not.toMatch(/\.illust|--illust/);
    expect(tokensCss).not.toContain('--illust');
  });

  it('자산: home-map-*.webp 파일이 저장소에 없고, 소스 어디에서도 가져오지 않는다', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { existsSync(p: URL): boolean; readdirSync(p: URL): string[] };
    expect(fs.existsSync(new URL('../src/assets/home/', import.meta.url)), 'src/assets/home 폴더').toBe(false);
    const all = Object.keys(import.meta.glob('../src/**/*.{ts,tsx,css}', { query: '?raw', eager: false }));
    expect(all.length).toBeGreaterThan(50); // 공허 통과 방지
    for (const url of Object.values(import.meta.glob('../src/**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true })) as string[]) expect(url).not.toContain('home-map');
  });

  it('외부 요청 0(FS8): 첫 화면 마크업이 불러오는 주소(src·srcSet)에 외부 주소가 없다 (푸터의 출처 링크 href는 사용자가 누를 때만 열리는 이동이라 요청이 아니다)', () => {
    expect(html).not.toMatch(/(?:src|srcSet)="(?:https?:)?\/\//);
  });

  it('머리(header)는 로고 → 한 줄 설명 → 기간 문장 순이고, 세대 고르기 fieldset이 그 다음, 통계 카드는 오른쪽 열(aside) 맨 위에서 시작한다', () => {
    const header = html.slice(html.indexOf('<header class="hero hero--005'), html.indexOf('</header>'));
    expect(header.indexOf('</h1>')).toBeGreaterThan(0);
    expect(header.indexOf('</h1>')).toBeLessThan(header.indexOf('class="hero__tag"'));
    expect(header.indexOf('class="hero__tag"')).toBeLessThan(header.indexOf('data-testid="hero-span"'));
    expect(html.indexOf('</header>')).toBeLessThan(html.indexOf('slot--gen8'));
    const aside = html.slice(html.indexOf('<aside class="title__side">'), html.indexOf('</aside>'));
    expect(aside.trimStart().startsWith('<aside class="title__side"><section class="card carousel carousel--005"'), '오른쪽 열 맨 위가 통계 카드').toBe(true);
  });
});

describe('세대 목록 마크업 (GS1·GS2·GS4·GS10): 한 열 라디오 줄 8개', () => {
  const rows = [...html.matchAll(/<label class="gen-row[^"]*" data-testid="gen-row-([a-z0-9]+)">/g)].map((m) => m[1]);

  it('라디오 묶음 하나(role=radiogroup, 이름 「태어날 세대」)에 줄 8개: 랜덤 세대 → 산업화 → 베이비붐 → 86 → X → 밀레니얼 → Z → 알파', () => {
    expect(html).toContain('<div class="gen-list" role="radiogroup" aria-label="태어날 세대" data-testid="gen-list">');
    expect(rows).toEqual(['random', 'industrial', 'boomer', 'g86', 'genx', 'millennial', 'genz', 'alpha']);
    expect(html.match(/<input type="radio"[^>]*name="gen"/g)?.length).toBe(8);
  });

  it('기본은 랜덤 세대가 눌려 있고(is-selected · checked), 랜덤 줄에는 메타가 없고 세대 줄에는 「{범위}년생 · 올해 N~M세」 메타가 있다', () => {
    expect(html).toMatch(/<label class="gen-row is-selected" data-testid="gen-row-random">/);
    expect(html.match(/gen-row is-selected"/g)?.length, '고른 줄은 하나').toBe(1);
    const random = html.slice(html.indexOf('data-testid="gen-row-random"'), html.indexOf('data-testid="gen-row-industrial"'));
    expect(random).not.toContain('gen-row__meta');
    expect(html.match(/class="gen-row__meta"/g)?.length).toBe(7);
    // 메타는 Glue 묶음이다: 「범위 · 나이」가 한 묶음(keep-phrase)이고 안의 숫자+단위는 줄바꿈 금지(nowrap) — 「·」가 줄 끝에 혼자 남지 않는다
    for (const [id, text] of [['genx', '1970~1980년생 · 올해 46~56세'], ['alpha', '2013~2020년생 · 올해 6~13세']]) {
      const start = html.indexOf(`id="gen-meta-${id}">`) + `id="gen-meta-${id}">`.length;
      expect(start, id).toBeGreaterThan(0);
      const meta = html.slice(start, html.indexOf('<span class="gen-row__desc"', start));
      expect(meta.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), id).toBe(text);
      expect(meta, id).toContain('keep-phrase');
    }
  });

  it('고른 줄에는 체크 표식과 스크린리더용 「선택됨」이 있고 색에만 기대지 않는다', () => {
    const random = html.slice(html.indexOf('data-testid="gen-row-random"'), html.indexOf('data-testid="gen-row-industrial"'));
    expect(random).toContain('선택됨');
    expect(random).toContain('gen-row__mark');
  });

  it('살아본 세대가 없으면 「살아봄」 표시가 없다 (GS10) — 순위·점수 말도 없다', () => {
    expect(html).not.toContain('gen-row__lived');
    expect(html).not.toMatch(/점수|순위|업적/);
  });
});

describe('통계 카드 색 토큰 (D5-27 → SPEC-004 D4-55 평면화)', () => {
  const blocks = readThemeBlocks(tokensCss);

  it('라이트·다크 두 블록 모두 --c-chart가 있고(값은 12-6 표 그대로), 평면화로 쓰는 곳이 없어진 --c-card-tint·--c-card-border·--shadow-card는 어디에도 없다', () => {
    const light = themeTokens(blocks, 'light');
    const dark = themeTokens(blocks, 'dark');
    expect(light['--c-chart']).toBe('#2f5f8f');
    expect(dark['--c-chart']).toBe('#9fc4ea');
    expect(blocks.darkMedia['--c-chart']).toBe(blocks.darkAttr['--c-chart']); // 다크 두 블록이 같다
    for (const t of ['--c-card-tint', '--c-card-border', '--shadow-card']) {
      expect(stripComments(tokensCss), t).not.toContain(t);
      expect(css, t).not.toContain(t);
    }
  });

  it('강제 색상 블록은 시스템 색으로 돌아간다: --c-chart ButtonText', () => {
    const forced = tokensCss.slice(tokensCss.indexOf('@media (forced-colors: active)'));
    expect(forced).toMatch(/--c-chart: ButtonText;/);
  });

  it('통계 카드(.carousel--005)는 평면이다: 카드 안 --c-brand만 --c-chart로 바꾸고 하늘 띠 그라디언트·푸른 그림자·카드 전용 테두리색이 없다 — 공용 .card의 면 + 1px 경계 그대로 (D4-55 정본)', () => {
    const body = ruleBody('.carousel--005');
    expect(body).toContain('--c-brand: var(--c-chart)');
    expect(body).toContain('box-shadow: none');
    expect(body).not.toContain('gradient');
    expect(ruleBody('.card')).toMatch(/background:\s*var\(--c-surface\)/); // 공용 카드는 그대로
    expect(ruleBody('.card')).toMatch(/border:\s*1px solid var\(--c-border\)/);
    expect(html.match(/carousel--005/g)?.length).toBe(1);
    expect(css.match(/var\(--c-chart\)/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('조작 버튼 상자는 테두리·면 없이 아이콘만이다(강제 색상에서만 경계를 남긴다)', () => {
    const box = ruleBody('.nav-btn__box');
    expect(box).toContain('border: 1px solid transparent');
    expect(box).toContain('background: transparent');
  });
});

describe('조작 줄 · 분절 컨트롤 크기 (SH5 ① · HS2 ⑤ — 보이는 크기가 작아도 클릭 대상은 지킨다)', () => {
  it('조작 버튼: 보이는 상자 28px(≤ 32px▲), 포인터 환경 클릭 대상 28 ≥ 24×24, 거친 포인터에서 버튼 자신이 44×44 (요소 넘침 0)', () => {
    expect(ruleBody('.nav-btn')).toMatch(/width:\s*28px;\s*height:\s*28px/);
    expect(ruleBody('.nav-btn__box')).toMatch(/width:\s*28px;\s*height:\s*28px/);
    expect(css).toMatch(/@media \(pointer: coarse\) \{\s*\.nav-btn \{ width: 44px; height: 44px; \}/);
  });

  it('분절 컨트롤: 보이는 칸 높이 32px, 거친 포인터에서 라디오 input이 위아래 8px씩 넓어 44px(높이를 calc로 직접 준다 — WebKit은 top·bottom만으로는 input을 늘리지 않는다)', () => {
    expect(ruleBody('.seg__opt')).toMatch(/min-height:\s*32px/);
    expect(css).toMatch(/@media \(pointer: coarse\) \{\s*\.seg__opt input \{ top: -8px; bottom: auto; height: calc\(100% \+ 16px\); \}/);
  });

  it('큰 슬롯(세대 목록)은 한 열 스크롤 창이다(GS1): 높이가 제한되고 안에서 스크롤하며 줄은 최소 44px(--hit)다 — 줄 수에 따라 열이 길어지지 않는다', () => {
    expect(ruleBody('.gen-list')).toMatch(/max-height:/);
    expect(ruleBody('.gen-list')).toMatch(/overflow-y:\s*auto/);
    expect(ruleBody('.gen-row')).toMatch(/min-height:\s*var\(--hit\)/);
    expect(html.match(/class="gen-row[ "]/g)?.length).toBe(8);
  });
});

describe('설정 줄 — 「무거운 장면 가리기」 스위치 자리 (HV3 · HS3 ④, 동작은 QI6)', () => {
  it('QI6 전에는 App이 넘기지 않아 첫 화면에 스위치가 그려지지 않는다(동작하지 않는 스위치를 보이지 않는다) — 슬롯(.slots-bottom)은 태어나는 시도·인생 길이로 이미 자리가 잡혀 있다', () => {
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain('gentle-slot');
    expect(html).toContain('<div class="slots-bottom">');
    expect(html.indexOf('data-testid="gen-list"')).toBeLessThan(html.indexOf('class="slots-bottom"'));
    expect(html.indexOf('class="slots-bottom"')).toBeLessThan(html.indexOf('data-testid="life-length-group"'));
  });

  it('gentle을 넘기면 인생 길이 아래 설정 줄에 스위치가 그려진다: role=switch + aria-checked, 이름(aria-labelledby)·설명(aria-describedby), 켜짐/꺼짐 글자(aria-hidden) — 슬롯 순서: 큰 슬롯 → 인생 길이 → 설정 줄', () => {
    const off = render({ on: false, onToggle: () => {} });
    expect(off).toMatch(/<button type="button" class="switch" role="switch" aria-checked="false" aria-labelledby="gentle-name" aria-describedby="gentle-desc" data-testid="gentle-switch">/);
    expect(off).toContain(`<span class="switch__name" id="gentle-name">${TITLE_TEXT.gentleName}</span>`);
    expect(off).toContain(`<span class="switch__state" aria-hidden="true">꺼짐</span>`);
    expect(off).toContain(`<span class="switch__desc" id="gentle-desc">${TITLE_TEXT.gentleDesc}</span>`);
    expect(off.indexOf('data-testid="life-length-group"')).toBeLessThan(off.indexOf('data-testid="gentle-switch"'));
    const on = render({ on: true, onToggle: () => {} });
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('<span class="switch__state" aria-hidden="true">켜짐</span>');
  });

  it('문구는 copy.md 9-5 그대로다 — 이름 「무거운 장면 가리기」(형진 님 답 M12), 설명 「아픈 일이나 이별 같은 장면의 글만 가려요. 일어나는 일은 같아요.」', () => {
    const sec = copyMd.slice(copyMd.indexOf('### 9-5.'), copyMd.indexOf('### 9-6.'));
    expect(sec).toContain(`「${TITLE_TEXT.gentleName}」`);
    expect(sec).toContain(`「${TITLE_TEXT.gentleDesc}」`);
    expect(sec).toContain(`「${TITLE_TEXT.gentleOff}」 / 「${TITLE_TEXT.gentleOn}」`);
    expect(TITLE_TEXT.gentleName).toBe('무거운 장면 가리기');
    for (const t of [TITLE_TEXT.gentleDesc, TITLE_TEXT.gentleName]) {
      expect(t).not.toMatch(/순한 맛|마음 놓고/); // 은유 이름은 쓰지 않는다(형진 님 답 M12)
      expect(t).not.toMatch(/[!！]/);
    }
  });

  it('스위치 CSS: 트랙 40×24 + 썸 16px, 켜짐 = 트랙 --c-brand + 썸 이동 + 상태 알약(색에만 의존하지 않는다), 버튼 높이 ≥ --hit(44px), 강제 색상은 Highlight 트랙', () => {
    expect(ruleBody('.switch__track')).toMatch(/width:\s*40px;\s*height:\s*24px/);
    expect(ruleBody('.switch__thumb')).toMatch(/width:\s*16px;\s*height:\s*16px/);
    expect(css).toContain(".switch[aria-checked='true'] .switch__thumb { transform: translateX(16px);");
    expect(ruleBody('.switch')).toMatch(/min-height:\s*var\(--hit\)/);
    expect(css).toMatch(/\.switch\[aria-checked='true'\] \.switch__track \{ forced-color-adjust: none; background: Highlight;/);
  });
});

describe('copy.md 9절 문구와 구현 상수 (CM-C)', () => {
  it('인생 길이 안내·캐러셀 조작 이름·머리 삭제 규칙이 9절에 그대로 적혀 있다', () => {
    const sec9 = copyMd.slice(copyMd.indexOf('## 9. SPEC-005 QI2'), copyMd.indexOf('## 10. SPEC-005 QI1'));
    expect(sec9).toContain(`「${TITLE_TEXT.lifeLengthHint.replace('이 기기에', '이 기기에')}」`);
    expect(sec9).toContain(`「${TITLE_TEXT.carouselPause}」`);
    expect(sec9).toContain(`「${TITLE_TEXT.carouselPlay}」`);
    expect(sec9).toContain(`「${TITLE_TEXT.carouselPrev}」`);
    expect(sec9).toContain(`「${TITLE_TEXT.carouselNext}」`);
    expect(sec9).toContain('**9초**');
  });
});

describe('GM4 2차 ④ 접는 선: 1280×800 왼쪽 열 끝 < 하단 띠 (CSS 값 — 실측은 e2e/first-screen-qi4.spec.ts·first-screen-gentle-layout.spec.ts)', () => {
  it('PC 세대 목록 창: 하한 9rem · 식 100vh − 37.5rem − (띠 − 68px) · 상한 24rem, 좁은 화면 식(하한 12rem)은 그대로다', () => {
    expect(css).toContain('@media (min-width: 960px) { .gen-list { --gen-list-h: clamp(9rem, 100vh - 37.5rem - var(--bar-h, 68px) + 68px, 24rem); } }');
    expect(css).toMatch(/\.gen-list \{ --gen-list-h: clamp\(12rem, 100svh - 27rem - var\(--bar-h, 68px\) \+ 68px, 24rem\);/);
  });
  it('설정 둘(무거운 장면 가리기 · 내 출신 시도)은 PC에서 한 줄 두 칸이고 태어나는 시도·인생 길이는 전체 폭이다', () => {
    expect(css).toMatch(/\.slots-bottom \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css).toContain('.slots-bottom > .slot--small { grid-column: 1 / -1; }');
  });
  it('제목 워드마크 --logo-h: 좁은 화면 64px · ≥ 960px 84px (GS11 제목 확대), 「한 판 약 30분」 줄·수저 다섯 자루 줄은 없다', () => {
    expect(css).toContain('.hero .logo--word { --logo-h: 64px;');
    expect(css).toContain('.hero .logo--word { --logo-h: 84px; }');
    expect(html).not.toContain('hero__time');
    expect(visibleTextOf(html)).not.toContain('한 판 약 30분');
  });
});
function visibleTextOf(h: string): string {
  return h.replace(/<[^>]+>/g, ' ');
}
