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
  return renderToStaticMarkup(<TitleScreen era="present" lifeLength="short30" onSelectEra={() => {}} onSelectLifeLength={() => {}} onBegin={() => {}} minute={29_850_000} gentle={gentle} />);
}
const html = render();

/** 규칙 하나의 본문 (주석을 뺀 CSS에서, 첫 번째 일치) */
function ruleBody(selector: string, source: string = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  expect(m, `규칙 ${selector}`).not.toBeNull();
  return m![1];
}

describe('일러스트 마크업 (HS1 · D5-24): 장식 — 이름은 로고가 말한다', () => {
  const figures = [...html.matchAll(/<figure class="illust illust--(banner|top)" aria-hidden="true" data-testid="home-illust-(?:banner|top)">[\s\S]*?<\/figure>/g)];

  it('같은 그림이 두 자리(배너·오른쪽 열 맨 위)에 있고 둘 다 figure[aria-hidden] > picture > source + img[alt=""] 이다', () => {
    expect(figures.map((m) => m[1])).toEqual(['banner', 'top']);
    for (const [markup] of figures) {
      expect(markup).toMatch(/<picture><source media="\(min-width: 960px\)" srcSet="[^"]+home-map-pc[^"]*\.webp" type="image\/webp"\/><img loading="lazy" decoding="async" width="375" height="440" alt="" src="[^"]+home-map-mobile[^"]*\.webp"\/><\/picture>/);
      // R-450: `loading="lazy"`가 `src`보다 앞에 있다 — React가 쓴 속성 순서대로 DOM에 주므로 `src`를 주는 순간 이미 lazy여야 WebKit이 `source`가 붙기 전에 모바일 파일을 먼저 받지 않는다
      expect(markup.indexOf('loading="lazy"')).toBeGreaterThan(-1);
      expect(markup.indexOf('loading="lazy"')).toBeLessThan(markup.indexOf(' src="'));
    }
  });

  it('대체 글이 없다(장식): 접근 가능한 이름·글자가 없고 figure 안에 글자 0, 클릭·선택 기능이 없다', () => {
    for (const [markup] of figures) {
      expect(markup.replace(/<[^>]+>/g, '').trim(), '그림 안 글자 0').toBe('');
      expect(markup).not.toMatch(/aria-label|role=|tabindex|onclick|<a |<button|<map|usemap/i);
      expect(markup).toContain('alt=""');
    }
    // 그림 자리 밖에 대체 글을 가진 이미지가 없다 — 이 화면의 <img>는 일러스트 둘뿐이다
    expect(html.match(/<img\b/g)?.length).toBe(2);
    expect(html.match(/<img\b[^>]*\balt="[^"]/g)).toBeNull();
  });

  it('외부 요청 0(FS8): 그림 주소가 같은 출처의 자산이다(vite 해시 이름), 외부 주소·data 주소가 아니다', () => {
    for (const m of html.matchAll(/(?:src|srcSet)="([^"]+)"/g)) {
      expect(m[1], '그림 주소').not.toMatch(/^(https?:)?\/\//);
      expect(m[1]).toMatch(/home-map-(pc|mobile)/);
    }
  });

  it('배너는 머리(header) 안 로고 줄 바로 아래, 위쪽 그림은 aside(오른쪽 열) 맨 위 통계 카드 앞에 있다', () => {
    const header = html.slice(html.indexOf('<header class="hero hero--005">'), html.indexOf('</header>'));
    expect(header.indexOf('</h1>')).toBeGreaterThan(0);
    expect(header.indexOf('illust--banner')).toBeGreaterThan(header.indexOf('</h1>'));
    expect(header.indexOf('illust--banner')).toBeLessThan(header.indexOf('class="hero__tag"'));
    const aside = html.slice(html.indexOf('<aside class="title__side">'), html.indexOf('</aside>'));
    expect(aside.indexOf('illust--top')).toBeGreaterThan(-1);
    expect(aside.indexOf('illust--top')).toBeLessThan(aside.indexOf('data-testid="carousel"'));
  });
});

