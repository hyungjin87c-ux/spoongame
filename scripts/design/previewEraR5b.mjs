/**
 * 시대의 창 r5b — 작업 중 미리보기(designer). 장면을 350×280·175×140·100×80으로, 다시 그린 장면은 r5(전)를 왼쪽에 함께 찍어 .taste-skill/009/era-r5b-preview/ 에 둔다(저장소에 올리지 않는다).
 * 실행: node scripts/design/previewEraR5b.mjs [id 조각…]   ← 인자 없으면 전부. 브라우저는 이 스크립트가 띄우고 닫는다(자기 것만).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, ERA_DEFS_R5, FIG_DEFS, LIGHT, decadeOf, toneLayer, toneCssA, tokenCss, toClass } from './eraR5bLib.mjs';
import { S5B } from './eraR5bScenes.mjs';
import { SCENES as R5 } from './eraR5Scenes.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + '.taste-skill/009/era-r5b-preview/';
mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2);
const list = want.length ? S5B.filter((q) => want.some((w) => q.id.includes(w))) : S5B;
const vars = Object.entries(LIGHT).map(([k, v]) => `--c-scene-${k}:${v}`).join(';');
const svg = (q) => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice">${toClass(q.draw() + toneLayer('a', q.year))}</svg>`;
const cell = (q, w, h) => `<div class="p" data-dec="${decadeOf(q.year)}" style="width:${w}px;height:${h}px">${svg(q)}</div>`;
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><style>:root{${vars}} body{margin:0;padding:12px;background:#f6f3ec;font:13px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d} .row{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px} .p{overflow:hidden;background:#dfe6ed;flex:none} .p svg{display:block;width:100%;height:100%} figcaption{max-width:300px} .before{opacity:.92} ${toneCssA('body')}
${tokenCss()}</style><body>
<svg width="0" height="0" style="position:absolute"><defs>${ERA_DEFS_R3}${FIG_DEFS}${ERA_DEFS_R5}</defs></svg>
${list.map((q) => { const b = R5.find((x) => x.id === q.id); return `<figure class="row" id="${q.id}">${b ? `<div class="before">${cell(b, 175, 140)}</div>` : ''}${cell(q, 350, 280)}${cell(q, 175, 140)}${cell(q, 100, 80)}<figcaption><b>${q.year} ${q.name}</b>${q.band ? ` · 수저 ${q.band}` : ''}${q.heavy ? ' · ○' : ''}${b ? ' · 왼쪽 = r5(전)' : ' · 새 장면'}<br>${q.draws}</figcaption></figure>`; }).join('\n')}
</body></html>`;
writeFileSync(OUT + 'preview.html', html, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 1 });
await page.goto('file:///' + (OUT + 'preview.html').replace(/\\/g, '/'));
await page.waitForTimeout(150);
for (const q of list) await page.locator(`#${q.id}`).screenshot({ path: `${OUT}${q.id}.png` });
await browser.close();
console.log(list.map((q) => q.id).join('\n'));
