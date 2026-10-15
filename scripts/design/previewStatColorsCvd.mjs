/**
 * 상태 4색 색각 시뮬레이션 시트 (REV-003-D-4 R-195, designer).
 *   npx vite-node scripts/design/previewStatColorsCvd.mjs
 *   → docs/design/screens/003/status-colors-cvd.png
 * 라이트·다크 두 테마 × 네 줄(정상 · 제1색맹 protan · 제2색맹 deutan · 제3색맹 tritan, Machado 2009 심각도 1.0 — scripts/checkContrastLib.ts#simulateCvd).
 * 줄마다 상태 바 4개(이름·숫자 함께, 실제 트랙 위)와 견줄 토큰(수저 5색 solid · ▲ · ▼ · 링크 · 포커스)을 같은 시뮬레이션으로 바꿔 그린다.
 * 숫자는 tests/designAssets.test.ts가 단언하는 값(상태색끼리 ΔE2000, 시뮬레이션 최소 ΔE2000, 이웃 쌍 ΔL*)을 줄 아래에 적는다. 정적 HTML을 Playwright(DPR 2)로 찍는다.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deltaE2000, lightness, parseHex, readThemeBlocks, simulateCvd, themeTokens, toHex } from '../checkContrastLib.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/screens/003/';
mkdirSync(OUT, { recursive: true });

const blocks = readThemeBlocks(readFileSync(ROOT + 'src/styles/tokens.css', 'utf-8'));
const STATS = [
  ['--c-stat-health', '건강', 74],
  ['--c-stat-happy', '행복', 58],
  ['--c-stat-knowledge', '지식', 66],
  ['--c-stat-relation', '관계', 62],
];
const OTHERS = [
  ['--c-grade-1', '흙'], ['--c-grade-2', '동'], ['--c-grade-3', '은'], ['--c-grade-4', '금'], ['--c-grade-5', '다이아'],
  ['--c-up', '▲'], ['--c-down', '▼'], ['--c-link', '링크'], ['--c-focus', '포커스'],
];
const ROWS = [
  ['normal', '정상 색각'],
  ['protan', '제1색맹 (protan, L 원추 없음)'],
  ['deutan', '제2색맹 (deutan, M 원추 없음)'],
  ['tritan', '제3색맹 (tritan, S 원추 없음) — 참고'],
];
const sim = (hex, kind) => (kind === 'normal' ? hex : toHex(simulateCvd(parseHex(hex), kind)));

function themeBlock(theme) {
  const t = themeTokens(blocks, theme);
  const bg = t['--c-bg'];
  const surface = t['--c-surface'];
  const track = t['--c-meter-track'];
  const text = t['--c-text'];
  const text2 = t['--c-text-2'];
  const border = t['--c-border'];
  const rows = ROWS.map(([kind, label]) => {
    const colors = STATS.map(([k]) => sim(t[k], kind));
    // 이 줄에서의 최소 ΔE2000(상태색끼리)와 이웃 쌍 ΔL*
    let minDe = Infinity;
    let minPair = '';
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const d = deltaE2000(parseHex(colors[i]), parseHex(colors[j]));
      if (d < minDe) {
        minDe = d;
        minPair = `${STATS[i][1]}↔${STATS[j][1]}`;
      }
    }
    const L = colors.map((c) => lightness(parseHex(c)));
    const dl = (a, b) => Math.abs(L[a] - L[b]).toFixed(0);
    const bars = STATS.map(([, name, v], i) => `<div class="meter"><span class="lab">${name}</span><div class="track" style="background:${sim(track, kind)};border-color:${sim(t['--c-border-strong'], kind)}"><div class="fill" style="width:${v}%;background:${colors[i]}"></div></div><span class="val">${v}</span></div>`).join('');
    const sw = OTHERS.map(([k, name]) => `<span class="sw"><i style="background:${sim(t[k], kind)}"></i>${name}</span>`).join('');
    const note = kind === 'normal' ? `상태색끼리 최소 ΔE2000 ${minDe.toFixed(1)} (${minPair}) · 이웃 쌍 ΔL* 지식↔관계 ${dl(2, 3)}, 행복↔관계 ${dl(1, 3)}` : `시뮬레이션 안 상태색끼리 최소 ΔE2000 ${minDe.toFixed(1)} (${minPair})${kind === 'tritan' ? ' · 기준 없음(참고)' : ' · 기준 ≥ 8'}`;
    return `<section class="row" style="background:${sim(surface, kind)};border-color:${sim(border, kind)}"><h3 style="color:${sim(text, kind)}">${label}</h3><div class="meters" style="color:${sim(text, kind)}">${bars}</div><div class="others" style="color:${sim(text2, kind)}">${sw}</div><p class="note" style="color:${sim(text2, kind)}">${note}</p></section>`;
  }).join('');
  const hexes = STATS.map(([k, name]) => `${name} ${t[k]}`).join(' · ');
  return `<article class="theme" style="background:${bg};color:${text}"><h2>${theme === 'light' ? '라이트' : '다크'} — ${hexes}</h2>${rows}</article>`;
}

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>상태 4색 색각 시뮬레이션</title>
<style>
body{margin:0;padding:16px;background:#fff;color:#111;font:13px/1.45 system-ui,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif}
h1{font-size:17px;margin:0 0 4px}.lead{margin:0 0 14px;color:#444;max-width:1100px}
.wrap{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.theme{padding:14px;border-radius:12px}.theme h2{font-size:14px;margin:0 0 10px;font-weight:700}
.row{border:1px solid;border-radius:10px;padding:10px 12px;margin-bottom:10px}.row h3{font-size:13px;margin:0 0 8px}
.meters{display:grid;gap:7px}.meter{display:grid;grid-template-columns:2.4rem 1fr 2rem;align-items:center;gap:8px;font-size:13px}
.track{height:12px;border-radius:999px;border:1px solid;overflow:hidden}.fill{height:100%;border-radius:999px}.val{text-align:right;font-variant-numeric:tabular-nums}
.others{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:9px;font-size:12px}.sw{display:inline-flex;align-items:center;gap:5px}.sw i{width:16px;height:16px;border-radius:4px;display:inline-block}
.note{margin:8px 0 0;font-size:12px}
</style></head><body>
<h1>상태 4색 — 색각 이상 시뮬레이션 (REV-003-D-4 R-195)</h1>
<p class="lead">Machado·Oliveira·Fernandes (2009) 심각도 1.0 행렬(선형 sRGB)로 바꾼 색. 각 줄의 아래 견본은 같은 시뮬레이션을 거친 수저 5색·▲·▼·링크·포커스. 바에는 늘 이름·숫자가 함께 있다(색만으로 전하지 않는다). 테스트 기준: protan·deutan에서 상태색끼리 ΔE2000 ≥ 8, 정상에서 ≥ 12, 이웃 쌍 ΔL* ≥ 12.</p>
<div class="wrap">${themeBlock('light')}${themeBlock('dark')}</div>
</body></html>`;

const tmp = ROOT + 'docs/design/mockups/_status-colors-cvd.html';
writeFileSync(tmp, html, 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('file:///' + tmp.replace(/\\/g, '/'));
await page.waitForLoadState('load');
await page.waitForTimeout(120);
await page.screenshot({ path: OUT + 'status-colors-cvd.png', fullPage: true });
await browser.close();
unlinkSync(tmp);
console.log('saved docs/design/screens/003/status-colors-cvd.png');
