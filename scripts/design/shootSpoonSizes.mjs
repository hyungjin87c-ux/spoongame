/**
 * 수저 5단계 아이콘 실제 크기 시트 (REV-003-D-2 R-121 완료 근거, designer).
 *   npx vite-node scripts/design/buildMockups.mjs && npx vite-node scripts/design/shootSpoonSizes.mjs
 *   → docs/design/screens/003/spoon-sizes-dpr1.png
 * deviceScaleFactor 1 로 docs/design/mockups/spoon-sizes.html 을 밝은·다크·강제 색상·단색 네 가지로 찍고(각각 *-light/-dark/-forced/-mono.png),
 * 한 장에 「실제 픽셀 크기 그대로(왼쪽)」 + 「4배 nearest-neighbor 확대(오른쪽, image-rendering: pixelated)」 로 모은다. 확대본은 참고이고, 판단은 왼쪽 원본으로 한다.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MOCK = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/';
const OUT = ROOT + 'docs/design/screens/003/';
mkdirSync(OUT, { recursive: true });

const THEMES = [
  { id: 'light', label: '밝은 테마', query: '', ctx: {} },
  { id: 'dark', label: '다크 테마', query: '?theme=dark', ctx: { colorScheme: 'dark' } },
  { id: 'forced', label: '강제 색상(고대비 — 칩도 CanvasText로 채운 실루엣, R-190)', query: '', ctx: { forcedColors: 'active' } },
  { id: 'mono', label: '단색(인쇄, 검정 한 가지 — 칩도 채운 실루엣)', query: '?mono=1', ctx: {} },
];

const browser = await chromium.launch();
const strips = [];
for (const t of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 760, height: 600 }, deviceScaleFactor: 1, ...t.ctx });
  const page = await ctx.newPage();
  await page.goto(MOCK + 'spoon-sizes.html' + t.query);
  await page.waitForLoadState('load');
  await page.waitForTimeout(80);
  const box = await page.locator('.sheet').boundingBox();
  const path = `${OUT}spoon-sizes-dpr1-${t.id}.png`;
  await page.screenshot({ path, clip: { x: 0, y: 0, width: Math.ceil(box.x + box.width + 4), height: Math.ceil(box.y + box.height + 4) } });
  strips.push({ ...t, path, w: Math.ceil(box.x + box.width + 4), h: Math.ceil(box.y + box.height + 4) });
  await ctx.close();
  console.log('saved', path.replace(ROOT, ''));
}

// 합본: 원본(1×) + 4배 확대(nearest-neighbor)
const row = (s) => `<section><h2>${s.label} — 왼쪽 실제 크기(DPR 1), 오른쪽 4배 확대(픽셀 그대로)</h2>
  <div class="pair"><img src="${'file:///' + s.path.replace(/\\/g, '/')}" width="${s.w}" height="${s.h}" alt=""><img class="zoom" src="${'file:///' + s.path.replace(/\\/g, '/')}" width="${s.w * 4}" height="${s.h * 4}" alt=""></div></section>`;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>수저 아이콘 실제 크기 시트 (DPR 1)</title>
<style>body{margin:0;padding:16px;background:#fff;color:#111;font:13px/1.4 system-ui,sans-serif}h1{font-size:16px;margin:0 0 4px}p{margin:0 0 12px;color:#444}h2{font-size:13px;margin:14px 0 6px;font-weight:700}
.pair{display:flex;align-items:flex-start;gap:16px}img{display:block;border:1px solid #bbb}img.zoom{image-rendering:pixelated;image-rendering:crisp-edges}</style></head><body>
<h1>수저 5단계 아이콘 — 실제 픽셀 크기 시트 (deviceScaleFactor 1)</h1>
<p>16·20·24px = 칩 변형 <code>sp-N</code>(무늬 없는 실루엣 — 실제 칩과 같은 <code>.grade svg.spoon</code> CSS 경로로 그렸다) · 32·48px = 큰 변형 <code>sp-N-lg</code>(닫힌 채움 표식, 은·금은 밝은 채움) + 참고 실루엣 · 마지막 두 줄 = 실제 칩 24px·큰 칩 32px(아이콘 + 이름 + 점). REV-003-D-2 R-121·REV-003-D-3 R-190의 완료 근거. 판단 기준은 왼쪽 원본.</p>
${strips.map(row).join('\n')}
</body></html>`;
const compositeFile = ROOT + 'docs/design/mockups/_spoon-sizes-composite.html';
writeFileSync(compositeFile, html, 'utf-8');
const ctx = await browser.newContext({ viewport: { width: 40 + Math.max(...strips.map((s) => s.w * 5 + 16)), height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('file:///' + compositeFile.replace(/\\/g, '/'));
await page.waitForLoadState('load');
await page.waitForTimeout(150);
await page.screenshot({ path: OUT + 'spoon-sizes-dpr1.png', fullPage: true });
await ctx.close();
await browser.close();
unlinkSync(compositeFile); // 합본용 임시 HTML(절대 경로 포함)은 저장소에 남기지 않는다
console.log('saved docs/design/screens/003/spoon-sizes-dpr1.png');
