// 심볼·워드마크 미리보기 (designer 작업 도구, SPEC-003 DS1·DS2). 실행: node scripts/design/previewBrand.mjs <출력.png>
// 확정안 A의 정식 심볼(512~24px)·단순화 심볼(120~16px)·다크 바탕·로고 파일(가로·헤더·세로·앱 아이콘·파비콘)을 한 장으로 본다.
import { chromium } from '@playwright/test';

const root = new URL('../../', import.meta.url).href;
const sym = await import(root + 'scripts/design/brandSymbols.mjs' + '?t=' + Date.now());
const geo = await import(root + 'scripts/design/brandGeometry.mjs' + '?t=' + Date.now());
const out = process.argv[2] || 'preview.png';

const svg = (d, fr, size, bg = '#f6f3ec', fg = '#26324a') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 528 528" width="${size}" height="${size}" style="background:${bg};margin:4px;border:1px solid #ccc"><path d="${d}" fill-rule="${fr}" fill="${fg}"/></svg>`;

let html = '<body style="margin:12px;font-family:sans-serif;background:#fff">';
for (const [k, o] of Object.entries(sym.OPTIONS)) {
  const full = o.fn({ small: false });
  const small = o.fn({ small: true });
  html += `<div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:8px"><b style="width:90px">${k} ${o.name}<br><small>정식 (지도/머리 ${full.metrics.mapToBowl.toFixed(2)})</small></b>`;
  html += svg(full.d, full.fillRule, 300) + svg(full.d, full.fillRule, 180) + svg(full.d, full.fillRule, 96) + svg(full.d, full.fillRule, 64) + svg(full.d, full.fillRule, 48) + svg(full.d, full.fillRule, 24);
  html += svg(full.d, full.fillRule, 120, '#14171f', '#e9e4d6');
  html += '</div>';
  html += `<div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:8px"><b style="width:90px">단순화<br><small>헤더·파비콘</small></b>`;
  html += svg(small.d, small.fillRule, 120) + svg(small.d, small.fillRule, 64) + svg(small.d, small.fillRule, 48) + svg(small.d, small.fillRule, 40) + svg(small.d, small.fillRule, 32) + svg(small.d, small.fillRule, 28) + svg(small.d, small.fillRule, 24) + svg(small.d, small.fillRule, 16);
  html += svg(small.d, small.fillRule, 40, '#14171f', '#e9e4d6') + svg(small.d, small.fillRule, 28, '#14171f', '#e9e4d6');
  html += '</div>';
}
// 워드마크
if (geo.GLYPHS) {
  const sw = geo.WORDMARK.strokeWidth ?? 10;
  const cells = geo.WORDMARK.cells;
  const chars = ['수', '저', '게', '임'];
  const g = chars.map((ch, i) => `<g transform="translate(${cells[i]} 0)">${geo.GLYPHS[ch].map((d) => (typeof d === 'string' ? `<path d="${d}"/>` : `<path d="${d.d}" stroke-width="${d.w}"/>`)).join('')}</g>`).join('');
  for (const h of [120, 56, 28, 22]) {
    html += `<div><svg viewBox="-6 -4 ${geo.WORDMARK.w + 12} 108" height="${h}" style="margin:6px;border:1px solid #ddd"><g fill="none" stroke="#26324a" stroke-width="${sw}" stroke-linecap="${geo.WORDMARK.linecap ?? 'butt'}" stroke-linejoin="${geo.WORDMARK.linejoin ?? 'miter'}">${g}</g></svg></div>`;
  }
}
// 만들어진 파일(로고·아이콘)도 함께 본다
const fs = await import('node:fs');
const assets = new URL(root + 'src/assets/');
const read = (rel) => { try { return fs.readFileSync(new URL(rel, assets), 'utf-8'); } catch { return ''; } };
const img = (rel, h, bg = '#f6f3ec', label = '') => { const t = read(rel); return t ? `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;background:${bg};padding:6px;margin:3px;border:1px solid #ddd;font-size:10px;color:#888">${t.replace('<svg ', `<svg height="${h}" `)}<span>${label || rel + ' ' + h}</span></span>` : ''; };
for (const k of Object.keys(sym.OPTIONS)) {
  html += `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:6px 0"><b style="width:30px">${k}</b>`;
  html += img(`logo-${k}.svg`, 108, '#f6f3ec', '가로(정식) 108') + img(`logo-${k}.svg`, 64, '#f6f3ec', '가로(정식) 64') + img(`brand/${k}/logo-header.svg`, 40, '#f6f3ec', '헤더 40') + img(`brand/${k}/logo-header.svg`, 32, '#f6f3ec', '헤더 32') + img(`brand/${k}/logo-header.svg`, 28, '#f6f3ec', '헤더 28') + img(`brand/${k}/logo-header-dark.svg`, 40, '#14171f', '헤더 다크 40');
  html += '</div><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:6px 0"><b style="width:30px"></b>';
  html += img(`brand/${k}/logo-stacked.svg`, 236, '#f6f3ec', '세로 236') + img(`brand/${k}/logo-dark.svg`, 44, '#14171f', '가로 다크 44') + img(`brand/${k}/app-icon.svg`, 96, '#fff', '앱 96') + img(`brand/${k}/app-icon.svg`, 48, '#fff', '앱 48') + img(`brand/${k}/favicon.svg`, 32, '#fff', '파비콘 32') + img(`brand/${k}/favicon.svg`, 16, '#fff', '파비콘 16') + img(`brand/${k}/symbol-mono.svg`, 60, '#fff', '단색 60') + img(`brand/${k}/symbol-small-mono.svg`, 32, '#fff', '단순화 단색 32');
  html += '</div>';
}
html += '</body>';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('saved', out);
