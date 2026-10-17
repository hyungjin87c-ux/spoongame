import { describe, expect, it } from 'vitest';
import copyMd from '../docs/design/copy.md?raw';
import creditsMd from '../docs/design/credits.md?raw';
import { looksTopPercent } from '../src/core/birth';
import {
  AGE_GROUPS,
  LOOKS_TIER_MIN_SCORE,
  TIER_PARAMS,
  ageGroupOf,
  faceNodes,
  faceSvg,
  looksTierOf,
  type AgeGroupId,
  type FaceNode,
  type Gender,
  type LooksTier,
} from '../src/assets/faces/faceLayers';
import { REBIRTH_NOTE } from '../src/data/endingText';
import { PAIRS, checkTheme, contrastRatio, cvdRowSums, darkMismatch, deltaE2000, deltaE2000Lab, hueDistance, hueOf, lightness, luminance, parseHex, readThemeBlocks, simulateCvd, themeTokens } from '../scripts/checkContrastLib';
import { islandMetrics, pathPoints, spoonPath, symbolA } from '../scripts/design/brandSymbols.mjs';

/**
 * 디자인 자산 계약 (SPEC-003 DS2~DS5, designer가 넘기는 자산의 약속을 지킨다).
 * 이 파일은 designer가 만든 순수 자산(토큰·얼굴 레이어·SVG 파일·숟가락 도형)만 본다. 화면 컴포넌트(DS4 4번 「프로필 카드 ≥ 72px」, DS5 렌더 점검)는 developer가 tests/face.test.tsx로 잇는다.
 * REV-003-D-1 반영: R-120(숟가락 좌표), R-126(머리 채움 단계 무관), R-129(섬 크기 순서), R-128(지도 높이 70%), R-135②(구조 부품 없음).
 */

/**
 * vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로(CSS 처리 꺼짐) tokens.css만 파일 시스템으로 읽는다.
 * tests/ 설정에는 Node 타입이 없어서 모듈 이름을 변수로 둔 동적 import를 쓴다.
 */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const tokensCss = await readText('../src/styles/tokens.css');
const dsCss = await readText('../docs/design/mockups/ds.css');
const economyMockHtml = await readText('../docs/design/mockups/economy-m5.html');

const TIERS: LooksTier[] = [1, 2, 3, 4, 5];
const GENDERS: Gender[] = ['female', 'male'];
const AGES = AGE_GROUPS.map((g) => g.id);

