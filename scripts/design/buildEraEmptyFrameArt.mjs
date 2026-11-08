/**
 * SPEC-013 T3 빈 해 종이틀 시안(docs/design/mockups/era-empty-frame.html)이 쓰는 그림 자료를 **승인된 자산에서 그대로** 꺼내 한 파일로 모은다 → docs/design/mockups/era-empty-frame-art.js (designer 2026-11-08).
 * 실행: node scripts/design/buildEraEmptyFrameArt.mjs
 *   집 그림: family/dashboard-family.html의 .scene__house 안 SVG(종이 오림, 승인 자산) · 사람·소품 심볼: family/era-window-r9.html의 <defs> · 시대의 창 그림: src/data/eraWindows/d1980·d2020·d2030.ts의 art(승인 그림 셋 — 1988 올림픽 · 2023 장바구니 · 2035 돌봄).
 *   src/·tests/는 읽기만 한다. 외부 요청 0. 새 그림 0(이 시안의 대상은 틀과 캡션 자리뿐이다).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(ROOT + p, 'utf8');

// 집 그림(dashboard-family.html 첫 장면): <div class="scene__house"> 안의 <svg …>…</svg>만. aria 속성은 시안에서 다시 단다(카드가 넷이라 id 중복 금지).
const fam = read('docs/design/mockups/family/dashboard-family.html');
const h0 = fam.indexOf('<div class="scene__house">');
const h1 = fam.indexOf('</svg>', h0) + 6;
let house = fam.slice(fam.indexOf('<svg', h0), h1);
house = house.replace(/ role="img"| aria-labelledby="[^"]*"/g, '').replace('<svg', '<svg aria-hidden="true"');

// 사람·소품 심볼(era-window-r9.html 머리의 숨은 <svg><defs>…) — 시대의 창 그림의 <use>·fill="url(#…)"이 참조한다.
const r9 = read('docs/design/mockups/family/era-window-r9.html');
const d0 = r9.indexOf('<svg width="0"');
const defs = r9.slice(d0, r9.indexOf('</svg>', d0) + 6);

// 시대의 창 그림: TS 데이터의 art 사전에서 세 장(승인된 그림 그대로, 문자열 이스케이프만 푼다)
function art(file, id) {
  const s = read(`src/data/eraWindows/${file}`);
  const m = new RegExp(`'${id}': '((?:[^'\\\\]|\\\\.)*)'`).exec(s.slice(s.indexOf('art:')));
  if (m === null) throw new Error(`${file}에 ${id} 그림이 없다`);
  return m[1].replace(/\\(['\\])/g, '$1');
}
const pieces = {
  stadium: art('d1980.ts', 'era-1988-stadium-flame-r3'),
  grocery: art('d2020.ts', 'era-2023-grocery-scale'),
  care: art('d2030.ts', 'era-2030s-care-intake-empty-chairs'),
};
const out = `/* 생성 파일 — node scripts/design/buildEraEmptyFrameArt.mjs. 승인 자산에서 꺼낸 그림(집 1 · 시대의 창 3 · 심볼 defs). 손으로 고치지 않는다. */\nwindow.EF_ART = ${JSON.stringify({ house, defs, pieces })};\n`;
writeFileSync(ROOT + 'docs/design/mockups/era-empty-frame-art.js', out);
console.log('house', house.length, 'defs', defs.length, Object.fromEntries(Object.entries(pieces).map(([k, v]) => [k, v.length])));
