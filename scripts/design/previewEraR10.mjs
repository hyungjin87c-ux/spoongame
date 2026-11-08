/**
 * 시대의 창 r10(SPEC-013 T5) — 작업 중 미리보기(designer). 장면을 350×280·175×140·100×80으로, 수정 장면은 전 그림을 왼쪽에 함께 찍어 .taste-skill/013/era-r10-preview/ 에 둔다(저장소에 올리지 않는다).
 * 실행: node scripts/design/previewEraR10.mjs [id 조각…]   ← 인자 없으면 전부. 브라우저는 이 스크립트가 띄우고 닫는다(자기 것만).
 */
import { chromium } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, ERA_DEFS_R5, FIG_DEFS, LIGHT, decadeOf, toneLayer, toneCssA, tokenCss, toClass } from './eraR5bLib.mjs';
import { ALL16 } from './eraR10Scenes.mjs';
import { HEAVY as R3H } from './eraR3ScenesHeavy.mjs';
import { S50 } from './eraR4Scenes50.mjs';
import { S60 } from './eraR4Scenes60.mjs';
import { S20 } from './eraR5Scenes20.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + '.taste-skill/013/era-r10-preview/';
mkdirSync(OUT, { recursive: true });
const BEFORE = [...R3H, ...S50, ...S60, ...S20];
const want = process.argv.slice(2);
const list = want.length ? ALL16.filter((q) => want.some((w) => q.id.includes(w))) : ALL16;
const vars = Object.entries(LIGHT).map(([k, v]) => `--c-scene-${k}:${v}`).join(';');
const inner = (q) => toClass(q.draw() + toneLayer('a', q.year));
const svg = (q) => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice">${inner(q)}</svg>`;
const cell = (q, w, h) => `<div class="p" data-dec="${decadeOf(q.year)}" style="width:${w}px;height:${h}px">${svg(q)}</div>`;
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><style>:root{${vars}} body{margin:0;padding:12px;background:#f6f3ec;font:13px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d} .row{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px} .p{overflow:hidden;background:#dfe6ed;flex:none} .p svg{display:block;width:100%;height:100%} figcaption{max-width:300px} .before{opacity:.92} ${toneCssA('body')}
${tokenCss()}</style><body>
<svg width="0" height="0" style="position:absolute"><defs>${ERA_DEFS_R3}${FIG_DEFS}${ERA_DEFS_R5}</defs></svg>
${list.map((q) => { const b = q.revise ? BEFORE.find((x) => x.id === q.revise) : null; return `<figure class="row" id="${q.id}">${b ? `<div class="before">${cell(b, 175, 140)}</div>` : ''}${cell(q, 350, 280)}${cell(q, 175, 140)}${cell(q, 100, 80)}<figcaption><b>${q.year} ${q.name}</b> · gz ${gz(inner(q))}B${q.heavy ? ' · ○' : ''}${b ? ' · 왼쪽 = 전' : ' · 새'}<br>${q.caption} — ${q.line}</figcaption></figure>`; }).join('\n')}
</body></html>`;
writeFileSync(OUT + 'preview.html', html, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 1 });
await page.goto('file:///' + (OUT + 'preview.html').replace(/\\/g, '/'));
await page.waitForTimeout(200);
for (const q of list) await page.locator(`#${q.id}`).screenshot({ path: `${OUT}${q.id}.png` });
await browser.close();
for (const q of list) console.log(`${q.year} ${q.id} gz ${gz(inner(q))}B${q.heavy ? ' ○(≤3500)' : ' (≤2500)'}`);