describe('일러스트 CSS (D5-24~D5-26·D5-29·D5-32·D5-33): 크기·겹침·흐림 2단계 「부드럽게」', () => {
  it('높이는 CSS 변수 --illust-h(배너 224px · ≥ 960px 420px · ≥ 1600px 500px), width auto + max-width 100% + object-fit: contain — 찌그러짐 0', () => {
    expect(ruleBody('.illust img')).toMatch(/height:\s*var\(--illust-h,\s*224px\)/);
    expect(ruleBody('.illust img')).toMatch(/width:\s*auto/);
    expect(ruleBody('.illust img')).toMatch(/max-width:\s*100%/);
    expect(ruleBody('.illust img')).toMatch(/object-fit:\s*contain/);
    expect(ruleBody('.illust--banner')).toMatch(/--illust-h:\s*224px/);
    // R-447(D5-34): 겹침은 그림 높이의 7.62% — 420px에서 32px, 500px에서 36px 그대로이고(min), 낮은 창에서 그림이 줄면 같이 줄어든다
    expect(css).toMatch(/\.illust--top \{[^}]*--illust-h:\s*420px;[^}]*--illust-tuck:\s*min\(32px,\s*calc\(var\(--illust-h\) \* 0\.0762\)\);[^}]*margin-bottom:\s*calc\(-1 \* var\(--illust-tuck\)\)/);
    expect(css).toMatch(/@media \(min-width: 1600px\) \{\s*\.illust--top \{[^}]*--illust-h:\s*500px;[^}]*--illust-tuck:\s*min\(36px,\s*calc\(var\(--illust-h\) \* 0\.0762\)\)/);
  });

  it('낮은 창(R-447, D5-34): 그림 높이는 창 높이에 맞춰 clamp(224px, (100vh − 334px) ÷ 0.924, 420px | 500px)로 줄고, clamp()를 모르는 엔진은 @supports 밖의 420·500px 그대로다', () => {
    expect(css).toMatch(/@supports \(height: clamp\(1px, 2px, 3px\)\) \{\s*\.illust--top \{ --illust-h: clamp\(224px, calc\(\(100vh - 334px\) \/ 0\.924\), 420px\); \}/);
    expect(css).toMatch(/@supports \(height: clamp\(1px, 2px, 3px\)\) \{\s*\.illust--top \{ --illust-h: clamp\(224px, calc\(\(100vh - 334px\) \/ 0\.924\), 500px\); \}/);
  });

  it('배너는 < 960px에서만, 오른쪽 열 그림은 ≥ 960px에서만 보인다(같은 그림이라 한 번에 하나)', () => {
    expect(ruleBody('.illust')).toMatch(/display:\s*none/);
    expect(ruleBody('.illust--banner')).toMatch(/display:\s*flex/);
    const wide = css.slice(css.indexOf('@media (min-width: 960px)'));
    expect(wide).toMatch(/\.illust--banner \{ display: none; \}/);
    expect(wide).toMatch(/\.illust--top \{ display: flex;/);
  });

  it('통계 카드가 그림 위에 얹힌다: .carousel--005에 position: relative + z-index: 1 (filter·opacity가 있는 img는 자체 스태킹 컨텍스트라 카드를 띄워야 그림이 뒤로 간다, D5-32)', () => {
    const body = ruleBody('.carousel--005');
    expect(body).toMatch(/position:\s*relative/);
    expect(body).toMatch(/z-index:\s*1\b/);
  });

  it('흐림 2단계(형진 님 확인): 라이트 opacity 0.8 + saturate(.85) contrast(.92) blur(.5px) / 다크 같은 불투명도 + brightness(.9) saturate(.78) contrast(.92) blur(.5px) / 강제 색상 불투명·filter 없음', () => {
    expect(ruleBody('.illust')).toMatch(/--illust-opacity:\s*0\.8;/);
    expect(ruleBody('.illust')).toMatch(/--illust-filter:\s*saturate\(0\.85\) contrast\(0\.92\) blur\(0\.5px\);/);
    expect(ruleBody('.illust img')).toMatch(/opacity:\s*var\(--illust-opacity\)/);
    expect(ruleBody('.illust img')).toMatch(/filter:\s*var\(--illust-filter\)/);
    // 다크: 미디어쿼리(수동 라이트가 아닐 때) + 수동 다크 — 테마 규칙(DB6) 두 선택자
    const DARK = 'brightness(0.9) saturate(0.78) contrast(0.92) blur(0.5px)';
    expect(css).toContain(`:root:not([data-theme='light']) .illust { --illust-filter: ${DARK}; }`);
    expect(css).toContain(`:root[data-theme='dark'] .illust { --illust-filter: ${DARK}; }`);
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \.illust/);
    // 강제 색상: 세 선택자(다크 두 규칙과 같은 특이도 + 소스 순서)로 값이 불투명·filter 없음
    expect(css).toContain(".illust, :root:not([data-theme='light']) .illust, :root[data-theme='dark'] .illust { --illust-opacity: 1; --illust-filter: none; }");
    expect(css.indexOf('--illust-opacity: 1;'), '강제 색상 규칙은 다크 규칙보다 뒤').toBeGreaterThan(css.indexOf(`--illust-filter: ${DARK}`));
    // 흐림은 파일에 굽지 않는다 — CSS 변수가 맡는다(자산 한 벌). 첫 화면 지역 변수라 tokens.css에 넣지 않는다
    expect(tokensCss).not.toContain('--illust');
  });

  it('그림 위에 글·UI를 얹지 않는다: 그림 요소(figure) 안에는 img뿐이고 CSS가 figure에 글자·버튼을 위치시키지 않는다', () => {
    expect(css).not.toMatch(/\.illust[^{]*\{[^}]*(position:\s*absolute|[;{\s]content:)/); // (justify-content 같은 속성 이름은 앞에 하이픈이 있어 걸리지 않는다)
  });
});

describe('통계 카드 색 토큰 4개 (D5-27 · design-system.md 12-6)', () => {
  const blocks = readThemeBlocks(tokensCss);

  it('라이트·다크 두 블록 모두 --c-chart·--c-card-tint·--c-card-border·--shadow-card가 있다 (값은 12-6 표 그대로)', () => {
    const light = themeTokens(blocks, 'light');
    const dark = themeTokens(blocks, 'dark');
    expect([light['--c-chart'], light['--c-card-tint'], light['--c-card-border']]).toEqual(['#2f5f8f', '#eef4f9', '#d3dce6']);
    expect(light['--shadow-card']).toBe('0 1px 2px rgba(38, 50, 74, 0.06), 0 8px 20px rgba(38, 50, 74, 0.08)');
    expect([dark['--c-chart'], dark['--c-card-tint'], dark['--c-card-border'], dark['--shadow-card']]).toEqual(['#9fc4ea', '#1f2735', '#343d4e', 'none']);
    expect(blocks.darkMedia['--c-chart']).toBe(blocks.darkAttr['--c-chart']); // 다크 두 블록이 같다
  });

  it('강제 색상 블록은 시스템 색으로 돌아간다: --c-chart ButtonText · --c-card-tint Canvas · --c-card-border CanvasText · --shadow-card none', () => {
    const forced = tokensCss.slice(tokensCss.indexOf('@media (forced-colors: active)'));
    expect(forced).toMatch(/--c-chart: ButtonText;\s*--c-card-tint: Canvas;\s*--c-card-border: CanvasText;\s*--shadow-card: none;/);
  });

  it('통계 카드(.carousel--005)만 새 토큰을 쓴다: 카드 안 --c-brand를 --c-chart로 바꾸고 테두리·그림자·위쪽 88px 띠를 맞춘다 — 공용 .card·다른 카드는 그대로', () => {
    const body = ruleBody('.carousel--005');
    expect(body).toContain('--c-brand: var(--c-chart)');
    expect(body).toContain('border-color: var(--c-card-border)');
    expect(body).toContain('box-shadow: var(--shadow-card)');
    expect(body).toContain('linear-gradient(180deg, var(--c-card-tint) 0, var(--c-surface) 88px)');
    expect(ruleBody('.card')).toMatch(/background:\s*var\(--c-surface\)/); // 공용 카드는 그대로
    expect(html.match(/carousel--005/g)?.length).toBe(1);
    for (const t of ['--c-chart', '--c-card-tint', '--c-card-border', '--shadow-card']) {
      const uses = css.match(new RegExp(`var\\(${t}\\)`, 'g'))?.length ?? 0;
      expect(uses, `${t}를 쓰는 곳`).toBeGreaterThanOrEqual(1);
    }
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

  it('슬롯 격자(HS3 ①): 큰 슬롯은 카드 수·열 수에 의존하지 않는 auto-fit 격자다 — 3장이든 8장이든 같은 컴포넌트', () => {
    expect(ruleBody('.choices--grid')).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*15rem\),\s*1fr\)\)/);
    expect(html).toContain('class="choices choices--grid" role="radiogroup" aria-label="태어날 세상"');
    expect(html.match(/radio-card radio-card--compact/g)?.length).toBe(3);
  });
});

describe('설정 줄 — 「무거운 장면 가리기」 스위치 자리 (HV3 · HS3 ④, 동작은 QI6)', () => {
  it('QI6 전에는 App이 넘기지 않아 첫 화면에 스위치가 그려지지 않는다(동작하지 않는 스위치를 보이지 않는다) — 슬롯(.slots-bottom)은 인생 길이 하나로 이미 자리가 잡혀 있다', () => {
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain('gentle-slot');
    expect(html).toContain('<div class="slots-bottom">');
    expect(html.indexOf('data-testid="era-group"')).toBeLessThan(html.indexOf('class="slots-bottom"'));
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
