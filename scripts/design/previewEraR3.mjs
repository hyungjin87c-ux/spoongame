/**
 * 시대의 창 r3 — 작업 중 미리보기(designer). 장면을 350×280(2배)과 175×140·100×80으로 찍어 .taste-skill/009/era-r3-preview/ 에 둔다(저장소에 올리지 않는다).
 * 실행: node scripts/design/previewEraR3.mjs [id 조각…]   ← 인자 없으면 전부. 브라우저는 이 스크립트가 띄우고 닫는다.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3 as ERA_DEFS, LIGHT, decadeOf, toneLayer, toneCssA } from './eraR3Lib.mjs';
import { SCENES } from './eraR3Scenes.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + '.taste-skill/009/era-r3-preview/';
mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2);
const list = want.length ? SCENES.filter((q) => want.some((w) => q.id.includes(w))) : SCENES;
const vars = Object.entries(LIGHT).map(([k, v]) => `--c-scene-${k}:${v}`).join(';');
const svg = (q) => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice">${q.draw()}${toneLayer('a', q.year)}</svg>`;
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><style>:root{${vars}} body{margin:0;padding:12px;background:#f6f3ec;font:13px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d} .row{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px} .p{overflow:hidden;background:#dfe6ed;flex:none} .p svg{display:block;width:100%;height:100%} figcaption{max-width:360px} ${toneCssA('body')}</style><body>
${list.map((q) => `<figure class="row" data-tone="a" id="${q.id}"><div class="p" data-dec="${decadeOf(q.year)}" style="width:350px;height:280px">${svg(q)}</div><div class="p" data-dec="${decadeOf(q.year)}" style="width:175px;height:140px">${svg(q)}</div><div class="p" data-dec="${decadeOf(q.year)}" style="width:100px;height:80px">${svg(q)}</div><figcaption><b>${q.year} ${q.name}</b><br>${q.draws}</figcaption></figure>`).join('\n')}
<svg width="0" height="0" style="position:absolute"><defs>${ERA_DEFS}</defs></svg></body></html>`;
writeFileSync(OUT + 'preview.html', html, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 400 }, deviceScaleFactor: 1 });
await page.goto('file:///' + (OUT + 'preview.html').replace(/\\/g, '/'));
await page.waitForTimeout(150);
for (const q of list) await page.locator(`#${q.id}`).screenshot({ path: `${OUT}${q.id}.png` });
await browser.close();
console.log(list.map((q) => q.id).join('\n'));
