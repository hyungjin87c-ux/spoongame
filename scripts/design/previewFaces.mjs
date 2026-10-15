/**
 * (작업용) 얼굴을 실제 크기(48·72·96px)로 한 장에 모아 찍는다 — 작은 크기에서의 오독(헤드셋·모자 등)을 눈으로 확인할 때.
 *   npx vite-node scripts/design/previewFaces.mjs [출력.png]   (기본: docs/design/screens/003/faces-small-sizes.png, DPR 1)
 * 시안·테스트에는 쓰지 않는다. 얼굴 함수는 src/assets/faces/faceLayers.ts 그대로.
 */
import { chromium } from '@playwright/test';
import { unlinkSync, writeFileSync } from 'node:fs';
import { AGE_GROUPS, faceSvg } from '../../src/assets/faces/faceLayers.ts';
import { ROOT } from './mockLib.mjs';

const out = process.argv[2] ?? ROOT + 'docs/design/screens/003/faces-small-sizes.png';
const SIZES = [48, 72, 96];
const TIERS = [1, 3, 5];
const ROWS = [];
for (const ag of AGE_GROUPS) for (const g of ['male', 'female']) ROWS.push([ag.id, g, `${ag.label} ${g === 'male' ? '남' : '여'}`]);

const cell = (ageGroup, gender, tier, size) => `<span class="f" style="width:${size}px;height:${size}px">${faceSvg({ ageGroup, gender, tier })}</span>`;
const rows = ROWS.map(
  ([ag, g, label]) =>
    `<tr><th>${label}</th>${SIZES.map((s) => `<td>${TIERS.map((t) => cell(ag, g, t, s)).join('')}</td>`).join('')}</tr>`,
).join('');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="../../src/styles/tokens.css">
<style>body{margin:16px;background:var(--c-bg);color:var(--c-text);font:12px system-ui}table{border-collapse:collapse}th{text-align:left;padding:4px 10px 4px 0;font-weight:700;white-space:nowrap}td{padding:4px 12px 4px 0;vertical-align:middle}
.f{display:inline-block;margin-right:6px;border-radius:8px;overflow:hidden;border:1px solid var(--c-border-strong);background:var(--c-face-bg);vertical-align:middle}.f svg{display:block;width:100%;height:100%}
caption{text-align:left;padding-bottom:8px;font-weight:700}</style></head><body>
<table><caption>얼굴 실제 크기 시트 (DPR 1) — 각 칸: 외모 1·3·5단계 / 열: ${SIZES.join('·')}px</caption><thead><tr><th></th>${SIZES.map((s) => `<th>${s}px</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
const file = ROOT + 'docs/design/mockups/_faces-sizes.html';
writeFileSync(file, html, 'utf-8');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 1200 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('file:///' + file.replace(/\\/g, '/'));
await page.waitForTimeout(100);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
unlinkSync(file); // 임시 HTML은 남기지 않는다
console.log('saved', out);