describe('색 토큰: 두 테마 모두 WCAG AA (scripts/checkContrast.ts와 같은 계산)', () => {
  const blocks = readThemeBlocks(tokensCss);
  it('다크 토큰 두 블록(미디어쿼리 / data-theme)이 같은 값이다', () => {
    expect(darkMismatch(blocks)).toEqual([]);
  });
  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: 글자 4.5:1, 컨트롤·그림 3:1 점검 쌍 전부 통과 (실패 0)`, () => {
      const results = checkTheme(themeTokens(blocks, theme), theme);
      const fails = results.filter((r) => !r.pass).map((r) => `${r.pair.use} ${r.pair.fg} on ${r.pair.bg} = ${r.ratio.toFixed(2)}`);
      expect(fails).toEqual([]);
      expect(results.length).toBe(PAIRS.length);
      expect(results.length).toBeGreaterThanOrEqual(70);
    });
  }
  it('대비 계산식: 검정/흰색 21:1, 같은 색 1:1', () => {
    expect(contrastRatio(parseHex('#000'), parseHex('#fff'))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseHex('#777777'), parseHex('#777777'))).toBeCloseTo(1, 5);
  });
  it('수저 5단계: 단계마다 soft 바탕·ink 글자·solid 면 토큰이 라이트·다크 모두 있다 (색만으로 구분하지 않는 이름·아이콘·점은 시안으로 본다)', () => {
    for (const theme of ['light', 'dark'] as const) {
      const t = themeTokens(blocks, theme);
      for (let n = 1; n <= 5; n++) for (const k of ['', '-soft', '-ink']) expect(t[`--c-grade-${n}${k}`], `${theme} ${n}${k}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it('헤더 로고 토큰은 40px (DS1·R-128: 워드마크 글자 높이 ≥ 22px가 되는 최소 높이)', () => {
    expect(tokensCss).toMatch(/--logo-h-header:\s*40px/);
  });
  /**
   * REV-003-M2-5 R-251 (M4 착수 조건, designer 2026-10-17): 강제 색상 블록의 선택자가 `:root` 하나(특이도 (0,1,0))면 다크 두 블록 `:root:not([data-theme='light'])`·`:root[data-theme='dark']`((0,2,0))에
   * 져서 OS 다크·수동 다크 + 강제 색상에서 시스템 색 매핑이 다크 팔레트에 덮인다 — 밝은 고대비 테마 위에 수동 다크를 켜면 로고·선택 카드 글자·포커스 링(forced-color-adjust: none)이 사라진다.
   * 강제 색상 블록은 다크 두 선택자를 함께 적어 **특이도가 다크 블록 이상**이고 **소스 순서가 뒤**이며 `!important`를 쓰지 않는다(값은 그대로). 실제 렌더(라이트 고대비 + data-theme='dark'에서 로고·선택 카드 글자 대비 ≥ 3:1)는 M4 developer의 e2e.
   */
  const specificity = (selector: string): [number, number, number] => {
    let s = selector.trim().replace(/:not\(([^)]*)\)/g, ' $1 '); // :not()은 인자의 특이도
    const ids = (s.match(/#[\w-]+/g) ?? []).length;
    const attrs = (s.match(/\[[^\]]*\]/g) ?? []).length;
    s = s.replace(/\[[^\]]*\]/g, ' ');
    const classes = (s.match(/\.[\w-]+/g) ?? []).length;
    const pseudoElements = (s.match(/::[\w-]+/g) ?? []).length;
    s = s.replace(/::[\w-]+/g, ' ');
    const pseudoClasses = (s.match(/:[\w-]+/g) ?? []).length;
    const elements = (s.replace(/[.#:][\w-]+/g, ' ').match(/\b[a-zA-Z][\w-]*/g) ?? []).length;
    return [ids, attrs + classes + pseudoClasses, elements + pseudoElements];
  };
  const atLeast = (a: [number, number, number], b: [number, number, number]): boolean => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] >= b[2];
  it('R-251: 강제 색상 블록의 선택자는 다크 두 블록(미디어쿼리·data-theme) 각각과 특이도가 같거나 높고, 소스 순서가 뒤이며, !important가 없고 값은 그대로다', () => {
    const css = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '');
    // 자기 점검: 특이도 계산기
    expect(specificity(':root')).toEqual([0, 1, 0]);
    expect(specificity(":root:not([data-theme='light'])")).toEqual([0, 2, 0]);
    expect(specificity(":root[data-theme='dark']")).toEqual([0, 2, 0]);
    expect(specificity('html.bar-released .bottom-bar')).toEqual([0, 2, 1]);
    expect(atLeast([0, 1, 0], [0, 2, 0])).toBe(false);
    expect(atLeast([0, 2, 0], [0, 2, 0])).toBe(true);
    const forcedAt = css.indexOf('@media (forced-colors: active)');
    expect(forcedAt).toBeGreaterThan(0);
    const forced = css.slice(forcedAt);
    const m = /@media \(forced-colors: active\)\s*\{\s*([^{]+?)\s*\{([\s\S]*?)\n\s*\}/.exec(forced);
    expect(m, '강제 색상 블록의 첫 규칙').toBeTruthy();
    const selectors = m![1].split(',').map((x) => x.trim());
    const body = m![2];
    const darkSelectors = [":root:not([data-theme='light'])", ":root[data-theme='dark']"];
    // 다크 두 선택자가 강제 색상 블록에도 그대로 있다 — 다크·수동 다크에서 같은 특이도 + 뒤 순서로 이긴다. `:root`는 수동 라이트(어느 다크 블록도 맞지 않는 때)를 맡는다
    expect(selectors).toContain(':root');
    for (const d of darkSelectors) {
      expect(selectors, `강제 색상 블록에 ${d}`).toContain(d);
      const strongest = selectors.map(specificity).some((s) => atLeast(s, specificity(d)));
      expect(strongest, `특이도 ≥ ${d}`).toBe(true);
    }
    // 소스 순서: 강제 색상 블록은 다크 두 블록보다 뒤
    expect(forcedAt).toBeGreaterThan(css.indexOf(":root:not([data-theme='light'])"));
    expect(forcedAt).toBeGreaterThan(css.indexOf(":root[data-theme='dark']"));
    // !important로 이기지 않는다(토큰을 덮어쓰는 다른 길까지 막는다)
    expect(forced).not.toContain('!important');
    // 값은 그대로(REV-003-D-4 표식·로고·포커스 매핑)
    expect(body).toMatch(/--sp-mark:\s*Canvas;/);
    expect(body).toMatch(/--c-logo:\s*CanvasText;/);
    expect(body).toMatch(/--c-focus:\s*Highlight;/);
    expect(body).toMatch(/--c-bg:\s*Canvas;/);
    // 블록 분리기는 여전히 라이트·다크 세 블록을 찾는다(강제 색상 블록의 `:root[data-theme='dark']`는 다크 블록보다 뒤라 먼저 잡히지 않는다)
    expect(Object.keys(blocks.darkAttr).length).toBeGreaterThan(40);
    expect(blocks.darkAttr['--c-bg']).toBe('#14171f');
  });
  const STATS = ['--c-stat-health', '--c-stat-happy', '--c-stat-knowledge', '--c-stat-relation'];
  const STAT_NAME: Record<string, string> = { '--c-stat-health': '건강', '--c-stat-happy': '행복', '--c-stat-knowledge': '지식', '--c-stat-relation': '관계' };
  /**
   * R-172(e) 취지(참고 게임 캡처의 녹·황·청록·적갈 조합·순서를 피한다)를 REV-003-D-4 (iv)대로 자리별 금지로 좁혔다 — 일괄 35°~170° 금지는 ΔE 규칙이 이미 막는
   * 초록(▲)·금·청록(다이아) 밖의 올리브·연두까지 막아 선택지를 줄였다. 색상 간격은 실제 원형 거리(hueDistance)로 20° 이상을 잰다(예전 주석의 「20° 간격」은 칸 나누기였다, R-196).
   */
  it('R-172(e)·R-195(자리별 금지): 건강은 녹(90°~170°)이 아니고 행복은 황(35°~70°)이 아니며, 네 색의 색상 계열 순서가 캡처의 녹·황·청록·적갈이 아니고, 서로 색상 차 ≥ 20°(원형 거리)', () => {
    const family = (h: number) => (h >= 90 && h <= 170 ? 'green' : h >= 35 && h < 90 ? 'yellow' : h > 170 && h <= 215 ? 'teal' : h < 35 || h >= 345 ? 'redbrown' : 'other');
    for (const theme of ['light', 'dark'] as const) {
      const t = themeTokens(blocks, theme);
      const hues = STATS.map((k) => hueOf(parseHex(t[k])));
      for (const h of hues) expect(h, `${theme}: 무채색 아님`).toBeGreaterThanOrEqual(0);
      const [health, happy] = hues;
      expect(health < 90 || health > 170, `${theme}: 건강 ${health.toFixed(0)}° 는 녹 계열이 아니다`).toBe(true);
      expect(happy < 35 || happy > 70, `${theme}: 행복 ${happy.toFixed(0)}° 는 황 계열이 아니다`).toBe(true);
      expect(hues.map(family), `${theme}: 캡처의 계열 순서와 같지 않다`).not.toEqual(['green', 'yellow', 'teal', 'redbrown']);
      for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) {
        expect(hueDistance(hues[i], hues[j]), `${theme} ${STAT_NAME[STATS[i]]} ${hues[i].toFixed(0)}° ↔ ${STAT_NAME[STATS[j]]} ${hues[j].toFixed(0)}°`).toBeGreaterThanOrEqual(20);
      }
    }
    expect(hueDistance(350, 10)).toBe(20); // 원형 거리 자기 점검
    expect(hueDistance(10, 350)).toBe(20);
  });
  it('CIEDE2000 계산식 자기 점검: 같은 색 0, Sharma 2005 검증 쌍 1번 2.0425·7번 2.3669·18번 27.1492, 지적 당시 행복 #b85014 ↔ 동수저 #b05a2b 는 5 미만', () => {
    expect(deltaE2000(parseHex('#2f6db5'), parseHex('#2f6db5'))).toBeCloseTo(0, 9);
    expect(deltaE2000Lab([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
    expect(deltaE2000Lab([50, 0, 0], [50, -1, 2])).toBeCloseTo(2.3669, 3);
    expect(deltaE2000Lab([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 3);
    expect(deltaE2000(parseHex('#b85014'), parseHex('#b05a2b'))).toBeLessThan(5);
  });
  /**
   * REV-003-D-3 R-192: 뜻이 다른 토큰과 같은 색으로 보이지 않는다.
   * 기준 = CIEDE2000 ≥ 15 (상태 4색 ↔ 수저 5색 solid·▲ --c-up·▼ --c-down, 두 테마 각각). 10을 넘으면 따로 봐도 다른 색이고, 15는 지적 당시 값(3.5·2.9)의 4배가 넘는 여유다.
   * 상태 4색끼리는 ≥ 12 + 위 색상 20° 규칙(네 바는 늘 이름·아이콘·숫자·고정 순서와 함께 있다).
   * REV-003-D-4 R-195③: 뜻 없는 크롬 색 --c-link·--c-focus 도 비교 대상에 넣는다 — 기준 ≥ 10(따로 봐도 다른 색. 링크 글자·포커스 링은 상태 바와 같은 자리에 오지 않고
   * 뜻을 나르지 않으므로 수저·▲▼의 15보다 낮게 둔다. 지적 당시 라이트 지식 ↔ --c-link 는 1.4였다).
   */
  it('R-192·R-195③: 상태 4색은 두 테마 모두 수저 5색·▲·▼와 ΔE2000 ≥ 15, 서로는 ≥ 12, 크롬 색(--c-link·--c-focus)과는 ≥ 10 떨어져 있다', () => {
    const OTHERS = ['--c-grade-1', '--c-grade-2', '--c-grade-3', '--c-grade-4', '--c-grade-5', '--c-up', '--c-down'];
    const CHROME = ['--c-link', '--c-focus'];
    for (const theme of ['light', 'dark'] as const) {
      const t = themeTokens(blocks, theme);
      const de = (a: string, b: string) => deltaE2000(parseHex(t[a]), parseHex(t[b]));
      for (const s of STATS) {
        for (const o of OTHERS) expect(de(s, o), `${theme} ${s} ${t[s]} ↔ ${o} ${t[o]} = ${de(s, o).toFixed(1)}`).toBeGreaterThanOrEqual(15);
        for (const o of CHROME) expect(de(s, o), `${theme} ${s} ${t[s]} ↔ ${o} ${t[o]} = ${de(s, o).toFixed(1)}`).toBeGreaterThanOrEqual(10);
      }
      for (let i = 0; i < STATS.length; i++) for (let j = i + 1; j < STATS.length; j++) expect(de(STATS[i], STATS[j]), `${theme} ${STATS[i]} ↔ ${STATS[j]} = ${de(STATS[i], STATS[j]).toFixed(1)}`).toBeGreaterThanOrEqual(12);
    }
  });
  /**
   * REV-003-D-4 R-195①: 적록 색각 이상에서는 색상(a*)이 무너지므로 이웃 쌍은 **명도**로 갈라 둔다 — 지식↔관계(두 테마), 행복↔관계(두 테마) ΔL* ≥ 12.
   * 명도를 엇갈리게 두면서도 바↔트랙 3:1(라이트 L* ≤ 53, 다크 L* ≥ 52)은 위 「두 테마 모두 WCAG AA」 테스트가 그대로 지킨다.
   */
  it('R-195①: 이웃 쌍 지식↔관계·행복↔관계의 명도 차 ΔL* ≥ 12 (두 테마), 바 면은 트랙·면과 3:1 유지', () => {
    for (const theme of ['light', 'dark'] as const) {
      const t = themeTokens(blocks, theme);
      const L = Object.fromEntries(STATS.map((k) => [k, lightness(parseHex(t[k]))]));
      for (const [a, b] of [['--c-stat-knowledge', '--c-stat-relation'], ['--c-stat-happy', '--c-stat-relation']]) {
        expect(Math.abs(L[a] - L[b]), `${theme} ${STAT_NAME[a]} L*${L[a].toFixed(1)} ↔ ${STAT_NAME[b]} L*${L[b].toFixed(1)}`).toBeGreaterThanOrEqual(12);
      }
      for (const k of STATS) for (const bg of ['--c-surface', '--c-meter-track']) expect(contrastRatio(parseHex(t[k]), parseHex(t[bg])), `${theme} ${k} on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });
  /**
   * REV-003-D-4 R-195②: 색각 이상 시뮬레이션. 행렬은 Machado·Oliveira·Fernandes(2009) IEEE TVCG 15(6)의 심각도 1.0(scripts/checkContrastLib.ts CVD_MATRIX, 출처 주석).
   * 자기 점검: 각 행의 합이 1이라 흰색·회색이 그대로이고, 순빨강은 제1색맹(protan)에서 어둡게 보인다(L 원추가 없어 장파장 감도가 떨어진다).
   * 기준: protan·deutan 두 시뮬레이션에서 상태 4색 모든 쌍 ΔE2000 ≥ 8(검수자 권장치). 지적 당시 다크 지식↔관계는 2.7·2.5, 라이트 2.6·5.0이었다. tritan은 시트(status-colors-cvd.png)로만 본다.
   */
  it('R-195②: Machado 2009 protan·deutan(심각도 1.0) 시뮬레이션에서도 상태 4색은 모든 쌍 ΔE2000 ≥ 8 (두 테마) — 행렬 자기 점검 포함', () => {
    for (const kind of ['protan', 'deutan', 'tritan'] as const) {
      for (const s of cvdRowSums(kind)) expect(s, `${kind} 행 합`).toBeCloseTo(1, 4);
      expect(simulateCvd([255, 255, 255], kind)).toEqual([255, 255, 255]);
      const gray = simulateCvd([128, 128, 128], kind);
      for (const v of gray) expect(Math.abs(v - 128), `${kind} 회색 유지`).toBeLessThanOrEqual(1);
    }
    expect(luminance(simulateCvd([255, 0, 0], 'protan'))).toBeLessThan(luminance([255, 0, 0]) * 0.75);
    expect(deltaE2000(simulateCvd([255, 0, 0], 'deutan'), simulateCvd([0, 128, 0], 'deutan'))).toBeLessThan(deltaE2000([255, 0, 0], [0, 128, 0]) * 0.5); // 빨강↔초록이 가까워진다
    for (const theme of ['light', 'dark'] as const) {
      const t = themeTokens(blocks, theme);
      for (const kind of ['protan', 'deutan'] as const) {
        const sim = Object.fromEntries(STATS.map((k) => [k, simulateCvd(parseHex(t[k]), kind)]));
        for (let i = 0; i < STATS.length; i++) for (let j = i + 1; j < STATS.length; j++) {
          const d = deltaE2000(sim[STATS[i]], sim[STATS[j]]);
          expect(d, `${theme} ${kind} ${STAT_NAME[STATS[i]]} ↔ ${STAT_NAME[STATS[j]]} = ${d.toFixed(1)}`).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });
});

describe('얼굴: 연령대·외모 단계 규칙 (DS4)', () => {
  it('연령대 8단계 경계 나이: 영아 0~2 / 유아 3~6 / 아동 7~12 / 청소년 13~19 / 청년 20~39 / 중년 40~59 / 장년 60~74 / 노년 75~', () => {
    const cases: Array<[number, AgeGroupId]> = [
      [0, 'infant'], [2, 'infant'], [3, 'toddler'], [6, 'toddler'], [7, 'child'], [12, 'child'], [13, 'teen'], [19, 'teen'],
      [20, 'young'], [39, 'young'], [40, 'middle'], [59, 'middle'], [60, 'senior'], [74, 'senior'], [75, 'elder'], [100, 'elder'],
    ];
    for (const [age, id] of cases) expect(ageGroupOf(age), `${age}세`).toBe(id);
    expect(ageGroupOf(2.9)).toBe('infant'); // 소수는 내림
    expect(ageGroupOf(-1)).toBe('infant');
    expect(ageGroupOf(Number.NaN)).toBe('infant');
  });

  it('나이가 연령대 경계를 넘으면 얼굴 그림이 바뀐다 (0~100세 모든 경계)', () => {
    const svg = (age: number) => faceSvg({ ageGroup: ageGroupOf(age), gender: 'female', tier: 3 });
    for (let age = 0; age < 100; age++) {
      const crossed = ageGroupOf(age) !== ageGroupOf(age + 1);
      expect(svg(age) !== svg(age + 1), `${age}→${age + 1}세`).toBe(crossed);
    }
  });

  it('외모 점수 → 단계: looksTopPercent(상위 %) 기준 상위 10%↓=5, 30%↓=4, 70%↓=3, 90%↓=2, 그 밖=1 (0~100점 전부)', () => {
    for (let looks = 0; looks <= 100; looks++) {
      const p = looksTopPercent(looks);
      const expected: LooksTier = p <= 10 ? 5 : p <= 30 ? 4 : p <= 70 ? 3 : p <= 90 ? 2 : 1;
      expect(looksTierOf(looks), `외모 ${looks}점 (상위 ${p}%)`).toBe(expected);
    }
    expect(LOOKS_TIER_MIN_SCORE).toEqual([0, 28, 41, 60, 72]);
  });

  it('숱·선명도 표는 외모 단계에 대해 비감소, 헤어라인 높이는 비증가 (DS4 1번)', () => {
    const nonDecreasing: Array<keyof typeof TIER_PARAMS> = ['hairDensity', 'hairVolume', 'hairFillAlpha', 'hairBackAlpha', 'sheenCount', 'featureClarity', 'lineWidth', 'lineAlpha', 'browWidth', 'eyeHighlightAlpha'];
    for (const key of nonDecreasing) {
      const v = TIER_PARAMS[key] as readonly number[];
      expect(v.length, key).toBe(5);
      for (let i = 1; i < v.length; i++) expect(v[i], `${key}[${i}]`).toBeGreaterThanOrEqual(v[i - 1]);
    }
    const rise = TIER_PARAMS.hairlineRise as readonly number[];
    for (let i = 1; i < rise.length; i++) expect(rise[i]).toBeLessThanOrEqual(rise[i - 1]);
    // 가장 낮은 단계도 선이 사라지지 않는다 (흐림은 대비를 낮추는 것으로만)
    expect(TIER_PARAMS.lineAlpha[0]).toBeGreaterThanOrEqual(0.62);
    expect(TIER_PARAMS.lineWidth[0]).toBeGreaterThanOrEqual(1.5);
  });

  it('R-126: 머리 채움 농도는 모든 단계 1(머리색 불변), 이마 상승은 최대 2px, 쌍꺼풀·콧날 같은 구조 표는 없다 (R-135②)', () => {
    expect([...TIER_PARAMS.hairFillAlpha]).toEqual([1, 1, 1, 1, 1]);
    for (const v of TIER_PARAMS.hairlineRise) expect(v).toBeLessThanOrEqual(2);
    expect(Object.keys(TIER_PARAMS)).not.toContain('eyeDetail');
    expect(Object.keys(TIER_PARAMS)).not.toContain('noseBridge');
  });

  it('80조합이 모두 그려지고(NaN·undefined 없음), 같은 입력은 같은 그림이다', () => {
    let count = 0;
    for (const ageGroup of AGES) for (const gender of GENDERS) for (const tier of TIERS) {
      const a = faceSvg({ ageGroup, gender, tier }, { label: '얼굴' });
      expect(a, `${ageGroup} ${gender} ${tier}`).not.toMatch(/NaN|undefined|Infinity/);
      expect(a.startsWith('<svg')).toBe(true);
      expect(faceSvg({ ageGroup, gender, tier }, { label: '얼굴' })).toBe(a);
      count++;
    }
    expect(count).toBe(80);
  });

  it('80조합의 그림이 서로 모두 다르다', () => {
    const seen = new Set<string>();
    for (const ageGroup of AGES) for (const gender of GENDERS) for (const tier of TIERS) seen.add(faceSvg({ ageGroup, gender, tier }));
    expect(seen.size).toBe(80);
  });

  /** features 층의 눈 타원(흰 하이라이트 제외)과 입·코의 위치 */
  const featureGeometry = (nodes: FaceNode[]): string => {
    const features = nodes.find((n) => n.tag === 'g' && n.layer === 'features');
    if (!features || features.tag !== 'g') throw new Error('features 층이 없다');
    const eyes = features.children.filter((n) => n.tag === 'ellipse' && n.fill !== '#FFFFFF' && !String(n.fill).includes('blush'));
    return JSON.stringify(eyes.map((e) => (e.tag === 'ellipse' ? [e.cx, e.cy, e.rx, e.ry] : [])));
  };

  it('눈의 크기·위치는 외모 단계와 무관하다 — 연령대·성별만 정한다 (DS4 3번: 일그러뜨리지 않는다)', () => {
    for (const ageGroup of AGES) for (const gender of GENDERS) {
      const base = featureGeometry(faceNodes({ ageGroup, gender, tier: 3 }));
      for (const tier of TIERS) expect(featureGeometry(faceNodes({ ageGroup, gender, tier })), `${ageGroup} ${gender} ${tier}`).toBe(base);
    }
  });

  it('R-135②: 이목구비 부품의 수와 종류(눈썹·눈·하이라이트·코·입)는 모든 단계에서 같다 — 상위 단계에만 생기는 선이 없다', () => {
    const shape = (nodes: FaceNode[]) => {
      const f = nodes.find((n) => n.tag === 'g' && n.layer === 'features');
      if (!f || f.tag !== 'g') throw new Error('features 층이 없다');
      return f.children.map((n) => (n.tag === 'path' ? `path:${n.d}` : n.tag === 'ellipse' ? `ellipse:${n.cx},${n.cy},${n.rx},${n.ry}` : n.tag)).join('|');
    };
    for (const ageGroup of AGES) for (const gender of GENDERS) {
      const base = shape(faceNodes({ ageGroup, gender, tier: 1 }));
      for (const tier of TIERS) expect(shape(faceNodes({ ageGroup, gender, tier })), `${ageGroup} ${gender} ${tier}`).toBe(base);
    }
  });

  it('피부색·머리 아래 얼굴형·귀는 외모 단계와 무관하다 (head·ears 층이 모든 단계에서 같다)', () => {
    const layer = (nodes: FaceNode[], name: string) => JSON.stringify(nodes.filter((n) => n.tag === 'g' && n.layer === name));
    for (const ageGroup of AGES) for (const gender of GENDERS) {
      const base = faceNodes({ ageGroup, gender, tier: 1 });
      for (const tier of TIERS) {
        const other = faceNodes({ ageGroup, gender, tier });
        for (const name of ['head', 'ears', 'neck', 'clothes', 'wrinkles']) expect(layer(other, name), `${ageGroup} ${gender} ${tier} ${name}`).toBe(layer(base, name));
      }
    }
  });

  /** 머리 층(hair-back·hair-mid·hair-front)에서 채움이 있는 노드의 (fill, fillOpacity) 집합 */
  const hairFills = (nodes: FaceNode[]): string[] => {
    const out = new Set<string>();
    const walk = (n: FaceNode) => {
      if (n.tag === 'g') {
        n.children.forEach(walk);
        return;
      }
      if (n.fill !== undefined && n.fill !== 'none' && String(n.fill).includes('--c-face-hair')) out.add(`${n.fill}@${n.fillOpacity ?? 1}`);
    };
    nodes.filter((n) => n.tag === 'g' && /^hair-/.test(n.layer)).forEach(walk);
    return [...out].sort();
  };

  it('R-126: 머리 채움색·불투명도는 외모 단계와 무관하다 — 모든 단계에서 연령대의 머리색 하나, 불투명도 1', () => {
    for (const ageGroup of AGES) for (const gender of GENDERS) {
      const base = hairFills(faceNodes({ ageGroup, gender, tier: 3 }));
      expect(base.length, `${ageGroup} ${gender}: 머리 채움색은 하나`).toBe(1);
      expect(base[0].endsWith('@1'), `${ageGroup} ${gender}: 불투명도 1`).toBe(true);
      for (const tier of TIERS) expect(hairFills(faceNodes({ ageGroup, gender, tier })), `${ageGroup} ${gender} ${tier}`).toEqual(base);
    }
  });

  it('주름은 연령대가 정한다: 영아~청년은 주름 층이 없고 중년 이상은 있으며 장년·노년은 더 많다', () => {
    const wrinkleCount = (ageGroup: AgeGroupId) => {
      const nodes = faceNodes({ ageGroup, gender: 'female', tier: 3 });
      const g = nodes.find((n) => n.tag === 'g' && n.layer === 'wrinkles');
      return g && g.tag === 'g' ? g.children.length : 0;
    };
    for (const id of ['infant', 'toddler', 'child', 'teen', 'young'] as const) expect(wrinkleCount(id), id).toBe(0);
    expect(wrinkleCount('middle')).toBeGreaterThan(0);
    expect(wrinkleCount('senior')).toBeGreaterThan(wrinkleCount('middle'));
    expect(wrinkleCount('elder')).toBeGreaterThan(wrinkleCount('senior'));
    // 외모 단계는 주름 수를 바꾸지 않는다
    for (const tier of TIERS) expect(faceNodes({ ageGroup: 'elder', gender: 'male', tier }).filter((n) => n.tag === 'g' && n.layer === 'wrinkles').length).toBe(1);
  });

  it('연령 단서(REV-003-D-2 관찰): 청소년 남성은 앞머리(fringe), 청년 남성은 가르마 — 앞머리 층이 서로 다르고 외모 단계와 무관하게 유지된다', () => {
    const front = (ageGroup: AgeGroupId, tier: LooksTier) => JSON.stringify(faceNodes({ ageGroup, gender: 'male', tier }).filter((n) => n.tag === 'g' && n.layer === 'hair-front'));
    for (const tier of TIERS) expect(front('teen', tier)).not.toBe(front('young', tier));
    // 청소년 남성의 헤어라인 층에는 가르마 선(검정 1px)이 없고, 청년 남성에는 있다
    const partLine = (ageGroup: AgeGroupId) => faceSvg({ ageGroup, gender: 'male', tier: 3 }).includes('stroke="#000000"');
    expect(partLine('teen')).toBe(false);
    expect(partLine('young')).toBe(true);
  });

  it('중년 희끗한 구레나룻은 한쪽에 짧은 한 토막(길이 ≤ 7, 귀 높이의 긴 띠가 아니다), 노년 흰머리에는 회색 결 줄이 있다 — 모두 외모 단계와 무관', () => {
    const grayStrokes = (ageGroup: AgeGroupId, tier: LooksTier) => {
      const out: string[] = [];
      const walk = (n: FaceNode) => {
        if (n.tag === 'g') n.children.forEach(walk);
        else if (n.tag === 'path' && n.stroke !== undefined && String(n.stroke).includes('--c-face-hair-gray')) out.push(n.d);
      };
      faceNodes({ ageGroup, gender: 'male', tier }).filter((n) => n.tag === 'g' && n.layer === 'hair-front').forEach(walk);
      return out;
    };
    for (const tier of TIERS) {
      const mid = grayStrokes('middle', tier);
      expect(mid.length, `중년 ${tier}단계`).toBe(2);
      for (const d of mid) {
        const [[x0, y0], [x1, y1]] = pathPoints(d);
        expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThanOrEqual(7);
      }
      expect(grayStrokes('elder', tier).length, `노년 ${tier}단계`).toBe(3);
      expect(grayStrokes('young', tier).length).toBe(0);
    }
  });

  it('얼굴 노드에는 비하적 표현을 만들 부품이 없다: 모든 색은 --c-face-* 토큰 또는 흰색 하이라이트', () => {
    for (const ageGroup of AGES) for (const gender of GENDERS) for (const tier of [1, 5] as LooksTier[]) {
      const svg = faceSvg({ ageGroup, gender, tier });
      const colors = [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]).filter((c) => c !== 'none');
      for (const c of colors) expect(c.startsWith('var(--c-face-') || c === '#FFFFFF' || c === '#000000', `${ageGroup} ${gender} ${tier}: ${c}`).toBe(true);
    }
  });
});

describe('숟가락 도형·심볼 기하 (DS2, R-120·R-128·R-129)', () => {
  /** 수저 5단계 아이콘과 같은 매개변수(20×32 격자) + 정식 심볼 크기 + 아주 작은 크기 */
  const CASES = [
    { name: '아이콘 20×32', p: { cx: 10, top: 1.2, w: 11.6, h: 12.6, neck: 1.7, neckLen: 2.2, handleLen: 14.6, endW: 3.8 } },
    { name: '심볼 머리 218', p: { cx: 0, top: -112, w: 218, h: 240, neck: 30, neckLen: 35, handleLen: 300, endW: 65 } },
    { name: '최소 6px', p: { cx: 3, top: 0, w: 6, h: 6.6, neck: 0.8, neckLen: 1, handleLen: 7, endW: 1.8 } },
  ];
  it('R-120: 어떤 크기에서도 숟가락 경로의 모든 좌표가 머리 폭·전체 높이 안에 든다 (고정 px 오프셋 없음)', () => {
    for (const { name, p } of CASES) {
      const pts = pathPoints(spoonPath(p));
      expect(pts.length, name).toBeGreaterThan(10);
      const endY = p.top + p.h + p.neckLen + p.handleLen;
      for (const [x, y] of pts) {
        expect(Number.isFinite(x) && Number.isFinite(y), `${name}: 숫자`).toBe(true);
        expect(x, `${name}: x ${x}`).toBeGreaterThanOrEqual(p.cx - p.w / 2 - 0.05);
        expect(x, `${name}: x ${x}`).toBeLessThanOrEqual(p.cx + p.w / 2 + 0.05);
        expect(y, `${name}: y ${y}`).toBeGreaterThanOrEqual(p.top - 0.05);
        expect(y, `${name}: y ${y}`).toBeLessThanOrEqual(endY + 0.05);
      }
    }
  });
  it('R-120: 목 보조점은 머리 폭에 비례한다 (머리 폭을 2배로 하면 목 보조점 간격도 2배)', () => {
    const neckX = (w: number) => {
      const pts = pathPoints(spoonPath({ cx: 0, top: 0, w, h: w * 1.1, neck: w * 0.14, neckLen: w * 0.16, handleLen: w, endW: w * 0.3 }));
      return Math.max(...pts.filter(([, y]) => Math.abs(y - w * 1.1) < 0.01).map(([x]) => x));
    };
    expect(neckX(200) / neckX(100)).toBeCloseTo(2, 1);
  });
  it('R-128: 정식 심볼의 머리 안 지도 높이 ≥ 머리 높이 70%, 단순화 심볼은 섬 없이 윤곽만', () => {
    const full = symbolA({ small: false });
    const small = symbolA({ small: true });
    expect(full.metrics.mapToBowl).toBeGreaterThanOrEqual(0.7);
    expect(full.metrics.islands).toBe(true);
    expect(small.metrics.islands).toBe(false);
    expect((full.d.match(/a[^a]*a/g) ?? []).length, '정식: 섬 타원 3개(타원은 a 명령 2개)').toBe(3);
    expect(small.d.includes('a'), '단순화: 타원 없음').toBe(false);
  });
  it('R-129: 섬 면적은 제주 ≥ 울릉도 × 2, 독도 < 울릉도 (특정 섬을 과대 강조하지 않는다)', () => {
    const m = islandMetrics();
    expect(m.jejuToUlleung).toBeGreaterThanOrEqual(2);
    expect(m.dokdoToUlleung).toBeLessThan(1);
    expect(m.dokdoToUlleung).toBeGreaterThan(0);
  });
});

describe('심볼·로고 SVG 파일 (DS1·DS2, 확정 A안)', () => {
  const svgs = import.meta.glob('../src/assets/**/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const names = Object.keys(svgs);
  const get = (suffix: string) => svgs[names.find((n) => n.endsWith(suffix)) ?? ''] ?? '';
  it('확정 A안 파일만 있다: 심볼·로고 기본 + 다크·단색·단순화(small)·헤더 로고·스택·앱 아이콘. B·C 파일은 src/assets에 없다', () => {
    for (const file of ['symbol-a.svg', 'logo-a.svg']) expect(names.some((n) => n.endsWith(`/assets/${file}`)), file).toBe(true);
    for (const file of ['symbol-dark.svg', 'symbol-mono.svg', 'symbol-small.svg', 'symbol-small-mono.svg', 'logo-dark.svg', 'logo-mono.svg', 'logo-header.svg', 'logo-header-dark.svg', 'logo-header-mono.svg', 'logo-stacked.svg', 'logo-stacked-dark.svg', 'logo-stacked-mono.svg', 'favicon.svg', 'app-icon.svg']) {
      expect(names.some((n) => n.endsWith(`/assets/brand/a/${file}`)), `brand/a/${file}`).toBe(true);
    }
    for (const file of ['wordmark.svg', 'wordmark-dark.svg', 'wordmark-mono.svg']) expect(names.some((n) => n.endsWith(`/assets/brand/${file}`)), file).toBe(true);
    for (const k of ['b', 'c']) {
      expect(names.some((n) => n.endsWith(`/assets/symbol-${k}.svg`) || n.endsWith(`/assets/logo-${k}.svg`) || n.includes(`/assets/brand/${k}/`)), `${k}안 파일 없음`).toBe(false);
    }
  });
  it('모든 SVG는 스크립트·외부 주소·이미지 삽입이 없고 viewBox가 있다 (외부 요청 0)', () => {
    for (const [name, text] of Object.entries(svgs)) {
      expect(text, name).toMatch(/viewBox="[^"]+"/);
      expect(text, name).not.toMatch(/<script|<image|<foreignObject|href="https?:|url\(https?:|@import/);
    }
  });
  it('REV-003-D-4: SVG 프레젠테이션 속성 값에 var()를 쓰지 않는다 — CSS 변수는 style 속성 안에서만(속성 안 var()는 iOS Safari 등이 무시할 수 있다). 모든 src/assets SVG', () => {
    expect(names.length).toBeGreaterThanOrEqual(20);
    for (const [name, text] of Object.entries(svgs)) {
      const attrsWithVar = [...text.matchAll(/\s([a-zA-Z:-]+)="[^"]*var\(/g)].map((m) => m[1]).filter((a) => a !== 'style');
      expect(attrsWithVar, `${name}: var()가 든 속성`).toEqual([]);
    }
    // 로고·심볼의 테마 색도 style로만 읽는다(라이트 파일), 은·금 표식은 fill="#fff" 고정값 + style 변수 이중 지정
    expect(get('/assets/symbol-a.svg')).toMatch(/style="fill:var\(--c-logo,#26324A\)"/);
    expect((get('/assets/icons/spoon-grades.svg').match(/ fill="#fff" style="fill:var\(--sp-mark,#fff\)"/g) ?? []).length).toBe(2);
    expect(get('/assets/icons/spoon-grades.svg')).not.toMatch(/ fill="var\(/);
  });
  it('색 변형: 라이트는 --c-logo 토큰(없으면 쪽빛), 다크는 크림색 고정, 단색은 currentColor', () => {
    expect(get('/assets/symbol-a.svg')).toContain('var(--c-logo,#26324A)');
    expect(get('/assets/brand/a/symbol-dark.svg')).toContain('#E9E4D6');
    expect(get('/assets/brand/a/symbol-mono.svg')).toContain('currentColor');
    expect(get('/assets/brand/a/logo-header-mono.svg')).toContain('currentColor');
    expect(get('/assets/brand/wordmark-mono.svg')).toContain('currentColor');
  });
  it('윤곽에 분단선·국경선·행정 경계를 그리지 않는다: 심볼 안 path는 하나(섬·숟가락 포함 한 덩어리)', () => {
    expect((get('/assets/symbol-a.svg').match(/<path /g) ?? []).length).toBe(1);
    expect((get('/assets/brand/a/symbol-small.svg').match(/<path /g) ?? []).length).toBe(1);
  });
  it('헤더 로고: 워드마크 높이가 로고 높이의 0.64 (40px에서 글자 높이 ≈ 23px ≥ 22px, R-128)', () => {
    const text = get('/assets/brand/a/logo-header.svg');
    const vb = text.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const scale = text.match(/translate\([\d.]+ [\d.]+\) scale\(([\d.]+)\)" fill="none"/);
    expect(vb && scale).toBeTruthy();
    const H = Number(vb![2]);
    const wmH = Number(scale![1]) * 100; // 워드마크 칸 100 기준
    const glyphH = wmH * 0.9; // 글자의 보이는 상자는 y 6~96
    expect((glyphH / H) * 40).toBeGreaterThanOrEqual(22);
  });
  /** 수저 아이콘 스프라이트의 심볼 목록: [id, body] (칩 변형 sp-N, 큰 변형 sp-N-lg) */
  const spoonSymbols = async () => {
    const sprite = await readText('../src/assets/icons/spoon-grades.svg');
    return [...sprite.matchAll(/<symbol id="(sp-\d(?:-lg)?)" viewBox="0 0 20 32">([\s\S]*?)<\/symbol>/g)].map(([, id, body]) => [id, body] as const);
  };
  /** 머리(bowl) 상자: SPOON_ICON {cx 10, top 1.2, w 11.6, h 12.6} */
  const BOWL = { x0: 4.2, x1: 15.8, y0: 1.2, y1: 13.8 };
  const subpaths = (d: string) => d.split(/(?=M)/).filter((s) => s.trim().length > 0);

  it('수저 5단계 아이콘: 칩 변형 sp-1~5와 큰 변형 sp-1-lg~5-lg가 있고, 모든 좌표가 viewBox 0 0 20 32 안이며(R-120), circle·line 같은 무늬 요소가 없다', async () => {
    const symbols = await spoonSymbols();
    expect(symbols.map(([id]) => id)).toEqual(['sp-1', 'sp-2', 'sp-3', 'sp-4', 'sp-5', 'sp-1-lg', 'sp-2-lg', 'sp-3-lg', 'sp-4-lg', 'sp-5-lg']);
    for (const [id, body] of symbols) {
      for (const d of [...body.matchAll(/ d="([^"]+)"/g)].map((m) => m[1])) {
        for (const [x, y] of pathPoints(d)) {
          expect(x, `${id} x`).toBeGreaterThanOrEqual(0);
          expect(x, `${id} x`).toBeLessThanOrEqual(20);
          expect(y, `${id} y`).toBeGreaterThanOrEqual(0);
          expect(y, `${id} y`).toBeLessThanOrEqual(32);
        }
      }
      expect(body, `${id}: 점·선 무늬 요소 없음`).not.toMatch(/<circle|<ellipse|<line|<polyline|<polygon|<rect|<g[\s>]/);
    }
  });

  it('R-121·R-190(마스터 결정): 칩 변형 sp-1~5는 무늬 없는 숟가락 실루엣 — path 하나, 부경로 하나, currentColor 채움뿐. stroke 속성·외곽선 변수가 없어 강제 색상·단색에서도 외곽선이 될 수 없다', async () => {
    const small = (await spoonSymbols()).filter(([id]) => !id.endsWith('-lg'));
    expect(small.length).toBe(5);
    const silhouettes = new Set<string>();
    for (const [id, body] of small) {
      const paths = [...body.matchAll(/<path [^>]*>/g)].map((m) => m[0]);
      expect(paths.length, `${id}: path 하나`).toBe(1);
      const d = paths[0].match(/ d="([^"]+)"/)![1];
      expect(subpaths(d).length, `${id}: 부경로 하나(구멍·표식 없음)`).toBe(1);
      expect(d.trim().endsWith('Z')).toBe(true);
      expect(paths[0], `${id}: stroke 속성 없음`).not.toMatch(/ stroke/);
      expect(paths[0], `${id}: 외곽선 변수 없음`).not.toMatch(/--sp-fill|--sp-stroke/);
      expect(paths[0]).toMatch(/ fill="currentColor"/);
      silhouettes.add(d);
    }
    expect(silhouettes.size, '다섯 단계의 실루엣은 같은 숟가락(재질 색·이름·점이 단계를 가른다)').toBe(1);
    // 시안 CSS도 강제 색상에서 칩 아이콘을 CanvasText 채움으로만 둔다(외곽선 변수 0)
    expect(dsCss).not.toMatch(/--sp-fill|--sp-stroke/);
    expect(dsCss).toMatch(/\.grade svg\.spoon \{ color: CanvasText; \}/);
  });

  it('R-121: 큰 변형 sp-N-lg의 머리 안 표식은 닫힌 채움 도형이다 — fill만 쓰고(stroke 없음), 모든 부경로가 Z로 닫히며, 표식 좌표가 머리 상자 안이고, 5개가 서로 다르다. 은·금의 광택은 구멍이 아니라 밝은 채움(REV-003-D-3 관찰) — fill="#fff" + style="fill:var(--sp-mark,#fff)" 이중 지정(REV-003-D-4)', async () => {
    const big = (await spoonSymbols()).filter(([id]) => id.endsWith('-lg'));
    expect(big.length).toBe(5);
    const bodies = new Set<string>();
    const MARK = ' fill="#fff" style="fill:var(--sp-mark,#fff)"';
    for (const [id, body] of big) {
      bodies.add(body);
      const paths = [...body.matchAll(/<path [^>]*>/g)].map((m) => m[0]);
      expect(paths.length).toBeGreaterThanOrEqual(1);
      // 은(sp-3-lg)·금(sp-4-lg): 몸체 path + 밝은 표식 path, evenodd 구멍 없음. 흙·다이아는 구멍(빈 그릇·커팅이 뜻), 동은 표식 없음
      if (id === 'sp-3-lg' || id === 'sp-4-lg') {
        expect(paths.length, `${id}: 몸체 + 밝은 표식`).toBe(2);
        expect(paths[1], `${id}: 표식은 밝은 채움(속성 고정값 + style 변수)`).toContain(MARK);
        expect(body, `${id}: 구멍 없음`).not.toContain('evenodd');
      } else {
        expect(body, `${id}: 밝은 표식 없음`).not.toContain('--sp-mark');
      }
      let marks = 0;
      paths.forEach((p, i) => {
        expect(p, `${id}: stroke 없음`).not.toMatch(/ stroke/);
        expect(p, `${id}: 채움`).toMatch(i === 0 ? / fill="currentColor"/ : / fill="(currentColor|#fff)"/);
        const d = p.match(/ d="([^"]+)"/)![1];
        const parts = subpaths(d);
        for (const sp of parts) expect(sp.trim().endsWith('Z'), `${id}: 닫힌 부경로 — ${sp.slice(0, 20)}`).toBe(true);
        // 첫 path의 첫 부경로는 숟가락 실루엣(자루까지). 그 밖의 부경로(구멍·더미)가 표식이다
        const markParts = i === 0 ? parts.slice(1) : parts;
        for (const sp of markParts) {
          marks++;
          for (const [x, y] of pathPoints(sp)) {
            expect(x, `${id} 표식 x ${x}`).toBeGreaterThanOrEqual(BOWL.x0);
            expect(x, `${id} 표식 x ${x}`).toBeLessThanOrEqual(BOWL.x1);
            expect(y, `${id} 표식 y ${y}`).toBeGreaterThanOrEqual(BOWL.y0);
            expect(y, `${id} 표식 y ${y}`).toBeLessThanOrEqual(BOWL.y1);
          }
        }
      });
      expect(marks, `${id}: 표식은 0~2개(동수저는 표식 없음)`).toBeLessThanOrEqual(2);
    }
    expect(bodies.size).toBe(5);
  });

  /**
   * D-05 (diff-003.md, QA-003-M3 마스터 추가): 칩 이름 안에는 줄바꿈 표시로 `<br>`뿐 아니라 `<wbr>`도 허용한다. `<wbr>`는 **글자 없는 줄바꿈 지점**이라 눈에 보이는 줄을 만들지 않고 읽는 이름은 같다
   * (구현의 `다이아몬드<wbr />수저`, src/ui/Grade.tsx — e2e/intendedBreaks.ts의 목록 항목). 약화가 아니다: 이름 글자는 그대로 단계마다 하나로 못 박혀 있고(`NAMES`), 다른 인라인 태그(`<b>`·`<i>` 등)는 여전히 막힌다.
   */
  const NAME_BREAK = '(?:<br>|<wbr>)?';
  const NAMES = ['', '흙수저', '동수저', '은수저', '금수저', `다이아몬드${NAME_BREAK}수저`];
  const PAIRED_CHIP = /<(?:span class="grade [^"]*"|li class="spoon-fig [^"]*")><svg class="spoon[^"]*"[^>]*><use href="#sp-(\d)(?:-lg)?"\/><\/svg><span(?: class="spoon-fig__name")?>([^<]*(?:<br>|<wbr>)?[^<]*)<\/span>/g;

  it('D-05: 칩 이름 정규식은 `<wbr>`를 허용하되 다른 태그·틀린 이름은 막는다 — 합성 마크업 (약화 아님: 이름 글자는 단계마다 그대로 고정)', () => {
    const chip = (n: number, inner: string) => `<span class="grade grade--${n}"><svg class="spoon" aria-hidden="true"><use href="#sp-${n}"/></svg><span>${inner}</span></span>`;
    const pairs = (html: string) => [...html.matchAll(PAIRED_CHIP)].map((m) => [m[1], m[2]] as const);
    const nameOk = (n: string, label: string) => new RegExp(`^${NAMES[Number(n)]}$`).test(label);
    // 허용: `<wbr>`가 있는 다이아몬드수저(구현), `<br>`가 있는 다이아몬드수저(시안의 첫 화면 띠), 줄바꿈 표시 없는 이름
    for (const label of ['다이아몬드<wbr>수저', '다이아몬드<br>수저', '다이아몬드수저']) {
      const found = pairs(chip(5, label));
      expect(found, label).toHaveLength(1);
      expect(nameOk(found[0][0], found[0][1]), `${label} 허용`).toBe(true);
    }
    // `<wbr>`는 글자가 없다: 지우면 읽는 이름은 「다이아몬드수저」다
    expect('다이아몬드<wbr>수저'.replace(/<wbr>/g, '')).toBe('다이아몬드수저');
    // 막는 것: 다른 인라인 태그(<b>)·틀린 이름·다른 단계의 이름·이름 한가운데 아닌 곳의 <wbr>
    expect(pairs(chip(5, '다이아<b>몬드</b>수저')), '다른 태그는 칩 이름으로 인정되지 않는다').toHaveLength(0);
    for (const [n, label] of [[5, '다이아몬드<wbr>수저2'], [5, '다이아<wbr>몬드수저'], [3, '은<wbr>수저'], [3, '금수저'], [1, '흙수저<wbr>']] as const) {
      const found = pairs(chip(n, label));
      expect(found.length === 1 && nameOk(found[0][0], found[0][1]), `${n}단계 「${label}」 거부`).toBe(false);
    }
  });

  /**
   * R-190·R-196: 「수저 아이콘은 이름·점 없이 단독으로 쓰지 않는다」를 화면 시안에서 실제로 막는다 — 열두 화면 시안의 모든 수저 아이콘(<svg class="spoon…">)은
   * 칩(.grade, gradeChip·reelSpoon) 또는 첫 화면 띠(.spoon-fig, spoonLineup) 안에 있고, 바로 뒤에 같은 단계의 이름이 따른다.
   * 설명판(components·spoon-sizes·symbols·faces)은 아이콘 자체를 보여 주는 시트라 제외한다(크기 줄 옆에 글로 이름을 적는다).
   */
  it('R-190: 화면 시안의 수저 아이콘은 모두 칩·띠 안에 있고 바로 뒤에 같은 단계의 이름이 따른다 — 단독 사용 0', () => {
    const mockups = import.meta.glob('../docs/design/mockups/*.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    // 설명판(components·spoon-sizes·symbols·faces)과 수저가 나오지 않는 화면 시안 — 밀린·오류 화면(system — 공통 헤더 + 카드 하나, 2026-10-17 M4 착수 정리),
    // M5 경제 모델 시안(economy-m5 — 선택지 영향 줄·자산 카드·엔딩 최종 순자산 줄, 2026-10-17 designer; 「자산 현황」에는 칩을 두지 않는다는 규칙 그대로)은 제외하고 아이콘이 정말 없음을 따로 단언한다
    const screens = Object.entries(mockups).filter(([n]) => !/\/(components|spoon-sizes|symbols|faces|faces-all|system|economy-m5)\.html$/.test(n));
    expect(screens.length, '화면 시안 수(수저 아이콘이 나오는 화면): M4까지 12장').toBe(12);
    for (const bare of ['system', 'economy-m5']) {
      expect(mockups[Object.keys(mockups).find((n) => n.endsWith(`/${bare}.html`)) ?? ''] ?? '', `${bare}.html: 시안이 있고 수저 아이콘 없음`).not.toMatch(/<svg class="spoon/);
      expect(Object.keys(mockups).some((n) => n.endsWith(`/${bare}.html`)), `${bare}.html 존재`).toBe(true);
    }
    let total = 0;
    for (const [name, html] of screens) {
      const icons = html.match(/<svg class="spoon[^"]*"/g) ?? [];
      expect(icons.length, `${name}: 아이콘이 있다`).toBeGreaterThan(0);
      const paired = [...html.matchAll(PAIRED_CHIP)];
      expect(paired.length, `${name}: 칩·띠 밖의 수저 아이콘 ${icons.length - paired.length}개`).toBe(icons.length);
      for (const [, n, label] of paired) expect(label, `${name}: sp-${n} 뒤의 이름`).toMatch(new RegExp(`^${NAMES[Number(n)]}$`));
      total += icons.length;
    }
    expect(total).toBeGreaterThanOrEqual(30);
  });
});

describe('저작권·문구 기록 (DS8, R-123)', () => {
  it('credits.md에 외부 자산 없음·직접 제작·글꼴(시스템 글꼴)·참고 캡처 미복제·문구 대조를 적는다', () => {
    for (const phrase of ['외부', '직접', '글꼴', '80억', '문구 대조']) expect(creditsMd, phrase).toContain(phrase);
  });
  it('copy.md: 수저 구간은 bandLabel(startBandOf) 한 함수의 출력(R-170), 캐러셀 간격은 7초(SC5), 「접속자」 낱말 없음(R-131), 다시 태어나기 안내는 REBIRTH_NOTE 그대로(R-191(c)), 엔딩 어체는 M7e를 따른다', () => {
    expect(copyMd).toContain('bandLabel(startBandOf');
    expect(copyMd).toContain('흙수저(하위 25% 안쪽)');
    expect(copyMd).toContain('7초마다');
    expect(copyMd).not.toContain('8초마다');
    expect(copyMd).toContain(REBIRTH_NOTE);
    expect(copyMd).toContain('M7e');
    expect(copyMd).not.toContain('「-다」체 출력 그대로');
    // 「접속자」는 금지 규칙을 적은 자리(R-131 행)에만 있고, 화면 문구 칸(「」 안의 첫 화면 보조 설명)에는 없다
    expect(copyMd).toContain('「접속자」 낱말을 쓰지 않는다');
    expect(copyMd).toContain('「이 기기 안에서 계산한 가상의 사람들이에요. 실제로 게임하는 사람 수가 아니에요.」');
  });
});

/**
 * M5 영향 줄·자산 카드·최종 순자산 줄 계약 (SPEC-003 EC5·DB11, economy-model.md 7·9-2·11·15절, designer 2026-10-17 — copy.md 4절 ↔ ds.css ↔ 시안 economy-m5.html).
 * developer는 ds.css 블록을 dash.css로 글자 그대로 옮기고 문장은 copy.md 4-2절 표를 쓴다. 여기서는 세 산출물이 서로 어긋나지 않았는지만 본다(구현 화면은 developer의 시험·e2e 몫).
 */
describe('M5 영향 줄·자산 카드·최종 순자산 줄 계약 (designer 산출물 사이의 일치)', () => {
  const NAME: Record<string, string> = { assets: '자산', family: '집안 살림', debt: '부채', relationships: '관계', happiness: '행복', health: '건강', education: '지식' };
  const JOSA: Record<string, string> = { assets: '이', family: '이', debt: '가', relationships: '가', happiness: '이', health: '이', education: '이' };
  const STEP = ['', '조금 ', '', '크게 '];
  const sentence = (kind: string, dir: 'up' | 'down', n: 1 | 2 | 3) => `${NAME[kind]}${JOSA[kind]} ${STEP[n]}${dir === 'up' ? '늘어납니다.' : '줄어듭니다.'}`;

  it('copy.md 4-2절: 항목 7개 × 방향 2 × 칸 수 3 = 42문장이 모두 합쇼체로 적혀 있고, 해요체 영향 문장은 없다 (D17)', () => {
    let count = 0;
    for (const kind of Object.keys(NAME)) {
      for (const dir of ['up', 'down'] as const) {
        for (const n of [1, 2, 3] as const) {
          expect(copyMd, `${kind} ${dir} ${n}`).toContain(sentence(kind, dir, n));
          count++;
        }
      }
    }
    expect(count).toBe(42);
    expect(copyMd).toContain('자산이 크게 줄어듭니다.');
    expect(copyMd).toContain('부채가 크게 늘어납니다.');
    expect(copyMd).not.toMatch(/줄어요|늘어요/);
  });

  it('copy.md 4절: 자산 카드·도움말·엔딩 줄 문구 — 「약」 없는 formatWon 금액, 가구 기준 한 문장, 「지금 가치로 환산」, 최종 순자산 세 경우', () => {
    for (const phrase of [
      '「상태와 자산의 뜻 보기」',
      '순자산, 연 소득, 부채는 내 가구 기준이며 결혼한 뒤에는 배우자와 자녀의 몫까지 합한 값입니다.',
      '순자산은 가진 것에서 부채를 뺀 값입니다. 0보다 작으면 부채가 가진 것보다 많다는 뜻입니다.',
      '「지금 가치로 환산」',
      '「같은 세상 안에서 {standingLabel}」',
      '「스무 살이 되기 전이라 자산을 세지 않았습니다.」',
      '▲는 늘어남, ▼는 줄어듦이며 표시가 많을수록 변화가 큽니다.',
    ]) {
      expect(copyMd, phrase).toContain(phrase);
    }
    // 금액 옆에 「약」을 붙이지 않는다(정확한 모델 값) — 4절 예시 금액 어디에도 「약 N만 원」 꼴이 없다
    const section = copyMd.slice(copyMd.indexOf('## 4. M5 경제 모델'));
    expect(section.length).toBeGreaterThan(2000);
    expect(section).not.toMatch(/약 [\d,]+(억|만) 원/);
  });

  it('ds.css M5 블록: 항목은 한 덩어리(nowrap), 「·」는 접근성 트리에 없는 CSS 생성 글자이고 컨테이너(overflow hidden + column-gap)가 줄 첫머리 기호를 가린다, 지속 비활성 선택지·금액 크기 3단계·폴백·강제 색상 쌍이 있다', () => {
    const rule = (selector: string): string => {
      const stripped = dsCss.replace(/\/\*[^]*?\*\//g, '');
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = new RegExp(`(?:^|\\}|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(stripped);
      expect(m, `규칙 ${selector}`).not.toBeNull();
      return m![1];
    };
    expect(rule('.impact')).toMatch(/display: flex/);
    expect(rule('.impact')).toMatch(/flex-wrap: wrap/);
    expect(rule('.impact')).toMatch(/column-gap: var\(--impact-gap\)/);
    expect(rule('.impact')).toMatch(/overflow: hidden/);
    expect(rule('.impact__item')).toMatch(/white-space: nowrap/);
    expect(rule('.impact__item')).toMatch(/position: relative/);
    expect(rule('.impact__item::before')).toMatch(/content: '·' \/ ''/);
    expect(rule('.impact__item::before')).toMatch(/left: calc\(-1 \* var\(--impact-gap\)\)/);
    // 기호의 색 = 톤(이로움 --c-up / 해로움 --c-down) — 방향 클래스가 아니다(r2 마스터 결정 D-37: 부채 ▲는 해로운 색)
    expect(rule('.impact__step--good')).toMatch(/color: var\(--c-up\)/);
    expect(rule('.impact__step--bad')).toMatch(/color: var\(--c-down\)/);
    expect(dsCss.replace(/\/\*[^]*?\*\//g, '')).not.toMatch(/\.impact__step--(up|down)\b/);
    expect(rule(".choice[data-unavailable='true']")).toMatch(/color: var\(--c-text-3\)/);
    expect(rule(".choice[data-unavailable='true']")).toMatch(/border-style: dashed/);
    expect(rule(".choice[data-unavailable='true']")).not.toMatch(/opacity/);
    expect(rule('.card--assets')).toMatch(/container-type: inline-size/);
    expect(dsCss).toMatch(/@container assets \(max-width: 14rem\) \{ \.assets__row dd \{ font-size: var\(--fs-md\); \} \}/);
    expect(dsCss).toMatch(/@container assets \(max-width: 9\.5rem\) \{ \.assets__row dd \{ font-size: var\(--fs-sm\); \} \}/);
    expect(dsCss).toMatch(/@container facts \(max-width: 14rem\) \{ \.final-net__value \{ font-size: var\(--fs-md\); \} \}/);
    expect(rule('.final-net')).toMatch(/border-top: 1px solid var\(--c-border\)/);
    // 컨테이너 질의 폴백(11-6)과 강제 색상 쌍
    const fallback = dsCss.slice(dsCss.indexOf('@supports not (container-type: inline-size)'));
    expect(fallback).toMatch(/\.assets__row dd, \.final-net__value \{ font-size: var\(--fs-md\); \}/);
    expect(dsCss).toMatch(/@media \(forced-colors: active\) \{\s*\.choice\[data-unavailable='true'\][^}]*color: GrayText; border-color: GrayText;/);
    // 색 값을 직접 적지 않는다(토큰만) — M5 규칙 본문에 16진 색이 0
    for (const sel of ['.impact', '.impact__item', '.impact__item::before', '.impact__step--good', '.impact__step--bad', ".choice[data-unavailable='true']", '.choice-panel__hint', '.card--assets', '.assets__note', '.final-net', '.final-net__value', '.final-net__standing', '.final-net__none']) {
      expect(rule(sel), sel).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('시안 economy-m5.html(생성기 economyPage가 만든다, D-35): 상태 9개를 품고, 영향 줄·자산 카드·최종 순자산 줄이 구현 컴포넌트가 만든 마크업이며 copy.md와 같은 7항목·합쇼체 문장이다', () => {
    for (const state of ['choice', 'choice-young', 'impact-samples', 'assets', 'assets-past', 'assets-big', 'ending', 'ending-past', 'ending-early']) {
      expect(economyMockHtml, state).toContain(`id="s-${state}"`);
    }
    expect(economyMockHtml).not.toMatch(/줄어요|늘어요/);
    // 영향 줄은 구현 컴포넌트(ui/dash/Impact.tsx)의 마크업이다: 이름·기호는 aria-hidden, 문장은 sr-only, 데이터 속성 key·direction·steps
    expect(economyMockHtml).toContain('<span class="impact__show" aria-hidden="true"><span class="impact__name">자산</span><span class="impact__step impact__step--bad">▼▼▼</span></span>');
    expect(economyMockHtml).toContain('<span class="sr-only">자산이 크게 줄어듭니다.</span>');
    expect(economyMockHtml).not.toContain('data-impact=');
    // 기호 색은 톤 한 식으로: 부채만 ▲가 해로움(bad) — copy.md 4-8 impactTone과 같은 식(구현 impactTone 출력), 방향 클래스(--up/--down)는 쓰지 않는다 (r2, D-37)
    expect(economyMockHtml).toContain('<span class="impact__name">부채</span><span class="impact__step impact__step--bad">▲▲</span>');
    expect(economyMockHtml).toContain('<span class="impact__name">부채</span><span class="impact__step impact__step--good">▼▼</span>'); // 부채 ▼(초록) 견본
    expect(economyMockHtml).toContain('<span class="impact__name">관계</span><span class="impact__step impact__step--good">▲</span>');
    // 20세 미만 선택지에도 독립 때 확정되는 부채가 오면 「집안 살림 → 부채」 순서로 한 줄에 선다(M5 r4, R-351 (a)안 — copy.md 4-1·4-8)
    expect(economyMockHtml).toMatch(/<span class="impact" data-testid="impact"><span class="impact__item" data-key="family"[^]*?<\/span><span class="impact__item" data-key="debt" data-direction="up" data-steps="2">/);
    expect(economyMockHtml).not.toMatch(/impact__step--(up|down)\b/);
    expect(copyMd).toContain('**부채만 반대**');
    expect(copyMd).toContain("item.key === 'debt' ? (item.direction === 'up' ? 'bad' : 'good') : (item.direction === 'up' ? 'good' : 'bad')");
    for (const name of Object.values(NAME)) expect(economyMockHtml, name).toContain(`impact__name">${name}<`);
    // 문장 42개가 모두 견본 목록에 있다(구현 IMPACT_SR 그대로)
    for (const kind of Object.keys(NAME)) for (const dir of ['up', 'down'] as const) for (const n of [1, 2, 3] as const) expect(economyMockHtml, `${kind} ${dir} ${n}`).toContain(sentence(kind, dir, n));
    // 자산 카드·상태 도움말·안내 한 줄·최종 순자산 줄도 구현 출력이다
    expect(economyMockHtml).toContain('<section class="card card--assets" aria-labelledby="assets-title"');
    expect(economyMockHtml).toContain('<span class="tag" id="assets-basis"');
    expect(economyMockHtml).toContain('<dl class="assets" aria-describedby="assets-basis"');
    expect(economyMockHtml).toContain('>−1,200만 원<');
    expect(economyMockHtml).toContain('<summary>상태와 자산의 뜻 보기</summary>');
    expect(economyMockHtml).toContain('선택지 아래 글씨는 지금 이서연에게 일어날 변화입니다.');
    expect(economyMockHtml).toContain('스무 살이 되기 전이라 자산을 세지 않았습니다.');
    expect(economyMockHtml).toContain('같은 세상 안에서 <span class="nowrap">상위 약 38%</span>'); // 순위 표현은 줄바꿈 없는 묶음(KeepStanding)
    expect(economyMockHtml).toContain('>1억 2,345만 원<');
    expect(economyMockHtml).not.toContain('class="neg');
    // 시안 글자에 사용자 폴더 절대경로가 없다(repoHygiene와 같은 뜻)
    expect(economyMockHtml).not.toMatch(/[A-Za-z]:[\\/]Users[\\/]/);
  });

  it('다른 시안(decision-*·components·dashboard-*·note)도 M1 초안 영향 마크업(해요체 sr 문장·방향 색 클래스)·옛 상태 도움말 문장·옛 자산 카드(「올해 가치 기준」 태그·.neg)가 0이고, 영향 줄이 있는 곳은 구현 ImpactLine 출력이다 (r3, D-31·D-32·D-36)', () => {
    const mockups = import.meta.glob('../docs/design/mockups/*.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const names = Object.keys(mockups);
    expect(names.length).toBeGreaterThanOrEqual(13);
    let withImpact = 0;
    for (const [name, html] of Object.entries(mockups)) {
      expect(html, `${name}: 해요체 영향 문장`).not.toMatch(/줄어요|늘어요/);
      expect(html, `${name}: 방향 색 클래스`).not.toMatch(/class="(up|down)"|impact__step--(up|down)\b/);
      expect(html, `${name}: 옛 도움말 제목`).not.toContain('상태 네 가지의 뜻 보기');
      expect(html, `${name}: 옛 자산 카드`).not.toMatch(/class="neg|<span class="tag">올해 가치 기준<\/span>|마이너스는 빚이/);
      if (html.includes('class="impact"')) {
        withImpact++;
        // 구현 ImpactLine 출력의 꼴: 항목에 data-key·direction·steps, 보이는 글자는 aria-hidden, 문장은 sr-only
        expect(html, name).toMatch(/<span class="impact__item" data-key="[a-z]+" data-direction="(up|down)" data-steps="[123]"><span class="impact__show" aria-hidden="true">/);
        expect(html, name).toMatch(/<span class="sr-only">[가-힣 ]+(늘어납니다|줄어듭니다)\.<\/span>/);
      }
    }
    // economy-m5 · decision-adult · decision-infant · components 네 시안에 영향 줄이 있다(공허 통과 방지)
    expect(withImpact).toBeGreaterThanOrEqual(4);
    const dash = mockups[names.find((n) => n.endsWith('/dashboard-adult.html')) ?? ''] ?? '';
    expect(dash).toContain('<summary>상태와 자산의 뜻 보기</summary>');
    expect(dash).toContain('<section class="card card--assets" aria-labelledby="assets-title"');
  });
});
