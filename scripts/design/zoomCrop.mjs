/**
 * (작업용) PNG의 일부를 nearest-neighbor(픽셀 그대로)로 확대해 저장한다 — 작은 아이콘·얼굴의 실제 픽셀을 눈으로 볼 때.
 *   node scripts/design/zoomCrop.mjs <in.png> <x> <y> <w> <h> <배율> <out.png>
 * 시안·테스트에는 쓰지 않는다. 새 의존성 없음(@playwright/test는 이미 개발 의존성).
 */
import { chromium } from '@playwright/test';
import { unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , input, x, y, w, h, scale, out] = process.argv;
if (!out) {
  console.error('사용법: node scripts/design/zoomCrop.mjs <in.png> <x> <y> <w> <h> <배율> <out.png>');
  process.exit(2);
}
const s = Number(scale);
const W = Math.round(Number(w) * s);
const H = Math.round(Number(h) * s);
// about:blank(setContent)에서는 file:// 이미지를 읽지 못하므로, 출력 파일 옆에 임시 HTML을 두고 file://로 연다
const src = 'file:///' + resolve(input).replace(/\\/g, '/');
const tmp = resolve(out) + '.tmp.html';
writeFileSync(
  tmp,
  `<!doctype html><body style="margin:0;background:#fff"><div style="width:${W}px;height:${H}px;overflow:hidden;position:relative"><img src="${src}" style="position:absolute;left:${-Number(x) * s}px;top:${-Number(y) * s}px;image-rendering:pixelated;transform-origin:0 0;transform:scale(${s})"></div></body>`,
  'utf-8',
);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
await page.goto('file:///' + tmp.replace(/\\/g, '/'));
await page.waitForLoadState('load');
await page.waitForTimeout(200);
await page.screenshot({ path: out });
await browser.close();
unlinkSync(tmp);
console.log('saved', out);
